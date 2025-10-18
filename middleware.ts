import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Inject Farcaster MiniApp headers
  res.headers.set("x-miniapp-name", "Proof of Time");
  res.headers.set("x-miniapp-image", "https://proofoftime.vercel.app/og.png");
  res.headers.set("x-miniapp-url", "https://proofoftime.vercel.app");

  // Allow Warpcast / Farcaster agent to preload SDK
  res.headers.set("Access-Control-Allow-Origin", "*");

  return res;
}

// Apply globally
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
