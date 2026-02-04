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

const UPSTREAM_TIMEOUT = 8_000;

const RPCS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://1rpc.io/base",
];

const clients = RPCS.map((url) =>
  createPublicClient({ chain: base, transport: http(url, { timeout: UPSTREAM_TIMEOUT, retryCount: 1 }) })
);

const isHexAddr = (s: string): s is HexAddr => /^0x[a-fA-F0-9]{40}$/.test(s);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

// hard allowlist for Base staples + your protocol token
const ALLOWLIST: Record<string, { symbol: string; decimals: number; name?: string }> = {
  "0x833589fcd6edb6e08f4c7c32d4f41f182e88c0a4": { symbol: "USDC", decimals: 6, name: "USD Coin" },
  "0x4200000000000000000000000000000000000006": { symbol: "WETH", decimals: 18, name: "Wrapped Ether" },
  "0xe4d22a9af4e14fdf70795dd9c9531295095f0cb6": { symbol: "POT", decimals: 18, name: "Proof of Time" },
};

function normalizeSymbol(sym: unknown): string | null {
  if (typeof sym !== "string") return null;
  const s = sym.trim();
  if (!s) return null;
  if (s.toUpperCase() === "TKN") return null;
  if (s.length === 4 && /^[0-9A-F]{4}$/.test(s)) return null; // kill B8D9 style
  if (s.length > 24) return null;
  return s;
}

async function fetchBaseScanTokenInfo(token: HexAddr) {
  const key = process.env.BASESCAN_API_KEY;
  if (!key) return null;

  const url = new URL("https://api.basescan.org/api");
  url.searchParams.set("module", "token");
  url.searchParams.set("action", "tokeninfo");
  url.searchParams.set("contractaddress", token);
  url.searchParams.set("apikey", key);

  const res = await withTimeout(fetch(url.toString()), UPSTREAM_TIMEOUT).catch(() => null);
  if (!res || !res.ok) return null;

  const json: any = await res.json().catch(() => null);
  const result = Array.isArray(json?.result) ? json.result[0] : null;
  if (!result) return null;

  const symbol = normalizeSymbol(result.symbol);
  const decimals = Number(result.decimals ?? result.tokenDecimal ?? 18);
  const name = typeof result.tokenName === "string" ? result.tokenName : typeof result.name === "string" ? result.name : null;

  if (!symbol || !Number.isFinite(decimals)) return null;
  return { symbol, decimals, name: name || null, source: "basescan" as const };
}

async function fetchOnchainMeta(token: HexAddr) {
  for (const c of clients) {
    try {
      const [sym, dec] = await Promise.all([
        withTimeout(
          c.readContract({ address: token, abi: erc20Abi, functionName: "symbol" } as any) as Promise<any>,
          UPSTREAM_TIMEOUT
        ).catch(() => null),
        withTimeout(
          c.readContract({ address: token, abi: erc20Abi, functionName: "decimals" } as any) as Promise<any>,
          UPSTREAM_TIMEOUT
        ).catch(() => null),
      ]);

      const symbol = normalizeSymbol(sym);
      const decimals =
        typeof dec === "bigint" ? Number(dec) : typeof dec === "number" ? dec : 18;

      if (!symbol) continue;
      if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) continue;

      return { symbol, decimals, name: null as string | null, source: "onchain" as const };
    } catch {}
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const tokensIn: unknown = (body as any)?.tokens;

  const tokens: HexAddr[] = Array.isArray(tokensIn)
    ? tokensIn
        .map((t) => String(t || "").toLowerCase())
        .filter((t): t is HexAddr => isHexAddr(t))
    : [];

  if (!tokens.length) {
    return NextResponse.json({ error: "Provide tokens: HexAddr[]" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const out: Record<string, { symbol: string | null; decimals: number | null; name: string | null; source: string; verified: boolean }> = {};

  for (const token of tokens) {
    const tokenKey = token.toLowerCase();

    // 1) allowlist
    if (ALLOWLIST[tokenKey]) {
      const v = ALLOWLIST[tokenKey];
      out[tokenKey] = { symbol: v.symbol, decimals: v.decimals, name: v.name ?? null, source: "allowlist", verified: true };

      await supabase.from("token_cache").upsert({
        token_address: tokenKey,
        symbol: v.symbol,
        name: v.name ?? null,
        decimals: v.decimals,
        source: "allowlist",
        verified: true,
        updated_at: new Date().toISOString(),
      }).catch(() => null);

      continue;
    }

    // 2) verified cache
    const cached = await supabase
      .from("token_cache")
      .select("symbol, decimals, name, source, verified")
      .eq("token_address", tokenKey)
      .maybeSingle()
      .catch(() => ({ data: null as any }));

    const cd = (cached as any)?.data;
    if (cd?.verified && normalizeSymbol(cd.symbol) && cd.decimals != null) {
      out[tokenKey] = {
        symbol: normalizeSymbol(cd.symbol),
        decimals: Number(cd.decimals),
        name: typeof cd.name === "string" ? cd.name : null,
        source: String(cd.source || "cache"),
        verified: true,
      };
      continue;
    }

    // 3) BaseScan
    const bs = await fetchBaseScanTokenInfo(token);
    if (bs) {
      out[tokenKey] = { symbol: bs.symbol, decimals: bs.decimals, name: bs.name, source: bs.source, verified: true };

      await supabase.from("token_cache").upsert({
        token_address: tokenKey,
        symbol: bs.symbol,
        name: bs.name,
        decimals: bs.decimals,
        source: bs.source,
        verified: true,
        updated_at: new Date().toISOString(),
      }).catch(() => null);

      continue;
    }

    // 4) on-chain last resort (validated)
    const oc = await fetchOnchainMeta(token);
    if (oc) {
      out[tokenKey] = { symbol: oc.symbol, decimals: oc.decimals, name: oc.name, source: oc.source, verified: true };

      await supabase.from("token_cache").upsert({
        token_address: tokenKey,
        symbol: oc.symbol,
        name: oc.name,
        decimals: oc.decimals,
        source: oc.source,
        verified: true,
        updated_at: new Date().toISOString(),
      }).catch(() => null);

      continue;
    }

    // unknown: DO NOT CACHE FALLBACK
    out[tokenKey] = { symbol: null, decimals: null, name: null, source: "unknown", verified: false };
  }

  return NextResponse.json({ tokens: out });
}
