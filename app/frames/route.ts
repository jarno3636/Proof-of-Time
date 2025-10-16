// app/frames/route.ts
export const runtime = "edge";

function abs(u: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://proofoftime.vercel.app";
  return new URL(u, base).toString();
}

export async function GET() {
  const img = abs("/og.png");
  const home = abs("/");

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <meta property="og:title" content="Proof of Time" />
      <meta property="og:description" content="Your longest-held tokens on Base. Time > hype." />
      <meta property="og:image" content="${img}" />
      <meta name="theme-color" content="#0b0e14" />

      <!-- Farcaster Frame vNext -->
      <meta name="fc:frame" content="vNext" />
      <meta name="fc:frame:image" content="${img}" />
      <meta name="fc:frame:button:1" content="Enter Your Altar" />
      <meta name="fc:frame:button:1:action" content="link" />
      <meta name="fc:frame:button:1:target" content="${home}" />
      <meta name="fc:frame:post_url" content="${abs("/frames")}" />
    </head>
    <body style="background:#0b0e14;color:#EDEEF2;font-family:system-ui, sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
      <div>Proof of Time — Frame Endpoint Active ✅</div>
    </body>
  </html>`;
  
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

export async function POST() {
  return GET();
}
