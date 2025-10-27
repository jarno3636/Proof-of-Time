// app/api/relic/[address]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pickTop3, classifyTier } from "@/lib/proofOfTime";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  const raw = (params.address || "").trim();

  // Basic format check
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return NextResponse.json({ error: "bad address" }, { status: 400 });
  }

  // ✅ Normalize to lowercase for consistent lookups/returns
  const addressLower = raw.toLowerCase();

  // 1) Try exact matches on lowercase and raw (covers historical rows)
  const { data, error } = await supabase
    .from("token_holdings")
    .select("*")
    .or(`address.eq.${addressLower},address.eq.${raw}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let rows = data ?? [];

  // 2) Safety net: case-insensitive exact match (in case rows were stored with mixed case)
  if (!rows.length) {
    const { data: dataCI, error: errCI } = await supabase
      .from("token_holdings")
      .select("*")
      .ilike("address", addressLower); // case-insensitive
    if (!errCI && dataCI) rows = dataCI;
  }

  if (!rows.length) {
    return NextResponse.json({ address: addressLower, tokens: [] });
  }

  // Transform → top 3 + tiers
  const top3 = pickTop3(rows as any).map((t: any) => ({
    token_address: t.token_address as `0x${string}`,
    symbol: t.symbol as string,
    days: t.continuous_hold_days as number,
    no_sell_streak_days: t.no_sell_streak_days as number,
    never_sold: t.never_sold as boolean,
    tier: classifyTier(t.continuous_hold_days) as
      | "Bronze"
      | "Silver"
      | "Gold"
      | "Platinum"
      | "Obsidian",
    balance: t.balance_numeric as number | undefined,
  }));

  return NextResponse.json({ address: addressLower, tokens: top3 });
}
