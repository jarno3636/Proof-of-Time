// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computePerTokenStats } from "@/lib/proofOfTime";
import type { Balance, HexAddr, PerTokenStats, Transfer } from "@/lib/types";

import {
  fetchBalancesBase,
  fetchTransfersViaEtherscan,
  fetchTransfersBase,
  fetchPriceUSDMap,
} from "@/lib/data";

import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { erc20Abi } from "viem";

// IMPORTANT: make this route reliable on Vercel (avoid Edge runtime surprises)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;

const UPSTREAM_TIMEOUT_MS = 15_000;
const META_TIMEOUT_MS = 6_000;

const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 4_000;

const TRANSFERS_PAGE_SIZE = 1000;
const TRANSFERS_MAX_PAGES = 8;
const TRANSFERS_MAX_TOTAL = 10_000;

const META_CONCURRENCY = 6;
const ALWAYS_FRESH = true;

// Public Base RPC as a last resort for metadata reads
const PUBLIC_BASE_RPC = "https://mainnet.base.org";
const viemClient = createPublicClient({
  chain: base,
  transport: http(PUBLIC_BASE_RPC, { retryCount: 2 }),
});

function isHexAddress(s: string): s is HexAddr {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number) {
  const j = Math.floor(ms * (0.15 + Math.random() * 0.25));
  return ms + j;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeJson(status: number, message: string, extra?: Record<string, any>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status });
}

function withTimeout<T>(p: Promise<T>, ms = UPSTREAM_TIMEOUT_MS): Promise<T> {
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

function getAlchemy() {
  if (!ALCHEMY_KEY) return null;
  return new Alchemy({
    apiKey: ALCHEMY_KEY,
    network: Network.BASE_MAINNET,
  });
}

// ---------- On-chain meta fallback (fixes "TKN") ----------
async function patchMetaOnchain(balances: Balance[]): Promise<Balance[]> {
  const need = balances.filter((b) => !b.symbol || b.symbol === "TKN");
  if (!need.length) return balances;

  const symbolCalls = need.map((b) => ({
    address: b.token,
    abi: erc20Abi,
    functionName: "symbol",
  })) as const;

  const decimalsCalls = need.map((b) => ({
    address: b.token,
    abi: erc20Abi,
    functionName: "decimals",
  })) as const;

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

/* ---------------- Alchemy Fetchers ---------------- */

async function fetchBalancesAlchemy(alchemy: Alchemy, address: HexAddr): Promise<Balance[]> {
  return withRetry("alchemy_balances", async () => {
    const res = await withTimeout(alchemy.core.getTokenBalances(address), UPSTREAM_TIMEOUT_MS);

    const balancesRaw: any[] = Array.isArray((res as any)?.tokenBalances)
      ? (res as any).tokenBalances
      : [];

    const candidates = balancesRaw
      .map((tb: any) => ({
        token: String(tb?.contractAddress || "").toLowerCase(),
        tokenBalance: String(tb?.tokenBalance || "0"),
      }))
      .filter((x) => x.token.startsWith("0x") && x.tokenBalance !== "0");

    if (!candidates.length) return [];

    const metaCache = new Map<string, { symbol: string; decimals: number }>();

    async function getMeta(token: string) {
      const cached = metaCache.get(token);
      if (cached) return cached;

      const meta = await limitMeta(async () => {
        try {
          return await withRetry(
            "alchemy_tokenMetadata",
            async () => await withTimeout(alchemy.core.getTokenMetadata(token), META_TIMEOUT_MS),
            2
          );
        } catch {
          return null;
        }
      });

      const out = {
        symbol: (meta as any)?.symbol || "TKN",
        decimals: typeof (meta as any)?.decimals === "number" ? (meta as any).decimals : 18,
      };
      metaCache.set(token, out);
      return out;
    }

    const out: Balance[] = [];
    await Promise.all(
      candidates.map(async (c) => {
        let raw = 0n;
        try {
          raw = BigInt(c.tokenBalance);
        } catch {
          raw = 0n;
        }
        if (raw === 0n) return;

        const meta = await getMeta(c.token);
        out.push({
          token: c.token as HexAddr,
          symbol: meta.symbol || "TKN",
          decimals: meta.decimals ?? 18,
          raw,
        });
      })
    );

    return out;
  });
}

async function fetchTransfersAlchemy(alchemy: Alchemy, address: HexAddr): Promise<Transfer[]> {
  async function fetchDirection(params: {
    fromAddress?: HexAddr;
    toAddress?: HexAddr;
  }): Promise<Transfer[]> {
    let pageKey: string | undefined = undefined;
    let page = 0;
    const out: Transfer[] = [];

    while (page < TRANSFERS_MAX_PAGES && out.length < TRANSFERS_MAX_TOTAL) {
      page++;

      const resp = await withRetry("alchemy_transfers", async () => {
        return await withTimeout(
          alchemy.core.getAssetTransfers({
            category: [AssetTransfersCategory.ERC20],
            withMetadata: true,
            excludeZeroValue: true,
            maxCount: TRANSFERS_PAGE_SIZE,
            pageKey,
            ...params,
          } as any),
          UPSTREAM_TIMEOUT_MS
        );
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

      await sleep(60);
    }

    return out;
  }

  const [outgoing, incoming] = await Promise.all([
    fetchDirection({ fromAddress: address }),
    fetchDirection({ toAddress: address }),
  ]);

  const merged = [...outgoing, ...incoming];
  merged.sort((a, b) => a.block - b.block || a.ts - b.ts);
  return merged;
}

/* ---------------- Backup path ---------------- */

async function fetchBalancesBackup(address: HexAddr): Promise<Balance[]> {
  return await withRetry(
    "backup_balances_base",
    async () => await withTimeout(fetchBalancesBase(address), 30_000),
    2
  );
}

async function fetchTransfersBackup(address: HexAddr): Promise<Transfer[]> {
  return await withRetry(
    "backup_transfers_base",
    async () => {
      const es = await withTimeout(fetchTransfersViaEtherscan(address), 20_000).catch(() => []);
      if (es.length) return es;
      return await withTimeout(fetchTransfersBase(address), 45_000);
    },
    2
  );
}

/* ---------------- POST /api/compute ---------------- */

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

    if (!raw || !isHexAddress(raw)) return safeJson(400, "Invalid address (expected 0x…40 hex)");
    address = raw.toLowerCase() as HexAddr;
  } catch {
    return safeJson(400, "Malformed request");
  }

  // 2) Supabase (write-only)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return safeJson(500, "Server misconfigured (Supabase env missing)");
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    await supabase.from("wallets").upsert({ address });
  } catch (e) {
    console.error("[supabase wallets] non-fatal write failure", sanitizeErr(e));
  }

  // 3) Prefer Alchemy
  let balances: Balance[] = [];
  let transfers: Transfer[] = [];
  let sourceBalances = "unknown";
  let sourceTransfers = "unknown";

  const alchemy = getAlchemy();
  let alchemyPingOk = false;

  if (alchemy) {
    try {
      // cheap sanity check to prove key works
      await withTimeout(alchemy.core.getBlockNumber(), 5_000);
      alchemyPingOk = true;
    } catch (e) {
      console.warn("[alchemy ping] failed", sanitizeErr(e));
      alchemyPingOk = false;
    }
  }

  // --- balances ---
  if (alchemy && alchemyPingOk) {
    try {
      balances = await fetchBalancesAlchemy(alchemy, address);
      sourceBalances = "alchemy";
    } catch (e) {
      console.warn("[compute] alchemy balances failed; falling back", sanitizeErr(e));
    }
  } else {
    console.warn("[compute] Alchemy unavailable (missing key or ping failed); using backup");
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

  // Fix "TKN" by patching with on-chain meta
  balances = await patchMetaOnchain(balances);

  // --- transfers (best effort) ---
  if (alchemy && alchemyPingOk) {
    try {
      transfers = await fetchTransfersAlchemy(alchemy, address);
      sourceTransfers = "alchemy";
    } catch (e) {
      console.warn("[compute] alchemy transfers failed; falling back", sanitizeErr(e));
      transfers = [];
    }
  }

  if (!transfers.length) {
    try {
      transfers = await fetchTransfersBackup(address);
      sourceTransfers = transfers.length ? "base_backup" : "none";
    } catch (e) {
      console.warn("[compute] backup transfers failed; continuing without transfers", sanitizeErr(e));
      transfers = [];
      sourceTransfers = "none";
    }
  }

  if (!balances.length) {
    return NextResponse.json({
      address,
      count: 0,
      note: "No ERC-20 balances detected on Base.",
      meta: {
        sourceBalances,
        sourceTransfers,
        alchemyUsed: sourceBalances === "alchemy" || sourceTransfers === "alchemy",
        alchemyPingOk,
      },
    });
  }

  // 5) Prices (non-fatal)
  let priceMap: Record<string, number> = {};
  try {
    priceMap = await withTimeout(fetchPriceUSDMap(balances.map((b) => b.token)), 10_000);
  } catch (e) {
    console.warn("[prices] non-fatal", sanitizeErr(e));
    priceMap = {};
  }

  // 6) Compute
  const stats: PerTokenStats[] = [];
  for (const b of balances) {
    const s = computePerTokenStats(
      address,
      b.token,
      transfers,
      b,
      priceMap[b.token.toLowerCase()]
    );
    if (s) stats.push(s);
  }

  // 7) Persist (non-fatal)
  if (stats.length) {
    const rows = stats.map((s) => ({
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
    }));

    try {
      const { error } = await supabase.from("token_holdings").upsert(rows, {
        onConflict: "address,token_address",
      });
      if (error) console.error("[supabase token_holdings] upsert failed", error.message);
    } catch (e) {
      console.error("[supabase token_holdings] non-fatal write failure", sanitizeErr(e));
    }
  }

  // 8) Respond with proof of Alchemy usage
  return NextResponse.json(
    {
      address,
      count: stats.length,
      meta: {
        balances: balances.length,
        transfers: transfers.length,
        freshPreferred: ALWAYS_FRESH,
        sourceBalances,
        sourceTransfers,
        alchemyKeyPresent: Boolean(ALCHEMY_KEY),
        alchemyPingOk,
        alchemyUsed: sourceBalances === "alchemy" || sourceTransfers === "alchemy",
        elapsedMs: Date.now() - started,
      },
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}

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
