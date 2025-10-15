// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchBalancesBase, fetchPriceUSDMap, fetchTransfersBase } from "@/lib/data";
import { computePerTokenStats } from "@/lib/proofOfTime";
import type { Balance, HexAddr, PerTokenStats } from "@/lib/types";
import { createClient } from "@supabase/supabase-js";

// Run on Node.js (not Edge) so viem/providers behave consistently on Vercel.
export const runtime = "nodejs";
// Avoid caching by the edge/CDN.
export const dynamic = "force-dynamic";

// --- Utilities --------------------------------------------------------------
function isHexAddress(s: string): s is HexAddr {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

// --- POST /api/compute ------------------------------------------------------
// Body: { "address": "0x..." }
export async function POST(req: NextRequest) {
  try {
    // Accept address in JSON body or fallback to URLSearchParams (?address=0x..)
    let address: string | undefined;
    try {
      const j = await req.json();
      address = j?.address;
    } catch {
      // ignore JSON parse error; we might have query param instead
    }
    if (!address) {
      const q = new URL(req.url).searchParams.get("address") || "";
      address = q || undefined;
    }

    if (!address || !isHexAddress(address)) {
      return NextResponse.json(
        { error: "Invalid address (expected 0x…40 hex)" },
        { status: 400 }
      );
    }

    // Supabase (server-side key)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      return NextResponse.json(
        { error: "Supabase env missing (URL or SERVICE_KEY)" },
        { status: 500 }
      );
    }
    const supabase = createClient(url, key);

    // Pull on-chain data
    const [transfers, balances] = await Promise.all([
      fetchTransfersBase(address as HexAddr),
      fetchBalancesBase(address as HexAddr),
    ]);

    // Ensure wallet exists in DB even if no balances
    await supabase.from("wallets").upsert({ address }).throwOnError();

    if (!balances?.length) {
      return NextResponse.json({
        address,
        count: 0,
        note: "No non-zero ERC-20 balances detected on Base.",
      });
    }

    // Prices for scoring & dust filter
    const priceMap = await fetchPriceUSDMap(balances.map((b) => b.token));

    const stats: PerTokenStats[] = [];
    for (const b of balances as Balance[]) {
      const s = computePerTokenStats(
        address as HexAddr,
        b.token,
        transfers,
        b,
        priceMap[b.token.toLowerCase()]
      );
      if (s) stats.push(s);
    }

    if (stats.length) {
      const rows = stats.map((s) => ({
        address,
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

      const { error } = await supabase
        .from("token_holdings")
        .upsert(rows, { onConflict: "address,token_address" });

      if (error) {
        return NextResponse.json(
          { error: `DB upsert failed: ${error.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ address, count: stats.length });
  } catch (err: any) {
    // Bubble up a useful message to the client (helps diagnose provider 401/429, etc.)
    const message = err?.message || String(err);
    console.error("compute error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// --- GET /api/compute -------------------------------------------------------
// Handy browser form so you can test without a separate client.
export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const prefill = u.searchParams.get("address") ?? "";
  return new Response(
    `<!doctype html>
<html><body style="font-family:system-ui;padding:24px;background:#0B0E14;color:#EDEEF2">
  <h1>Proof of Time – Compute</h1>
  <p>Enter a Base address and we'll compute your relic stats. (This GET page just helps you send a POST.)</p>
  <form onsubmit="event.preventDefault(); run();">
    <input id="addr" value="${prefill}" placeholder="0x..." style="padding:8px;border-radius:8px;background:#1a1f2a;color:white;width:420px">
    <button style="padding:8px 12px;margin-left:8px;border-radius:8px;">Compute</button>
  </form>
  <pre id="out" style="margin-top:16px;white-space:pre-wrap;"></pre>
  <script>
    async function run(){
      const address = (document.getElementById('addr').value||'').trim();
      const r = await fetch('', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ address }) });
      const text = await r.text();
      let j = null; try { j = JSON.parse(text); } catch (_) {}
      document.getElementById('out').textContent = j ? JSON.stringify(j,null,2) : text;
      if (j && j.address && typeof j.count === 'number') location.href = '/relic/' + address;
    }
  </script>
</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
