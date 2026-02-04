// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computePerTokenStats } from "@/lib/proofOfTime";
import { Balance, HexAddr, PerTokenStats, Transfer } from "@/lib/types";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";

/* ───────────────────── Alchemy (SERVER ONLY) ───────────────────── */

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
if (!ALCHEMY_KEY) {
  throw new Error("ALCHEMY_API_KEY missing");
}

const alchemy = new Alchemy({
  apiKey: ALCHEMY_KEY,
  network: Network.BASE_MAINNET,
});

/* ───────────────────── Utilities ───────────────────── */

function isHexAddress(s: string): s is HexAddr {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

function withTimeout<T>(p: Promise<T>, ms = 15_000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), ms)
    ),
  ]);
}

function safeError(message = "Upstream data unavailable") {
  return NextResponse.json({ error: message }, { status: 503 });
}

/* ───────────────────── Alchemy Fetchers (SANITIZED) ───────────────────── */

async function fetchBalancesAlchemy(address: HexAddr): Promise<Balance[]> {
  try {
    const res = await withTimeout(
      alchemy.core.getTokenBalances(address)
    );

    const out: Balance[] = [];

    for (const tb of res.tokenBalances) {
      if (!tb.tokenBalance || tb.tokenBalance === "0") continue;

      const token = tb.contractAddress?.toLowerCase();
      if (!token || !token.startsWith("0x")) continue;

      let symbol = "TKN";
      let decimals = 18;

      try {
        const meta = await withTimeout(
          alchemy.core.getTokenMetadata(token),
          5_000
        );
        if (meta?.symbol) symbol = meta.symbol;
        if (typeof meta?.decimals === "number") decimals = meta.decimals;
      } catch {
        /* swallow metadata errors */
      }

      out.push({
        token: token as HexAddr,
        symbol,
        decimals,
        raw: BigInt(tb.tokenBalance),
      });
    }

    return out;
  } catch (err) {
    console.error("[alchemy balances]", err);
    throw new Error("BALANCES_FAILED");
  }
}

async function fetchTransfersAlchemy(address: HexAddr): Promise<Transfer[]> {
  try {
    const [outgoing, incoming] = await Promise.all([
      withTimeout(
        alchemy.core.getAssetTransfers({
          category: [AssetTransfersCategory.ERC20],
          fromAddress: address,
          withMetadata: true,
          excludeZeroValue: true,
          order: "asc",
          maxCount: 5000,
        })
      ),
      withTimeout(
        alchemy.core.getAssetTransfers({
          category: [AssetTransfersCategory.ERC20],
          toAddress: address,
          withMetadata: true,
          excludeZeroValue: true,
          order: "asc",
          maxCount: 5000,
        })
      ),
    ]);

    return [...outgoing.transfers, ...incoming.transfers]
      .filter((t) => t.rawContract?.address)
      .map((t) => ({
        token: t.rawContract!.address!.toLowerCase() as HexAddr,
        from: t.from!.toLowerCase() as HexAddr,
        to: t.to!.toLowerCase() as HexAddr,
        value: BigInt(t.rawContract!.value || "0"),
        block: parseInt(t.blockNum, 16),
        ts: Math.floor(
          new Date(t.metadata!.blockTimestamp).getTime() / 1000
        ),
        symbol: t.asset || "TKN",
        decimals: Number(t.rawContract!.decimal ?? 18),
      }));
  } catch (err) {
    console.error("[alchemy transfers]", err);
    throw new Error("TRANSFERS_FAILED");
  }
}

/* ───────────────────── POST /api/compute ───────────────────── */

export async function POST(req: NextRequest) {
  let address: HexAddr;

  try {
    const body = await req.json().catch(() => ({}));
    const raw =
      body?.address ??
      new URL(req.url).searchParams.get("address");

    if (!raw || !isHexAddress(raw)) {
      return NextResponse.json(
        { error: "Invalid address" },
        { status: 400 }
      );
    }

    address = raw.toLowerCase() as HexAddr;
  } catch {
    return NextResponse.json(
      { error: "Malformed request" },
      { status: 400 }
    );
  }

  /* ───── Supabase (write-only cache) ───── */

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase.from("wallets").upsert({ address });

  /* ───── Fetch fresh chain data ───── */

  let balances: Balance[];
  let transfers: Transfer[];

  try {
    [balances, transfers] = await Promise.all([
      fetchBalancesAlchemy(address),
      fetchTransfersAlchemy(address),
    ]);
  } catch {
    return safeError("Unable to verify on-chain data");
  }

  if (!balances.length) {
    return NextResponse.json({
      address,
      count: 0,
      note: "No ERC-20 balances detected",
    });
  }

  /* ───── Compute ───── */

  const stats: PerTokenStats[] = [];

  for (const b of balances) {
    const s = computePerTokenStats(
      address,
      b.token,
      transfers,
      b,
      undefined
    );
    if (s) stats.push(s);
  }

  /* ───── Persist (overwrite cache) ───── */

  if (stats.length) {
    const rows = stats.map((s) => ({
      address,
      token_address: s.token_address.toLowerCase(),
      symbol: s.symbol,
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
    }));

    const { error } = await supabase
      .from("token_holdings")
      .upsert(rows, { onConflict: "address,token_address" });

    if (error) {
      console.error("[supabase]", error);
      return NextResponse.json(
        { error: "Storage failure" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    address,
    count: stats.length,
  });
}
