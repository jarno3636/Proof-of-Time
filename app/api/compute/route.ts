// app/api/compute/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computePerTokenStats } from "@/lib/proofOfTime";
import { Balance, HexAddr, PerTokenStats, Transfer } from "@/lib/types";
import { Alchemy, Network, AssetTransfersCategory } from "alchemy-sdk";

/* ───────────────────── Config ───────────────────── */

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
if (!ALCHEMY_KEY) {
  // Note: this message is safe (does not include the key)
  throw new Error("ALCHEMY_API_KEY missing");
}

const alchemy = new Alchemy({
  apiKey: ALCHEMY_KEY,
  network: Network.BASE_MAINNET,
});

// Reliability knobs
const UPSTREAM_TIMEOUT_MS = 15_000;
const META_TIMEOUT_MS = 6_000;
const MAX_RETRIES = 4; // total attempts = 1 + retries
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 4_000;

// Transfers
const TRANSFERS_PAGE_SIZE = 1000; // Alchemy usually caps at 1000 per page
const TRANSFERS_MAX_PAGES = 12;   // prevent infinite loops (adjust if needed)
const TRANSFERS_MAX_TOTAL = 20_000; // hard cap for safety

// Metadata fetch
const META_CONCURRENCY = 6;

/* ───────────────────── Utilities ───────────────────── */

function isHexAddress(s: string): s is HexAddr {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number) {
  const j = Math.floor(ms * (0.15 + Math.random() * 0.25)); // 15–40%
  return ms + j;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safe503(message = "Upstream data unavailable") {
  return NextResponse.json({ error: message }, { status: 503 });
}

function safe400(message = "Bad request") {
  return NextResponse.json({ error: message }, { status: 400 });
}

function safe500(message = "Server misconfigured") {
  return NextResponse.json({ error: message }, { status: 500 });
}

// Hard timeout wrapper
function withTimeout<T>(p: Promise<T>, ms = UPSTREAM_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("UPSTREAM_TIMEOUT")), ms)
    ),
  ]);
}

// Determine if an upstream error is retryable (no leaking details)
function isRetryableUpstreamError(err: unknown): boolean {
  const msg = String((err as any)?.message || "");
  const code = String((err as any)?.code || "");

  // Common “missing response” / server_error / timeouts
  if (msg.includes("UPSTREAM_TIMEOUT")) return true;
  if (msg.toLowerCase().includes("missing response")) return true;
  if (code.toUpperCase().includes("SERVER_ERROR")) return true;

  // Some fetch/network-ish signals
  if (msg.toLowerCase().includes("timeout")) return true;
  if (msg.toLowerCase().includes("network")) return true;
  if (msg.toLowerCase().includes("socket")) return true;
  if (msg.toLowerCase().includes("econnreset")) return true;

  return false;
}

// Retry wrapper with exponential backoff + jitter
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

      // Sanitized logging only (no url/body/key)
      console.error(`[upstream:${label}] attempt ${attempt} failed`, {
        message: String((err as any)?.message || err),
        code: (err as any)?.code,
        name: (err as any)?.name,
      });

      if (!retryable || attempt > maxRetries) {
        throw err;
      }

      const backoff = clamp(
        Math.floor(BASE_BACKOFF_MS * Math.pow(2, attempt - 1)),
        BASE_BACKOFF_MS,
        MAX_BACKOFF_MS
      );
      await sleep(jitter(backoff));
    }
  }
}

// Simple concurrency limiter (no external deps)
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

/* ───────────────────── Alchemy Fetchers ───────────────────── */

/**
 * Fetch balances via Alchemy Enhanced API.
 * We then hydrate symbol/decimals via getTokenMetadata with concurrency limits.
 */
async function fetchBalancesAlchemy(address: HexAddr): Promise<Balance[]> {
  return withRetry("balances", async () => {
    // NOTE: alchemy-sdk supports this signature and internally uses alchemy_getTokenBalances.
    // Some accounts may occasionally return “missing response”; retries handle it.
    const res = await withTimeout(alchemy.core.getTokenBalances(address), UPSTREAM_TIMEOUT_MS);

    const balancesRaw = res?.tokenBalances || [];
    if (!Array.isArray(balancesRaw)) return [];

    // Filter non-zero + normalize token addresses
    const candidates = balancesRaw
      .map((tb: any) => ({
        token: String(tb?.contractAddress || "").toLowerCase(),
        tokenBalance: String(tb?.tokenBalance || "0"),
      }))
      .filter((x) => x.token.startsWith("0x") && x.tokenBalance !== "0");

    if (!candidates.length) return [];

    // Fetch metadata (symbol/decimals) with concurrency limits; tolerate failures.
    const metaCache = new Map<string, { symbol: string; decimals: number }>();

    async function getMeta(token: string) {
      const cached = metaCache.get(token);
      if (cached) return cached;

      // Each metadata call is also retried and time-bounded.
      const meta = await limitMeta(async () => {
        try {
          return await withRetry(
            "tokenMetadata",
            async () =>
              await withTimeout(alchemy.core.getTokenMetadata(token), META_TIMEOUT_MS),
            2
          );
        } catch {
          return null;
        }
      });

      const out = {
        symbol: (meta as any)?.symbol || "TKN",
        decimals:
          typeof (meta as any)?.decimals === "number" ? (meta as any).decimals : 18,
      };

      metaCache.set(token, out);
      return out;
    }

    const out: Balance[] = [];

    // Hydrate metadata in parallel (limited)
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
          symbol: meta.symbol,
          decimals: meta.decimals,
          raw,
        });
      })
    );

    return out;
  });
}

/**
 * Fetch ERC-20 transfers (incoming + outgoing) with pagination.
 * We DO NOT set `order` to avoid TS mismatch and because we sort later anyway.
 */
async function fetchTransfersAlchemy(address: HexAddr): Promise<Transfer[]> {
  async function fetchDirection(params: {
    fromAddress?: HexAddr;
    toAddress?: HexAddr;
  }): Promise<Transfer[]> {
    let pageKey: string | undefined = undefined;
    let page = 0;
    const out: Transfer[] = [];

    while (page < TRANSFERS_MAX_PAGES && out.length < TRANSFERS_MAX_TOTAL) {
      page++;

      const resp = await withRetry("assetTransfers", async () => {
        return await withTimeout(
          alchemy.core.getAssetTransfers({
            category: [AssetTransfersCategory.ERC20],
            withMetadata: true,
            excludeZeroValue: true,
            maxCount: TRANSFERS_PAGE_SIZE,
            pageKey,
            ...params,
          }),
          UPSTREAM_TIMEOUT_MS
        );
      });

      const transfers = (resp as any)?.transfers || [];
      if (Array.isArray(transfers) && transfers.length) {
        for (const t of transfers) {
          const tokenAddr = String(t?.rawContract?.address || "").toLowerCase();
          if (!tokenAddr.startsWith("0x")) continue;

          const from = String(t?.from || "").toLowerCase();
          const to = String(t?.to || "").toLowerCase();
          if (!from.startsWith("0x") || !to.startsWith("0x")) continue;

          const rawValue = String(t?.rawContract?.value || "0");
          let value = 0n;
          try {
            value = BigInt(rawValue);
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
      }

      pageKey = (resp as any)?.pageKey;
      if (!pageKey) break;

      // small sleep to reduce burstiness under heavy wallets
      await sleep(60);
    }

    return out;
  }

  const [outgoing, incoming] = await Promise.all([
    fetchDirection({ fromAddress: address }),
    fetchDirection({ toAddress: address }),
  ]);

  // Merge + sort for deterministic behavior (and to help your stats logic)
  const merged = [...outgoing, ...incoming];
  merged.sort((a, b) => a.block - b.block || a.ts - b.ts);
  return merged;
}

/* ───────────────────── POST /api/compute ───────────────────── */

export async function POST(req: NextRequest) {
  // Parse and normalize address
  let address: HexAddr;
  try {
    const body = await req.json().catch(() => ({}));
    const raw =
      (body?.address as string | undefined)?.trim() ||
      new URL(req.url).searchParams.get("address")?.trim() ||
      "";

    if (!raw || !isHexAddress(raw)) {
      return safe400("Invalid address (expected 0x…40 hex)");
    }
    address = raw.toLowerCase() as HexAddr;
  } catch {
    return safe400("Malformed request");
  }

  // Supabase (write-only cache)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return safe500("Server misconfigured (Supabase env missing)");
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Ensure wallet record (do not hard-fail compute if this write fails)
  try {
    await supabase.from("wallets").upsert({ address });
  } catch (e) {
    console.error("[supabase wallets] non-fatal write failure", {
      message: String((e as any)?.message || e),
    });
  }

  // Always prefer fresh chain data (Alchemy). Supabase is NOT read here.
  let balances: Balance[] = [];
  let transfers: Transfer[] = [];
  try {
    [balances, transfers] = await Promise.all([
      fetchBalancesAlchemy(address),
      fetchTransfersAlchemy(address),
    ]);
  } catch {
    // Sanitized response (no upstream url/body/key)
    return safe503("Unable to verify on-chain data right now. Please retry.");
  }

  if (!balances.length) {
    return NextResponse.json({
      address,
      count: 0,
      note: "No ERC-20 balances detected on Base.",
    });
  }

  // Compute per-token stats (fresh)
  const stats: PerTokenStats[] = [];
  for (const b of balances) {
    const s = computePerTokenStats(address, b.token, transfers, b, undefined);
    if (s) stats.push(s);
  }

  // Persist (overwrite cache). If it fails, still return computed count.
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
      const { error } = await supabase
        .from("token_holdings")
        .upsert(rows, { onConflict: "address,token_address" });

      if (error) {
        console.error("[supabase token_holdings] upsert failed", {
          message: error.message,
        });
      }
    } catch (e) {
      console.error("[supabase token_holdings] non-fatal write failure", {
        message: String((e as any)?.message || e),
      });
    }
  }

  return NextResponse.json({
    address,
    count: stats.length,
    // helpful metadata for debugging without secrets:
    meta: {
      balances: balances.length,
      transfers: transfers.length,
      source: "alchemy_fresh",
    },
  });
}

/* ───────────────────── GET /api/compute (optional helper page) ───────────────────── */

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
          headers:{'Content-Type':'application/json'},
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
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
