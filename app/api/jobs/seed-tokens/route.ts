import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Browser-safe seed job
 * - GET only
 * - Returns immediately
 * - Discovers tokens from MULTIPLE trusted sources
 * - Resolution happens via /api/tokens/resolve
 */

const BASE_TOKENLIST =
  "https://raw.githubusercontent.com/base-org/token-lists/main/lists/base.tokenlist.json";

const LLAMA_TOKENS =
  "https://coins.llama.fi/tokenlists/base";

const COINGECKO_TOKENS =
  "https://api.coingecko.com/api/v3/coins/list?include_platform=true";

const CHUNK_SIZE = 25;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function GET() {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://proofoftime.vercel.app";

  const resolveEndpoint = `${site}/api/tokens/resolve`;

  const discovered = new Set<string>();

  try {
    /* 1️⃣ Base token list */
    try {
      const res = await fetch(BASE_TOKENLIST, { cache: "no-store" });
      const json: any = await res.json();
      for (const t of json?.tokens || []) {
        if (t.chainId === 8453 && t.address) {
          discovered.add(t.address.toLowerCase());
        }
      }
    } catch {}

    /* 2️⃣ DefiLlama Base tokens */
    try {
      const res = await fetch(LLAMA_TOKENS, { cache: "no-store" });
      const json: any = await res.json();
      for (const t of json?.tokens || []) {
        if (t.address) discovered.add(t.address.toLowerCase());
      }
    } catch {}

    /* 3️⃣ CoinGecko Base platform tokens */
    try {
      const res = await fetch(COINGECKO_TOKENS, { cache: "no-store" });
      const list: any[] = await res.json();
      for (const c of list) {
        const addr = c?.platforms?.base;
        if (addr && typeof addr === "string") {
          discovered.add(addr.toLowerCase());
        }
      }
    } catch {}

    const tokens = [...discovered];
    if (!tokens.length) {
      return NextResponse.json({ ok: false, error: "No tokens discovered" });
    }

    /* 4️⃣ Chunk + fire-and-forget resolution */
    const chunks = chunk(tokens, CHUNK_SIZE);
    for (const batch of chunks) {
      fetch(resolveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: batch }),
      }).catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      job: "seed-tokens",
      discovery_sources: ["base-tokenlist", "defillama", "coingecko"],
      tokens_discovered: tokens.length,
      batches_fired: chunks.length,
      note:
        "Metadata resolution runs asynchronously. Reload app in 1–2 minutes.",
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || "Unexpected error",
    });
  }
}
