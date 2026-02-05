import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Browser-safe seed job
 * - GET only
 * - Returns JSON immediately
 * - Does NOT block build or static generation
 */

const TOKENLIST_URL =
  "https://raw.githubusercontent.com/base-org/token-lists/main/lists/base.tokenlist.json";

const CHUNK_SIZE = 25;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function GET() {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://proofoftime.vercel.app";

  const resolveEndpoint = `${site}/api/tokens/resolve`;

  let discovered = 0;
  let attempted = 0;
  let batches = 0;

  try {
    /* 1️⃣ fetch Base token list */
    const res = await fetch(TOKENLIST_URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: "Failed to fetch Base token list",
      });
    }

    const json: any = await res.json();
    const tokens: string[] = (json?.tokens || [])
      .filter((t: any) => t.chainId === 8453)
      .map((t: any) => String(t.address).toLowerCase());

    discovered = tokens.length;

    if (!tokens.length) {
      return NextResponse.json({
        ok: false,
        error: "No Base tokens found",
      });
    }

    /* 2️⃣ chunk + fire-and-forget resolve calls */
    const chunks = chunk(tokens, CHUNK_SIZE);
    batches = chunks.length;

    for (const batch of chunks) {
      // fire-and-forget to avoid blocking
      fetch(resolveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: batch }),
      }).catch(() => null);

      attempted += batch.length;
    }

    /* 3️⃣ immediate browser-visible success */
    return NextResponse.json({
      ok: true,
      job: "seed-tokens",
      mode: "browser-safe",
      discovered_tokens: discovered,
      batches_fired: batches,
      tokens_attempted: attempted,
      note:
        "Resolution runs asynchronously. Refresh wallet pages in ~1–2 minutes.",
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || "Unexpected error",
    });
  }
}
