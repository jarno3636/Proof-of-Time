// app/api/snap/route.ts
import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const runtime = "nodejs";  // Next.js route config
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 15;    // ✅ set the function timeout here

function siteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const v = process.env.VERCEL_URL;
  if (v) return `https://${v}`;
  return "http://localhost:3000";
}

async function resolveExecutablePath(): Promise<string> {
  const execPath = await chromium.executablePath();
  if (execPath) return execPath;
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;
  return "/usr/bin/google-chrome";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const path     = url.searchParams.get("path") || "/";
  const selector = url.searchParams.get("selector") || '[data-share="altar"]';
  const dpr      = Math.max(1, Math.min(3, Number(url.searchParams.get("dpr") || 2)));
  const width    = Math.max(360, Math.min(1600, Number(url.searchParams.get("w") || 1200)));
  const waitMs   = Math.min(20_000, Number(url.searchParams.get("wait") || 1500));
  const target   = new URL(path, siteOrigin()).toString();

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const executablePath = await resolveExecutablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width, height: 800, deviceScaleFactor: dpr },
      executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.goto(target, { waitUntil: "networkidle0", timeout: 40_000 });
    // ⬇ replace waitForTimeout with a plain Promise to satisfy types
    await new Promise((r) => setTimeout(r, waitMs));

    await page.waitForSelector(selector, { visible: true, timeout: 10_000 });
    const el = await page.$(selector);
    if (!el) throw new Error(`Selector not found: ${selector}`);

    await page.addStyleTag({
      content: `
        * { animation-play-state: paused !important; transition: none !important; }
        video, audio { display: none !important; }
      `,
    });

    await el.evaluate((node) => node.scrollIntoView({ block: "nearest", inline: "nearest" }));
    const box = await el.boundingBox();
    if (!box) throw new Error("Element not visible for screenshot");

    const vp = page.viewport();
    const neededH = Math.ceil(box.y + box.height + 24);
    if (vp && neededH > vp.height) {
      await page.setViewport({ ...vp, height: Math.min(neededH, 5000) });
      await new Promise((r) => setTimeout(r, 50));
    }

    const clip = {
      x: Math.max(0, box.x - 8),
      y: Math.max(0, box.y - 8),
      width: Math.min(width, box.width + 16),
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
    try { await browser?.close(); } catch {}
  }
}
