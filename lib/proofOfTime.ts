// lib/proofOfTime.ts
import type { Balance, HexAddr, PerTokenStats, Transfer, RelicTier } from "./types";

const SECS_PER_DAY = 86400;
const DUST_USD = 0.5;

/* ───────────────── helpers ───────────────── */

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

export function classifyTier(days: number): RelicTier {
  if (days >= 730) return "Obsidian";
  if (days >= 365) return "Platinum";
  if (days >= 180) return "Gold";
  if (days >= 90) return "Silver";
  return "Bronze";
}

function normalizePossibleSymbol(sym: unknown): string | null {
  if (typeof sym !== "string") return null;
  const s = sym.trim();
  if (!s) return null;
  if (s.toUpperCase() === "TKN") return null;
  if (s.length === 4 && /^[0-9A-F]{4}$/.test(s)) return null; // kill B8D9 garbage
  if (s.length > 24) return null;
  return s;
}

function parseIsoToSec(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

type PrevHolding = {
  token_address: HexAddr;
  first_acquired_ts: string | null;
  held_since: string | null;
  last_sell_ts: string | null;
  last_full_exit_ts: string | null;
  never_sold: boolean;
};

/* ───────────────── core logic ───────────────── */

/**
 * Compute holding stats for a token.
 *
 * KEY FIX:
 * - If we already have a valid anchor in DB for a token that is "never_sold" and still has balance,
 *   we LOCK that anchor and just advance days using wall-clock time.
 *
 * This prevents "stuck days" when transfer APIs truncate deep history.
 */
export function computePerTokenStats(
  address: HexAddr,
  token: HexAddr,
  transfersAll: Transfer[],
  balance: Balance,
  priceUSD: number | undefined,
  nowSec = Math.floor(Date.now() / 1000),
  prev?: PrevHolding
): PerTokenStats | null {
  if (!balance || balance.raw === 0n) return null;

  const balanceNow = formatUnits(balance.raw, balance.decimals);
  const usdNow = (priceUSD ?? 0) * balanceNow;

  // dust filter only if token has price
  if (priceUSD != null && usdNow < DUST_USD) return null;

  const addr = safeLower(address);
  const tokenL = safeLower(token);

  // prefer balance symbol, then transfer symbol
  const txsForToken = transfersAll.filter((t) => safeLower(t.token) === tokenL);

  const balanceSymbol = normalizePossibleSymbol(balance.symbol);
  const transferSymbol = normalizePossibleSymbol(
    txsForToken.find((t) => t.symbol && String(t.symbol).toUpperCase() !== "TKN")?.symbol
  );

  const resolvedSymbol: string | null = balanceSymbol ?? transferSymbol ?? null;

  /* ───────── 1) ANCHOR LOCK PATH ───────── */
  if (prev?.never_sold && prev.held_since) {
    const heldSinceSec = parseIsoToSec(prev.held_since);
    const firstAcqSec = parseIsoToSec(prev.first_acquired_ts) ?? heldSinceSec;

    if (heldSinceSec != null && firstAcqSec != null) {
      const continuousHoldDays = Math.max(
        0,
        Math.floor((nowSec - heldSinceSec) / SECS_PER_DAY)
      );

      const lastSellSec = parseIsoToSec(prev.last_sell_ts);
      const noSellSinceSec = lastSellSec ?? firstAcqSec;
      const noSellStreakDays = Math.max(
        0,
        Math.floor((nowSec - noSellSinceSec) / SECS_PER_DAY)
      );

      return {
        token_address: token,
        symbol: resolvedSymbol, // still optional
        decimals: balance.decimals,

        first_acquired_ts: prev.first_acquired_ts ?? prev.held_since,
        last_full_exit_ts: null,
        last_sell_ts: prev.last_sell_ts ?? null,
        held_since: prev.held_since,

        continuous_hold_days: continuousHoldDays,
        never_sold: true,
        no_sell_streak_days: noSellStreakDays,

        balance_numeric: balanceNow,
        time_score: continuousHoldDays * Math.log(balanceNow + 1),
      };
    }
  }

  /* ───────── 2) TRANSFER-BASED INFERENCE ───────── */

  // If transfers are missing/empty (API truncation or failure) and we DON'T have a prior anchor:
  // be honest: we can only anchor "first seen now" (0 days). Next successful deep-history compute
  // will correct it, but we will NOT invent 1-day anchors.
  if (!txsForToken.length) {
    const nowIso = new Date(nowSec * 1000).toISOString();
    return {
      token_address: token,
      symbol: resolvedSymbol,
      decimals: balance.decimals,

      first_acquired_ts: nowIso,
      last_full_exit_ts: null,
      last_sell_ts: null,
      held_since: nowIso,

      continuous_hold_days: 0,
      never_sold: true,
      no_sell_streak_days: 0,

      balance_numeric: balanceNow,
      time_score: 0,
    };
  }

  const sorted = [...txsForToken].sort((a, b) => a.block - b.block || a.ts - b.ts);

  let firstAcquired: number | null = null;
  let lastFullExit: number | null = null;
  let lastSell: number | null = null;
  let everSold = false;

  let running = 0n;

  for (const t of sorted) {
    const fromMe = safeLower(t.from) === addr;
    const toMe = safeLower(t.to) === addr;

    if (!fromMe && !toMe) continue;
    if (fromMe && toMe) continue;

    const prevRun = running;
    if (toMe) running += t.value;
    if (fromMe) running -= t.value;

    if (!firstAcquired && prevRun === 0n && running > 0n) {
      firstAcquired = t.ts || null;
    }

    if (fromMe && !toMe && t.value > 0n) {
      lastSell = t.ts || null;
      everSold = true;
    }

    if (prevRun > 0n && running === 0n) {
      lastFullExit = t.ts || null;
    }
  }

  if (!firstAcquired) firstAcquired = nowSec;

  // held_since is the latest point we "re-entered" from zero.
  // If we fully exited after first acquired, we anchor from that exit point (re-acquire moment might be missing).
  // This matches your prior behavior and avoids inventing purchases.
  const heldSinceSec =
    lastFullExit && lastFullExit > firstAcquired ? lastFullExit : firstAcquired;

  const continuousHoldDays = Math.max(
    0,
    Math.floor((nowSec - heldSinceSec) / SECS_PER_DAY)
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
    held_since: new Date(heldSinceSec * 1000).toISOString(),

    continuous_hold_days: continuousHoldDays,
    never_sold: !everSold,
    no_sell_streak_days: noSellStreakDays,

    balance_numeric: balanceNow,
    time_score: continuousHoldDays * Math.log(balanceNow + 1),
  };
}

/* ───────────────── ranking ───────────────── */

export function pickTop3(stats: PerTokenStats[]) {
  return [...stats]
    .sort((a, b) => {
      const aDays = a.continuous_hold_days ?? 0;
      const bDays = b.continuous_hold_days ?? 0;
      return (
        b.time_score - a.time_score ||
        bDays - aDays ||
        String(a.token_address).localeCompare(String(b.token_address))
      );
    })
    .slice(0, 3);
}
