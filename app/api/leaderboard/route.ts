import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "global"; // global|token|nosell
  const token = (searchParams.get("token") ?? "").toLowerCase();
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 200);

  if (type === "token" && !/^0x[a-fA-F0-9]{40}$/.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  if (type === "global") {
    const { data, error } = await supabase.rpc("proof_time_global_lb", { p_limit: limit });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ type, items: data });
  }

  if (type === "nosell") {
    const { data, error } = await supabase
      .from("token_holdings")
      .select("address, symbol, token_address, no_sell_streak_days")
      .order("no_sell_streak_days", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ type, items: data });
  }

  // per token by continuous hold
  const { data, error } = await supabase
    .from("token_holdings")
    .select("address, symbol, token_address, continuous_hold_days")
    .eq("token_address", token)
    .order("continuous_hold_days", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ type, token, items: data });
}

/* Supabase function (create once):
create or replace function proof_time_global_lb(p_limit int)
returns table(address text, total_score numeric, total_days bigint)
language sql stable as $$
  select address,
         sum(time_score) as total_score,
         sum(continuous_hold_days)::bigint as total_days
  from token_holdings
  group by address
  order by total_score desc
  limit p_limit;
$$;
*/
