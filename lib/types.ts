// lib/types.ts

export type HexAddr = `0x${string}`;

export type Transfer = {
  token: HexAddr;
  from: HexAddr;
  to: HexAddr;
  value: bigint;
  ts: number;
  block: number;
  symbol?: string;
  decimals?: number;
};

export type Balance = {
  token: HexAddr;
  symbol: string;
  decimals: number;
  raw: bigint;
};

export type PerTokenStats = {
  token_address: HexAddr;
  symbol: string;
  decimals: number;

  // ⬇️ anchors MAY be null (do not overwrite DB)
  first_acquired_ts: string | null;
  last_full_exit_ts: string | null;
  last_sell_ts: string | null;
  held_since: string | null;

  // ⬇️ derived values may be null until anchored
  continuous_hold_days: number | null;
  no_sell_streak_days: number | null;

  never_sold: boolean;
  balance_numeric: number;
  time_score: number;
};

export type RelicTier =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Obsidian";
