// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Alchemy, Network } from "alchemy-sdk";
import { createPublicClient, http } from "viem";
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

// RPC fallbacks for on-chain metadata reads
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

function normalizeSymbol(symbol: string | null | undefined, token: string) {
  // Never return literal "TKN"
  if (!symbol || symbol === "TKN") return token.slice(2, 6).toUpperCase();
  return symbol;
}

/* ───────────────── metadata resolution ───────────────── */
/**
 * Resolve token metadata with:
 * 1) token_cache
 * 2) Alchemy metadata
 * 3) on-chain symbol()/decimals()
 * 4) deterministic fallback
 */
async function resolveTokenMeta(
  supabase: any,
  alchemy: Alchemy | null,
  token: HexAddr
): Promise<{ symbol: string; decimals: number }> {
  const tokenKey = token.toLowerCase();

  // 1) cache
  try {
    const { data: cached } = await supabase
      .from("token_cache")
      .select("symbol, decimals")
      .eq("token_address", tokenKey)
      .maybeSingle();

    if (cached?.symbol && cached?.decimals != null) {
      return {
        symbol: normalizeSymbol(cached.symbol, token),
        decimals: Number(cached.decimals) || 18,
      };
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

      try {
        await supabase.from("token_cache").upsert({
          token_address: tokenKey,
          symbol,
          decimals,
          source: "alchemy",
          updated_at: new Date().toISOString(),
        });
      } catch {
        // ignore cache write errors
      }

      return { symbol, decimals };
    } catch {
      // continue
    }
  }

  // 3) on-chain fallback
  for (const client of viemClients) {
    try {
      const [sym, dec] = await Promise.all([
        withTimeout(
          client.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "symbol",
          } as any) as Promise<string>,
          META_TIMEOUT
        ).catch(() => null),
        withTimeout(
          client.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "decimals",
          } as any) as Promise<number | bigint>,
          META_TIMEOUT
        ).catch(() => null),
      ]);

      const symbol = normalizeSymbol(typeof sym === "string" ? sym : null, token);
      const decimals =
        typeof dec === "bigint" ? Number(dec) : typeof dec === "number" ? dec : 18;

      try {
        await supabase.from("token_cache").upsert({
          token_address: tokenKey,
          symbol,
          decimals,
          source: "onchain",
          updated_at: new Date().toISOString(),
        });
      } catch {
        // ignore cache write errors
      }

      return { symbol, decimals };
    } catch {
      // try next rpc
    }
  }

  // 4) deterministic fallback
  const fallback = token.slice(2, 6).toUpperCase();

  try {
    await supabase.from("token_cache").upsert({
      token_address: tokenKey,
      symbol: fallback,
      decimals: 18,
      source: "fallback",
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }

  return { symbol: fallback, decimals: 18 };
}

/* ───────────────── balances ───────────────── */

async function fetchBalances(
  alchemy: Alchemy | null,
  address: HexAddr
): Promise<{ balances: Balance[]; source: "alchemy" | "base_backup" }> {
  if (alchemy) {
    try {
      const res = await withTimeout(alchemy.core.getTokenBalances(address), UPSTREAM_TIMEOUT);

      const list = Array.isArray((res as any)?.tokenBalances) ? (res as any).tokenBalances : [];

      const balances: Balance[] = list
        .filter((t: any) => t?.contractAddress && t?.tokenBalance && t.tokenBalance !== "0")
        .map((t: any) => {
          // ✅ FIX: tokenBalance can be string | null → sanitize before BigInt
          const balStr =
            typeof t.tokenBalance === "string" && t.tokenBalance !== "0" ? t.tokenBalance : "0";

          return {
            token: String(t.contractAddress).toLowerCase() as HexAddr,
            raw: BigInt(balStr),
            symbol: "TKN",
            decimals: 18,
          };
        })
        .filter((b) => b.raw !== 0n);

      return { balances, source: "alchemy" };
    } catch {
      // fall through to backup
    }
  }

  const balances = await fetchBalancesBase(address);
  return { balances, source: "base_backup" };
}

/* ───────────────── POST ───────────────── */

export async function POST(req: NextRequest) {
  const started = Date.now();

  const body = await req.json().catch(() => ({}));
  const rawAddr = String(body?.address || "").trim();
  if (!isHex(rawAddr)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const address = rawAddr.toLowerCase() as HexAddr;

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

  // optional: prove alchemy key works (non-fatal)
  let alchemyPingOk = false;
  if (alchemy) {
    try {
      await withTimeout(alchemy.core.getBlockNumber(), 5_000);
      alchemyPingOk = true;
    } catch {
      alchemyPingOk = false;
    }
  }

  // balances
  let { balances, source: sourceBalances } = await fetchBalances(alchemyPingOk ? alchemy : null, address);
  if (balances.length > MAX_TOKENS_PER_RUN) balances = balances.slice(0, MAX_TOKENS_PER_RUN);

  if (!balances.length) {
    return NextResponse.json({
      address,
      count: 0,
      note: "No ERC-20 balances detected on Base.",
      meta: {
        sourceBalances,
        alchemyKeyPresent: Boolean(ALCHEMY_KEY),
        alchemyPingOk,
      },
    });
  }

  // metadata resolve (cached) — sequential for safety; you can parallelize later
  for (const b of balances) {
    const meta = await resolveTokenMeta(supabase, alchemyPingOk ? alchemy : null, b.token);
    b.symbol = meta.symbol;
    b.decimals = meta.decimals;
  }

  // transfers (best effort)
  let transfers: Transfer[] = [];
  let sourceTransfers: "etherscan" | "base_backup" | "none" = "none";
  try {
    transfers = await fetchTransfersViaEtherscan(address).catch(() => []);
    if (transfers.length) sourceTransfers = "etherscan";
    if (!transfers.length) {
      transfers = await fetchTransfersBase(address).catch(() => []);
      if (transfers.length) sourceTransfers = "base_backup";
    }
  } catch {
    transfers = [];
    sourceTransfers = "none";
  }

  // prices (non-fatal)
  const priceMap = await fetchPriceUSDMap(balances.map((b) => b.token)).catch(() => ({} as any));

  // compute
  const stats: PerTokenStats[] = [];
  for (const b of balances) {
    const s = computePerTokenStats(address, b.token, transfers, b, (priceMap as any)[b.token.toLowerCase()]);
    if (s) {
      // enforce: never store "TKN"
      s.symbol = normalizeSymbol(s.symbol, s.token_address);
      stats.push(s);
    }
  }

  // persist holdings
  try {
    if (stats.length) {
      await supabase.from("token_holdings").upsert(
        stats.map((s) => ({
          address,
          token_address: s.token_address.toLowerCase(),
          symbol: normalizeSymbol(s.symbol, s.token_address),
          decimals: s.decimals,
          first_acquired_ts: s.first_acquired_ts,
          last_full_exit_ts: s.last_full_exit_ts,
          last_sell_ts: s.last_sell_ts,
          held_since: s.held_since,
          continuous_hold_days: s.continuous_hold_days,
          never_sold: s.never_sold,
          no_sell_streak_days: s.no_sell_streak_days,
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
      balances: balances.length,
      sourceBalances,
      sourceTransfers,
      alchemyKeyPresent: Boolean(ALCHEMY_KEY),
      alchemyPingOk,
      alchemyUsed: Boolean(alchemyPingOk && sourceBalances === "alchemy"),
      elapsedMs: Date.now() - started,
    },
  });
}
