// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computePerTokenStats } from "@/lib/proofOfTime";
import { Balance, HexAddr, PerTokenStats, Transfer } from "@/lib/types";

import {
  fetchBalancesBase,
  fetchTransfersViaEtherscan,
  fetchTransfersBase,
  fetchPriceUSDMap,
} from "@/lib/data";

import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";

/* ───────────────────── Config ───────────────────── */

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const UPSTREAM_TIMEOUT_MS = 15_000;

/* ───────────────────── Utilities ───────────────────── */

function isHexAddress(s: string): s is HexAddr {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

function safeJson(status: number, message: string, extra?: any) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status });
}

function withTimeout<T>(p: Promise<T>, ms = UPSTREAM_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), ms)
    ),
  ]);
}

function sanitizeErr(err: unknown) {
  return {
    message: String((err as any)?.message || err),
  };
}

function getAlchemy() {
  if (!ALCHEMY_KEY) return null;
  return new Alchemy({
    apiKey: ALCHEMY_KEY,
    network: Network.BASE_MAINNET,
  });
}

/* ───────────────────── Alchemy Fetchers ───────────────────── */

async function fetchBalancesAlchemy(
  alchemy: Alchemy,
  address: HexAddr
): Promise<Balance[]> {
  const res = await withTimeout(alchemy.core.getTokenBalances(address));

  const out: Balance[] = [];

  for (const tb of res.tokenBalances || []) {
    if (!tb.tokenBalance || tb.tokenBalance === "0") continue;

    let raw = 0n;
    try {
      raw = BigInt(tb.tokenBalance);
    } catch {
      continue;
    }

    const meta = await alchemy.core
      .getTokenMetadata(tb.contractAddress)
      .catch(() => null);

    out.push({
      token: tb.contractAddress.toLowerCase() as HexAddr,
      symbol: meta?.symbol || `0x${tb.contractAddress.slice(2, 6).toUpperCase()}`,
      decimals: meta?.decimals ?? 18,
      raw,
    });
  }

  return out;
}

async function fetchTransfersAlchemy(
  alchemy: Alchemy,
  address: HexAddr
): Promise<Transfer[]> {
  const [outgoing, incoming] = await Promise.all([
    alchemy.core.getAssetTransfers({
      fromAddress: address,
      category: [AssetTransfersCategory.ERC20],
      withMetadata: true,
      excludeZeroValue: true,
    }),
    alchemy.core.getAssetTransfers({
      toAddress: address,
      category: [AssetTransfersCategory.ERC20],
      withMetadata: true,
      excludeZeroValue: true,
    }),
  ]);

  const merged = [...outgoing.transfers, ...incoming.transfers];

  return merged
    .map((t) => {
      if (!t.rawContract?.address) return null;
      return {
        token: t.rawContract.address.toLowerCase() as HexAddr,
        from: t.from!.toLowerCase() as HexAddr,
        to: t.to!.toLowerCase() as HexAddr,
        value: BigInt(t.rawContract.value || "0"),
        block: parseInt(t.blockNum, 16),
        ts: t.metadata?.blockTimestamp
          ? Math.floor(new Date(t.metadata.blockTimestamp).getTime() / 1000)
          : 0,
        symbol: t.asset || undefined,
        decimals: t.rawContract.decimal ?? undefined,
      } as Transfer;
    })
    .filter(Boolean) as Transfer[];
}

/* ───────────────────── POST /api/compute ───────────────────── */

export async function POST(req: NextRequest) {
  let address: HexAddr;

  try {
    const body = await req.json().catch(() => ({}));
    const raw =
      body?.address ||
      new URL(req.url).searchParams.get("address");

    if (!raw || !isHexAddress(raw)) {
      return safeJson(400, "Invalid address");
    }

    address = raw.toLowerCase() as HexAddr;
  } catch {
    return safeJson(400, "Malformed request");
  }

  /* ───── Supabase (WRITE ONLY) ───── */

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return safeJson(500, "Supabase env missing");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase.from("wallets").upsert({ address });

  /* ───── Fetch balances (REQUIRED) ───── */

  let balances: Balance[] = [];
  let transfers: Transfer[] = [];

  const alchemy = getAlchemy();

  try {
    if (alchemy) {
      balances = await fetchBalancesAlchemy(alchemy, address);
    }
    if (!balances.length) {
      balances = await fetchBalancesBase(address);
    }
  } catch (e) {
    console.error("balances failed", sanitizeErr(e));
    return safeJson(503, "Unable to verify balances");
  }

  /* ───── Fetch transfers (BEST EFFORT) ───── */

  try {
    if (alchemy) {
      transfers = await fetchTransfersAlchemy(alchemy, address);
    }
    if (!transfers.length) {
      transfers = await fetchTransfersViaEtherscan(address);
    }
    if (!transfers.length) {
      transfers = await fetchTransfersBase(address);
    }
  } catch {
    transfers = [];
  }

  if (!balances.length) {
    return NextResponse.json({
      address,
      count: 0,
      note: "No ERC-20 balances detected",
    });
  }

  /* ───── Prices (NON-FATAL) ───── */

  let priceMap: Record<string, number> = {};
  try {
    priceMap = await fetchPriceUSDMap(balances.map((b) => b.token));
  } catch {}

  /* ───── Compute stats ───── */

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

  /* ───── Persist (ANCHOR-SAFE) ───── */

  if (stats.length) {
    const rows = stats.map((s) => ({
      address,
      token_address: s.token_address.toLowerCase(),
      symbol: s.symbol,
      decimals: s.decimals,

      // ⬇️ CRITICAL: preserve anchors
      first_acquired_ts: s.first_acquired_ts ?? undefined,
      last_full_exit_ts: s.last_full_exit_ts ?? undefined,
      last_sell_ts: s.last_sell_ts ?? undefined,
      held_since: s.held_since ?? undefined,

      continuous_hold_days: s.continuous_hold_days ?? undefined,
      no_sell_streak_days: s.no_sell_streak_days ?? undefined,

      never_sold: s.never_sold,
      balance_numeric: s.balance_numeric,
      time_score: s.time_score,
      last_computed_at: new Date().toISOString(),
    }));

    await supabase
      .from("token_holdings")
      .upsert(rows, { onConflict: "address,token_address" });
  }

  return NextResponse.json({
    address,
    count: stats.length,
  });
}
