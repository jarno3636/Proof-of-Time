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

function normalizeSymbol(symbol: unknown, token: string): string {
  if (typeof symbol === "string" && symbol !== "TKN" && symbol.length > 0) {
    return symbol;
  }
  return token.slice(2, 6).toUpperCase();
}

/* ───────────────── metadata resolution ───────────────── */

type TokenCacheRow = {
  symbol: string | null;
  decimals: number | null;
};

async function resolveTokenMeta(
  supabase: SupabaseClient,
  alchemy: Alchemy | null,
  token: HexAddr
): Promise<{ symbol: string; decimals: number }> {
  const tokenKey = token.toLowerCase();

  // 1️⃣ cache
  try {
    const { data } = await supabase
      .from("token_cache")
      .select("symbol, decimals")
      .eq("token_address", tokenKey)
      .maybeSingle<TokenCacheRow>();

    if (data && data.decimals != null) {
      return {
        symbol: normalizeSymbol(data.symbol, token),
        decimals: Number(data.decimals) || 18,
      };
    }
  } catch {}

  // 2️⃣ Alchemy
  if (alchemy) {
    try {
      const meta = await withTimeout(
        alchemy.core.getTokenMetadata(token),
        META_TIMEOUT
      );

      const symbol = normalizeSymbol((meta as any)?.symbol, token);
      const decimals =
        typeof (meta as any)?.decimals === "number"
          ? (meta as any).decimals
          : 18;

      await supabase.from("token_cache").upsert({
        token_address: tokenKey,
        symbol,
        decimals,
        source: "alchemy",
        updated_at: new Date().toISOString(),
      });

      return { symbol, decimals };
    } catch {}
  }

  // 3️⃣ on-chain
  for (const client of viemClients) {
    try {
      const [sym, dec] = await Promise.all([
        withTimeout(
          client.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "symbol",
          } as any),
          META_TIMEOUT
        ).catch(() => null),
        withTimeout(
          client.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "decimals",
          } as any),
          META_TIMEOUT
        ).catch(() => null),
      ]);

      const symbol = normalizeSymbol(sym, token);
      const decimals =
        typeof dec === "bigint"
          ? Number(dec)
          : typeof dec === "number"
          ? dec
          : 18;

      await supabase.from("token_cache").upsert({
        token_address: tokenKey,
        symbol,
        decimals,
        source: "onchain",
        updated_at: new Date().toISOString(),
      });

      return { symbol, decimals };
    } catch {}
  }

  // 4️⃣ fallback
  const fallback = token.slice(2, 6).toUpperCase();
  await supabase.from("token_cache").upsert({
    token_address: tokenKey,
    symbol: fallback,
    decimals: 18,
    source: "fallback",
    updated_at: new Date().toISOString(),
  });

  return { symbol: fallback, decimals: 18 };
}

/* ───────────────── balances ───────────────── */

async function fetchBalances(
  alchemy: Alchemy | null,
  address: HexAddr
): Promise<{ balances: Balance[]; source: "alchemy" | "base_backup" }> {
  if (alchemy) {
    try {
      const res = await withTimeout(
        alchemy.core.getTokenBalances(address),
        UPSTREAM_TIMEOUT
      );

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
        .map(
          (t: any): Balance => ({
            token: t.contractAddress.toLowerCase() as HexAddr,
            raw: BigInt(t.tokenBalance),
            symbol: "TKN",
            decimals: 18,
          })
        )
        .filter((b: Balance) => b.raw !== 0n);

      return { balances, source: "alchemy" };
    } catch {}
  }

  return { balances: await fetchBalancesBase(address), source: "base_backup" };
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
    ALCHEMY_KEY && ALCHEMY_KEY.length
      ? new Alchemy({ apiKey: ALCHEMY_KEY, network: Network.BASE_MAINNET })
      : null;

  let { balances } = await fetchBalances(alchemy, address);
  if (balances.length > MAX_TOKENS_PER_RUN) {
    balances = balances.slice(0, MAX_TOKENS_PER_RUN);
  }

  for (const b of balances) {
    const meta = await resolveTokenMeta(supabase, alchemy, b.token);
    b.symbol = meta.symbol;
    b.decimals = meta.decimals;
  }

  let transfers: Transfer[] = [];
  try {
    transfers = await fetchTransfersViaEtherscan(address);
    if (!transfers.length) {
      transfers = await fetchTransfersBase(address);
    }
  } catch {}

  const priceMap: Record<string, number> = await fetchPriceUSDMap(
    balances.map((b) => b.token)
  ).catch(() => ({}));

  const stats: PerTokenStats[] = [];
  for (const b of balances) {
    const price = priceMap[b.token.toLowerCase()];
    const s = computePerTokenStats(address, b.token, transfers, b, price);
    if (s) {
      s.symbol = normalizeSymbol(s.symbol, s.token_address);
      stats.push(s);
    }
  }

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

  return NextResponse.json({
    address,
    count: stats.length,
    elapsedMs: Date.now() - started,
  });
}
