// app/api/relic-card/route.ts
import { NextResponse, NextRequest } from "next/server";
import sharp from "sharp";

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

const tierColors: Record<Tier, { bg: string; rim: string; glow: string }> = {
  Bronze:   { bg: "#2b1c10", rim: "#BBA46A", glow: "rgba(187,164,106,0.28)" },
  Silver:   { bg: "#1f242a", rim: "#d2d6dd", glow: "rgba(190,200,210,0.28)" },
  Gold:     { bg: "#2a210b", rim: "#f2d37a", glow: "rgba(242,211,122,0.28)" },
  Platinum: { bg: "#171c28", rim: "#bcd0ff", glow: "rgba(188,208,255,0.28)" },
  Obsidian: { bg: "#0b0e14", rim: "#5a657a", glow: "rgba(90,101,122,0.28)" },
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

  // Support array syntax: symbol[]=...&days[]=...
  const sym = sp.getAll("symbol[]");
  const days = sp.getAll("days[]");
  const tier = sp.getAll("tier[]");
  const never = sp.getAll("never_sold[]");
  const nosell = sp.getAll("no_sell_streak_days[]");
  const token = sp.getAll("token[]");

  const asArray = sym.length
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

  // Clamp to 3 to keep the image readable
  return asArray.slice(0, 3);
}

function relicRowSVG(it: Item, y: number) {
  const c = tierColors[it.tier];
  const yTop = y - 88; // row height ~176px
  const badge =
    it.never_sold
      ? `<g transform="translate(0,0)">
           <rect x="0" y="${yTop + 118}" rx="16" ry="16" width="150" height="32" fill="rgba(16,120,80,0.18)" stroke="rgba(80,225,160,0.35)"/>
           <text x="16" y="${yTop + 139}" font-family="Inter, system-ui, -apple-system, Segoe UI" font-size="16" fill="#b8f8d2">Never sold</text>
         </g>`
      : `<g transform="translate(0,0)">
           <rect x="0" y="${yTop + 118}" rx="16" ry="16" width="190" height="32" fill="rgba(60,140,210,0.18)" stroke="rgba(120,190,255,0.35)"/>
           <text x="16" y="${yTop + 139}" font-family="Inter, system-ui, -apple-system, Segoe UI" font-size="16" fill="#d6ecff">No-sell ${Math.max(0, it.no_sell_streak_days || 0)}d</text>
         </g>`;

  return `
    <g>
      <!-- aura -->
      <ellipse cx="170" cy="${y}" rx="64" ry="64" fill="${c.glow}" />
      <!-- coin -->
      <circle cx="170" cy="${y}" r="60" fill="${c.bg}" stroke="${c.rim}" stroke-width="4"/>
      <circle cx="170" cy="${y}" r="46" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
      <rect x="160" y="${y - 10}" width="20" height="20" fill="white" opacity="0.9" rx="3"/>

      <!-- copy -->
      <text x="260" y="${y - 28}" font-family="ui-serif, Georgia, 'Times New Roman', serif" font-size="22" fill="#d8d6cf" letter-spacing="3" opacity="0.8">${esc(it.tier)} Relic</text>
      <text x="260" y="${y + 8}" font-family="Cinzel, ui-serif, Georgia" font-size="46" fill="#f6f1e6" font-weight="700">$${esc(it.symbol)}</text>
      ${
        it.token
          ? `<text x="260" y="${y + 38}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" font-size="18" fill="rgba(255,255,255,0.6)">${esc(
              short(it.token)
            )}</text>`
          : ""
      }

      <text x="960" y="${y + 6}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI" font-size="64" fill="#fff" font-weight="800" text-anchor="end">${Math.max(
        0,
        it.days || 0
      )}</text>
      <text x="965" y="${y + 6}" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI" font-size="22" fill="rgba(255,255,255,0.72)">days held</text>

      ${badge}
    </g>
  `;
}

function buildSVG(items: Item[]) {
  // vertical positions for up to 3 rows
  const rowsY = [H / 2 - 190, H / 2, H / 2 + 190].slice(0, items.length);
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b0e14"/>
        <stop offset="100%" stop-color="#141a22"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <g>
      <text x="64" y="84" font-family="Cinzel, ui-serif, Georgia" font-size="34" fill="#f2e9d0" font-weight="700">Proof of Time</text>
      <text x="64" y="112" font-family="ui-sans-serif, system-ui" font-size="16" fill="rgba(255,255,255,0.7)">Relics forged by patience</text>
    </g>
    ${items.map((it, i) => relicRowSVG(it, rowsY[i])).join("\n")}
    <rect x="0" y="${H - 60}" width="${W}" height="60" fill="rgba(255,255,255,0.03)"/>
    <text x="${W - 64}" y="${H - 24}" text-anchor="end" font-family="ui-sans-serif, system-ui" font-size="18" fill="rgba(255,255,255,0.7)">Time > hype • #ProofOfTime</text>
  </svg>`;
}

export async function GET(req: NextRequest) {
  try {
    const items = parseItems(req);
    const svg = buildSVG(items);
    // convert to JPG (good for Warpcast/X)
    const buf = await sharp(Buffer.from(svg))
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    return new NextResponse(buf, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
