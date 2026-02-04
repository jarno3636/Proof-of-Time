// lib/proofOfTime.ts
import type { Balance, HexAddr, PerTokenStats, Transfer } from "./types";

const SECS_PER_DAY = 86400;
const DUST_USD = 0.5;

function safeLower<T extends string>(x: T) {
  return x.toLowerCase() as T;
}

function formatUnits(raw: bigint, decimals: number) {
  const s = raw.toString().padStart(decimals + 1, "0");
  const i = s.length - decimals;
  const int = s.slice(0, i);
  const frac = s.slice(i).replace(/0+$/, "");
  return Number(frac ? `${int}.${frac}` : int);
}

export function classifyTier(
  days: number
): "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian" {
  if (days >= 730) return "Obsidian";
  if (days >= 365) return "Platinum";
  if (days >= 180) return "Gold";
  if (days >= 90) return "Silver";
  return "Bronze";
}

/**
 * “Old API” compute using a provided transfers list.
 * Your compute route below no longer relies on this for correctness,
 * but it’s still useful for local testing.
 */
export function computePerTokenStats(
  address: HexAddr,
  token: HexAddr,
  transfersAll: Transfer[],
  balance: Balance,
  priceUSD: number | undefined,
  nowSec = Math.floor(Date.now() / 1000)
): PerTokenStats | null {
  if (!balance || balance.raw === 0n) return null;

  const balanceNow = formatUnits(balance.raw, balance.decimals);
  const usdNow = (priceUSD ?? 0) * balanceNow;

  // Keep dust filter only for priced tokens; if no price, keep token (otherwise big wallets lose long-helds)
  if (priceUSD != null && usdNow < DUST_USD) return null;

  const addr = safeLower(address);
  const tokenL = safeLower(token);

  const txs = transfersAll.filter((t) => safeLower(t.token) === tokenL);
  const transferSymbol = txs.find((t) => t.symbol && t.symbol !== "TKN")?.symbol;

  const resolvedSymbol =
    balance.symbol && balance.symbol !== "TKN"
      ? balance.symbol
      : transferSymbol
      ? transferSymbol
      : token.slice(2, 6).toUpperCase();

  // No transfers provided → treat as held “since now” (cannot infer genesis without indexer/history)
  if (!txs.length) {
    const heldDays = 0;
    return {
      token_address: token,
      symbol: resolvedSymbol,
      decimals: balance.decimals,
      first_acquired_ts: new Date(nowSec * 1000).toISOString(),
      last_full_exit_ts: null,
      last_sell_ts: null,
      held_since: new Date(nowSec * 1000).toISOString(),
      continuous_hold_days: heldDays,
      never_sold: true,
      no_sell_streak_days: heldDays,
      balance_numeric: balanceNow,
      time_score: 0,
    };
  }

  // Sort by time
  const sorted = [...txs].sort((a, b) => a.block - b.block || a.ts - b.ts);

  let firstAcquired: number | null = null;
  let lastFullExit: number | null = null;
  let lastSell: number | null = null;
  let everSold = false;

  let running = 0n;

  for (const t of sorted) {
    const fromMe = safeLower(t.from) === addr;
    const toMe = safeLower(t.to) === addr;

    // ignore weird
    if (!fromMe && !toMe) continue;

    // self-transfer => no net change
    if (fromMe && toMe) continue;

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
      lastFullExit = t.ts;
    }
  }

  if (!firstAcquired) firstAcquired = nowSec;

  const heldSince =
    lastFullExit && lastFullExit > firstAcquired ? lastFullExit : firstAcquired;

  const continuousHoldDays = Math.max(
    0,
    Math.floor((nowSec - heldSince) / SECS_PER_DAY)
  );

  const noSellSince = lastSell ?? firstAcquired;
  const noSellStreakDays = Math.max(
    0,
    Math.floor((nowSec - noSellSince) / SECS_PER_DAY)
  );

  return {
    token_address: token,
    symbol: resolvedSymbol,
    decimals: balance.decimals,
    first_acquired_ts: new Date(firstAcquired * 1000).toISOString(),
    last_full_exit_ts: lastFullExit ? new Date(lastFullExit * 1000).toISOString() : null,
    last_sell_ts: lastSell ? new Date(lastSell * 1000).toISOString() : null,
    held_since: new Date(heldSince * 1000).toISOString(),
    continuous_hold_days: continuousHoldDays,
    never_sold: !everSold,
    no_sell_streak_days: noSellStreakDays,
    balance_numeric: balanceNow,
    time_score: continuousHoldDays * Math.log(balanceNow + 1),
  };
}

export function pickTop3(stats: PerTokenStats[]) {
  return [...stats]
    .sort(
      (a, b) =>
        b.time_score - a.time_score ||
        b.continuous_hold_days - a.continuous_hold_days ||
        a.symbol.localeCompare(b.symbol)
    )
    .slice(0, 3);
}
