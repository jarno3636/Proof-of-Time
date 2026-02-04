import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { erc20Abi } from "viem";

import type { Balance, HexAddr, PerTokenStats, Transfer } from "@/lib/types";
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

/* ───────────────── helpers ───────────────── */

const RPCS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://1rpc.io/base",
];

const viemClients = RPCS.map((url) =>
  createPublicClient({ chain: base, transport: http(url) })
);

const isHex = (s: string): s is HexAddr =>
  /^0x[a-fA-F0-9]{40}$/.test(s);

function normalizeSymbol(symbol: string | null | undefined, token: string) {
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

  // 1️⃣ cache
  const { data: cached } = await supabase
    .from("token_cache")
    .select("symbol, decimals")
    .eq("token_address", tokenKey)
    .maybeSingle();

  if (cached?.symbol && cached?.decimals != null) {
    return cached;
  }

  // 2️⃣ alchemy
  if (alchemy) {
    try {
      const meta = await alchemy.core.getTokenMetadata(token);
      const symbol = normalizeSymbol(meta?.symbol, token);
      const decimals = typeof meta?.decimals === "number" ? meta.decimals : 18;

      await supabase.from("token_cache").upsert({
        token_address: tokenKey,
        symbol,
        decimals,
        source: "alchemy",
      });

      return { symbol, decimals };
    } catch {}
  }

  // 3️⃣ on-chain fallback
  for (const client of viemClients) {
    try {
      const [sym, dec] = await Promise.all([
        client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "symbol",
        }) as Promise<string>,
        client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "decimals",
        }) as Promise<number | bigint>,
      ]);

      const symbol = normalizeSymbol(sym, token);
      const decimals = typeof dec === "bigint" ? Number(dec) : dec ?? 18;

      await supabase.from("token_cache").upsert({
        token_address: tokenKey,
        symbol,
        decimals,
        source: "onchain",
      });

      return { symbol, decimals };
    } catch {}
  }

  // 4️⃣ deterministic fallback
  const fallback = token.slice(2, 6).toUpperCase();

  await supabase.from("token_cache").upsert({
    token_address: tokenKey,
    symbol: fallback,
    decimals: 18,
    source: "fallback",
  });

  return { symbol: fallback, decimals: 18 };
}

/* ───────────────── balances ───────────────── */

async function fetchBalances(
  alchemy: Alchemy | null,
  address: HexAddr
): Promise<Balance[]> {
  if (alchemy) {
    try {
      const res = await alchemy.core.getTokenBalances(address);
      return (res.tokenBalances ?? [])
        .filter((t) => t.tokenBalance && t.tokenBalance !== "0")
        .map((t) => ({
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
  if (!isHex(body.address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const address = body.address.toLowerCase() as HexAddr;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const alchemy = ALCHEMY_KEY
    ? new Alchemy({ apiKey: ALCHEMY_KEY, network: Network.BASE_MAINNET })
    : null;

  /* balances */
  let balances = await fetchBalances(alchemy, address);
  if (balances.length > MAX_TOKENS_PER_RUN) {
    balances = balances.slice(0, MAX_TOKENS_PER_RUN);
  }

  /* metadata resolve (cached) */
  for (const b of balances) {
    const meta = await resolveTokenMeta(supabase, alchemy, b.token);
    b.symbol = meta.symbol;
    b.decimals = meta.decimals;
  }

  /* transfers (best effort) */
  let transfers: Transfer[] = [];
  try {
    transfers = await fetchTransfersViaEtherscan(address);
    if (!transfers.length) transfers = await fetchTransfersBase(address);
  } catch {}

  /* prices */
  const priceMap = await fetchPriceUSDMap(
    balances.map((b) => b.token)
  ).catch(() => ({}));

  /* compute */
  const stats: PerTokenStats[] = [];
  for (const b of balances) {
    const s = computePerTokenStats(
      address,
      b.token,
      transfers,
      b,
      priceMap[b.token]
    );
    if (s) stats.push(s);
  }

  /* persist */
  if (stats.length) {
    await supabase.from("token_holdings").upsert(
      stats.map((s) => ({
        address,
        token_address: s.token_address.toLowerCase(),
        symbol: normalizeSymbol(s.symbol, s.token_address),
        decimals: s.decimals,
        ...s,
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
