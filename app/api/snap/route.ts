// app/api/snap/route.ts
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const runtime = "nodejs";          // must be node
export const dynamic = "force-dynamic";
export const revalidate = 0;

function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const v = process.env.VERCEL_URL;
  if (v) return `https://${v}`;
  return "http://localhost:3000";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "/";           // e.g. /relic/0xabc...
  const selector = url.searchParams.get("selector") || '[data-share="altar"]';
  const dpr = Math.min(3, Number(url.searchParams.get("dpr") || 2)); // retina-ish
  const w = Math.min(1400, Number(url.searchParams.get("w") || 1200));
  const wait = Math.min(8000, Number(url.searchParams.get("wait") || 1500)); // ms

  const target = new URL(path, siteOrigin()).toString();

  let browser: puppeteer.Browser | null = null;
  try {
    const execPath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: w, height: 800, deviceScaleFactor: dpr },
      executablePath: execPath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto(target, { waitUntil: "networkidle0", timeout: 30_000 });

    // give animations/fonts a moment
    await page.waitForTimeout(wait);

    const el = await page.$(selector);
    if (!el) {
      throw new Error(`Selector not found: ${selector}`);
    }

    const clip = await el.boundingBox();
    if (!clip) throw new Error("Element not visible for screenshot");

    const buf = await page.screenshot({
      type: "jpeg",
      quality: 92,
      clip: {
        x: Math.max(0, clip.x - 8),
        y: Math.max(0, clip.y - 8),
        width: Math.min(w, clip.width + 16),
        height: clip.height + 16,
      },
    }) as Buffer;

    return new NextResponse(buf, {
      headers: {
        "content-type": "image/jpeg",
        // cache a bit so Warpcast/X can fetch it
        "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "snap failed" }, { status: 500 });
  } finally {
    await browser?.close().catch(() => {});
  }
}
