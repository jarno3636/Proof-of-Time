// app/api/relic/[address]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pickTop3, classifyTier } from "@/lib/proofOfTime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SECS_PER_DAY = 86400;

function toLower(x: string) {
  return (x || "").toLowerCase();
}

function parseIsoToSec(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

export async function GET(_req: NextRequest, { params }: { params: { address: string } }) {
  const raw = (params.address || "").trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return NextResponse.json({ error: "bad address" }, { status: 400 });
  }

  const addressLower = raw.toLowerCase();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Server misconfigured (Supabase env missing)" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("token_holdings")
    .select("*")
    .or(`address.eq.${addressLower},address.eq.${raw}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let rows: any[] = data ?? [];

  // Safety net: mixed-case historical rows
  if (!rows.length) {
    const { data: dataCI } = await supabase
      .from("token_holdings")
      .select("*")
      .ilike("address", addressLower);
    if (dataCI) rows = dataCI as any[];
  }

  if (!rows.length) {
    return NextResponse.json(
      { address: addressLower, tokens: [] },
      { headers: { "cache-control": "no-store, max-age=0" } }
    );
  }

  // ---- LIVE recompute day counters so they update every request ----
  const nowSec = Math.floor(Date.now() / 1000);

  const normalized = rows.map((r) => {
    const heldSinceSec = parseIsoToSec(r.held_since) ?? nowSec;
    const firstAcquiredSec = parseIsoToSec(r.first_acquired_ts) ?? heldSinceSec;
    const lastSellSec = parseIsoToSec(r.last_sell_ts);

    const continuousDays = Math.max(0, Math.floor((nowSec - heldSinceSec) / SECS_PER_DAY));
    const noSellSince = lastSellSec ?? firstAcquiredSec;
    const noSellDays = Math.max(0, Math.floor((nowSec - noSellSince) / SECS_PER_DAY));

    // keep stored balance/time_score if you want; but compute a fresh tier basis
    return {
      ...r,
      continuous_hold_days: continuousDays,
      no_sell_streak_days: noSellDays,
    };
  });

  const top3 = pickTop3(normalized as any).map((t: any) => ({
    token_address: t.token_address as `0x${string}`,
    symbol: t.symbol as string,
    days: t.continuous_hold_days as number,
    no_sell_streak_days: t.no_sell_streak_days as number,
    never_sold: Boolean(t.never_sold),
    tier: classifyTier(Number(t.continuous_hold_days) || 0),
    balance: t.balance_numeric as number | undefined,
  }));

  return NextResponse.json(
    { address: addressLower, tokens: top3 },
    { headers: { "cache-control": "no-store, max-age=0" } }
  );
}
