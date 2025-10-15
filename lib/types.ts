export type HexAddr = `0x${string}`;

export type Transfer = {
  token: HexAddr;     // ERC-20 contract
  from: HexAddr;
  to: HexAddr;
  value: bigint;      // raw units
  ts: number;         // unix seconds
  block: number;
  symbol?: string;
  decimals?: number;
};

export type Balance = {
  token: HexAddr;
  symbol: string;
  decimals: number;
  raw: bigint;        // raw units
};

export type PerTokenStats = {
  token_address: HexAddr;
  symbol: string;
  decimals: number;
  first_acquired_ts: string;
  last_full_exit_ts: string | null;
  last_sell_ts: string | null;
  held_since: string;
  continuous_hold_days: number;
  never_sold: boolean;
  no_sell_streak_days: number;
  balance_numeric: number;
  time_score: number;
};

export type RelicTier = "Bronze"|"Silver"|"Gold"|"Platinum"|"Obsidian";
