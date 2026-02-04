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

const UPSTREAM_TIMEOUT = 8_000;

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
  if (s.length === 4 && /^[0-9A-F]{4}$/.test(s)) return null; // kill B8D9
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

/* ───────────────── upstream resolvers ───────────────── */

async function fetchBaseScanTokenInfo(token: HexAddr) {
  const key = process.env.BASESCAN_API_KEY;
  if (!key) return null;

  const url = new URL("https://api.basescan.org/api");
  url.searchParams.set("module", "token");
  url.searchParams.set("action", "tokeninfo");
  url.searchParams.set("contractaddress", token);
  url.searchParams.set("apikey", key);

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
  const decimals = Number(result.decimals ?? result.tokenDecimal ?? 18);
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
    source: "basescan" as const,
  };
}

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
        source: "onchain" as const,
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const out: Record<
    string,
    {
      symbol: string | null;
      decimals: number | null;
      name: string | null;
      source: string;
      verified: boolean;
    }
  > = {};

  for (const token of tokens) {
    const tk = token.toLowerCase();

    /* 1️⃣ allowlist */
    if (ALLOWLIST[tk]) {
      const v = ALLOWLIST[tk];
      out[tk] = {
        symbol: v.symbol,
        decimals: v.decimals,
        name: v.name ?? null,
        source: "allowlist",
        verified: true,
      };

      try {
        await supabase.from("token_cache").upsert({
          token_address: tk,
          symbol: v.symbol,
          name: v.name ?? null,
          decimals: v.decimals,
          source: "allowlist",
          verified: true,
          updated_at: new Date().toISOString(),
        });
      } catch {}

      continue;
    }

    /* 2️⃣ verified cache */
    let cached: any = null;
    try {
      const res = await supabase
        .from("token_cache")
        .select("symbol,decimals,name,source,verified")
        .eq("token_address", tk)
        .maybeSingle();
      cached = res.data;
    } catch {}

    if (
      cached?.verified &&
      normalizeSymbol(cached.symbol) &&
      cached.decimals != null
    ) {
      out[tk] = {
        symbol: normalizeSymbol(cached.symbol),
        decimals: Number(cached.decimals),
        name: typeof cached.name === "string" ? cached.name : null,
        source: String(cached.source || "cache"),
        verified: true,
      };
      continue;
    }

    /* 3️⃣ BaseScan */
    const bs = await fetchBaseScanTokenInfo(token);
    if (bs) {
      out[tk] = {
        symbol: bs.symbol,
        decimals: bs.decimals,
        name: bs.name,
        source: bs.source,
        verified: true,
      };

      try {
        await supabase.from("token_cache").upsert({
          token_address: tk,
          symbol: bs.symbol,
          name: bs.name,
          decimals: bs.decimals,
          source: bs.source,
          verified: true,
          updated_at: new Date().toISOString(),
        });
      } catch {}

      continue;
    }

    /* 4️⃣ on-chain validated */
    const oc = await fetchOnchainMeta(token);
    if (oc) {
      out[tk] = {
        symbol: oc.symbol,
        decimals: oc.decimals,
        name: oc.name,
        source: oc.source,
        verified: true,
      };

      try {
        await supabase.from("token_cache").upsert({
          token_address: tk,
          symbol: oc.symbol,
          name: oc.name,
          decimals: oc.decimals,
          source: oc.source,
          verified: true,
          updated_at: new Date().toISOString(),
        });
      } catch {}

      continue;
    }

    /* 5️⃣ unknown */
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
