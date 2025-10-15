import { NextRequest, NextResponse } from "next/server";
import { fetchBalancesBase, fetchPriceUSDMap, fetchTransfersBase } from "@/lib/data";
import { computePerTokenStats } from "@/lib/proofOfTime";
import { Balance, HexAddr, PerTokenStats } from "@/lib/types";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json().catch(() => ({}));
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
    }
    const supabase = createClient(url, key);

    const [transfers, balances] = await Promise.all([
      fetchTransfersBase(address as HexAddr),
      fetchBalancesBase(address as HexAddr),
    ]);

    const priceMap = await fetchPriceUSDMap(balances.map(b => b.token));
    const stats: PerTokenStats[] = [];
    for (const b of balances as Balance[]) {
      const s = computePerTokenStats(address as HexAddr, b.token, transfers, b, priceMap[b.token.toLowerCase()]);
      if (s) stats.push(s);
    }

    await supabase.from("wallets").upsert({ address }).throwOnError();

    if (stats.length) {
      const rows = stats.map(s => ({
        address,
        token_address: s.token_address,
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
      const { error } = await supabase.from("token_holdings").upsert(rows, { onConflict: "address,token_address" });
      if (error) return NextResponse.json({ error: `DB upsert failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ address, count: stats.length });
  } catch (err: any) {
    console.error("compute error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Unknown compute error" }, { status: 500 });
  }
}
