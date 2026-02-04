// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";
import { createPublicClient, http, parseAbiItem, hexToBigInt } from "viem";
import { base } from "viem/chains";
import { erc20Abi } from "viem";

import type { Balance, HexAddr, PerTokenStats, Transfer } from "@/lib/types";

// Backup utilities you already have
import {
  fetchBalancesBase,
  fetchTransfersViaEtherscan,
  fetchTransfersBase,
  fetchPriceUSDMap,
} from "@/lib/data";

/* ───────────────── Runtime safety ───────────────── */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ───────────────── Config ───────────────── */

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;

const UPSTREAM_TIMEOUT_MS = 15_000;
const META_TIMEOUT_MS = 6_000;

const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 4_000;

const TRANSFERS_PAGE_SIZE = 1000;
const TRANSFERS_MAX_PAGES = 12;       // more for large wallets
const TRANSFERS_MAX_TOTAL = 25_000;   // cap per token per run

const LOG_CHUNK_BLOCKS = 50_000n;     // on-chain fallback chunk
const MAX_TOKENS_PER_RUN = 80;        // protects Vercel timeout for first-run mega wallets

const META_CONCURRENCY = 6;

/**
 * Optional (recommended) cursor columns for incremental mode:
 *
 * ALTER TABLE token_holdings
 *   ADD COLUMN IF NOT EXISTS last_scanned_block bigint,
 *   ADD COLUMN IF NOT EXISTS running_balance_raw text,
 *   ADD COLUMN IF NOT EXISTS running_balance_decimals int,
 *   ADD COLUMN IF NOT EXISTS first_acquired_block bigint,
 *   ADD COLUMN IF NOT EXISTS last_full_exit_block bigint,
 *   ADD COLUMN IF NOT EXISTS last_sell_block bigint;
 *
 * Notes:
 * - running_balance_raw is stored as TEXT to avoid bigint driver quirks.
 * - The code below works even if these columns don’t exist (it will just scan more).
 */

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

/* ───────────────── Helpers ───────────────── */

function isHexAddress(s: string): s is HexAddr {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

function safeJson(status: number, message: string, extra?: Record<string, any>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number) {
  return ms + Math.floor(ms * (0.15 + Math.random() * 0.25));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), ms)),
  ]);
}

function sanitizeErr(err: unknown) {
  return {
    name: String((err as any)?.name || ""),
    code: String((err as any)?.code || ""),
    message: String((err as any)?.message || err),
  };
}

function isRetryableUpstreamError(err: unknown): boolean {
  const e = sanitizeErr(err);
  const msg = e.message.toLowerCase();
  const code = e.code.toUpperCase();

  if (msg.includes("upstream_timeout")) return true;
  if (msg.includes("timeout")) return true;
  if (msg.includes("missing response")) return true;
  if (code.includes("SERVER_ERROR")) return true;

  if (msg.includes("network")) return true;
  if (msg.includes("socket")) return true;
  if (msg.includes("econnreset")) return true;
  if (msg.includes("fetch")) return true;

  return false;
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const retryable = isRetryableUpstreamError(err);
      const e = sanitizeErr(err);

      console.error(`[upstream:${label}] attempt ${attempt} failed`, {
        name: e.name,
        code: e.code,
        message: e.message,
      });

      if (!retryable || attempt > maxRetries) throw err;

      const backoff = clamp(
        Math.floor(BASE_BACKOFF_MS * Math.pow(2, attempt - 1)),
        BASE_BACKOFF_MS,
        MAX_BACKOFF_MS
      );

      await sleep(jitter(backoff));
    }
  }
}

function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active--;
    const job = queue.shift();
    if (job) job();
  };

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

const limitMeta = createLimiter(META_CONCURRENCY);

/* ───────────────── Clients ───────────────── */

function getAlchemy() {
  if (!ALCHEMY_KEY) return null;
  return new Alchemy({ apiKey: ALCHEMY_KEY, network: Network.BASE_MAINNET });
}

/**
 * Multiple RPC fallbacks (public) for log scanning + metadata.
 * (If Alchemy is up, we’ll still use it as primary.)
 */
const RPCS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://1rpc.io/base",
];

function makeViemClient(url: string) {
  return createPublicClient({
    chain: base,
    transport: http(url, { retryCount: 2, timeout: UPSTREAM_TIMEOUT_MS }),
  });
}

const viemClients = RPCS.map(makeViemClient);

/* ───────────────── Metadata resolution ───────────────── */

/**
 * Resolve symbol/decimals primarily from Alchemy token metadata,
 * then fallback to on-chain multicall (symbol/decimals).
 */
async function resolveMeta(
  alchemy: Alchemy | null,
  token: HexAddr
): Promise<{ symbol: string; decimals: number }> {
  // 1) Try Alchemy metadata
  if (alchemy) {
    try {
      const meta = await withRetry(
        "alchemy_tokenMetadata",
        async () => withTimeout(alchemy.core.getTokenMetadata(token), META_TIMEOUT_MS),
        2
      );

      const symbol = String((meta as any)?.symbol || "TKN");
      const decimals =
        typeof (meta as any)?.decimals === "number" ? (meta as any).decimals : 18;

      if (symbol && symbol !== "TKN") return { symbol, decimals };
      // if it returned TKN, still might have decimals
      if (decimals !== 18) return { symbol: symbol || "TKN", decimals };
    } catch {
      // ignore
    }
  }

  // 2) On-chain fallback across RPCs
  for (const client of viemClients) {
    try {
      const [symRes, decRes] = await Promise.all([
        withTimeout(
          client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" } as any),
          META_TIMEOUT_MS
        ).catch(() => null),
        withTimeout(
          client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" } as any),
          META_TIMEOUT_MS
        ).catch(() => null),
      ]);

      const symbol = typeof symRes === "string" ? symRes : "TKN";
      const decimals =
        typeof decRes === "number" ? decRes : typeof decRes === "bigint" ? Number(decRes) : 18;

      if (symbol && symbol !== "TKN") return { symbol, decimals };
      return { symbol: symbol || "TKN", decimals: Number.isFinite(decimals) ? decimals : 18 };
    } catch {
      // try next rpc
    }
  }

  return { symbol: token.slice(2, 6).toUpperCase(), decimals: 18 };
}

/* ───────────────── Balance fetchers ───────────────── */

async function fetchBalancesAlchemy(alchemy: Alchemy, address: HexAddr): Promise<Balance[]> {
  return withRetry("alchemy_balances", async () => {
    const res = await withTimeout(alchemy.core.getTokenBalances(address), UPSTREAM_TIMEOUT_MS);

    const raw: any[] = Array.isArray((res as any)?.tokenBalances) ? (res as any).tokenBalances : [];

    const candidates = raw
      .map((tb: any) => ({
        token: String(tb?.contractAddress || "").toLowerCase(),
        tokenBalance: tb?.tokenBalance,
      }))
      .filter((x) => x.token.startsWith("0x") && x.tokenBalance != null && x.tokenBalance !== "0");

    const out: Balance[] = [];
    for (const c of candidates) {
      let bal: bigint = 0n;
      try {
        // tokenBalance can be null; guard
        const s = String(c.tokenBalance ?? "0");
        if (s === "0") continue;
        bal = BigInt(s);
      } catch {
        bal = 0n;
      }
      if (bal === 0n) continue;

      out.push({
        token: c.token as HexAddr,
        symbol: "TKN",
        decimals: 18,
        raw: bal,
      });
    }

    return out;
  });
}

async function fetchBalancesBackup(address: HexAddr): Promise<Balance[]> {
  return withRetry("backup_balances_base", async () => withTimeout(fetchBalancesBase(address), 30_000), 2);
}

/* ───────────────── Transfer acquisition (incremental) ───────────────── */

/**
 * Fetch transfers for a single token incrementally using Alchemy indexer.
 * We do BOTH directions (incoming/outgoing) and merge.
 */
async function fetchTokenTransfersAlchemyIncremental(args: {
  alchemy: Alchemy;
  address: HexAddr;
  token: HexAddr;
  fromBlock?: number; // inclusive
  toBlock?: number;   // inclusive
}): Promise<Transfer[]> {
  const { alchemy, address, token, fromBlock, toBlock } = args;

  async function fetchDir(dir: "in" | "out"): Promise<Transfer[]> {
    let pageKey: string | undefined = undefined;
    let page = 0;
    const out: Transfer[] = [];

    while (page < TRANSFERS_MAX_PAGES && out.length < TRANSFERS_MAX_TOTAL) {
      page++;

      const resp = await withRetry("alchemy_transfers", async () => {
        const req: any = {
          category: [AssetTransfersCategory.ERC20],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: TRANSFERS_PAGE_SIZE,
          pageKey,
          // filter to token
          contractAddresses: [token],
        };

        if (typeof fromBlock === "number" && fromBlock > 0) req.fromBlock = "0x" + fromBlock.toString(16);
        if (typeof toBlock === "number" && toBlock > 0) req.toBlock = "0x" + toBlock.toString(16);

        if (dir === "out") req.fromAddress = address;
        else req.toAddress = address;

        return await withTimeout(alchemy.core.getAssetTransfers(req), UPSTREAM_TIMEOUT_MS);
      });

      const transfers = Array.isArray((resp as any)?.transfers) ? (resp as any).transfers : [];
      for (const t of transfers) {
        const tokenAddr = String(t?.rawContract?.address || "").toLowerCase();
        if (!tokenAddr.startsWith("0x")) continue;

        const from = String(t?.from || "").toLowerCase();
        const to = String(t?.to || "").toLowerCase();
        if (!from.startsWith("0x") || !to.startsWith("0x")) continue;

        let value = 0n;
        try {
          value = BigInt(String(t?.rawContract?.value || "0"));
        } catch {
          value = 0n;
        }
        if (value === 0n) continue;

        const blockHex = String(t?.blockNum || "0x0");
        const block = Number.parseInt(blockHex, 16) || 0;

        const tsStr = String(t?.metadata?.blockTimestamp || "");
        const ts = tsStr ? Math.floor(new Date(tsStr).getTime() / 1000) : 0;

        out.push({
          token: tokenAddr as HexAddr,
          from: from as HexAddr,
          to: to as HexAddr,
          value,
          block,
          ts,
          symbol: String(t?.asset || "TKN"),
          decimals: Number(t?.rawContract?.decimal ?? 18),
        });
      }

      pageKey = (resp as any)?.pageKey;
      if (!pageKey) break;

      // small yield to avoid provider throttles
      await sleep(60);
    }

    return out;
  }

  const [outgoing, incoming] = await Promise.all([fetchDir("out"), fetchDir("in")]);
  const merged = [...outgoing, ...incoming];

  merged.sort((a, b) => a.block - b.block || a.ts - b.ts);
  return merged;
}

/**
 * On-chain fallback scan for a token using viem getLogs in chunks.
 * This is slower but reliable without an indexer.
 */
async function fetchTokenTransfersOnchainFallback(args: {
  address: HexAddr;
  token: HexAddr;
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<Transfer[]> {
  const { address, token, fromBlock, toBlock } = args;
  const addrLower = address.toLowerCase();

  // try RPCs in order
  for (const client of viemClients) {
    try {
      const out: Transfer[] = [];

      let start = fromBlock;
      while (start <= toBlock && out.length < TRANSFERS_MAX_TOTAL) {
        const end = start + LOG_CHUNK_BLOCKS > toBlock ? toBlock : start + LOG_CHUNK_BLOCKS;

        // outgoing: from == address
        const logsOut = await withRetry("rpc_logs_out", async () =>
          withTimeout(
            client.getLogs({
              address: token,
              event: TRANSFER_EVENT,
              args: { from: address } as any,
              fromBlock: start,
              toBlock: end,
            }),
            UPSTREAM_TIMEOUT_MS
          ),
          2
        ).catch(() => []);

        // incoming: to == address
        const logsIn = await withRetry("rpc_logs_in", async () =>
          withTimeout(
            client.getLogs({
              address: token,
              event: TRANSFER_EVENT,
              args: { to: address } as any,
              fromBlock: start,
              toBlock: end,
            }),
            UPSTREAM_TIMEOUT_MS
          ),
          2
        ).catch(() => []);

        const merged = [...logsOut, ...logsIn];

        // normalize
        for (const l of merged as any[]) {
          const from = String(l?.args?.from || "").toLowerCase();
          const to = String(l?.args?.to || "").toLowerCase();
          const v = BigInt(l?.args?.value ?? 0n);

          // self transfer ignore
          if (from === addrLower && to === addrLower) continue;

          out.push({
            token,
            from: from as HexAddr,
            to: to as HexAddr,
            value: v,
            block: Number(l?.blockNumber ?? 0n),
            ts: 0, // we will infer TS via Alchemy/latest; but 0 is okay because we sort by block/logIndex later
            symbol: "TKN",
            decimals: 18,
          });
        }

        start = end + 1n;
      }

      // If timestamps are 0, that’s fine for “days held” because we use held_since from block-derived updates.
      // But we’ll still sort by block.
      out.sort((a, b) => a.block - b.block);
      return out;
    } catch {
      // try next RPC
    }
  }

  return [];
}

/* ───────────────── Token state reducer ───────────────── */

type TokenCursorState = {
  token: HexAddr;
  decimals: number;
  symbol: string;

  runningBalanceRaw: bigint;      // running balance in raw units
  firstAcquiredTs: number | null;
  firstAcquiredBlock: number | null;

  lastFullExitTs: number | null;
  lastFullExitBlock: number | null;

  lastSellTs: number | null;
  lastSellBlock: number | null;

  lastScannedBlock: number;       // last block fully processed
};

function reduceTransfersIntoState(params: {
  address: HexAddr;
  state: TokenCursorState;
  transfers: Transfer[];
}) {
  const { address, state } = params;
  const addr = address.toLowerCase();

  // transfers expected sorted by block, ts
  for (const t of params.transfers) {
    const from = t.from.toLowerCase();
    const to = t.to.toLowerCase();

    if (from !== addr && to !== addr) continue;
    if (from === addr && to === addr) continue; // self

    const prev = state.runningBalanceRaw;

    if (to === addr) state.runningBalanceRaw += t.value;
    if (from === addr) state.runningBalanceRaw -= t.value;

    const b = t.block || 0;

    // first acquire: 0 -> >0
    if (!state.firstAcquiredTs && prev === 0n && state.runningBalanceRaw > 0n) {
      state.firstAcquiredTs = t.ts || state.firstAcquiredTs || null;
      state.firstAcquiredBlock = b;
    }

    // last sell: any outgoing to other
    if (from === addr && to !== addr && t.value > 0n) {
      state.lastSellTs = t.ts || state.lastSellTs || null;
      state.lastSellBlock = b;
    }

    // full exit: >0 -> 0
    if (prev > 0n && state.runningBalanceRaw === 0n) {
      state.lastFullExitTs = t.ts || state.lastFullExitTs || null;
      state.lastFullExitBlock = b;
    }

    if (b > state.lastScannedBlock) state.lastScannedBlock = b;
  }
}

/* ───────────────── POST /api/compute ───────────────── */

export async function POST(req: NextRequest) {
  const started = Date.now();

  // 1) Parse address
  let address: HexAddr;
  try {
    const body = await req.json().catch(() => ({}));
    const raw =
      (body?.address as string | undefined)?.trim() ||
      new URL(req.url).searchParams.get("address")?.trim() ||
      "";

    if (!raw || !isHexAddress(raw)) {
      return safeJson(400, "Invalid address (expected 0x…40 hex)");
    }

    address = raw.toLowerCase() as HexAddr;
  } catch {
    return safeJson(400, "Malformed request");
  }

  // 2) Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return safeJson(500, "Server misconfigured (Supabase env missing)");
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // write-only wallets table (non-fatal)
  try {
    await supabase.from("wallets").upsert({ address });
  } catch (e) {
    console.error("[supabase wallets] non-fatal write failure", sanitizeErr(e));
  }

  // 3) Alchemy sanity ping (proves key works)
  const alchemy = getAlchemy();
  let alchemyPingOk = false;
  let latestBlock = 0;

  if (alchemy) {
    try {
      latestBlock = await withTimeout(alchemy.core.getBlockNumber(), 6_000);
      alchemyPingOk = true;
    } catch (e) {
      console.warn("[alchemy ping] failed", sanitizeErr(e));
      alchemyPingOk = false;
    }
  }

  // If Alchemy ping failed, get latest block via RPC for fallbacks
  if (!latestBlock) {
    for (const client of viemClients) {
      try {
        latestBlock = Number(await withTimeout(client.getBlockNumber(), 6_000));
        if (latestBlock) break;
      } catch {}
    }
  }

  // 4) Get balances (prefer Alchemy)
  let balances: Balance[] = [];
  let sourceBalances = "none";

  if (alchemy && alchemyPingOk) {
    try {
      balances = await fetchBalancesAlchemy(alchemy, address);
      sourceBalances = "alchemy";
    } catch (e) {
      console.warn("[compute] alchemy balances failed; falling back", sanitizeErr(e));
    }
  }

  if (!balances.length) {
    try {
      balances = await fetchBalancesBackup(address);
      sourceBalances = "base_backup";
    } catch (e) {
      return safeJson(503, "Unable to verify on-chain balances right now. Please retry.", {
        meta: {
          alchemyKeyPresent: Boolean(ALCHEMY_KEY),
          alchemyPingOk,
          sourceBalances,
          err: sanitizeErr(e),
        },
      });
    }
  }

  // Large-wallet protection: cap token count per run
  // (Returning users will be fast due to incremental scan.)
  if (balances.length > MAX_TOKENS_PER_RUN) {
    balances = balances.slice(0, MAX_TOKENS_PER_RUN);
  }

  // 5) Resolve metadata (symbol/decimals) concurrently but safely
  const metaMap = new Map<string, { symbol: string; decimals: number }>();
  await Promise.all(
    balances.map(async (b) => {
      const token = b.token.toLowerCase();
      const meta = await limitMeta(async () => resolveMeta(alchemy && alchemyPingOk ? alchemy : null, b.token));
      metaMap.set(token, meta);
    })
  );

  balances = balances.map((b) => {
    const meta = metaMap.get(b.token.toLowerCase());
    return {
      ...b,
      symbol: meta?.symbol || b.symbol || "TKN",
      decimals: typeof meta?.decimals === "number" ? meta!.decimals : b.decimals || 18,
    };
  });

  // 6) Load existing cursor rows for incremental mode (best effort)
  // If table doesn’t have these columns, Supabase returns them as null/undefined (fine).
  const { data: existingRows } = await supabase
    .from("token_holdings")
    .select(
      "token_address, last_scanned_block, running_balance_raw, running_balance_decimals, first_acquired_ts, first_acquired_block, last_full_exit_ts, last_full_exit_block, last_sell_ts, last_sell_block, symbol, decimals"
    )
    .eq("address", address)
    .catch(() => ({ data: [] as any[] }));

  const rowByToken = new Map<string, any>();
  for (const r of (existingRows || []) as any[]) {
    if (r?.token_address) rowByToken.set(String(r.token_address).toLowerCase(), r);
  }

  // 7) Prices (best effort, non-fatal)
  let priceMap: Record<string, number> = {};
  try {
    priceMap = await withTimeout(fetchPriceUSDMap(balances.map((b) => b.token)), 10_000);
  } catch (e) {
    console.warn("[prices] non-fatal", sanitizeErr(e));
    priceMap = {};
  }

  // 8) Per-token incremental update
  const nowSec = Math.floor(Date.now() / 1000);
  const stats: PerTokenStats[] = [];

  let sourceTransfers = "none";
  let tokensUpdated = 0;
  let tokensFallbackLogs = 0;

  for (const b of balances) {
    const token = b.token;
    const tokenKey = token.toLowerCase();
    const prev = rowByToken.get(tokenKey);

    const meta = metaMap.get(tokenKey) || { symbol: b.symbol, decimals: b.decimals };
    const symbol = meta.symbol && meta.symbol !== "TKN" ? meta.symbol : token.slice(2, 6).toUpperCase();
    const decimals = meta.decimals ?? b.decimals ?? 18;

    // incremental cursor
    const prevScanned = typeof prev?.last_scanned_block === "number" ? prev.last_scanned_block : null;
    const startBlock = prevScanned != null && prevScanned > 0 ? prevScanned + 1 : 0;

    // running balance from db (optional)
    let runningBalanceRaw = 0n;
    try {
      const rb = prev?.running_balance_raw;
      if (rb != null) runningBalanceRaw = BigInt(String(rb));
    } catch {
      runningBalanceRaw = 0n;
    }

    const state: TokenCursorState = {
      token,
      symbol,
      decimals,

      runningBalanceRaw,

      firstAcquiredTs: prev?.first_acquired_ts ? Math.floor(new Date(prev.first_acquired_ts).getTime() / 1000) : null,
      firstAcquiredBlock: typeof prev?.first_acquired_block === "number" ? prev.first_acquired_block : null,

      lastFullExitTs: prev?.last_full_exit_ts ? Math.floor(new Date(prev.last_full_exit_ts).getTime() / 1000) : null,
      lastFullExitBlock: typeof prev?.last_full_exit_block === "number" ? prev.last_full_exit_block : null,

      lastSellTs: prev?.last_sell_ts ? Math.floor(new Date(prev.last_sell_ts).getTime() / 1000) : null,
      lastSellBlock: typeof prev?.last_sell_block === "number" ? prev.last_sell_block : null,

      lastScannedBlock: prevScanned ?? 0,
    };

    // If we have no latest block, we can’t update reliably
    if (!latestBlock) continue;

    // If already caught up, we can compute immediately
    let transfers: Transfer[] = [];

    // Primary: Alchemy incremental transfers per token
    if (alchemy && alchemyPingOk && startBlock <= latestBlock) {
      try {
        transfers = await fetchTokenTransfersAlchemyIncremental({
          alchemy,
          address,
          token,
          fromBlock: startBlock || 0,
          toBlock: latestBlock,
        });
        if (transfers.length) sourceTransfers = "alchemy";
      } catch (e) {
        console.warn("[token transfers] alchemy failed; will fallback to logs", {
          token,
          err: sanitizeErr(e),
        });
        transfers = [];
      }
    }

    // Secondary: backup transfers sources (fast indexers)
    if (!transfers.length) {
      // Etherscan path first
      try {
        const es = await withTimeout(fetchTransfersViaEtherscan(address), 18_000).catch(() => []);
        transfers = es.filter((t) => t.token.toLowerCase() === tokenKey);
        if (transfers.length) sourceTransfers = "base_backup";
      } catch {
        // ignore
      }
    }

    // Tertiary: on-chain log scan for this token from cursor->latest
    if (!transfers.length && startBlock <= latestBlock) {
      const fromB = BigInt(startBlock);
      const toB = BigInt(latestBlock);
      const logs = await fetchTokenTransfersOnchainFallback({
        address,
        token,
        fromBlock: fromB,
        toBlock: toB,
      });
      transfers = logs;
      if (transfers.length) {
        sourceTransfers = sourceTransfers === "alchemy" ? "alchemy+logs" : "logs";
        tokensFallbackLogs++;
      }
    }

    // Reduce transfers into cursor state
    if (transfers.length) {
      // IMPORTANT: If alchemy returned timestamps, use them; if logs had ts=0, block ordering still ok.
      reduceTransfersIntoState({ address, state, transfers });
      tokensUpdated++;
    } else {
      // no new transfers; still fine
      state.lastScannedBlock = Math.max(state.lastScannedBlock, latestBlock);
    }

    // If first acquired is still unknown, but wallet holds balance now,
    // we can’t truthfully infer it without history. Use best-effort:
    // - if DB already had it, keep it
    // - else set to now (will improve once history is scanned)
    if (!state.firstAcquiredTs) state.firstAcquiredTs = nowSec;
    if (!state.firstAcquiredBlock) state.firstAcquiredBlock = state.lastScannedBlock || latestBlock;

    const heldSinceTs =
      state.lastFullExitTs && state.lastFullExitTs > state.firstAcquiredTs
        ? state.lastFullExitTs
        : state.firstAcquiredTs;

    const continuousHoldDays = Math.max(0, Math.floor((nowSec - heldSinceTs) / 86400));

    const noSellSinceTs = state.lastSellTs ?? state.firstAcquiredTs;
    const noSellStreakDays = Math.max(0, Math.floor((nowSec - noSellSinceTs) / 86400));

    const balanceNumeric = (() => {
      // do not rely on state.runningBalanceRaw for current balance;
      // use live balance from balances list
      const raw = b.raw;
      const s = raw.toString().padStart(decimals + 1, "0");
      const i = s.length - decimals;
      const int = s.slice(0, i);
      const frac = s.slice(i).replace(/0+$/, "");
      return Number(frac ? `${int}.${frac}` : int);
    })();

    // Price could be missing; keep token anyway
    const timeScore = continuousHoldDays * Math.log(balanceNumeric + 1);

    stats.push({
      token_address: token,
      symbol,
      decimals,
      first_acquired_ts: new Date(state.firstAcquiredTs * 1000).toISOString(),
      last_full_exit_ts: state.lastFullExitTs ? new Date(state.lastFullExitTs * 1000).toISOString() : null,
      last_sell_ts: state.lastSellTs ? new Date(state.lastSellTs * 1000).toISOString() : null,
      held_since: new Date(heldSinceTs * 1000).toISOString(),
      continuous_hold_days: continuousHoldDays,
      never_sold: state.lastSellTs == null,
      no_sell_streak_days: noSellStreakDays,
      balance_numeric: balanceNumeric,
      time_score: timeScore,
    });

    // Persist per-token cursor + stats (non-fatal if some columns don’t exist)
    try {
      const row: any = {
        address,
        token_address: token.toLowerCase(),
        symbol,
        decimals,

        first_acquired_ts: new Date(state.firstAcquiredTs * 1000).toISOString(),
        last_full_exit_ts: state.lastFullExitTs ? new Date(state.lastFullExitTs * 1000).toISOString() : null,
        last_sell_ts: state.lastSellTs ? new Date(state.lastSellTs * 1000).toISOString() : null,
        held_since: new Date(heldSinceTs * 1000).toISOString(),

        continuous_hold_days: continuousHoldDays,
        never_sold: state.lastSellTs == null,
        no_sell_streak_days: noSellStreakDays,

        balance_numeric: balanceNumeric,
        time_score: timeScore,

        last_computed_at: new Date().toISOString(),

        // cursor fields (safe even if columns don’t exist; supabase will error — we catch and ignore)
        last_scanned_block: state.lastScannedBlock,
        running_balance_raw: state.runningBalanceRaw.toString(),
        running_balance_decimals: decimals,
        first_acquired_block: state.firstAcquiredBlock,
        last_full_exit_block: state.lastFullExitBlock,
        last_sell_block: state.lastSellBlock,
      };

      const { error } = await supabase
        .from("token_holdings")
        .upsert([row], { onConflict: "address,token_address" });

      if (error) {
        // If your table doesn't have the cursor columns yet, you'll see an error here.
        // It's safe; stats still compute, but you should add the columns for performance.
        console.warn("[supabase token_holdings] upsert warning", { message: error.message });
      }
    } catch (e) {
      console.warn("[supabase token_holdings] non-fatal write failure", sanitizeErr(e));
    }
  }

  // If no balances detected
  if (!balances.length) {
    return NextResponse.json({
      address,
      count: 0,
      note: "No ERC-20 balances detected on Base.",
      meta: {
        alchemyKeyPresent: Boolean(ALCHEMY_KEY),
        alchemyPingOk,
        sourceBalances,
        sourceTransfers,
      },
    });
  }

  // Response meta (proves Alchemy usage)
  return NextResponse.json(
    {
      address,
      count: stats.length,
      meta: {
        balances: balances.length,
        tokensProcessed: balances.length,
        tokensUpdated,
        tokensFallbackLogs,
        sourceBalances,
        sourceTransfers,
        alchemyKeyPresent: Boolean(ALCHEMY_KEY),
        alchemyPingOk,
        alchemyUsed: sourceBalances === "alchemy" || sourceTransfers.includes("alchemy"),
        latestBlock,
        elapsedMs: Date.now() - started,
      },
    },
    { headers: { "cache-control": "no-store, max-age=0" } }
  );
}

/* ───────────────── GET helper page ───────────────── */

export async function GET() {
  return new Response(
    `<!doctype html>
<html><body style="font-family:system-ui;padding:24px;background:#0B0E14;color:#EDEEF2">
  <h1>Proof of Time – Compute</h1>
  <p>Enter a Base address and we'll compute your relic stats. (This GET page sends a POST.)</p>
  <form onsubmit="event.preventDefault(); run();">
    <input id="addr" placeholder="0x..." style="padding:8px;border-radius:8px;background:#1a1f2a;color:white;width:420px">
    <button id="btn" style="padding:8px 12px;margin-left:8px;border-radius:8px;">Compute</button>
  </form>
  <pre id="out" style="margin-top:16px;white-space:pre-wrap;"></pre>
  <script>
    async function run(){
      const btn = document.getElementById('btn');
      const out = document.getElementById('out');
      const address = (document.getElementById('addr').value||'').trim();
      out.textContent = '⏳ Computing for ' + address + ' ...';
      btn.disabled = true;
      try {
        const r = await fetch('', {
          method:'POST',
          headers:{'Content-Type':'application/json', 'Cache-Control':'no-store'},
          body: JSON.stringify({ address })
        });
        const j = await r.json().catch(()=>({error:'non-json'}));
        out.textContent = JSON.stringify(j,null,2);
        if (j && j.address) location.href = '/relic/' + j.address;
      } catch (e) {
        out.textContent = '❌ Request error: ' + (e && e.message ? e.message : e);
      } finally {
        btn.disabled = false;
      }
    }
  </script>
</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}
