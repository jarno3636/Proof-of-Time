import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TOKENLIST_URL =
  "https://raw.githubusercontent.com/base-org/token-lists/main/lists/base.tokenlist.json";

const RESOLVE_ENDPOINT =
  process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/tokens/resolve`
    : null;

const CHUNK_SIZE = 25;

type TokenListToken = {
  address: string;
  chainId: number;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function POST(_req: NextRequest) {
  if (!RESOLVE_ENDPOINT) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SITE_URL not set" },
      { status: 500 }
    );
  }

  // 1️⃣ fetch Base token list
  const res = await fetch(TOKENLIST_URL);
  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch token list" },
      { status: 500 }
    );
  }

  const json: any = await res.json();
  const tokens: string[] = (json?.tokens || [])
    .filter((t: TokenListToken) => t.chainId === 8453)
    .map((t: TokenListToken) => t.address.toLowerCase());

  if (!tokens.length) {
    return NextResponse.json({ error: "No tokens found" }, { status: 500 });
  }

  // 2️⃣ chunk + resolve
  let resolved = 0;

  for (const batch of chunk(tokens, CHUNK_SIZE)) {
    await fetch(RESOLVE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: batch }),
    });

    resolved += batch.length;
  }

  return NextResponse.json({
    ok: true,
    tokens_seen: tokens.length,
    batches: Math.ceil(tokens.length / CHUNK_SIZE),
    resolved_attempted: resolved,
  });
}
