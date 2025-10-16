// app/api/frame/route.ts
import { NextResponse } from "next/server";

export const runtime = "edge";

/** Build the absolute origin safely (Vercel/Prod/Preview). */
function getOrigin(req: Request) {
  const url = new URL(req.url);
  const hdrs = req.headers as Headers;
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || url.host;
  const proto = (hdrs.get("x-forwarded-proto") || url.protocol.replace(":", "")).split(",")[0].trim();
  return process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
}

/** Basic HTML template for a Frames v2 response (meta tags). */
function frameHtml({
  img,
  postUrl,
  buttons,
  title = "Proof of Time",
  description = "Time > hype.",
}: {
  img: string;
  postUrl: string;
  buttons: Array<{ label: string; action: "post" | "link"; target?: string }>;
  title?: string;
  description?: string;
}) {
  // Buttons become fc:frame:button:[i] and optionally fc:frame:button:[i]:action / :target
  const lines: string[] = [];
  lines.push(`<meta property="og:title" content="${escapeHtml(title)}" />`);
  lines.push(`<meta property="og:description" content="${escapeHtml(description)}" />`);
  lines.push(`<meta property="og:image" content="${img}" />`);
  lines.push(`<meta name="fc:frame" content="vNext" />`);
  lines.push(`<meta name="fc:frame:image" content="${img}" />`);
  lines.push(`<meta name="fc:frame:post_url" content="${postUrl}" />`);
  buttons.forEach((b, i) => {
    const idx = i + 1;
    lines.push(`<meta name="fc:frame:button:${idx}" content="${escapeHtml(b.label)}" />`);
    if (b.action === "link" && b.target) {
      lines.push(`<meta name="fc:frame:button:${idx}:action" content="link" />`);
      lines.push(`<meta name="fc:frame:button:${idx}:target" content="${b.target}" />`);
    } else {
      lines.push(`<meta name="fc:frame:button:${idx}:action" content="post" />`);
    }
  });

  return `<!DOCTYPE html><html><head>${lines.join("")}</head><body></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/** GET: initial frame */
export async function GET(req: Request) {
  const origin = getOrigin(req);
  const url = new URL(req.url);
  const address = (url.searchParams.get("address") || "").toLowerCase();

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    // Tiny helper page so people know how to use it
    const img = `${origin}/api/relic-card?symbol=BASE&days=0&tier=Bronze&token=0x0000000000000000000000000000000000000000`;
    const html = frameHtml({
      img,
      postUrl: `${origin}/api/frame`, // no-op on post
      buttons: [{ label: "Enter address param", action: "link", target: `${origin}` }],
      title: "Proof of Time",
      description: "Add ?address=0x… to render your altar frame.",
    });
    return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html" } });
  }

  const imgUrl = `${origin}/api/card/${address}`; // or use /api/relic-card?address=...
  const postUrl = `${origin}/api/frame?address=${address}`;

  const html = frameHtml({
    img: imgUrl,
    postUrl,
    buttons: [
      { label: "Verify your will to hold", action: "post" },
      { label: "Open Altar", action: "link", target: `${origin}/relic/${address}` },
      { label: "Share", action: "link", target: `https://warpcast.com/~/compose?text=${encodeURIComponent("Proof of Time – Time > hype ⏳")}&embeds[]=${encodeURIComponent(imgUrl)}` },
    ],
    title: "Proof of Time",
    description: "Your relics on Base.",
  });

  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html" } });
}

/** POST: button 1 (“Verify your will to hold”) */
export async function POST(req: Request) {
  const origin = getOrigin(req);
  const url = new URL(req.url);
  const address = (url.searchParams.get("address") || "").toLowerCase();

  // (Optional) You could verify the frame signature via Neynar if you want to gate this.
  // Minimal flow: just trigger compute for the requested address.
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    // best-effort; do not block on response
    try {
      await fetch(`${origin}/api/compute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
        // avoid re-entrancy/timeouts impacting the frame
        cache: "no-store",
      });
    } catch {
      // swallow; we’ll still return a frame
    }
  }

  // Return a success frame with a “Refresh” post and “Open Altar” link
  const imgUrl = `${origin}/api/card/${address}?_=${Date.now()}`; // cache-bust
  const postUrl = `${origin}/api/frame?address=${address}`;
  const html = frameHtml({
    img: imgUrl,
    postUrl,
    buttons: [
      { label: "Refresh", action: "post" },
      { label: "Open Altar", action: "link", target: `${origin}/relic/${address}` },
      { label: "Share", action: "link", target: `https://warpcast.com/~/compose?text=${encodeURIComponent("Proof of Time – Time > hype ⏳")}&embeds[]=${encodeURIComponent(imgUrl)}` },
    ],
    title: "Proof of Time",
    description: "Verification requested. Give it a moment, then refresh.",
  });

  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html" } });
}
