// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computePerTokenStats } from "@/lib/proofOfTime";
import { Balance, HexAddr, PerTokenStats } from "@/lib/types";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";

/* ───────────────────── Alchemy Client ───────────────────── */

const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY!,
  network: Network.BASE_MAINNET,
});

/* ───────────────────── Helpers ───────────────────── */

function isHexAddress(s: string): s is HexAddr {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

/* ───────────────────── Data Fetchers (Alchemy) ───────────────────── */

async function fetchBalancesAlchemy(address: HexAddr): Promise<Balance[]> {
  const res = await alchemy.core.getTokenBalances(address);
  const out: Balance[] = [];

  for (const tb of res.tokenBalances) {
    if (!tb.tokenBalance || tb.tokenBalance === "0") continue;

    const meta = await alchemy.core.getTokenMetadata(tb.contractAddress);

    out.push({
      token: tb.contractAddress.toLowerCase() as HexAddr,
      symbol: meta.symbol || "TKN",
      decimals: meta.decimals ?? 18,
      raw: BigInt(tb.tokenBalance),
    });
  }

  return out;
}

async function fetchTransfersAlchemy(address: HexAddr) {
  const res = await alchemy.core.getAssetTransfers({
    fromAddress: address,
    toAddress: address,
    category: [AssetTransfersCategory.ERC20],
    withMetadata: true,
    maxCount: 10000,
  });

  return res.transfers
    .filter((t) => t.rawContract?.address)
    .map((t) => ({
      token: t.rawContract.address!.toLowerCase() as HexAddr,
      from: t.from!.toLowerCase() as HexAddr,
      to: t.to!.toLowerCase() as HexAddr,
      value: BigInt(t.rawContract.value || "0"),
      block: parseInt(t.blockNum, 16),
      ts: Math.floor(
        new Date(t.metadata!.blockTimestamp).getTime() / 1000
      ),
      symbol: t.asset || "TKN",
      decimals: Number(t.rawContract.decimal ?? 18),
    }));
}

/* ───────────────────── POST /api/compute ───────────────────── */

export async function POST(req: NextRequest) {
  try {
    // Parse address
    let raw: string | undefined;
    try {
      const j = await req.json().catch(() => ({}));
      raw = (j?.address as string | undefined)?.trim();
    } catch {}

    if (!raw) {
      raw = new URL(req.url).searchParams.get("address")?.trim();
    }

    if (!raw || !isHexAddress(raw)) {
      return NextResponse.json(
        { error: "Invalid address (expected 0x…40 hex)" },
        { status: 400 }
      );
    }

    const address = raw.toLowerCase() as HexAddr;

    // Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase env missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Always ensure wallet row exists
    await supabase.from("wallets").upsert({ address }).throwOnError();

    /* ───────────── Fresh chain data (Alchemy) ───────────── */

    const [balances, transfers] = await Promise.all([
      fetchBalancesAlchemy(address),
      fetchTransfersAlchemy(address),
    ]);

    if (!balances.length) {
      return NextResponse.json({
        address,
        count: 0,
        note: "No non-zero ERC-20 balances detected on Base.",
      });
    }

    /* ───────────── Compute stats ───────────── */

    const stats: PerTokenStats[] = [];

    for (const b of balances) {
      const s = computePerTokenStats(
        address,
        b.token,
        transfers,
        b,
        undefined // price optional (can add later)
      );
      if (s) stats.push(s);
    }

    /* ───────────── Persist (overwrite cache) ───────────── */

    if (stats.length) {
      const rows = stats.map((s) => ({
        address,
        token_address: s.token_address.toLowerCase(),
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
    console.error("compute error:", err);
    return NextResponse.json(
      { error: err?.message || "Unknown compute error" },
      { status: 500 }
    );
  }
}

/* ───────────────────── GET /api/compute ───────────────────── */

export async function GET() {
  return new Response(
    `<!doctype html>
<html>
<body style="font-family:system-ui;padding:24px;background:#0B0E14;color:#EDEEF2">
<h1>Proof of Time – Compute</h1>
<p>Enter a Base address and compute relic stats.</p>
<form onsubmit="event.preventDefault(); run();">
  <input id="addr" placeholder="0x..." style="padding:8px;border-radius:8px;background:#1a1f2a;color:white;width:420px">
  <button id="btn" style="padding:8px 12px;margin-left:8px;border-radius:8px;">Verify</button>
</form>
<pre id="out" style="margin-top:16px;"></pre>
<script>
async function run(){
  const btn = document.getElementById('btn');
  const out = document.getElementById('out');
  const address = document.getElementById('addr').value.trim();
  btn.disabled = true;
  out.textContent = '⏳ Verifying…';
  try {
    const r = await fetch('', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ address })
    });
    const j = await r.json();
    out.textContent = JSON.stringify(j,null,2);
    if (j.address) location.href = '/relic/' + j.address;
  } catch(e){
    out.textContent = '❌ Error';
  } finally {
    btn.disabled = false;
  }
}
</script>
</body>
</html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
