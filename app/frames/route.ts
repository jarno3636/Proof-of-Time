export const runtime = "edge";

function abs(u: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://proofoftime.vercel.app";
  return new URL(u, base).toString();
}

// GET: initial frame state
export async function GET() {
  // The image shown in the frame. Use your global OG as a start.
  const img = abs("/og.png");
  const home = abs("/");

  const html = `<!doctype html>
  <html>
    <head>
      <meta property="og:title" content="Proof of Time" />
      <meta property="og:image" content="${img}" />
      <meta name="fc:frame" content="vNext" />
      <meta name="fc:frame:image" content="${img}" />
      <meta name="fc:frame:button:1" content="Open App" />
      <meta name="fc:frame:button:1:action" content="link" />
      <meta name="fc:frame:button:1:target" content="${home}" />
      <meta name="fc:frame:post_url" content="${abs("/frames")}" />
    </head>
    <body></body>
  </html>`;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

// POST: handle button presses / state updates (optional for now)
export async function POST() {
  // For now, just return the same frame.
  return GET();
}
