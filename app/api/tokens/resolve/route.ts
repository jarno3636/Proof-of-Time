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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

function normalizeSymbol(sym: unknown): string | null {
  if (typeof sym !== "string") return null;
  const s = sym.trim();
  if (!s) return null;
  if (s.toUpperCase() === "TKN") return null;
  if (s.length === 4 && /^[0-9A-F]{4}$/.test(s)) return null; // kill B8D9 garbage
  if (s.length > 24) return null;
  return s;
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

/* ───────────────── Etherscan (Base) ───────────────── */

async function fetchEtherscanTokenInfo(token: HexAddr) {
  if (!ETHERSCAN_API_KEY) return null;

  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", "8453"); // BASE
  url.searchParams.set("module", "token");
  url.searchParams.set("action", "tokeninfo");
  url.searchParams.set("contractaddress", token);
  url.searchParams.set("apikey", ETHERSCAN_API_KEY);

  let res: Response;
  try {
    res = await withTimeout(fetch(url.toString()), UPSTREAM_TIMEOUT);
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const json: any = await res.json().catch(() => null);
  const result = Array.isArray(json?.result) ? json.result[0] : null;
  if (!result) return null;

  const symbol = normalizeSymbol(result.symbol);
  const decimals = Number(result.decimals ?? result.tokenDecimal);
  const name =
    typeof result.tokenName === "string"
      ? result.tokenName
      : typeof result.name === "string"
      ? result.name
      : null;

  if (!symbol || !Number.isFinite(decimals)) return null;

  return {
    symbol,
    decimals,
    name: name ?? null,
    source: "etherscan",
  };
}

/* ───────────────── On-chain fallback ───────────────── */

async function fetchOnchainMeta(token: HexAddr) {
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

      if (!symbol || decimals == null || decimals < 0 || decimals > 36) continue;

      return {
        symbol,
        decimals,
        name: null as string | null,
        source: "onchain",
      };
    } catch {}
  }
  return null;
}

/* ───────────────── POST ───────────────── */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const tokensIn = (body as any)?.tokens;

  const tokens: HexAddr[] = Array.isArray(tokensIn)
    ? tokensIn
        .map((t) => String(t || "").toLowerCase())
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

    // 1️⃣ Allowlist
    if (ALLOWLIST[tk]) {
      const v = ALLOWLIST[tk];
      out[tk] = { ...v, source: "allowlist", verified: true };

      await supabase.from("token_cache").upsert({
        token_address: tk,
        symbol: v.symbol,
        name: v.name ?? null,
        decimals: v.decimals,
        source: "allowlist",
        verified: true,
        updated_at: new Date().toISOString(),
      });

      continue;
    }

    // 2️⃣ Verified cache
    const { data: cached } = await supabase
      .from("token_cache")
      .select("symbol,decimals,name,source,verified")
      .eq("token_address", tk)
      .maybeSingle();

    if (cached?.verified && normalizeSymbol(cached.symbol)) {
      out[tk] = {
        symbol: cached.symbol,
        decimals: cached.decimals,
        name: cached.name,
        source: cached.source,
        verified: true,
      };
      continue;
    }

    // 3️⃣ Etherscan (Base)
    const es = await fetchEtherscanTokenInfo(token);
    if (es) {
      out[tk] = { ...es, verified: true };

      await supabase.from("token_cache").upsert({
        token_address: tk,
        symbol: es.symbol,
        name: es.name,
        decimals: es.decimals,
        source: es.source,
        verified: true,
        updated_at: new Date().toISOString(),
      });

      continue;
    }

    // 4️⃣ On-chain validated fallback
    const oc = await fetchOnchainMeta(token);
    if (oc) {
      out[tk] = { ...oc, verified: true };

      await supabase.from("token_cache").upsert({
        token_address: tk,
        symbol: oc.symbol,
        name: oc.name,
        decimals: oc.decimals,
        source: oc.source,
        verified: true,
        updated_at: new Date().toISOString(),
      });

      continue;
    }

    // 5️⃣ Unknown (never cached)
    out[tk] = {
      symbol: null,
      decimals: null,
      name: null,
      source: "unknown",
      verified: false,
    };
  }

  return NextResponse.json({ tokens: out });
}
