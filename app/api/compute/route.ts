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
const SECS_PER_DAY = 86400;

/* ───────────────── helpers ───────────────── */

const isHexAddr = (s: string): s is HexAddr =>
  /^0x[a-fA-F0-9]{40}$/.test(s);

function safeAddr(x: unknown): HexAddr | null {
  const s = String(x || "").trim();
  if (!isHexAddr(s)) return null;
  return s.toLowerCase() as HexAddr;
}

/* ───────────────── POST ───────────────── */

export async function POST(req: NextRequest) {
  const started = Date.now();

  const body = await req.json().catch(() => ({}));
  const address = safeAddr((body as any)?.address);

  if (!address) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  /* 1️⃣ balances */
  let balances: Balance[] = await fetchBalancesBase(address);
  if (balances.length > MAX_TOKENS_PER_RUN) {
    balances = balances.slice(0, MAX_TOKENS_PER_RUN);
  }

  /* 2️⃣ transfers */
  let transfers: Transfer[] = [];
  try {
    transfers = await fetchTransfersViaEtherscan(address);
    if (!transfers.length) {
      transfers = await fetchTransfersBase(address);
    }
  } catch {
    transfers = [];
  }

  /* 3️⃣ prices */
  const priceMap = await fetchPriceUSDMap(
    balances.map((b) => b.token)
  ).catch(() => ({} as Record<string, number>));

  /* 4️⃣ compute */
  const stats: PerTokenStats[] = [];

  for (const b of balances) {
    const price = priceMap[b.token.toLowerCase()];
    const s = computePerTokenStats(
      address,
      b.token,
      transfers,
      b,
      price
    );
    if (s) stats.push(s);
  }

  /* 5️⃣ persist — ALWAYS DERIVE DAYS FROM held_since */
  const now = Date.now();

  if (stats.length) {
    await supabase.from("token_holdings").upsert(
      stats.map((s) => {
        const heldSinceMs = s.held_since
          ? new Date(s.held_since).getTime()
          : null;

        const daysHeld =
          heldSinceMs != null
            ? Math.max(
                0,
                Math.floor((now - heldSinceMs) / (SECS_PER_DAY * 1000))
              )
            : 0;

        return {
          address,
          token_address: s.token_address.toLowerCase(),
          decimals: s.decimals,
          symbol: s.symbol,

          first_acquired_ts: s.first_acquired_ts,
          last_full_exit_ts: s.last_full_exit_ts,
          last_sell_ts: s.last_sell_ts,

          // 🔑 SOURCE OF TRUTH
          held_since: s.held_since,

          // 🔥 DERIVED EVERY RUN
          continuous_hold_days: daysHeld,
          no_sell_streak_days: daysHeld,
          never_sold: s.never_sold,

          balance_numeric: s.balance_numeric,
          time_score: daysHeld * Math.log(s.balance_numeric + 1),

          last_computed_at: new Date().toISOString(),
        };
      }),
      { onConflict: "address,token_address" }
    );
  }

  return NextResponse.json({
    address,
    count: stats.length,
    elapsedMs: Date.now() - started,
  });
}
