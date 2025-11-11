// Same output as /api/relic-og, but the path ends with .png so Warpcast treats it as an image.
import type { NextRequest } from "next/server";
export const runtime = "edge";

// Reuse the generator from the main route
export { GET as _GET } from "../relic-og/route";

// Optionally provide fast 204 for HEAD probes
export async function HEAD() {
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "public, max-age=60" },
  });
}

// Delegate GET to the original handler
export async function GET(req: NextRequest) {
  // @ts-expect-error re-exported alias
  return _GET(req);
}
