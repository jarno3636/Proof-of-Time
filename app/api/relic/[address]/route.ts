import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classifyTier } from "@/lib/proofOfTime";
import type { HexAddr } from "@/lib/types";

/* ───────────────── runtime ───────────────── */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ───────────────── supabase ───────────────── */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

/* ───────────────── symbol resolver ───────────────── */

async function resolveTopSymbols(tokens: HexAddr[]) {
  const map = new Map<string, string | null>();
  if (!tokens.length) return map;

  /* 1️⃣ verified cache */
  let cached: any[] = [];
  try {
    const res = await supabase
      .from("token_cache")
      .select("token_address,symbol,verified")
      .in("token_address", tokens.map((t) => t.toLowerCase()));

    cached = res.data || [];
  } catch {}

  for (const row of cached) {
    if (row?.verified) {
      const sym = normalizeSymbol(row.symbol);
      if (sym) {
        map.set(String(row.token_address).toLowerCase(), sym);
      }
    }
  }

  /* 2️⃣ BaseScan fallback (verified only) */
  const apiKey = process.env.BASESCAN_API_KEY;
  if (!apiKey) return map;

  for (const token of tokens) {
    const tk = token.toLowerCase();
    if (map.has(tk)) continue;

    try {
      const url = new URL("https://api.basescan.org/api");
      url.searchParams.set("module", "token");
      url.searchParams.set("action", "tokeninfo");
      url.searchParams.set("contractaddress", token);
      url.searchParams.set("apikey", apiKey);

      const res = await fetch(url.toString());
      if (!res.ok) continue;

      const json: any = await res.json();
      const result = Array.isArray(json?.result) ? json.result[0] : null;
      if (!result) continue;

      const sym = normalizeSymbol(result.symbol);
      const dec = Number(result.decimals ?? result.tokenDecimal ?? 18);
      const name =
        typeof result.tokenName === "string"
          ? result.tokenName
          : typeof result.name === "string"
          ? result.name
          : null;

      if (!sym || !Number.isFinite(dec)) continue;

      map.set(tk, sym);

      try {
        await supabase.from("token_cache").upsert({
          token_address: tk,
          symbol: sym,
          name,
          decimals: dec,
          source: "basescan",
          verified: true,
          updated_at: new Date().toISOString(),
        });
      } catch {}
    } catch {}
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

  let rows: any[] = [];
  try {
    const res = await supabase
      .from("token_holdings")
      .select(
        "token_address,continuous_hold_days,no_sell_streak_days,never_sold,balance_numeric,time_score"
      )
      .eq("address", address);

    rows = res.data || [];
  } catch {
    return NextResponse.json({ error: "db error" }, { status: 500 });
  }

  const normalized = rows.map((r) => ({
    token_address: String(r.token_address).toLowerCase() as HexAddr,
    continuous_hold_days: Number(r.continuous_hold_days || 0),
    no_sell_streak_days: Number(r.no_sell_streak_days || 0),
    never_sold: Boolean(r.never_sold),
    balance_numeric: Number(r.balance_numeric || 0),
    time_score: Number(r.time_score || 0),
  }));

  normalized.sort(
    (a, b) =>
      b.time_score - a.time_score ||
      b.continuous_hold_days - a.continuous_hold_days
  );

  const top = normalized.slice(0, 3);
  const symMap = await resolveTopSymbols(top.map((t) => t.token_address));

  const tokens = top.map((t) => {
    const sym = symMap.get(t.token_address) ?? null;
    return {
      token_address: t.token_address,
      symbol: sym ?? "TOKEN",
      symbol_verified: Boolean(sym),
      symbol_hint: sym ?? shortAddr(t.token_address),
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
