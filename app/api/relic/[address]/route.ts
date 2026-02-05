import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classifyTier } from "@/lib/proofOfTime";
import type { HexAddr } from "@/lib/types";

/* ───────────────── runtime ───────────────── */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ───────────────── supabase ───────────────── */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/* ───────────────── helpers ───────────────── */

const isHexAddr = (s: string): s is HexAddr =>
  /^0x[a-fA-F0-9]{40}$/.test(s);

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function normalizeSymbol(sym: unknown): string | null {
  if (typeof sym !== "string") return null;
  const s = sym.trim();
  if (!s) return null;
  if (s.toUpperCase() === "TKN") return null;
  if (s.length === 4 && /^[0-9A-F]{4}$/.test(s)) return null;
  if (s.length > 24) return null;
  return s;
}

/* ───────────────── verified symbol reader ───────────────── */

async function getVerifiedSymbols(tokens: HexAddr[]) {
  const map = new Map<string, string>();
  if (!tokens.length) return map;

  const { data } = await supabase
    .from("token_cache")
    .select("token_address,symbol,verified")
    .in(
      "token_address",
      tokens.map((t) => t.toLowerCase())
    );

  for (const row of data || []) {
    if (row?.verified) {
      const sym = normalizeSymbol(row.symbol);
      if (sym) {
        map.set(String(row.token_address).toLowerCase(), sym);
      }
    }
  }

  return map;
}

/* ───────────────── GET ───────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  const raw = String(params.address || "").trim();
  if (!isHexAddr(raw)) {
    return NextResponse.json({ error: "bad address" }, { status: 400 });
  }

  const address = raw.toLowerCase();

  const { data, error } = await supabase
    .from("token_holdings")
    .select(
      "token_address,continuous_hold_days,no_sell_streak_days,never_sold,balance_numeric,time_score"
    )
    .eq("address", address);

  if (error) {
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  const rows = (data || []).map((r) => ({
    token_address: String(r.token_address).toLowerCase() as HexAddr,
    continuous_hold_days: Number(r.continuous_hold_days || 0),
    no_sell_streak_days: Number(r.no_sell_streak_days || 0),
    never_sold: Boolean(r.never_sold),
    balance_numeric: Number(r.balance_numeric || 0),
    time_score: Number(r.time_score || 0),
  }));

  rows.sort(
    (a, b) =>
      b.time_score - a.time_score ||
      b.continuous_hold_days - a.continuous_hold_days
  );

  const top = rows.slice(0, 3);
  const symMap = await getVerifiedSymbols(
    top.map((t) => t.token_address)
  );

  const tokens = top.map((t) => {
    const sym = symMap.get(t.token_address) ?? null;

    return {
      token_address: t.token_address,
      symbol: sym ? `$${sym}` : shortAddr(t.token_address),
      symbol_verified: Boolean(sym),
      symbol_hint: sym ? null : shortAddr(t.token_address),
      days: t.continuous_hold_days,
      no_sell_streak_days: t.no_sell_streak_days,
      never_sold: t.never_sold,
      tier: classifyTier(t.continuous_hold_days),
      balance: t.balance_numeric,
      time_score: t.time_score,
    };
  });

  return NextResponse.json({ address, tokens });
}
