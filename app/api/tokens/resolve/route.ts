// app/api/tokens/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { erc20Abi } from "viem";
import type { HexAddr } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ───────────────── config ───────────────── */

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const UPSTREAM_TIMEOUT = 8_000;

/* ───────────────── RPC fallback ───────────────── */

const RPCS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://1rpc.io/base",
];

const clients = RPCS.map((url) =>
  createPublicClient({
    chain: base,
    transport: http(url, { timeout: UPSTREAM_TIMEOUT, retryCount: 1 }),
  })
);

/* ───────────────── helpers ───────────────── */

const isHexAddr = (s: string): s is HexAddr =>
  /^0x[a-fA-F0-9]{40}$/.test(s);

function normalizeSymbol(sym: unknown): string | null {
  if (typeof sym !== "string") return null;
  const s = sym.trim();
  if (!s) return null;
  if (s.toUpperCase() === "TKN") return null;
  if (s.length === 4 && /^[0-9A-F]{4}$/.test(s)) return null; // kill B8D9
  if (s.length > 24) return null;
  return s;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

/* ───────────────── allowlist ───────────────── */

const ALLOWLIST: Record<
  string,
  { symbol: string; decimals: number; name?: string }
> = {
  "0x833589fcd6edb6e08f4c7c32d4f41f182e88c0a4": {
    symbol: "USDC",
    decimals: 6,
    name: "USD Coin",
  },
  "0x4200000000000000000000000000000000000006": {
    symbol: "WETH",
    decimals: 18,
    name: "Wrapped Ether",
  },
  "0xe4d22a9af4e14fdf70795dd9c9531295095f0cb6": {
    symbol: "POT",
    decimals: 18,
    name: "Proof of Time",
  },
};

/* ───────────────── CoinGecko (Base) ───────────────── */

async function fetchCoinGecko(token: HexAddr) {
  const url =
    "https://api.coingecko.com/api/v3/onchain/networks/base/tokens/" + token;

  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;

  const j: any = await res.json().catch(() => null);
  const attr = j?.data?.attributes;
  if (!attr) return null;

  const symbol = normalizeSymbol(attr.symbol);
  const decimals = Number(attr.decimals);
  const name = typeof attr.name === "string" ? attr.name : null;

  if (!symbol || !Number.isFinite(decimals)) return null;

  return { symbol, decimals, name, source: "coingecko" };
}

/* ───────────────── DefiLlama ───────────────── */

let llamaCache: Map<string, any> | null = null;

async function loadDefiLlama() {
  if (llamaCache) return llamaCache;

  const res = await fetch("https://tokens.llama.fi").catch(() => null);
  if (!res || !res.ok) return null;

  const j: any = await res.json().catch(() => null);
  const map = new Map<string, any>();

  for (const k of Object.keys(j?.tokens || {})) {
    const [chain, addr] = k.split(":");
    if (chain === "base" && isHexAddr(addr)) {
      map.set(addr.toLowerCase(), j.tokens[k]);
    }
  }

  llamaCache = map;
  return map;
}

async function fetchDefiLlama(token: HexAddr) {
  const map = await loadDefiLlama();
  if (!map) return null;

  const t = map.get(token.toLowerCase());
  if (!t) return null;

  const symbol = normalizeSymbol(t.symbol);
  const decimals = Number(t.decimals);
  const name = typeof t.name === "string" ? t.name : null;

  if (!symbol || !Number.isFinite(decimals)) return null;

  return { symbol, decimals, name, source: "defillama" };
}

/* ───────────────── Etherscan (Base) ───────────────── */

async function fetchEtherscan(token: HexAddr) {
  if (!ETHERSCAN_API_KEY) return null;

  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", "8453");
  url.searchParams.set("module", "token");
  url.searchParams.set("action", "tokeninfo");
  url.searchParams.set("contractaddress", token);
  url.searchParams.set("apikey", ETHERSCAN_API_KEY);

  const res = await fetch(url.toString()).catch(() => null);
  if (!res || !res.ok) return null;

  const j: any = await res.json().catch(() => null);
  const r = Array.isArray(j?.result) ? j.result[0] : null;
  if (!r) return null;

  const symbol = normalizeSymbol(r.symbol);
  const decimals = Number(r.decimals ?? r.tokenDecimal);
  const name =
    typeof r.tokenName === "string"
      ? r.tokenName
      : typeof r.name === "string"
      ? r.name
      : null;

  if (!symbol || !Number.isFinite(decimals)) return null;

  return { symbol, decimals, name, source: "etherscan" };
}

/* ───────────────── On-chain fallback ───────────────── */

async function fetchOnchain(token: HexAddr) {
  for (const c of clients) {
    try {
      const [sym, dec] = await Promise.all([
        withTimeout(
          c.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "symbol",
          } as any),
          UPSTREAM_TIMEOUT
        ).catch(() => null),
        withTimeout(
          c.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "decimals",
          } as any),
          UPSTREAM_TIMEOUT
        ).catch(() => null),
      ]);

      const symbol = normalizeSymbol(sym);
      const decimals =
        typeof dec === "bigint"
          ? Number(dec)
          : typeof dec === "number"
          ? dec
          : null;

      if (!symbol || decimals == null || decimals > 36) continue;

      return { symbol, decimals, name: null, source: "onchain" };
    } catch {}
  }
  return null;
}

/* ───────────────── POST ───────────────── */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const tokensIn = body?.tokens;

  const tokens: HexAddr[] = Array.isArray(tokensIn)
    ? tokensIn
        .map((t) => String(t).toLowerCase())
        .filter((t): t is HexAddr => isHexAddr(t))
    : [];

  if (!tokens.length) {
    return NextResponse.json(
      { error: "Provide tokens: HexAddr[]" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const out: Record<string, any> = {};

  for (const token of tokens) {
    const tk = token.toLowerCase();

    // 1) allowlist
    if (ALLOWLIST[tk]) {
      const v = ALLOWLIST[tk];
      await supabase.from("token_cache").upsert({
        token_address: tk,
        symbol: v.symbol,
        name: v.name ?? null,
        decimals: v.decimals,
        source: "allowlist",
        verified: true,
        updated_at: new Date().toISOString(),
      });
      out[tk] = { ...v, source: "allowlist", verified: true };
      continue;
    }

    // 2) verified cache
    const cached = await supabase
      .from("token_cache")
      .select("symbol,decimals,name,source,verified")
      .eq("token_address", tk)
      .maybeSingle();

    if (cached.data?.verified && normalizeSymbol(cached.data.symbol)) {
      out[tk] = { ...cached.data, verified: true };
      continue;
    }

    // 3–6 resolution
    const resolved =
      (await fetchCoinGecko(token)) ||
      (await fetchDefiLlama(token)) ||
      (await fetchEtherscan(token)) ||
      (await fetchOnchain(token));

    if (resolved) {
      await supabase.from("token_cache").upsert({
        token_address: tk,
        symbol: resolved.symbol,
        name: resolved.name,
        decimals: resolved.decimals,
        source: resolved.source,
        verified: true,
        updated_at: new Date().toISOString(),
      });
      out[tk] = { ...resolved, verified: true };
      continue;
    }

    out[tk] = { symbol: null, verified: false };
  }

  return NextResponse.json({ tokens: out });
}
