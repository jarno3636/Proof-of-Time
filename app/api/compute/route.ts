// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Alchemy, Network } from "alchemy-sdk";
import { createPublicClient, http, hexToString } from "viem";
import { base } from "viem/chains";
import { erc20Abi } from "viem";

import type { Balance, HexAddr, PerTokenStats, Transfer } from "@/lib/types";
import { computePerTokenStats } from "@/lib/proofOfTime";
import {
  fetchBalancesBase,
  fetchTransfersViaEtherscan,
  fetchTransfersBase,
  fetchPriceUSDMap,
} from "@/lib/data";

/* ───────────────── runtime ───────────────── */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ───────────────── config ───────────────── */
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const META_TIMEOUT = 6_000;
const UPSTREAM_TIMEOUT = 15_000;
const MAX_TOKENS_PER_RUN = 80;

/* ───────────────── RPC fallbacks ───────────────── */
const RPCS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://1rpc.io/base",
];

const viemClients = RPCS.map((url) =>
  createPublicClient({
    chain: base,
    transport: http(url, { timeout: UPSTREAM_TIMEOUT, retryCount: 2 }),
  })
);

/* ───────────────── helpers ───────────────── */

const isHex = (s: string): s is HexAddr => /^0x[a-fA-F0-9]{40}$/.test(s);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), ms)
    ),
  ]);
}

function fallbackSymbol(token: string) {
  return token.slice(2, 6).toUpperCase();
}

// If symbol looks like our deterministic fallback (4 hex chars), treat it as low-confidence.
function looksLikeFallback(sym: string, token: string) {
  return sym.toUpperCase() === fallbackSymbol(token);
}

function normalizeSymbol(symbol: unknown, token: string): string {
  if (typeof symbol === "string") {
    const s = symbol.trim();
    if (s && s.toUpperCase() !== "TKN") return s;
  }
  return fallbackSymbol(token);
}

const bytes32SymbolAbi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

async function readSymbolOnchain(
  token: HexAddr
): Promise<string | null> {
  for (const client of viemClients) {
    // 1) standard string symbol()
    try {
      const sym = await withTimeout(
        client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "symbol",
        }) as Promise<string>,
        META_TIMEOUT
      );
      const cleaned = typeof sym === "string" ? sym.trim() : "";
      if (cleaned && cleaned.toUpperCase() !== "TKN") return cleaned;
    } catch {
      // continue
    }

    // 2) bytes32 symbol() (common non-standard tokens)
    try {
      const sym32 = await withTimeout(
        client.readContract({
          address: token,
          abi: bytes32SymbolAbi,
          functionName: "symbol",
        }) as Promise<`0x${string}`>,
        META_TIMEOUT
      );

      const decoded = hexToString(sym32, { size: 32 }).replace(/\0/g, "").trim();
      if (decoded && decoded.toUpperCase() !== "TKN") return decoded;
    } catch {
      // continue
    }
  }
  return null;
}

/* ───────────────── metadata resolution ───────────────── */

type TokenCacheRow = {
  symbol: string | null;
  decimals: number | null;
  source: string | null;
  updated_at: string | null;
};

async function resolveTokenMeta(
  supabase: SupabaseClient,
  alchemy: Alchemy | null,
  token: HexAddr
): Promise<{ symbol: string; decimals: number }> {
  const tokenKey = token.toLowerCase();

  // 1) cache (but ignore low-confidence cached fallbacks so we can improve later)
  try {
    const { data } = await supabase
      .from("token_cache")
      .select("symbol, decimals, source, updated_at")
      .eq("token_address", tokenKey)
      .maybeSingle<TokenCacheRow>();

    if (data?.symbol && data.decimals != null) {
      const sym = normalizeSymbol(data.symbol, token);

      // If cache is fallback-ish, treat as miss and try to re-resolve.
      // This is the main reason you were stuck with $B8D9 etc.
      if (!looksLikeFallback(sym, token) || (data.source && data.source !== "fallback")) {
        return { symbol: sym, decimals: Number(data.decimals) || 18 };
      }
      // else: continue to try to improve symbol
    }
  } catch {
    // ignore cache read errors
  }

  // 2) Alchemy metadata
  if (alchemy) {
    try {
      const meta = await withTimeout(alchemy.core.getTokenMetadata(token), META_TIMEOUT);
      const symbol = normalizeSymbol((meta as any)?.symbol, token);
      const decimals =
        typeof (meta as any)?.decimals === "number" ? (meta as any).decimals : 18;

      // Only cache Alchemy if it’s not a fallback-ish symbol
      if (!looksLikeFallback(symbol, token)) {
        try {
          await supabase.from("token_cache").upsert({
            token_address: tokenKey,
            symbol,
            decimals,
            source: "alchemy",
            updated_at: new Date().toISOString(),
          });
        } catch {}
        return { symbol, decimals };
      }
      // If alchemy gives nothing useful, keep going
    } catch {
      // continue
    }
  }

  // 3) On-chain symbol/decimals
  let onchainSymbol: string | null = null;
  try {
    onchainSymbol = await readSymbolOnchain(token);
  } catch {
    onchainSymbol = null;
  }

  // decimals: try on-chain (string path already in your earlier code; keep it simple)
  let decimals = 18;
  for (const client of viemClients) {
    try {
      const dec = await withTimeout(
        client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "decimals",
        }) as Promise<number | bigint>,
        META_TIMEOUT
      );
      decimals = typeof dec === "bigint" ? Number(dec) : typeof dec === "number" ? dec : 18;
      break;
    } catch {}
  }

  if (onchainSymbol) {
    const symbol = normalizeSymbol(onchainSymbol, token);
    try {
      await supabase.from("token_cache").upsert({
        token_address: tokenKey,
        symbol,
        decimals,
        source: "onchain",
        updated_at: new Date().toISOString(),
      });
    } catch {}
    return { symbol, decimals };
  }

  // 4) deterministic fallback (cache it, but marked fallback)
  const fallback = fallbackSymbol(token);
  try {
    await supabase.from("token_cache").upsert({
      token_address: tokenKey,
      symbol: fallback,
      decimals,
      source: "fallback",
      updated_at: new Date().toISOString(),
    });
  } catch {}

  return { symbol: fallback, decimals };
}

/* ───────────────── balances ───────────────── */

async function fetchBalances(
  alchemy: Alchemy | null,
  address: HexAddr
): Promise<{ balances: Balance[]; source: "alchemy" | "base_backup" }> {
  if (alchemy) {
    try {
      const res = await withTimeout(alchemy.core.getTokenBalances(address), UPSTREAM_TIMEOUT);

      const list: any[] = Array.isArray((res as any)?.tokenBalances)
        ? (res as any).tokenBalances
        : [];

      const balances: Balance[] = list
        .filter(
          (t: any) =>
            t?.contractAddress &&
            typeof t.tokenBalance === "string" &&
            t.tokenBalance !== "0"
        )
        .map((t: any): Balance => ({
          token: String(t.contractAddress).toLowerCase() as HexAddr,
          raw: BigInt(t.tokenBalance),
          symbol: "TKN",
          decimals: 18,
        }))
        .filter((b: Balance) => b.raw !== 0n);

      return { balances, source: "alchemy" };
    } catch {
      // fallthrough
    }
  }

  return { balances: await fetchBalancesBase(address), source: "base_backup" };
}

/* ───────────────── POST ───────────────── */

export async function POST(req: NextRequest) {
  const started = Date.now();

  const body = await req.json().catch(() => ({}));
  const raw = String((body as any)?.address || "").trim();
  if (!isHex(raw)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const address = raw.toLowerCase() as HexAddr;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Server misconfigured (Supabase env missing)" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const alchemy =
    ALCHEMY_KEY && ALCHEMY_KEY.trim().length
      ? new Alchemy({ apiKey: ALCHEMY_KEY, network: Network.BASE_MAINNET })
      : null;

  // balances
  let { balances, source: sourceBalances } = await fetchBalances(alchemy, address);
  if (balances.length > MAX_TOKENS_PER_RUN) balances = balances.slice(0, MAX_TOKENS_PER_RUN);

  if (!balances.length) {
    return NextResponse.json({
      address,
      count: 0,
      note: "No ERC-20 balances detected on Base.",
      meta: { sourceBalances, elapsedMs: Date.now() - started },
    });
  }

  // metadata resolve (cached)
  for (const b of balances) {
    const meta = await resolveTokenMeta(supabase, alchemy, b.token);
    b.symbol = meta.symbol;
    b.decimals = meta.decimals;
  }

  // transfers (IMPORTANT: [] is truthy, so don't use ||)
  let transfers: Transfer[] = [];
  try {
    transfers = await fetchTransfersViaEtherscan(address).catch(() => []);
    if (!transfers.length) {
      transfers = await fetchTransfersBase(address).catch(() => []);
    }
  } catch {
    transfers = [];
  }

  // prices
  const priceMap: Record<string, number> = await fetchPriceUSDMap(
    balances.map((b) => b.token)
  ).catch(() => ({} as Record<string, number>));

  // compute
  const stats: PerTokenStats[] = [];
  for (const b of balances) {
    const price = priceMap[b.token.toLowerCase()];
    const s = computePerTokenStats(address, b.token, transfers, b, price);
    if (s) {
      s.symbol = normalizeSymbol(s.symbol, s.token_address);
      stats.push(s);
    }
  }

  // persist (avoid duplicate keys / overwrites)
  try {
    if (stats.length) {
      await supabase.from("token_holdings").upsert(
        stats.map((s) => ({
          address,
          token_address: s.token_address.toLowerCase(),
          symbol: s.symbol,
          decimals: s.decimals,
          first_acquired_ts: s.first_acquired_ts,
          last_full_exit_ts: s.last_full_exit_ts,
          last_sell_ts: s.last_sell_ts,
          held_since: s.held_since,
          continuous_hold_days: s.continuous_hold_days,
          no_sell_streak_days: s.no_sell_streak_days,
          never_sold: s.never_sold,
          balance_numeric: s.balance_numeric,
          time_score: s.time_score,
          last_computed_at: new Date().toISOString(),
        })),
        { onConflict: "address,token_address" }
      );
    }
  } catch {
    // non-fatal
  }

  return NextResponse.json({
    address,
    count: stats.length,
    meta: {
      sourceBalances,
      elapsedMs: Date.now() - started,
    },
  });
}
