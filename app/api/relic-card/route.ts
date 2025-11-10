// app/api/relic-card/route.ts
import { NextRequest, NextResponse } from "next/server";

// Optional sharp (fallback to SVG if not installed)
let sharp: typeof import("sharp") | null = null;
try { sharp = require("sharp"); } catch { sharp = null; }

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
type Item = {
  symbol: string;
  days: number;
  tier: Tier;
  never_sold?: boolean;
  no_sell_streak_days?: number;
  token?: string;
};

const W = 1200;
const H = 630;

// Palette tuned for readability on dark
const tierColors: Record<Tier, { bg: string; rim: string; glow: string }> = {
  Bronze:   { bg: "#2b1c10", rim: "#C8AC6B", glow: "rgba(200,172,107,0.22)" },
  Silver:   { bg: "#1f242a", rim: "#D6DCE4", glow: "rgba(198,210,222,0.22)" },
  Gold:     { bg: "#2a210b", rim: "#F0D17A", glow: "rgba(240,209,122,0.22)" },
  Platinum: { bg: "#171c28", rim: "#C4D6FF", glow: "rgba(196,214,255,0.22)" },
  Obsidian: { bg: "#0b0e14", rim: "#6a758a", glow: "rgba(106,117,138,0.22)" },
};

function short(addr?: string) {
  if (!addr) return "";
  const a = String(addr);
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
function esc(s: string) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseItems(req: NextRequest): Item[] {
  const u = new URL(req.url);
  const sp = u.searchParams;

  // Support array style: symbol[]=... etc.
  const sym = sp.getAll("symbol[]");
  const days = sp.getAll("days[]");
  const tier = sp.getAll("tier[]");
  const never = sp.getAll("never_sold[]");
  const nosell = sp.getAll("no_sell_streak_days[]");
  const token = sp.getAll("token[]");

  const arr: Item[] = sym.length
    ? sym.map((_, i) => ({
        symbol: sym[i],
        days: Number(days[i] ?? 0) || 0,
        tier: (tier[i] as Tier) || "Bronze",
        never_sold: /^(1|true|yes)$/i.test(never[i] || ""),
        no_sell_streak_days: Number(nosell[i] ?? 0) || 0,
        token: token[i],
      }))
    : [
        {
          symbol: sp.get("symbol") || "RELIC",
          days: Number(sp.get("days") || 0) || 0,
          tier: (sp.get("tier") as Tier) || "Bronze",
          never_sold: /^(1|true|yes)$/i.test(sp.get("never_sold") || ""),
          no_sell_streak_days: Number(sp.get("no_sell_streak_days") || 0) || 0,
          token: sp.get("token") || "",
        },
      ];

  return arr.slice(0, 3);
}

/** A single row “card” – bigger type, clear columns */
function relicRowSVG(it: Item, yTop: number) {
  const c = tierColors[it.tier];

  const rowH = 170;
  const midY = yTop + rowH / 2;
  const coinX = 170;

  const badge =
    it.never_sold
      ? `<g>
           <rect x="260" y="${yTop + 114}" rx="12" ry="12" width="144" height="30" fill="rgba(16,120,80,0.18)" stroke="rgba(80,225,160,0.35)"/>
           <text x="278" y="${yTop + 133}" font-family="Inter, system-ui, -apple-system, Segoe UI" font-size="14" fill="#b8f8d2">Never sold</text>
         </g>`
      : `<g>
           <rect x="260" y="${yTop + 114}" rx="12" ry="12" width="178" height="30" fill="rgba(60,140,210,0.18)" stroke="rgba(120,190,255,0.35)"/>
           <text x="278" y="${yTop + 133}" font-family="Inter, system-ui, -apple-system, Segoe UI" font-size="14" fill="#d6ecff">No-sell ${Math.max(0, it.no_sell_streak_days || 0)}d</text>
         </g>`;

  return `
  <g>
    <!-- card background -->
    <rect x="48" y="${yTop}" width="${W - 96}" height="${rowH}" rx="20" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)"/>
    <ellipse cx="${coinX}" cy="${midY}" rx="64" ry="64" fill="${c.glow}" />
    <!-- coin -->
    <circle cx="${coinX}" cy="${midY}" r="60" fill="${c.bg}" stroke="${c.rim}" stroke-width="4"/>
    <circle cx="${coinX}" cy="${midY}" r="46" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
    <rect x="${coinX - 10}" y="${midY - 10}" width="20" height="20" fill="#fff" opacity="0.95" rx="3"/>

    <!-- left copy -->
    <text x="260" y="${yTop + 38}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI"
          font-size="18" fill="#d8d6cf" letter-spacing="2"> ${esc(it.tier)} Relic</text>
    <text x="260" y="${yTop + 78}" font-family="Cinzel, ui-serif, Georgia" font-size="44" fill="#f6f1e6" font-weight="700">
      $${esc(it.symbol)}
    </text>
    ${it.token ? `<text x="260" y="${yTop + 104}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas"
              font-size="16" fill="rgba(255,255,255,0.65)">${esc(short(it.token))}</text>` : ""}

    <!-- right: days -->
    <text x="${W - 120}" y="${yTop + 84}" text-anchor="end"
          font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI"
          font-size="70" fill="#ffffff" font-weight="800">${Math.max(0, it.days || 0)}</text>
    <text x="${W - 115}" y="${yTop + 84}" font-family="ui-sans-serif, system-ui"
          font-size="22" fill="rgba(255,255,255,0.75)">days held</text>

    ${badge}
  </g>`;
}

function buildSVG(items: Item[]) {
  const top = 130;        // top padding below title
  const gap = 12;         // gap between rows
  const rowH = 170;       // row height
  const ys = Array.from({ length: items.length }, (_, i) => top + i * (rowH + gap));

  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0e14"/>
      <stop offset="100%" stop-color="#141a22"/>
    </linearGradient>
    <filter id="vignette" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="40" />
    </filter>
  </defs>

  <!-- background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${W - 140}" cy="80" r="160" fill="#BBA46A22" filter="url(#vignette)"/>
  <circle cx="180" cy="${H - 40}" r="180" fill="#79FFE122" filter="url(#vignette)"/>

  <!-- header -->
  <g transform="translate(48,56)">
    <text x="0" y="0" font-family="Cinzel, ui-serif, Georgia" font-weight="700" font-size="40" fill="#f2e9d0">
      Proof of Time
    </text>
    <text x="0" y="30" font-family="ui-sans-serif, system-ui" font-size="16" fill="rgba(255,255,255,0.78)">
      Relics forged by patience
    </text>
  </g>

  ${items.map((it, i) => relicRowSVG(it, ys[i])).join("\n")}

  <!-- footer -->
  <rect x="0" y="${H - 56}" width="${W}" height="56" fill="rgba(255,255,255,0.03)"/>
  <text x="${W - 56}" y="${H - 20}" text-anchor="end" font-family="ui-sans-serif, system-ui" font-size="18"
        fill="rgba(255,255,255,0.78)">Time > hype • #ProofOfTime</text>
</svg>`.trim();
}

export async function GET(req: NextRequest) {
  try {
    const items = parseItems(req);
    const svg = buildSVG(items);
    const svgBuf = Buffer.from(svg);

    if (sharp) {
      const buf = await sharp(svgBuf).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
      return new NextResponse(buf, {
        headers: {
          "content-type": "image/jpeg",
          "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
        },
      });
    }

    // Fallback: return SVG if sharp isn’t available at build/runtime
    return new NextResponse(svgBuf, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
