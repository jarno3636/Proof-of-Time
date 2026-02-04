import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// IMPORTANT:
// Ensure these ARE exported from lib/proofOfTime.ts
import { pickTop3, classifyTier } from "@/lib/proofOfTime";

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  const raw = (params.address || "").trim();

  // Basic format check
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return NextResponse.json({ error: "bad address" }, { status: 400 });
  }

  const addressLower = raw.toLowerCase();

  // Create Supabase client per-request (safer in serverless)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // 1) Exact match (preferred)
  const { data, error } = await supabase
    .from("token_holdings")
    .select("*")
    .eq("address", addressLower);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let rows = data ?? [];

  // 2) Legacy safety net (mixed-case historical rows)
  if (!rows.length) {
    const { data: legacyRows } = await supabase
      .from("token_holdings")
      .select("*")
      .eq("address", raw);

    if (legacyRows?.length) rows = legacyRows;
  }

  if (!rows.length) {
    return NextResponse.json({
      address: addressLower,
      tokens: [],
    });
  }

  // Top 3 + tiers
  const top3 = pickTop3(rows as any).map((t: any) => ({
    token_address: t.token_address as `0x${string}`,
    symbol: t.symbol as string,
    days: t.continuous_hold_days as number,
    no_sell_streak_days: t.no_sell_streak_days as number,
    never_sold: t.never_sold as boolean,
    tier: classifyTier(t.continuous_hold_days),
    balance: t.balance_numeric as number | undefined,
  }));

  return NextResponse.json({
    address: addressLower,
    tokens: top3,
  });
}
