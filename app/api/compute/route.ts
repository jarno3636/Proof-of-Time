// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Balance, HexAddr, PerTokenStats, Transfer } from "@/lib/types";
import { computePerTokenStats } from "@/lib/proofOfTime";
import {
  fetchBalancesBase,
  fetchTransfersViaEtherscan,
  fetchTransfersBase,
  fetchPriceUSDMap,
} from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_TOKENS_PER_RUN = 80;

const isHexAddr = (s: string): s is HexAddr => /^0x[a-fA-F0-9]{40}$/.test(s);

function safeAddr(x: unknown): HexAddr | null {
  const s = String(x || "").trim();
  if (!isHexAddr(s)) return null;
  return s.toLowerCase() as HexAddr;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const body = await req.json().catch(() => ({} as any));
  const address = safeAddr((body as any)?.address);

  if (!address) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1) balances
  let balances: Balance[] = await fetchBalancesBase(address);
  if (balances.length > MAX_TOKENS_PER_RUN) balances = balances.slice(0, MAX_TOKENS_PER_RUN);

  // 2) transfers (prefer Etherscan; fallback Base logs)
  let transfers: Transfer[] = [];
  try {
    transfers = await fetchTransfersViaEtherscan(address);
    if (!transfers.length) transfers = await fetchTransfersBase(address);
  } catch {
    transfers = [];
  }

  // 3) prices
  const priceMap: Record<string, number> = await fetchPriceUSDMap(balances.map((b) => b.token)).catch(
    () => ({})
  );

  // 4) compute
  const stats: PerTokenStats[] = [];
  for (const b of balances) {
    const price = priceMap[b.token.toLowerCase()];
    const s = computePerTokenStats(address, b.token, transfers, b, price);
    if (s) stats.push(s);
  }

  // 5) persist (NO symbol poisoning)
  if (stats.length) {
    await supabase
      .from("token_holdings")
      .upsert(
        stats.map((s) => ({
          address: address.toLowerCase(),
          token_address: s.token_address.toLowerCase(),
          decimals: s.decimals,
          // store symbol if present but it's optional; UI must resolve via token_cache
          symbol: s.symbol,

          first_acquired_ts: s.first_acquired_ts,
          last_full_exit_ts: s.last_full_exit_ts,
          last_sell_ts: s.last_sell_ts,
          held_since: s.held_since,

          continuous_hold_days: s.continuous_hold_days,
          no_sell_streak_days: s.no_sell_streak_days,
          never_sold: s.never_sold,

          balance_numeric: s.balance_numeric,
          time_score: s.time_score,

          last_computed_at: new Date().toISOString(),
        })),
        { onConflict: "address,token_address" }
      )
      .catch(() => null);
  }

  return NextResponse.json({
    address,
    count: stats.length,
    elapsedMs: Date.now() - started,
  });
}
