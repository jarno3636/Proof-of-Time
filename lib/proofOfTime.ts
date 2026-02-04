// lib/proofOfTime.ts
import { Balance, HexAddr, PerTokenStats, Transfer } from "./types";

const SECS_PER_DAY = 86400;
const DUST_USD = 0.5;

const toLower = (x: string) => x.toLowerCase();

function groupByBlock<T extends { block: number }>(arr: T[]) {
  const m = new Map<number, T[]>();
  for (const t of arr) {
    const g = m.get(t.block);
    if (g) g.push(t);
    else m.set(t.block, [t]);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

function formatUnits(raw: bigint, decimals: number) {
  const s = raw.toString().padStart(decimals + 1, "0");
  const i = s.length - decimals;
  const int = s.slice(0, i);
  const frac = s.slice(i).replace(/0+$/, "");
  return Number(frac ? `${int}.${frac}` : int);
}

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
  if ((priceUSD ?? 0) * balanceNow < DUST_USD) return null;

  const addr = toLower(address);
  const tokenL = toLower(token);

  const txs = transfersAll.filter(
    (t) => toLower(t.token) === tokenL
  );

  const resolvedSymbol =
    balance.symbol && balance.symbol !== "TKN"
      ? balance.symbol
      : txs.find((t) => t.symbol && t.symbol !== "TKN")?.symbol
      ?? `0x${token.slice(2, 6).toUpperCase()}`;

  // ─────────────────────────────
  // NO TRANSFERS → DO NOT RESET
  // ─────────────────────────────
  if (!txs.length) {
    return {
      token_address: token,
      symbol: resolvedSymbol,
      decimals: balance.decimals,
      first_acquired_ts: null,
      last_full_exit_ts: null,
      last_sell_ts: null,
      held_since: null,
      continuous_hold_days: null,
      no_sell_streak_days: null,
      never_sold: true,
      balance_numeric: balanceNow,
      time_score: 0,
    };
  }

  const byBlock = groupByBlock(txs);

  let firstAcquired: number | null = null;
  let lastFullExit: number | null = null;
  let lastSell: number | null = null;
  let running = 0n;
  let everSold = false;

  for (const [, blockTxs] of byBlock) {
    blockTxs.sort((a, b) => a.ts - b.ts);
    let net = 0n;
    let blockTs = blockTxs[0].ts;

    for (const t of blockTxs) {
      if (toLower(t.to) === addr) net += t.value;
      if (toLower(t.from) === addr) net -= t.value;

      if (!firstAcquired && net > 0n) {
        firstAcquired = t.ts;
      }
      blockTs = t.ts;
    }

    if (net < 0n) {
      lastSell = blockTs;
      everSold = true;
    }

    running += net;
    if (running === 0n) lastFullExit = blockTs;
  }

  if (!firstAcquired) return null;

  const heldSince =
    lastFullExit && lastFullExit > firstAcquired
      ? lastFullExit
      : firstAcquired;

  const continuousHoldDays = Math.floor(
    (nowSec - heldSince) / SECS_PER_DAY
  );

  const noSellSince = lastSell ?? firstAcquired;
  const noSellStreakDays = Math.floor(
    (nowSec - noSellSince) / SECS_PER_DAY
  );

  return {
    token_address: token,
    symbol: resolvedSymbol,
    decimals: balance.decimals,
    first_acquired_ts: new Date(firstAcquired * 1000).toISOString(),
    last_full_exit_ts: lastFullExit
      ? new Date(lastFullExit * 1000).toISOString()
      : null,
    last_sell_ts: lastSell
      ? new Date(lastSell * 1000).toISOString()
      : null,
    held_since: new Date(heldSince * 1000).toISOString(),
    continuous_hold_days: Math.max(0, continuousHoldDays),
    no_sell_streak_days: Math.max(0, noSellStreakDays),
    never_sold: !everSold,
    balance_numeric: balanceNow,
    time_score: Math.max(0, continuousHoldDays) * Math.log(balanceNow + 1),
  };
}
