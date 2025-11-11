// app/api/snap/route.ts
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const v = process.env.VERCEL_URL;
  if (v) return `https://${v}`;
  return "http://localhost:3000";
}

async function resolveExecutablePath(): Promise<string> {
  const p = await chromium.executablePath();
  if (p) return p;
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;
  return "/usr/bin/google-chrome";
}

// ⚡ Fast readiness for HEAD (composer probes) and ping=1
export async function HEAD() {
  return new NextResponse(null, {
    status: 204,
    headers: { "cache-control": "public, max-age=60" },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // If someone calls ?ping=1 we return immediately (used for pre-warm)
  if (url.searchParams.get("ping")) {
    return new NextResponse(null, {
      status: 204,
      headers: { "cache-control": "public, max-age=60" },
    });
  }

  const path     = url.searchParams.get("path") || "/";
  const selector = url.searchParams.get("selector") || '[data-share="altar"]';
  const dpr      = Math.max(1, Math.min(2, Number(url.searchParams.get("dpr") || 1.6))); // a bit lighter
  const width    = Math.max(360, Math.min(1200, Number(url.searchParams.get("w") || 1100)));
  const waitMs   = Math.min(8000, Number(url.searchParams.get("wait") || 600)); // smaller wait
  const target   = new URL(path, siteOrigin()).toString();

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const executablePath = await resolveExecutablePath();

    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage"],
      defaultViewport: { width, height: 800, deviceScaleFactor: dpr },
      executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // 🚫 Block heavy/irrelevant stuff to reach “ready” faster
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const u = req.url();
      if (/\.(?:mp4|mp3|webm|mov)$/i.test(u)) return req.abort();
      if (/fonts\.gstatic|googletagmanager|analytics|segment|sentry|hotjar|fullstory/i.test(u)) return req.abort();
      return req.continue();
    });

    // Don’t wait for every network call; we only need DOM + CSS
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await page.waitForTimeout(waitMs);

    await page.waitForSelector(selector, { visible: true, timeout: 6_000 });
    const el = await page.$(selector);
    if (!el) throw new Error(`Selector not found: ${selector}`);

    await page.addStyleTag({
      content: `*{animation-play-state:paused!important;transition:none!important} video,audio{display:none!important}`,
    });

    await el.evaluate((n) => n.scrollIntoView({ block: "nearest" }));
    const box = await el.boundingBox();
    if (!box) throw new Error("Element not visible for screenshot");

    // Expand viewport if required
    const needH = Math.ceil(box.y + box.height + 24);
    const vp = page.viewport();
    if (vp && needH > vp.height) {
      await page.setViewport({ ...vp, height: Math.min(needH, 4500) });
      await page.waitForTimeout(40);
    }

    const clip = {
      x: Math.max(0, box.x - 8),
      y: Math.max(0, box.y - 8),
      width: Math.min(width, box.width + 16),
      height: Math.min(page.viewport()?.height ?? 2000, box.height + 16),
    };

    const buf = (await page.screenshot({ type: "jpeg", quality: 90, clip })) as Buffer;

    return new NextResponse(buf, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "snap failed" }, { status: 500 });
  } finally {
    try { await browser?.close(); } catch {}
  }
}
