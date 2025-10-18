// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // These headers make Warpcast treat your site as a Mini App container.
  res.headers.set("x-miniapp-name", "Proof of Time");
  res.headers.set("x-miniapp-image", "https://proofoftime.vercel.app/og.png");
  res.headers.set("x-miniapp-url", "https://proofoftime.vercel.app");

  return res;
}

// Apply to all app routes (skip Next.js assets)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
