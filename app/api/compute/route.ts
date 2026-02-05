// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

const MAX_TOKENS_PER_RUN = 80;

/* ───────────────── helpers ───────────────── */

const isHexAddr = (s: string): s is HexAddr =>
  /^0x[a-fA-F0-9]{40}$/.test(s);

function safeAddr(x: unknown): HexAddr | null {
  const s = String(x || "").trim();
  if (!isHexAddr(s)) return null;
  return s.toLowerCase() as HexAddr;
}

type PrevHolding = {
  token_address: HexAddr;
  first_acquired_ts: string | null;
  held_since: string | null;
  last_sell_ts: string | null;
  last_full_exit_ts: string | null;
  never_sold: boolean;
};

/* ───────────────── POST ───────────────── */

export async function POST(req: NextRequest) {
  const started = Date.now();

  const body = await req.json().catch(() => ({} as any));
  const address = safeAddr((body as any)?.address);

  if (!address) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  /* 0️⃣ load previous anchors (CRITICAL) */
  const prevMap = new Map<string, PrevHolding>();
  try {
    const { data } = await supabase
      .from("token_holdings")
      .select(
        "token_address,first_acquired_ts,held_since,last_sell_ts,last_full_exit_ts,never_sold"
      )
      .eq("address", address);

    for (const r of data || []) {
      const token = String((r as any)?.token_address || "")
        .toLowerCase()
        .trim();
      if (!isHexAddr(token)) continue;

      prevMap.set(token, {
        token_address: token as HexAddr,
        first_acquired_ts:
          typeof (r as any)?.first_acquired_ts === "string"
            ? (r as any).first_acquired_ts
            : null,
        held_since:
          typeof (r as any)?.held_since === "string" ? (r as any).held_since : null,
        last_sell_ts:
          typeof (r as any)?.last_sell_ts === "string" ? (r as any).last_sell_ts : null,
        last_full_exit_ts:
          typeof (r as any)?.last_full_exit_ts === "string"
            ? (r as any).last_full_exit_ts
            : null,
        never_sold: Boolean((r as any)?.never_sold),
      });
    }
  } catch (err) {
    console.warn("token_holdings preload failed", err);
  }

  /* 1️⃣ balances */
  let balances: Balance[] = await fetchBalancesBase(address);
  if (balances.length > MAX_TOKENS_PER_RUN) {
    balances = balances.slice(0, MAX_TOKENS_PER_RUN);
  }

  /* 2️⃣ transfers */
  let transfers: Transfer[] = [];
  try {
    transfers = await fetchTransfersViaEtherscan(address);
    if (!transfers.length) transfers = await fetchTransfersBase(address);
  } catch {
    transfers = [];
  }

  /* 3️⃣ prices */
  const priceMap: Record<string, number> = await fetchPriceUSDMap(
    balances.map((b) => b.token)
  ).catch(() => ({}));

  /* 4️⃣ compute (with anchor locking) */
  const stats: PerTokenStats[] = [];

  for (const b of balances) {
    const tokenKey = b.token.toLowerCase();
    const prev = prevMap.get(tokenKey);

    const price = priceMap[tokenKey];

    const s = computePerTokenStats(
      address,
      b.token,
      transfers,
      b,
      price,
      Math.floor(Date.now() / 1000),
      prev
    );

    if (s) stats.push(s);
  }

  /* 5️⃣ persist (avoid overwriting good anchors with nulls) */
  if (stats.length) {
    try {
      const rows = stats.map((s) => {
        const tokenKey = s.token_address.toLowerCase();
        const prev = prevMap.get(tokenKey);

        // If compute couldn't infer some timestamps (rare), keep the prior anchor.
        const heldSince = s.held_since ?? prev?.held_since ?? null;
        const firstAcquired = s.first_acquired_ts ?? prev?.first_acquired_ts ?? heldSince ?? null;

        return {
          address,
          token_address: tokenKey,
          decimals: s.decimals,

          // symbol optional — UI resolves via token_cache later
          symbol: s.symbol,

          first_acquired_ts: firstAcquired,
          last_full_exit_ts: s.last_full_exit_ts ?? prev?.last_full_exit_ts ?? null,
          last_sell_ts: s.last_sell_ts ?? prev?.last_sell_ts ?? null,
          held_since: heldSince,

          continuous_hold_days: s.continuous_hold_days,
          no_sell_streak_days: s.no_sell_streak_days,
          never_sold: s.never_sold,

          balance_numeric: s.balance_numeric,
          time_score: s.time_score,

          last_computed_at: new Date().toISOString(),
        };
      });

      await supabase.from("token_holdings").upsert(rows, {
        onConflict: "address,token_address",
      });
    } catch (err) {
      console.error("token_holdings upsert failed", err);
    }
  }

  return NextResponse.json({
    address,
    count: stats.length,
    elapsedMs: Date.now() - started,
  });
}
