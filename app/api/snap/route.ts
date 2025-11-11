// app/api/snap/route.ts
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import type * as P from "puppeteer-core";
import puppeteer from "puppeteer-core";

export const runtime = "nodejs";         // must be node for Puppeteer
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
  // Vercel / AWS Lambda path (provided by @sparticuz/chromium)
  const execPath = await chromium.executablePath();
  if (execPath) return execPath;

  // Local dev options:
  // 1) If you have CHROME_EXECUTABLE_PATH set, use that.
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;

  // 2) If you installed full "puppeteer" locally, use that binary.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteerFull: typeof import("puppeteer") = require("puppeteer");
    if (puppeteerFull?.executablePath) return puppeteerFull.executablePath();
  } catch {}
  // 3) Fallback: hope system Chrome is on PATH (rare in CI, fine for dev)
  return "/usr/bin/google-chrome";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Inputs
  const path = url.searchParams.get("path") || "/"; // e.g. /relic/0xabc...
  const selector = url.searchParams.get("selector") || '[data-share="altar"]';
  const dpr = Math.max(1, Math.min(3, Number(url.searchParams.get("dpr") || 2))); // device scale
  const w = Math.max(360, Math.min(1600, Number(url.searchParams.get("w") || 1200)));
  const waitMs = Math.min(20_000, Number(url.searchParams.get("wait") || 1500)); // extra settle time

  const target = new URL(path, siteOrigin()).toString();

  let browser: P.Browser | null = null;
  try {
    const executablePath = await resolveExecutablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: w, height: 800, deviceScaleFactor: dpr },
      executablePath,
      headless: chromium.headless, // true on Vercel
    });

    const page = await browser.newPage();
    // Speed up serverless rendering
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      // block analytics/fonts you don’t need for pixel-perfect capture? (toggle if needed)
      if (/\.(?:mp4|mp3|gif|webp|woff2?)$/i.test(req.url())) {
        req.continue();
      } else {
        req.continue();
      }
    });

    await page.goto(target, { waitUntil: "networkidle0", timeout: 40_000 });

    // give CSS/JS a moment (fonts, transitions)
    await page.waitForTimeout(waitMs);

    // Make sure the element exists and is visible
    await page.waitForSelector(selector, { visible: true, timeout: 10_000 });
    const el = await page.$(selector);
    if (!el) throw new Error(`Selector not found: ${selector}`);

    // Pause animations to avoid motion blur/mid-frame states
    await page.addStyleTag({
      content: `
        * { animation-play-state: paused !important; transition: none !important; }
        video, audio { display: none !important; }
      `,
    });

    // Scroll element into view and get full bounding box
    await el.evaluate((node) => node.scrollIntoView({ block: "nearest", inline: "nearest" }));
    const box = await el.boundingBox();
    if (!box) throw new Error("Element not visible for screenshot");

    // Expand viewport height to fit the element if it’s taller than default
    const neededH = Math.ceil(box.y + box.height + 24);
    const current = page.viewport();
    if (current && neededH > current.height) {
      await page.setViewport({ ...current, height: Math.min(neededH, 5000) });
      // Recompute box after viewport change
      await page.waitForTimeout(50);
    }

    // Pad slightly for ring/shadows
    const clip = {
      x: Math.max(0, box.x - 8),
      y: Math.max(0, box.y - 8),
      width: Math.min(w, box.width + 16),
      height: Math.min(page.viewport()?.height ?? 2000, box.height + 16),
    };

    const buf = (await page.screenshot({
      type: "jpeg",
      quality: 92,
      clip,
    })) as Buffer;

    return new NextResponse(buf, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "snap failed" }, { status: 500 });
  } finally {
    await browser?.close().catch(() => {});
  }
}
