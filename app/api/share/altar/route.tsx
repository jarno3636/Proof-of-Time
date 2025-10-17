// app/api/share/altar/route.tsx
import type { NextRequest } from "next/server";
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const IMG_WIDTH = 1200;
const IMG_HEIGHT = 630;

// Helper: shorten address
function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Helper: absolute origin (works on vercel / dev)
function getOrigin(req: NextRequest) {
  const url = new URL(req.url);
  const hdrs = req.headers;
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || url.host;
  const proto = (hdrs.get("x-forwarded-proto") || url.protocol.replace(":", "")).split(",")[0].trim();
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return env || `${proto}://${host}`;
}

type ApiToken = {
  token_address: `0x${string}`;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
  balance?: number;
};

// Common headers so Warpcast & webviews can fetch & cache safely
const IMG_HEADERS = {
  "content-type": "image/png",
  // Adjust caching to taste. This lets Warpcast cache for 10m and browsers too.
  "cache-control": "public, max-age=600, s-maxage=600, stale-while-revalidate=86400",
  // Allow any referrer (Farcaster/third-party clients) to pull the PNG
  "access-control-allow-origin": "*",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const origin = getOrigin(req);

  const address = (searchParams.get("address") || "").toLowerCase();
  const symbolsParam = (searchParams.get("symbols") || "").trim();
  const selectedSet = new Set(
    symbolsParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );

  // Minimal blank slate if address invalid
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return new ImageResponse(
      (
        <div
          style={{
            width: IMG_WIDTH,
            height: IMG_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0b0e14",
            color: "#EDEEF2",
            fontSize: 44,
            fontWeight: 700,
            fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial",
          }}
        >
          Proof of Time
        </div>
      ),
      { width: IMG_WIDTH, height: IMG_HEIGHT, headers: IMG_HEADERS }
    );
  }

  // Fetch altar tokens (be resilient)
  let tokens: ApiToken[] = [];
  try {
    const r = await fetch(`${origin}/api/relic/${address}`, { cache: "no-store" });
    const j = (await r.json()) as { address: string; tokens: ApiToken[] };
    tokens = j?.tokens || [];
  } catch {
    // swallow; we’ll render a graceful “no data” image below
  }

  if (selectedSet.size) {
    tokens = tokens.filter((t) => selectedSet.has(t.symbol.toUpperCase()));
  }
  // Default to top 3 if nothing is selected
  if (!tokens.length) tokens = tokens.slice(0, 3);

  // Visual styles
  const bg = "#0b0e14";
  const gold = "#BBA46A";
  const ink = "#EDEEF2";
  const sub = "rgba(237,238,242,0.7)";
  const badgeBg = "rgba(255,255,255,0.06)";
  const stroke = "rgba(255,255,255,0.12)";

  return new ImageResponse(
    (
      <div
        style={{
          width: IMG_WIDTH,
          height: IMG_HEIGHT,
          display: "flex",
          padding: 48,
          background: bg,
          position: "relative",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial",
          color: ink,
        }}
      >
        {/* Subtle temple glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(80% 60% at 50% -20%, rgba(187,164,106,.18), transparent), radial-gradient(60% 40% at -10% 110%, rgba(255,255,255,.06), transparent)",
          }}
        />

        {/* Outer frame */}
        <div
          style={{
            position: "absolute",
            inset: 24,
            borderRadius: 28,
            border: `2px solid ${gold}`,
            boxShadow: `0 0 0 1px ${gold} inset, 0 20px 80px rgba(187,164,106,0.15) inset`,
          }}
        />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 26, width: "100%" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: -0.5 }}>Your Relic Altar</div>
              <div style={{ fontSize: 22, color: sub }}>Longest-held tokens on Base · {short(address)}</div>
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: bg,
                background: gold,
                padding: "10px 16px",
                borderRadius: 999,
              }}
            >
              Proof of Time
            </div>
          </div>

          {/* Relic cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 18,
              marginTop: 6,
            }}
          >
            {tokens.slice(0, 3).map((t, i) => {
              const badge = t.never_sold ? "✦ never sold" : `⏳ no-sell ${t.no_sell_streak_days}d`;
              const tier = t.tier || "Relic";
              return (
                <div
                  key={`${t.symbol}-${i}`}
                  style={{
                    position: "relative",
                    borderRadius: 22,
                    padding: 20,
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${stroke}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, rgba(255,255,255,0.06), transparent 40%)",
                      pointerEvents: "none",
                    }}
                  />
                  <div style={{ fontSize: 18, letterSpacing: 1.5, color: sub }}>{tier}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <div
                      style={{
                        fontSize: 48,
                        fontWeight: 900,
                        letterSpacing: -0.8,
                        color: ink,
                      }}
                    >
                      ${t.symbol}
                    </div>
                    <div
                      style={{
                        marginLeft: "auto",
                        fontSize: 20,
                        padding: "6px 10px",
                        background: badgeBg,
                        borderRadius: 999,
                        border: `1px solid ${stroke}`,
                      }}
                    >
                      {t.days}d held
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      color: sub,
                      marginTop: 2,
                    }}
                  >
                    {badge}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, alignItems: "center" }}>
            <div style={{ fontSize: 18, color: sub }}>Time &gt; hype. #ProofOfTime</div>
            <div style={{ fontSize: 18, color: sub }}>proofoftime.vercel.app</div>
          </div>
        </div>
      </div>
    ),
    { width: IMG_WIDTH, height: IMG_HEIGHT, headers: IMG_HEADERS }
  );
}
