import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pickTop3, classifyTier } from "@/lib/proofOfTime";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(_req: NextRequest, { params }: { params: { address: string } }) {
  const address = params.address;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return NextResponse.json({ error: "bad address" }, { status: 400 });

  const { data, error } = await supabase
    .from("token_holdings")
    .select("*")
    .eq("address", address);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ address, tokens: [] });

  const top3 = pickTop3(data as any).map((t: any) => ({
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
