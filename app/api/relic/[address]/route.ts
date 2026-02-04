// app/api/relic/[address]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classifyTier } from "@/lib/proofOfTime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  const raw = (params.address || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return NextResponse.json({ error: "bad address" }, { status: 400 });
  }

  const address = raw.toLowerCase();

  // Pull newest computed rows; sorting server-side to reduce payload
  const { data, error } = await supabase
    .from("token_holdings")
    .select("token_address,symbol,continuous_hold_days,no_sell_streak_days,never_sold,balance_numeric,time_score,last_computed_at")
    .eq("address", address);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []).map((r: any) => ({
    token_address: String(r.token_address) as `0x${string}`,
    symbol: String(r.symbol || "TKN"),
    continuous_hold_days: Number(r.continuous_hold_days || 0),
    no_sell_streak_days: Number(r.no_sell_streak_days || 0),
    never_sold: Boolean(r.never_sold),
    balance_numeric: r.balance_numeric != null ? Number(r.balance_numeric) : undefined,
    time_score: r.time_score != null ? Number(r.time_score) : 0,
  }));

  rows.sort(
    (a, b) =>
      (b.time_score - a.time_score) ||
      (b.continuous_hold_days - a.continuous_hold_days) ||
      a.symbol.localeCompare(b.symbol)
  );

  const top3 = rows.slice(0, 3).map((t) => ({
    token_address: t.token_address,
    symbol: t.symbol,
    days: t.continuous_hold_days,
    no_sell_streak_days: t.no_sell_streak_days,
    never_sold: t.never_sold,
    tier: classifyTier(t.continuous_hold_days),
    balance: t.balance_numeric,
  }));

  return NextResponse.json({ address, tokens: top3 });
}
