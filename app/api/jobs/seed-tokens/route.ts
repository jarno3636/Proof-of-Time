import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ───────────────── CONFIG ───────────────── */

const BASE_TOKENLIST_URL =
  "https://raw.githubusercontent.com/base-org/token-lists/main/lists/base.tokenlist.json";

const COINGECKO_BASE_TOKENS =
  "https://api.coingecko.com/api/v3/coins/list?include_platform=true";

const DEFILLAMA_PROTOCOLS =
  "https://api.llama.fi/protocols";

const RESOLVE_ENDPOINT =
  process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/tokens/resolve`
    : null;

const CHUNK_SIZE = 25;

/* ───────────────── TYPES ───────────────── */

type TokenListToken = {
  address: string;
  chainId: number;
};

type CoinGeckoCoin = {
  platforms?: Record<string, string>;
};

type LlamaProtocol = {
  chain?: string;
  address?: string;
};

/* ───────────────── UTILS ───────────────── */

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function isHex(addr: unknown): addr is string {
  return typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

/* ───────────────── GET (BROWSER SAFE) ───────────────── */

export async function GET() {
  return NextResponse.json({
    ok: true,
    job: "seed-tokens",
    description:
      "Seeds Base token metadata using Base tokenlist + CoinGecko + DefiLlama.",
    how_it_works: [
      "1) Discover token addresses from multiple trusted sources",
      "2) Deduplicate",
      "3) Resolve metadata via /api/tokens/resolve",
      "4) Cache only verified symbols",
    ],
    how_to_run: {
      manual: "POST to this endpoint",
      curl: "curl -X POST https://proofoftime.vercel.app/api/jobs/seed-tokens",
    },
    safe: true,
  });
}

/* ───────────────── POST (JOB) ───────────────── */

export async function POST(_req: NextRequest) {
  if (!RESOLVE_ENDPOINT) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SITE_URL not set" },
      { status: 500 }
    );
  }

  const discovered = new Set<string>();

  /* 1️⃣ Base official token list */
  try {
    const res = await fetch(BASE_TOKENLIST_URL);
    if (res.ok) {
      const json: any = await res.json();
      for (const t of json?.tokens || []) {
        if (t.chainId === 8453 && isHex(t.address)) {
          discovered.add(t.address.toLowerCase());
        }
      }
    }
  } catch {}

  /* 2️⃣ CoinGecko Base platform tokens */
  try {
    const res = await fetch(COINGECKO_BASE_TOKENS);
    if (res.ok) {
      const coins: CoinGeckoCoin[] = await res.json();
      for (const c of coins) {
        const addr = c.platforms?.["base"];
        if (isHex(addr)) discovered.add(addr.toLowerCase());
      }
    }
  } catch {}

  /* 3️⃣ DefiLlama protocols (Base only) */
  try {
    const res = await fetch(DEFILLAMA_PROTOCOLS);
    if (res.ok) {
      const protocols: LlamaProtocol[] = await res.json();
      for (const p of protocols) {
        if (p.chain === "Base" && isHex(p.address)) {
          discovered.add(p.address.toLowerCase());
        }
      }
    }
  } catch {}

  const tokens = Array.from(discovered);

  if (!tokens.length) {
    return NextResponse.json(
      { error: "No tokens discovered" },
      { status: 500 }
    );
  }

  /* 4️⃣ Resolve + cache via your resolver */
  let attempted = 0;
  let batches = 0;

  for (const batch of chunk(tokens, CHUNK_SIZE)) {
    batches++;

    await fetch(RESOLVE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: batch }),
    }).catch(() => null);

    attempted += batch.length;
  }

  return NextResponse.json({
    ok: true,
    job: "seed-tokens",
    discovered: tokens.length,
    batches,
    attempted,
    sources: ["base-tokenlist", "coingecko", "defillama"],
    note:
      "Only verified metadata is stored. Junk symbols are discarded by resolver.",
  });
}
