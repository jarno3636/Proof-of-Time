// lib/proofOfTime.ts
import type { Balance, HexAddr, PerTokenStats, Transfer } from "./types";

const SECS_PER_DAY = 86400;
const DUST_USD = 0.5;

const lower = (x: string) => x.toLowerCase();

function formatUnits(raw: bigint, decimals: number) {
  const s = raw.toString().padStart(decimals + 1, "0");
  const i = s.length - decimals;
  const int = s.slice(0, i);
  const frac = s.slice(i).replace(/0+$/, "");
  return Number(frac ? `${int}.${frac}` : int);
}

export function classifyTier(days: number) {
  if (days >= 730) return "Obsidian";
  if (days >= 365) return "Platinum";
  if (days >= 180) return "Gold";
  if (days >= 90) return "Silver";
  return "Bronze";
}

export function computePerTokenStats(
  address: HexAddr,
  token: HexAddr,
  transfersAll: Transfer[],
  balance: Balance,
  priceUSD?: number,
  nowSec = Math.floor(Date.now() / 1000)
): PerTokenStats | null {
  if (!balance || balance.raw === 0n) return null;

  const balanceNow = formatUnits(balance.raw, balance.decimals);
  if (priceUSD != null && balanceNow * priceUSD < DUST_USD) return null;

  const addr = lower(address);
  const tokenL = lower(token);

  const txs = transfersAll.filter((t) => lower(t.token) === tokenL);

  const transferSymbol =
    txs.find((t) => t.symbol && t.symbol !== "TKN")?.symbol;

  const resolvedSymbol =
    balance.symbol && balance.symbol !== "TKN"
      ? balance.symbol
      : transferSymbol && transferSymbol !== "TKN"
      ? transferSymbol
      : token.slice(2, 6).toUpperCase();

  if (!txs.length) {
    return {
      token_address: token,
      symbol: resolvedSymbol,
      decimals: balance.decimals,
      first_acquired_ts: new Date(nowSec * 1000).toISOString(),
      last_full_exit_ts: null,
      last_sell_ts: null,
      held_since: new Date(nowSec * 1000).toISOString(),
      continuous_hold_days: 0,
      no_sell_streak_days: 0,
      never_sold: true,
      balance_numeric: balanceNow,
      time_score: 0,
    };
  }

  const sorted = [...txs].sort((a, b) => a.block - b.block || a.ts - b.ts);

  let running = 0n;
  let firstAcquired: number | null = null;
  let lastSell: number | null = null;
  let lastExit: number | null = null;
  let everSold = false;

  for (const t of sorted) {
    const fromMe = lower(t.from) === addr;
    const toMe = lower(t.to) === addr;
    if (!fromMe && !toMe) continue;

    const prev = running;
    if (toMe) running += t.value;
    if (fromMe) running -= t.value;

    if (!firstAcquired && prev === 0n && running > 0n) {
      firstAcquired = t.ts;
    }

    if (fromMe && !toMe && t.value > 0n) {
      lastSell = t.ts;
      everSold = true;
    }

    if (prev > 0n && running === 0n) {
      lastExit = t.ts;
    }
  }

  if (!firstAcquired) firstAcquired = nowSec;

  const heldSince =
    lastExit && lastExit > firstAcquired ? lastExit : firstAcquired;

  const holdDays = Math.floor((nowSec - heldSince) / SECS_PER_DAY);
  const noSellDays = Math.floor(
    (nowSec - (lastSell ?? firstAcquired)) / SECS_PER_DAY
  );

  return {
    token_address: token,
    symbol: resolvedSymbol,
    decimals: balance.decimals,
    first_acquired_ts: new Date(firstAcquired * 1000).toISOString(),
    last_full_exit_ts: lastExit ? new Date(lastExit * 1000).toISOString() : null,
    last_sell_ts: lastSell ? new Date(lastSell * 1000).toISOString() : null,
    held_since: new Date(heldSince * 1000).toISOString(),
    continuous_hold_days: holdDays,
    no_sell_streak_days: noSellDays,
    never_sold: !everSold,
    balance_numeric: balanceNow,
    time_score: holdDays * Math.log(balanceNow + 1),
  };
}

export function pickTop3(stats: PerTokenStats[]) {
  return [...stats]
    .sort((a, b) => {
      const aDays = a.continuous_hold_days ?? 0;
      const bDays = b.continuous_hold_days ?? 0;
      return (
        b.time_score - a.time_score ||
        bDays - aDays ||
        a.symbol.localeCompare(b.symbol)
      );
    })
    .slice(0, 3);
}
