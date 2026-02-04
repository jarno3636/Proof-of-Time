import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
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
const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY ?? "";
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

const isHex = (s: string): s is HexAddr =>
  /^0x[a-fA-F0-9]{40}$/.test(s);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), ms)
    ),
  ]);
}

/** TRUE fallback = hex-derived */
function isFallbackSymbol(symbol: string): boolean {
  return /^[0-9A-F]{4}$/.test(symbol);
}

function safeSymbol(symbol: unknown, token: string): string {
  if (typeof symbol === "string" && symbol.length > 0 && symbol !== "TKN") {
    return symbol;
  }
  return token.slice(2, 6).toUpperCase();
}

/* ───────────────── metadata resolution ───────────────── */

type TokenCacheRow = {
  symbol: string | null;
  decimals: number | null;
  source?: string | null;
};

async function resolveTokenMeta(
  supabase: SupabaseClient,
  alchemy: Alchemy | null,
  token: HexAddr
): Promise<{ symbol: string; decimals: number }> {
  const tokenKey = token.toLowerCase();

  /* 1️⃣ cache (ONLY if authoritative) */
  try {
    const { data } = await supabase
      .from("token_cache")
      .select("symbol, decimals, source")
      .eq("token_address", tokenKey)
      .maybeSingle<TokenCacheRow>();

    if (
      data &&
      data.symbol &&
      !isFallbackSymbol(data.symbol) &&
      data.decimals != null
    ) {
      return {
        symbol: data.symbol,
        decimals: Number(data.decimals),
      };
    }
  } catch {}

  /* 2️⃣ Alchemy */
  if (alchemy) {
    try {
      const meta = await withTimeout(
        alchemy.core.getTokenMetadata(token),
        META_TIMEOUT
      );

      const symbol = safeSymbol((meta as any)?.symbol, token);
      const decimals =
        typeof (meta as any)?.decimals === "number"
          ? (meta as any).decimals
          : 18;

      if (!isFallbackSymbol(symbol)) {
        await supabase.from("token_cache").upsert({
          token_address: tokenKey,
          symbol,
          decimals,
          source: "alchemy",
          updated_at: new Date().toISOString(),
        });
      }

      return { symbol, decimals };
    } catch {}
  }

  /* 3️⃣ on-chain string + bytes32 */
  for (const client of viemClients) {
    try {
      let symbol: string | null = null;

      try {
        symbol = (await withTimeout(
          client.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "symbol",
          }) as Promise<string>,
          META_TIMEOUT
        )) as string;
      } catch {}

      if (!symbol) {
        try {
          const raw = (await withTimeout(
            client.readContract({
              address: token,
              abi: [
                {
                  name: "symbol",
                  type: "function",
                  stateMutability: "view",
                  inputs: [],
                  outputs: [{ type: "bytes32" }],
                },
              ],
              functionName: "symbol",
            }) as Promise<`0x${string}`>,
            META_TIMEOUT
          )) as `0x${string}`;

          symbol = Buffer.from(raw.slice(2), "hex")
            .toString("utf8")
            .replace(/\0/g, "")
            .trim();
        } catch {}
      }

      const finalSymbol = safeSymbol(symbol, token);

      if (!isFallbackSymbol(finalSymbol)) {
        await supabase.from("token_cache").upsert({
          token_address: tokenKey,
          symbol: finalSymbol,
          decimals: 18,
          source: "onchain",
          updated_at: new Date().toISOString(),
        });
      }

      return { symbol: finalSymbol, decimals: 18 };
    } catch {}
  }

  /* 4️⃣ UI-only fallback (NEVER cached) */
  return {
    symbol: token.slice(2, 6).toUpperCase(),
    decimals: 18,
  };
}

/* ───────────────── balances ───────────────── */

async function fetchBalances(
  alchemy: Alchemy | null,
  address: HexAddr
): Promise<Balance[]> {
  if (alchemy) {
    try {
      const res = await withTimeout(
        alchemy.core.getTokenBalances(address),
        UPSTREAM_TIMEOUT
      );

      const list: any[] = Array.isArray((res as any)?.tokenBalances)
        ? (res as any).tokenBalances
        : [];

      return list
        .filter(
          (t) =>
            t?.contractAddress &&
            typeof t.tokenBalance === "string" &&
            t.tokenBalance !== "0"
        )
        .map((t): Balance => ({
          token: t.contractAddress.toLowerCase() as HexAddr,
          raw: BigInt(t.tokenBalance),
          symbol: "TKN",
          decimals: 18,
        }));
    } catch {}
  }

  return fetchBalancesBase(address);
}

/* ───────────────── POST ───────────────── */

export async function POST(req: NextRequest) {
  const started = Date.now();
  const body = await req.json().catch(() => ({}));
  const raw = String(body?.address || "").trim();

  if (!isHex(raw)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const address = raw.toLowerCase() as HexAddr;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const alchemy =
    ALCHEMY_KEY.length > 0
      ? new Alchemy({ apiKey: ALCHEMY_KEY, network: Network.BASE_MAINNET })
      : null;

  let balances = await fetchBalances(alchemy, address);
  if (balances.length > MAX_TOKENS_PER_RUN) {
    balances = balances.slice(0, MAX_TOKENS_PER_RUN);
  }

  for (const b of balances) {
    const meta = await resolveTokenMeta(supabase, alchemy, b.token);
    b.symbol = meta.symbol;
    b.decimals = meta.decimals;
  }

  const transfers: Transfer[] =
    (await fetchTransfersViaEtherscan(address).catch(() => [])) ||
    (await fetchTransfersBase(address).catch(() => []));

  const priceMap: Record<string, number> = await fetchPriceUSDMap(
    balances.map((b) => b.token)
  ).catch(() => ({}));

  const stats: PerTokenStats[] = [];

  for (const b of balances) {
    const s = computePerTokenStats(
      address,
      b.token,
      transfers,
      b,
      priceMap[b.token.toLowerCase()]
    );
    if (s) {
      s.symbol = safeSymbol(s.symbol, s.token_address);
      stats.push(s);
    }
  }

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

  return NextResponse.json({
    address,
    count: stats.length,
    elapsedMs: Date.now() - started,
  });
}
