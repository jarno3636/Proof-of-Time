// app/api/relic-og.png/route.ts
import type { NextRequest } from "next/server";
import { GET as relicGET } from "../relic-og/route";

export const runtime = "edge";

// Fast probe for composers (optional)
export async function HEAD() {
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "public, max-age=60" },
  });
}

// Delegate GET to the original handler
export function GET(req: NextRequest) {
  return relicGET(req as any);
}
