import type {
  Balance,
  HexAddr,
  PerTokenStats,
  Transfer,
  RelicTier,
} from "./types";

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
  if (s.length === 4 && /^[0-9A-F]{4}$/.test(s)) return null;
  if (s.length > 24) return null;
  return s;
}

/* ───────────────── core logic ───────────────── */

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

  if (priceUSD != null && usdNow < DUST_USD) return null;

  const addr = safeLower(address);
  const tokenL = safeLower(token);

  const txs = transfersAll.filter(
    (t) => safeLower(t.token) === tokenL
  );

  const balanceSymbol = normalizePossibleSymbol(balance.symbol);
  const transferSymbol = normalizePossibleSymbol(
    txs.find((t) => t.symbol)?.symbol
  );

  const resolvedSymbol = balanceSymbol ?? transferSymbol ?? null;

  /* ───────── NO TRANSFERS → SAFE ANCHOR ───────── */
  if (!txs.length) {
    const anchorIso = new Date((nowSec - SECS_PER_DAY) * 1000).toISOString();

    return {
      token_address: token,
      symbol: resolvedSymbol,
      decimals: balance.decimals,

      first_acquired_ts: anchorIso,
      last_full_exit_ts: null,
      last_sell_ts: null,
      held_since: anchorIso,

      continuous_hold_days: null,
      never_sold: true,
      no_sell_streak_days: null,

      balance_numeric: balanceNow,
      time_score: 0,
    };
  }

  /* ───────── TRANSFER-BASED ANCHOR ───────── */

  const sorted = [...txs].sort(
    (a, b) => a.block - b.block || a.ts - b.ts
  );

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

    const prev = running;
    if (toMe) running += t.value;
    if (fromMe) running -= t.value;

    if (!firstAcquired && prev === 0n && running > 0n) {
      firstAcquired = t.ts;
    }

    if (fromMe && t.value > 0n) {
      lastSell = t.ts;
      everSold = true;
    }

    if (prev > 0n && running === 0n) {
      lastFullExit = t.ts;
    }
  }

  if (!firstAcquired) firstAcquired = nowSec;

  const heldSince =
    lastFullExit && lastFullExit > firstAcquired
      ? lastFullExit
      : firstAcquired;

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

    continuous_hold_days: null,
    never_sold: !everSold,
    no_sell_streak_days: null,

    balance_numeric: balanceNow,
    time_score: 0,
  };
}
