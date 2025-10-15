// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fetchBalancesBase, fetchPriceUSDMap, fetchTransfersBase } from "@/lib/data";
import { computePerTokenStats } from "@/lib/proofOfTime";
import type { Balance, HexAddr, PerTokenStats } from "@/lib/types";
import { createClient } from "@supabase/supabase-js";

// ✅ Run only on Node.js to avoid silent Edge runtime failures
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- Utility ---------------------------------------------------------------
function isHexAddress(s: string): s is HexAddr {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

// --- POST /api/compute -----------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    // Parse address
    let address: string | undefined;
    try {
      const body = await req.json();
      address = body?.address;
    } catch {
      const q = new URL(req.url).searchParams.get("address");
      address = q || undefined;
    }

    if (!address || !isHexAddress(address)) {
      return NextResponse.json({ error: "Invalid address (expected 0x…40 hex)" }, { status: 400 });
    }

    // Supabase setup
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      return NextResponse.json(
        { error: "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY)" },
        { status: 500 }
      );
    }
    const supabase = createClient(url, key);

    // Fetch blockchain data
    const [transfers, balances] = await Promise.all([
      fetchTransfersBase(address as HexAddr),
      fetchBalancesBase(address as HexAddr),
    ]);

    // Always ensure wallet record exists
    await supabase.from("wallets").upsert({ address }).throwOnError();

    if (!balances?.length) {
      return NextResponse.json({ address, count: 0, note: "No non-zero ERC20 balances found on Base." });
    }

    // Fetch prices
    const priceMap = await fetchPriceUSDMap(balances.map(b => b.token));

    // Compute per-token stats
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

    // Store results
    if (stats.length) {
      const rows = stats.map(s => ({
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
        console.error("❌ Supabase upsert error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ address, count: stats.length });
  } catch (err: any) {
    console.error("❌ Compute route crashed:", err);
    return new Response(
      `Internal compute error:\n${err?.message || String(err)}`,
      { status: 500, headers: { "content-type": "text/plain" } }
    );
  }
}

// --- GET /api/compute ------------------------------------------------------
export async function GET(req: NextRequest) {
  return new Response(
    `<!doctype html>
<html><body style="font-family:system-ui;padding:24px;background:#0B0E14;color:#EDEEF2">
  <h1>Proof of Time – Compute</h1>
  <p>Enter a Base address below to test the endpoint (uses POST under the hood).</p>
  <form onsubmit="event.preventDefault(); run();">
    <input id="addr" placeholder="0x..." style="padding:8px;border-radius:8px;background:#1a1f2a;color:white;width:420px">
    <button style="padding:8px 12px;margin-left:8px;border-radius:8px;">Compute</button>
  </form>
  <pre id="out" style="margin-top:16px;white-space:pre-wrap;background:#111;padding:12px;border-radius:8px;"></pre>
  <script>
    async function run(){
      const address = (document.getElementById('addr').value||'').trim();
      const out = document.getElementById('out');
      out.textContent = '⏳ Computing for ' + address + ' ...';
      try {
        const res = await fetch('', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ address }) });
        const text = await res.text();
        out.textContent = text;
      } catch(e){ out.textContent = '❌ Request error: ' + e; }
    }
  </script>
</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
