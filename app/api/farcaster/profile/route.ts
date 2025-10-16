import { NextResponse } from "next/server";

/**
 * GET /api/farcaster/profile?address=0x...
 * Uses Neynar to find FC user by verified address, returns { username, pfpUrl, fid }
 */
export async function GET(req: Request) {
  const key = process.env.NEYNAR_API_KEY;
  if (!key) return NextResponse.json({ error: "NEYNAR_API_KEY missing" }, { status: 500 });

  const url = new URL(req.url);
  const address = (url.searchParams.get("address") || "").toLowerCase();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Bad address" }, { status: 400 });
  }

  // Neynar: user-by-verification
  const api = `https://api.neynar.com/v2/farcaster/user/by_verifications?addresses=${address}`;
  const r = await fetch(api, { headers: { "accept": "application/json", "api_key": key } });
  const j = await r.json().catch(() => ({} as any));

  const user = j?.users?.[0];
  if (!user) return NextResponse.json({});

  return NextResponse.json({
    username: user?.username,
    fid: user?.fid,
    pfpUrl: user?.pfp_url,
  });
}
