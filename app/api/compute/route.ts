// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { erc20Abi } from "viem";

import { computePerTokenStats } from "@/lib/proofOfTime";
import type { Balance, HexAddr, PerTokenStats, Transfer } from "@/lib/types";
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

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 350;

// Public Base RPC – used only for ERC20 symbol/decimals patch
const PUBLIC_BASE_RPC = "https://mainnet.base.org";

/* ───────────────── Utils ───────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isHex = (s: string): s is HexAddr => /^0x[a-fA-F0-9]{40}$/.test(s);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), ms)
    ),
  ]);
}

function sanitizeErr(err: unknown) {
  return {
    name: String((err as any)?.name || ""),
    code: String((err as any)?.code || ""),
    message: String((err as any)?.message || err),
  };
}

function isRetryable(err: unknown) {
  const msg = sanitizeErr(err).message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("upstream_timeout") ||
    msg.includes("missing response") ||
    msg.includes("server_error") ||
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("econnreset") ||
    msg.includes("socket")
  );
}

async function withRetry<T>(label: string, fn: () => Promise<T>) {
  let lastErr: unknown;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      console.error(`[${label}] attempt ${i + 1} failed`, sanitizeErr(e));
      if (!isRetryable(e)) break;
      await sleep(RETRY_BASE_DELAY_MS * (i + 1));
    }
  }
  throw lastErr;
}

function getAlchemy() {
  if (!ALCHEMY_KEY) return null;
  return new Alchemy({ apiKey: ALCHEMY_KEY, network: Network.BASE_MAINNET });
}

function safeBigInt(x: unknown): bigint {
  // Alchemy can return tokenBalance: string | null
  if (x === null || x === undefined) return 0n;
  try {
    const s = String(x);
    if (!s || s === "0") return 0n;
    return BigInt(s);
  } catch {
    return 0n;
  }
}

/* ───────────────── Metadata patch (viem) ───────────────── */

const viemClient = createPublicClient({
  chain: base,
  transport: http(PUBLIC_BASE_RPC, { retryCount: 2 }),
});

async function patchMeta(balances: Balance[]) {
  const need = balances.filter((b) => !b.symbol || b.symbol === "TKN");
  if (!need.length) return balances;

  // IMPORTANT: multicall results align with `need`, not `balances`
  const symbolCalls = need.map((b) => ({
    address: b.token,
    abi: erc20Abi,
    functionName: "symbol",
  }));

  const decimalsCalls = need.map((b) => ({
    address: b.token,
    abi: erc20Abi,
    functionName: "decimals",
  }));

  const [symRes, decRes] = await Promise.all([
    withTimeout(viemClient.multicall({ contracts: symbolCalls as any }), META_TIMEOUT_MS).catch(
      () => []
    ),
    withTimeout(viemClient.multicall({ contracts: decimalsCalls as any }), META_TIMEOUT_MS).catch(
      () => []
    ),
  ]);

  const byToken = new Map<string, { symbol?: string; decimals?: number }>();
  for (let i = 0; i < need.length; i++) {
    const token = need[i].token.toLowerCase();
    const sym = (symRes?.[i] as any)?.result as string | undefined;
    const dec = (decRes?.[i] as any)?.result as number | bigint | undefined;

    const decimals =
      typeof dec === "bigint" ? Number(dec) : typeof dec === "number" ? dec : undefined;

    byToken.set(token, {
      symbol: sym && sym !== "TKN" ? sym : undefined,
      decimals: Number.isFinite(decimals as any) ? (decimals as number) : undefined,
    });
  }

  return balances.map((b) => {
    const meta = byToken.get(b.token.toLowerCase());
    if (!meta) return b;
    return {
      ...b,
      symbol: meta.symbol ?? b.symbol ?? "TKN",
      decimals: meta.decimals ?? b.decimals ?? 18,
    };
  });
}

/* ───────────────── Alchemy fetchers ───────────────── */

async function fetchBalancesAlchemy(alchemy: Alchemy, address: HexAddr): Promise<Balance[]> {
  const res = await withRetry("alchemy_balances", async () =>
    withTimeout(alchemy.core.getTokenBalances(address), UPSTREAM_TIMEOUT_MS)
  );

  const list: any[] = Array.isArray((res as any)?.tokenBalances) ? (res as any).tokenBalances : [];

  // tokenBalance can be null; handle safely
  const out: Balance[] = [];
  for (const t of list) {
    const token = String(t?.contractAddress || "").toLowerCase();
    if (!token.startsWith("0x")) continue;

    const raw = safeBigInt(t?.tokenBalance);
    if (raw === 0n) continue;

    out.push({
      token: token as HexAddr,
      raw,
      symbol: "TKN",
      decimals: 18,
    });
  }

  return out;
}

async function fetchTransfersAlchemy(alchemy: Alchemy, address: HexAddr): Promise<Transfer[]> {
  async function fetchDir(params: { fromAddress?: HexAddr; toAddress?: HexAddr }): Promise<Transfer[]> {
    const r = await withRetry("alchemy_transfers", async () =>
      withTimeout(
        alchemy.core.getAssetTransfers({
          category: [AssetTransfersCategory.ERC20],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: 1000,
          ...params,
        } as any),
        UPSTREAM_TIMEOUT_MS
      )
    );

    const transfers: any[] = Array.isArray((r as any)?.transfers) ? (r as any).transfers : [];

    const out: Transfer[] = [];
    for (const t of transfers) {
      const token = String(t?.rawContract?.address || "").toLowerCase();
      const from = String(t?.from || "").toLowerCase();
      const to = String(t?.to || "").toLowerCase();
      if (!token.startsWith("0x") || !from.startsWith("0x") || !to.startsWith("0x")) continue;

      const value = safeBigInt(t?.rawContract?.value);
      if (value === 0n) continue;

      const block = Number.parseInt(String(t?.blockNum || "0x0"), 16) || 0;

      const tsStr = String(t?.metadata?.blockTimestamp || "");
      const ts = tsStr ? Math.floor(new Date(tsStr).getTime() / 1000) : 0;

      out.push({
        token: token as HexAddr,
        from: from as HexAddr,
        to: to as HexAddr,
        value,
        block,
        ts,
        symbol: String(t?.asset || "TKN"),
        decimals: Number(t?.rawContract?.decimal ?? 18),
      });
    }

    return out;
  }

  const [out, inc] = await Promise.all([
    fetchDir({ fromAddress: address }),
    fetchDir({ toAddress: address }),
  ]);

  // Merge + sort
  return [...out, ...inc].sort((a, b) => a.block - b.block || a.ts - b.ts);
}

/* ───────────────── POST /api/compute ───────────────── */

export async function POST(req: NextRequest) {
  const started = Date.now();

  const body = await req.json().catch(() => ({}));
  const rawAddr = String(body?.address || "").trim();
  if (!isHex(rawAddr)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const address = rawAddr.toLowerCase() as HexAddr;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Server misconfigured (Supabase env missing)" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const alchemy = getAlchemy();
  let alchemyPingOk = false;

  if (alchemy) {
    try {
      await withTimeout(alchemy.core.getBlockNumber(), 5_000);
      alchemyPingOk = true;
    } catch (e) {
      console.warn("[alchemy ping] failed", sanitizeErr(e));
      alchemyPingOk = false;
    }
  }

  let balances: Balance[] = [];
  let transfers: Transfer[] = [];
  let sourceBalances: "alchemy" | "backup" | "none" = "none";
  let sourceTransfers: "alchemy" | "backup" | "none" = "none";

  // ---- balances (required) ----
  try {
    if (alchemy && alchemyPingOk) {
      balances = await fetchBalancesAlchemy(alchemy, address);
      sourceBalances = balances.length ? "alchemy" : "none";
    }

    if (!balances.length) {
      balances = await withTimeout(fetchBalancesBase(address), 30_000);
      sourceBalances = balances.length ? "backup" : "none";
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: "Unable to verify balances right now",
        meta: {
          alchemyKeyPresent: Boolean(ALCHEMY_KEY),
          alchemyPingOk,
          err: sanitizeErr(e),
        },
      },
      { status: 503 }
    );
  }

  // Patch TKN symbols/decimals using on-chain calls
  balances = await patchMeta(balances);

  // ---- transfers (best effort) ----
  try {
    if (alchemy && alchemyPingOk) {
      transfers = await fetchTransfersAlchemy(alchemy, address);
      sourceTransfers = transfers.length ? "alchemy" : "none";
    }

    if (!transfers.length) {
      transfers = await withTimeout(fetchTransfersViaEtherscan(address), 20_000).catch(() => []);
      if (!transfers.length) {
        transfers = await withTimeout(fetchTransfersBase(address), 45_000);
      }
      sourceTransfers = transfers.length ? "backup" : "none";
    }
  } catch (e) {
    console.warn("[transfers] non-fatal", sanitizeErr(e));
    transfers = [];
    sourceTransfers = "none";
  }

  // Prices are non-fatal
  const prices = await withTimeout(fetchPriceUSDMap(balances.map((b) => b.token)), 10_000).catch(
    () => ({})
  );

  const stats: PerTokenStats[] = [];
  for (const b of balances) {
    const s = computePerTokenStats(address, b.token, transfers, b, (prices as any)[b.token.toLowerCase()]);
    if (s) stats.push(s);
  }

  // Persist (non-fatal)
  try {
    await supabase.from("token_holdings").upsert(
      stats.map((s) => ({
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
      })),
      { onConflict: "address,token_address" }
    );
  } catch (e) {
    console.warn("[supabase upsert] non-fatal", sanitizeErr(e));
  }

  return NextResponse.json(
    {
      address,
      count: stats.length,
      meta: {
        sourceBalances,
        sourceTransfers,
        alchemyKeyPresent: Boolean(ALCHEMY_KEY),
        alchemyPingOk,
        alchemyUsed: sourceBalances === "alchemy" || sourceTransfers === "alchemy",
        elapsedMs: Date.now() - started,
      },
    },
    { headers: { "cache-control": "no-store, max-age=0" } }
  );
}
