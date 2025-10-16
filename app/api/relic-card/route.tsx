/* app/api/relic-card/route.tsx */
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge"; // Next.js Edge runtime

// Render size (pass at construction time)
const OG = { width: 1200, height: 630 } as const;

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";

type ApiToken = {
  token_address: string;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier: Tier;
};

const tiers: Record<Tier, { ring: string; glowA: string; glowB: string }> = {
  Bronze:   { ring: "#d6a25c", glowA: "#7a4b26", glowB: "#f0c27a" },
  Silver:   { ring: "#cfd6df", glowA: "#8e9eab", glowB: "#ffffff" },
  Gold:     { ring: "#f1d17a", glowA: "#b9931a", glowB: "#f6d365" },
  Platinum: { ring: "#c6d0ff", glowA: "#8a9ad1", glowB: "#f0f5ff" },
  Obsidian: { ring: "#667085", glowA: "#0b0e14", glowB: "#2a2f3a" },
};

function shortAddr(a: string) {
  if (!a || a.length < 10) return a || "";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function parseBool(v: string | null): boolean {
  if (!v) return false;
  return ["1", "true", "yes", "y"].includes(v.toLowerCase());
}

function parseTier(v: string | null): Tier {
  const t = (v || "").trim();
  if (t === "Bronze" || t === "Silver" || t === "Gold" || t === "Platinum" || t === "Obsidian") {
    return t;
  }
  return "Bronze";
}

async function getFromWallet(
  req: NextRequest,
  address: string,
  bySymbol?: string | null,
  byToken?: string | null
): Promise<ApiToken | null> {
  const hdrs = req.headers;
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const proto = (hdrs.get("x-forwarded-proto") || "https").split(",")[0].trim();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;

  const r = await fetch(`${origin}/api/relic/${address}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`relic api failed (${r.status})`);

  const j = (await r.json()) as { tokens: ApiToken[] };
  const list = Array.isArray(j?.tokens) ? j.tokens : [];
  if (!list.length) return null;

  // explicit token address wins
  if (byToken) {
    const lo = byToken.toLowerCase();
    const found = list.find((t) => t.token_address?.toLowerCase() === lo);
    if (found) return found;
  }
  // then symbol
  if (bySymbol) {
    const sym = bySymbol.toLowerCase();
    const found = list.find((t) => (t.symbol || "").toLowerCase() === sym);
    if (found) return found;
  }
  // fallback first
  return list[0] || null;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const qp = url.searchParams;

    // Option A: derive from an address’ altar
    const qAddress = qp.get("address") || undefined;
    const qSymbol  = qp.get("symbol") || undefined;
    const qToken   = qp.get("token")  || undefined;

    // Option B: direct explicit params
    const dSymbol = qp.get("symbol") || undefined;
    const dToken  = qp.get("token")  || undefined;
    const dDays   = Number(qp.get("days") || "");
    const dNoSell = Number(qp.get("noSell") || qp.get("nosell") || "");
    const dNever  = parseBool(qp.get("neverSold"));
    const dTier   = parseTier(qp.get("tier"));

    let relic: ApiToken | null = null;

    if (qAddress) {
      relic = await getFromWallet(req, qAddress, qSymbol, qToken);
    } else if (dSymbol && dToken && Number.isFinite(dDays)) {
      relic = {
        symbol: dSymbol.toUpperCase(),
        token_address: dToken,
        days: Math.max(0, Math.floor(dDays)),
        no_sell_streak_days: Number.isFinite(dNoSell) ? Math.max(0, Math.floor(dNoSell)) : 0,
        never_sold: !!dNever,
        tier: dTier,
      };
    }

    // Fallback placeholder
    if (!relic) {
      return new ImageResponse(
        (
          <div
            style={{
              width: OG.width,
              height: OG.height,
              display: "flex",
              background: "#0b0e14",
              color: "#EDEEF2",
              fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 40,
            }}
          >
            <div>
              <div style={{ fontSize: 72, fontWeight: 900, opacity: 0.9 }}>Proof of Time</div>
              <div style={{ fontSize: 28, opacity: 0.75, marginTop: 12 }}>
                Add <code>?address=0x…&symbol=USDC</code> or direct{" "}
                <code>?symbol=USDC&days=420&tier=Gold&token=0x…</code>
              </div>
            </div>
          </div>
        ),
        { width: OG.width, height: OG.height }
      );
    }

    const palette = tiers[relic.tier];
    const neverSoldBadge = relic.never_sold ? "Never sold" : "";
    const noSellBadge =
      !relic.never_sold && relic.no_sell_streak_days > 0
        ? `No-sell ${relic.no_sell_streak_days}d`
        : "";

    return new ImageResponse(
      (
        <div
          style={{
            width: OG.width,
            height: OG.height,
            display: "flex",
            background:
              "radial-gradient(1200px 630px at 50% 50%, rgba(255,255,255,0.06), rgba(11,14,20,1) 60%)",
            color: "#EDEEF2",
            fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
            position: "relative",
          }}
        >
          {/* background glow */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(600px 300px at 20% 30%, ${palette.glowB}, transparent 60%), radial-gradient(700px 350px at 80% 70%, ${palette.glowA}, transparent 65%)`,
              opacity: 0.35,
            }}
          />

          <div
            style={{
              display: "flex",
              width: "100%",
              height: "100%",
              padding: "64px 72px",
              boxSizing: "border-box",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 48,
            }}
          >
            {/* left: relic disc */}
            <div
              style={{
                width: 260,
                height: 260,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                boxShadow: `0 0 0 3px ${palette.ring} inset, 0 30px 80px rgba(0,0,0,0.45)`,
                background:
                  "conic-gradient(from 0deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 30%, rgba(255,255,255,0.14) 60%, rgba(255,255,255,0))",
              }}
            >
              <svg width="220" height="220" viewBox="0 0 56 56" aria-hidden>
                <defs>
                  <radialGradient id="metal" cx="50%" cy="50%" r="60%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="55%" stopColor={palette.glowB} />
                    <stop offset="100%" stopColor={palette.glowA} />
                  </radialGradient>
                  <linearGradient id="glyph" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.5" />
                  </linearGradient>
                </defs>
                <circle cx="28" cy="28" r="26" fill="url(#metal)" />
                <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                <g transform="translate(28 28)">
                  <polygon
                    points="0,-12 3,-3 12,0 3,3 0,12 -3,3 -12,0 -3,-3"
                    fill="url(#glyph)"
                    opacity="0.9"
                  />
                </g>
              </svg>
            </div>

            {/* right: text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 22, letterSpacing: 2, opacity: 0.7, textTransform: "uppercase" }}>
                  {relic.tier} Relic
                </div>
                <div
                  style={{
                    height: 1,
                    flex: 1,
                    background: "linear-gradient(90deg, rgba(255,255,255,0.25), transparent)",
                  }}
                />
              </div>

              <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 12 }}>
                <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1 }}>{relic.days}</div>
                <div style={{ fontSize: 36, opacity: 0.8, marginTop: 8 }}>days held</div>
              </div>

              <div style={{ marginTop: 18, fontSize: 42, fontWeight: 700 }}>
                ${relic.symbol}
              </div>
              <div style={{ marginTop: 6, fontSize: 22, opacity: 0.7, fontFamily: "monospace" }}>
                {shortAddr(relic.token_address)}
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
                {neverSoldBadge && (
                  <div
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.10)",
                      fontSize: 20,
                    }}
                  >
                    {neverSoldBadge}
                  </div>
                )}
                {noSellBadge && (
                  <div
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.10)",
                      fontSize: 20,
                    }}
                  >
                    {noSellBadge}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 32, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 26, opacity: 0.8 }}>⟡ Proof of Time</div>
                <div style={{ fontSize: 22, opacity: 0.6 }}>Time &gt; hype.</div>
              </div>
            </div>
          </div>
        </div>
      ),
      { width: OG.width, height: OG.height }
    );
  } catch (e: any) {
    return new Response(`OG error: ${e?.message || e}`, { status: 500 });
  }
}
