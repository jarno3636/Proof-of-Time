// app/api/relic/[address]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { classifyTier } from "@/lib/proofOfTime";
import type { HexAddr } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const isHexAddr = (s: string): s is HexAddr => /^0x[a-fA-F0-9]{40}$/.test(s);

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

async function resolveTopSymbols(tokens: HexAddr[]) {
  if (!tokens.length) return new Map<string, string | null>();

  // pull verified cache first
  const { data } = await supabase
    .from("token_cache")
    .select("token_address,symbol,verified")
    .in("token_address", tokens.map((t) => t.toLowerCase()))
    .catch(() => ({ data: [] as any[] }));

  const map = new Map<string, string | null>();
  for (const row of data || []) {
    if (row?.verified && normalizeSymbol(row.symbol)) {
      map.set(String(row.token_address).toLowerCase(), normalizeSymbol(row.symbol));
    }
  }

  // any missing? call internal resolver endpoint logic by inserting rows via API call is overkill here;
  // easiest: call your /api/tokens/resolve from server-side? (no, that's a Next route too)
  // So instead: attempt BaseScan directly here (minimal duplication)
  const key = process.env.BASESCAN_API_KEY;
  if (!key) return map;

  for (const token of tokens) {
    const tk = token.toLowerCase();
    if (map.has(tk)) continue;

    try {
      const url = new URL("https://api.basescan.org/api");
      url.searchParams.set("module", "token");
      url.searchParams.set("action", "tokeninfo");
      url.searchParams.set("contractaddress", token);
      url.searchParams.set("apikey", key);

      const res = await fetch(url.toString()).catch(() => null);
      if (!res || !res.ok) continue;

      const json: any = await res.json().catch(() => null);
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

      await supabase.from("token_cache").upsert({
        token_address: tk,
        symbol: sym,
        name,
        decimals: dec,
        source: "basescan",
        verified: true,
        updated_at: new Date().toISOString(),
      }).catch(() => null);
    } catch {}
  }

  return map;
}

export async function GET(_req: NextRequest, { params }: { params: { address: string } }) {
  const raw = String(params.address || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return NextResponse.json({ error: "bad address" }, { status: 400 });
  }

  const address = raw.toLowerCase();

  const { data, error } = await supabase
    .from("token_holdings")
    .select("token_address,continuous_hold_days,no_sell_streak_days,never_sold,balance_numeric,time_score,last_computed_at")
    .eq("address", address);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []).map((r: any) => ({
    token_address: String(r.token_address).toLowerCase() as HexAddr,
    continuous_hold_days: r.continuous_hold_days == null ? 0 : Number(r.continuous_hold_days),
    no_sell_streak_days: r.no_sell_streak_days == null ? 0 : Number(r.no_sell_streak_days),
    never_sold: Boolean(r.never_sold),
    balance_numeric: r.balance_numeric != null ? Number(r.balance_numeric) : 0,
    time_score: r.time_score != null ? Number(r.time_score) : 0,
  }));

  rows.sort(
    (a, b) =>
      b.time_score - a.time_score ||
      b.continuous_hold_days - a.continuous_hold_days ||
      a.token_address.localeCompare(b.token_address)
  );

  const top = rows.slice(0, 3);
  const symMap = await resolveTopSymbols(top.map((t) => t.token_address));

  const tokens = top.map((t) => {
    const sym = symMap.get(t.token_address.toLowerCase()) ?? null;
    const display = sym ? sym : "TOKEN"; // NEVER fake like B8D9
    return {
      token_address: t.token_address,
      symbol: display,
      symbol_verified: Boolean(sym),
      symbol_hint: sym ? sym : shortAddr(t.token_address),
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
