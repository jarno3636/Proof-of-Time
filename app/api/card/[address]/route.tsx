import { ImageResponse } from "next/og";

export const runtime = "edge"; // ✅ edge-safe

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";

type Token = {
  token_address: `0x${string}`;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier: Tier;
};

const SIZE = { width: 1200, height: 630 } as const;
const PALETTE = { bg: "#0B0E14", fg: "#EDEEF2", gold: "#C7A46B" };

// simple tier palettes for discs
const tierGrad: Record<Tier, { a: string; b: string; c: string; rim: string }> = {
  Bronze:   { a: "#7a4b26", b: "#b07438", c: "#f0c27a", rim: "#d6a25c" },
  Silver:   { a: "#8e9eab", b: "#cfd9df", c: "#ffffff", rim: "#cfd6df" },
  Gold:     { a: "#b9931a", b: "#f6d365", c: "#fda085", rim: "#f1d17a" },
  Platinum: { a: "#8a9ad1", b: "#c6d0ff", c: "#f0f5ff", rim: "#c6d0ff" },
  Obsidian: { a: "#0b0e14", b: "#2a2f3a", c: "#5a657a", rim: "#667085" },
};

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

async function fetchTokens(origin: string, address: string) {
  const res = await fetch(`${origin}/api/relic/${address}`, { cache: "no-store" });
  if (!res.ok) return [] as Token[];
  const j = await res.json().catch(() => ({ tokens: [] as Token[] }));
  const list: Token[] = Array.isArray(j?.tokens) ? j.tokens : [];
  // Sort by days desc and take top 3
  return list.sort((a, b) => (b?.days ?? 0) - (a?.days ?? 0)).slice(0, 3);
}

export async function GET(req: Request, { params }: { params: { address: string } }) {
  try {
    const { address } = params;

    // Resolve an origin that works in preview/prod/dev
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      new URL(req.url).origin;

    const items = await fetchTokens(origin, address);

    // Placeholder if nothing
    const rows =
      items.length === 0
        ? ([
            {
              symbol: "—",
              tier: "Bronze",
              days: 0,
              never_sold: false,
              no_sell_streak_days: 0,
              token_address: "0x0000000000000000000000000000000000000000",
            },
          ] as Token[])
        : items;

    return new ImageResponse(
      (
        <div
          style={{
            width: SIZE.width,
            height: SIZE.height,
            background:
              "radial-gradient(1400px 700px at 50% 50%, rgba(255,255,255,0.06), #0B0E14 60%)",
            color: PALETTE.fg,
            display: "flex",
            flexDirection: "column",
            padding: 48,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue"',
            position: "relative",
          }}
        >
          {/* header */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -0.5 }}>
              Proof of Time
            </div>
            <div style={{ opacity: 0.7, fontSize: 22 }}>Relics forged by time • Base</div>
          </div>

          {/* cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 18,
              marginTop: 28,
              width: "100%",
            }}
          >
            {rows.map((it, i) => {
              const g = tierGrad[it.tier as Tier] ?? tierGrad.Bronze;
              const badgeText = it.never_sold
                ? "Never sold"
                : it.no_sell_streak_days > 0
                ? `No-sell ${it.no_sell_streak_days}d`
                : "";

              return (
                <div
                  key={`${it.symbol}-${i}`}
                  style={{
                    borderRadius: 18,
                    padding: 24,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background:
                      "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    position: "relative",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px rgba(0,0,0,0.35)",
                  }}
                >
                  {/* disc */}
                  <div
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      boxShadow: `0 0 0 3px ${g.rim} inset`,
                      background:
                        "conic-gradient(from 0deg, rgba(255,255,255,0.15), rgba(255,255,255,0) 30%, rgba(255,255,255,0.15) 60%, rgba(255,255,255,0))",
                      marginBottom: 2,
                    }}
                  >
                    <svg width="64" height="64" viewBox="0 0 56 56">
                      <defs>
                        <radialGradient id={`metal-${i}`} cx="50%" cy="50%" r="60%">
                          <stop offset="0%" stopColor={g.c} />
                          <stop offset="55%" stopColor={g.b} />
                          <stop offset="100%" stopColor={g.a} />
                        </radialGradient>
                        <linearGradient id={`glyph-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.5" />
                        </linearGradient>
                      </defs>
                      <circle cx="28" cy="28" r="26" fill={`url(#metal-${i})`} />
                      <circle
                        cx="28"
                        cy="28"
                        r="22"
                        fill="none"
                        stroke="rgba(255,255,255,0.25)"
                        strokeWidth="1.5"
                      />
                      <g transform="translate(28 28)">
                        <polygon
                          points="0,-12 3,-3 12,0 3,3 0,12 -3,3 -12,0 -3,-3"
                          fill={`url(#glyph-${i})`}
                          opacity="0.9"
                        />
                      </g>
                    </svg>
                  </div>

                  <div style={{ fontSize: 16, letterSpacing: 2, opacity: 0.7, textTransform: "uppercase" }}>
                    {it.tier} Relic
                  </div>

                  <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>
                    {it.days}
                    <span style={{ fontSize: 22, opacity: 0.8 }}> days</span>
                  </div>

                  <div style={{ fontSize: 26, fontWeight: 700 }}>${it.symbol}</div>
                  <div style={{ fontSize: 18, opacity: 0.7, fontFamily: "monospace" }}>
                    {shortAddr(it.token_address)}
                  </div>

                  {badgeText ? (
                    <div
                      style={{
                        marginTop: 6,
                        display: "inline-flex",
                        padding: "8px 12px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.08)",
                        fontSize: 18,
                        color: PALETTE.gold,
                      }}
                    >
                      {badgeText}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* footer */}
          <div style={{ marginTop: "auto", opacity: 0.65, fontSize: 20 }}>
            Built for Base • Farcaster native
          </div>
        </div>
      ),
      { width: SIZE.width, height: SIZE.height }
    );
  } catch (e: any) {
    return new ImageResponse(
      <div
        style={{
          width: SIZE.width,
          height: SIZE.height,
          background: PALETTE.bg,
          color: PALETTE.fg,
          display: "grid",
          placeItems: "center",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 64, fontWeight: 900 }}>Proof of Time</div>
          <div style={{ marginTop: 8, opacity: 0.7 }}>Card render error</div>
        </div>
      </div>,
      { width: SIZE.width, height: SIZE.height }
    );
  }
}
