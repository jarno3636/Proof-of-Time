import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { erc20Abi } from "viem";

import { computePerTokenStats } from "@/lib/proofOfTime";
import type { Balance, HexAddr, PerTokenStats, Transfer } from "@/lib/types";
import {
  fetchBalancesBase,
  fetchTransfersViaEtherscan,
  fetchTransfersBase,
  fetchPriceUSDMap,
} from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ───────── Config ───────── */

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const UPSTREAM_TIMEOUT_MS = 15_000;
const META_TIMEOUT_MS = 6_000;
const MAX_RETRIES = 3;

/* ───────── Utils ───────── */

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const isHex = (s: string): s is HexAddr => /^0x[a-fA-F0-9]{40}$/.test(s);

async function withRetry<T>(fn: () => Promise<T>) {
  let err;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      await sleep(300 * (i + 1));
    }
  }
  throw err;
}

function getAlchemy() {
  if (!ALCHEMY_KEY) return null;
  return new Alchemy({ apiKey: ALCHEMY_KEY, network: Network.BASE_MAINNET });
}

/* ───────── Metadata patch ───────── */

const viemClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

async function patchMeta(balances: Balance[]) {
  const need = balances.filter(b => b.symbol === "TKN");
  if (!need.length) return balances;

  const calls = need.map(b => ({
    address: b.token,
    abi: erc20Abi,
    functionName: "symbol",
  }));

  const res = await viemClient.multicall({ contracts: calls as any }).catch(() => []);

  return balances.map((b, i) => ({
    ...b,
    symbol: (res?.[i] as any)?.result || b.symbol,
  }));
}

/* ───────── Alchemy fetchers ───────── */

async function fetchBalancesAlchemy(alchemy: Alchemy, address: HexAddr) {
  const res = await alchemy.core.getTokenBalances(address);
  return (res.tokenBalances ?? [])
    .filter(t => t.tokenBalance !== "0")
    .map(t => ({
      token: t.contractAddress.toLowerCase() as HexAddr,
      raw: BigInt(t.tokenBalance),
      symbol: "TKN",
      decimals: 18,
    }));
}

async function fetchTransfersAlchemy(alchemy: Alchemy, address: HexAddr) {
  async function fetchDir(params: any): Promise<Transfer[]> {
    const r = await alchemy.core.getAssetTransfers({
      category: [AssetTransfersCategory.ERC20],
      withMetadata: true,
      maxCount: 1000,
      ...params,
    } as any);

    return (r.transfers ?? []).map(t => ({
      token: t.rawContract.address.toLowerCase(),
      from: t.from.toLowerCase(),
      to: t.to.toLowerCase(),
      value: BigInt(t.rawContract.value ?? "0"),
      block: parseInt(t.blockNum, 16),
      ts: Math.floor(new Date(t.metadata.blockTimestamp).getTime() / 1000),
      symbol: t.asset ?? "TKN",
      decimals: t.rawContract.decimal ?? 18,
    }));
  }

  const [out, inc] = await Promise.all([
    fetchDir({ fromAddress: address }),
    fetchDir({ toAddress: address }),
  ]);

  return [...out, ...inc].sort((a, b) => a.block - b.block);
}

/* ───────── POST ───────── */

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

  const alchemy = getAlchemy();
  let balances: Balance[] = [];
  let transfers: Transfer[] = [];
  let sourceBalances = "none";
  let sourceTransfers = "none";

  /* balances */
  if (alchemy) {
    try {
      balances = await withRetry(() => fetchBalancesAlchemy(alchemy, address));
      sourceBalances = "alchemy";
    } catch {}
  }
  if (!balances.length) {
    balances = await fetchBalancesBase(address);
    sourceBalances = "backup";
  }

  balances = await patchMeta(balances);

  /* transfers */
  if (alchemy) {
    try {
      transfers = await fetchTransfersAlchemy(alchemy, address);
      sourceTransfers = "alchemy";
    } catch {}
  }
  if (!transfers.length) {
    transfers = await fetchTransfersViaEtherscan(address).catch(() => []);
    if (!transfers.length) {
      transfers = await fetchTransfersBase(address);
    }
    sourceTransfers = transfers.length ? "backup" : "none";
  }

  const prices = await fetchPriceUSDMap(balances.map(b => b.token)).catch(() => ({}));

  const stats: PerTokenStats[] = [];
  for (const b of balances) {
    const s = computePerTokenStats(address, b.token, transfers, b, prices[b.token]);
    if (s) stats.push(s);
  }

  await supabase.from("token_holdings").upsert(
    stats.map(s => ({
      address,
      token_address: s.token_address,
      ...s,
      last_computed_at: new Date().toISOString(),
    })),
    { onConflict: "address,token_address" }
  );

  return NextResponse.json({
    address,
    count: stats.length,
    meta: {
      sourceBalances,
      sourceTransfers,
      alchemyUsed: sourceBalances === "alchemy" || sourceTransfers === "alchemy",
      elapsedMs: Date.now() - started,
    },
  });
}
