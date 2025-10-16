// app/api/farcaster/profile/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: Request) {
  const key = process.env.NEYNAR_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "NEYNAR_API_KEY missing" }, { status: 500 });
  }

  const url = new URL(req.url);
  const address = (url.searchParams.get("address") || "").toLowerCase();

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Bad address" }, { status: 400 });
  }

  const api = `https://api.neynar.com/v2/farcaster/user/by_verifications?addresses=${address}`;
  const r = await fetch(api, {
    headers: { accept: "application/json", api_key: key },
    // Profiles change rarely; cache for a short time
    next: { revalidate: 300 },
  });

  if (!r.ok) {
    return NextResponse.json({ error: `Neynar error ${r.status}` }, { status: 502 });
  }

  const j = await r.json().catch(() => ({} as any));
  const user = j?.users?.[0];

  return NextResponse.json(
    user
      ? { username: user?.username, fid: user?.fid, pfpUrl: user?.pfp_url }
      : {},
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
  );
}
