import { NextRequest, NextResponse } from "next/server";
import { fetchBalancesBase, fetchPriceUSDMap, fetchTransfersBase } from "@/lib/data";
import { computePerTokenStats } from "@/lib/proofOfTime";
import { Balance, HexAddr, PerTokenStats } from "@/lib/types";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function POST(req: NextRequest) {
  const { address } = await req.json().catch(() => ({}));
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const addr = address as HexAddr;

  const [transfers, balances] = await Promise.all([
    fetchTransfersBase(addr),
    fetchBalancesBase(addr),
  ]);

  const priceMap = await fetchPriceUSDMap(balances.map(b => b.token));

  // Compute per token
  const stats: PerTokenStats[] = [];
  for (const b of balances as Balance[]) {
    const s = computePerTokenStats(addr, b.token, transfers, b, priceMap[b.token.toLowerCase()]);
    if (s) stats.push(s);
  }

  // DB upsert
  await supabase.from("wallets").upsert({ address: addr }).throwOnError();

  if (stats.length) {
    const rows = stats.map(s => ({
      address: addr,
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
    await supabase.from("token_holdings").upsert(rows, { onConflict: "address,token_address" }).throwOnError();
  }

  return NextResponse.json({ address: addr, count: stats.length });
}
