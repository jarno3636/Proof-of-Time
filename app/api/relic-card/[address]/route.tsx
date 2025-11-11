import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";
export const revalidate = 300;         // 5 min
export const dynamic = "force-dynamic";

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
type Token = {
  token_address: `0x${string}`;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier: Tier;
};

const W = 1200;
const H = 630;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const VALID_TIERS: Tier[] = ["Bronze", "Silver", "Gold", "Platinum", "Obsidian"];
const isTier = (t: any): t is Tier => VALID_TIERS.includes(t);

const tierColors: Record<Tier, { bg: string; rim: string; glow: string }> = {
  Bronze:   { bg: "#2b1c10", rim: "#C8AC6B", glow: "rgba(200,172,107,0.22)" },
  Silver:   { bg: "#1f242a", rim: "#D6DCE4", glow: "rgba(198,210,222,0.22)" },
  Gold:     { bg: "#2a210b", rim: "#F0D17A", glow: "rgba(240,209,122,0.22)" },
  Platinum: { bg: "#171c28", rim: "#C4D6FF", glow: "rgba(196,214,255,0.22)" },
  Obsidian: { bg: "#0b0e14", rim: "#6a758a", glow: "rgba(106,117,138,0.22)" },
};

function esc(s?: string) {
  return (s || "").replace(/[<>&]/g, (m) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;" }[m]!));
}

function Coin({ tier }: { tier: Tier }) {
  const c = tierColors[tier];
  return (
    <div style={{ position: "relative", width: 120, height: 120 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: c.glow }} />
      <div style={{ position: "absolute", inset: 8, borderRadius: 999, background: c.bg, border: `4px solid ${c.rim}` }} />
      <div style={{ position: "absolute", inset: 24, borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.25)" }} />
      <div style={{ position: "absolute", left: 50, top: 50, width: 20, height: 20, borderRadius: 4, background: "#fff", opacity: 0.95 }} />
    </div>
  );
}

function Row({ t }: { t: Token }) {
  const badge = t.never_sold ? "Never sold" : `No-sell ${Math.max(0, t.no_sell_streak_days || 0)}d`;
  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        width: W - 96,
        padding: 16,
        borderRadius: 20,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        alignItems: "center",
      }}
    >
      <Coin tier={t.tier} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ color: "#d8d6cf", fontSize: 18, letterSpacing: 2 }}>{esc(t.tier)} Relic</div>
        <div style={{ color: "#f6f1e6", fontSize: 44, fontWeight: 800, fontFamily: "serif" }}>
          ${esc(t.symbol)}
        </div>
        <div
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 12,
            background: t.never_sold ? "rgba(16,120,80,0.18)" : "rgba(60,140,210,0.18)",
            border: `1px solid ${t.never_sold ? "rgba(80,225,160,0.35)" : "rgba(120,190,255,0.35)"}`,
            color: t.never_sold ? "#b8f8d2" : "#d6ecff",
            fontSize: 14,
          }}
        >
          {badge}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: "#fff", fontSize: 70, fontWeight: 800, lineHeight: 0.9 }}>{Math.max(0, t.days || 0)}</div>
        <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 22, marginTop: 4 }}>days held</div>
      </div>
    </div>
  );
}

/** Normalize API token objects to the exact Token shape */
function normalizeToken(x: any): Token {
  const rawAddr = String(x?.token_address || ZERO_ADDR);
  const addr = (rawAddr.startsWith("0x") ? rawAddr : ZERO_ADDR) as `0x${string}`;
  const t = (x?.tier ?? "Bronze") as string;
  const tier: Tier = isTier(t) ? t : "Bronze";
  return {
    token_address: addr,
    symbol: String(x?.symbol || "RELIC"),
    days: Number(x?.days || 0) || 0,
    no_sell_streak_days: Number(x?.no_sell_streak_days || 0) || 0,
    never_sold: Boolean(x?.never_sold),
    tier,
  };
}

async function fetchRelicsAbs(origin: string, address: string): Promise<Token[]> {
  try {
    const r = await fetch(`${origin}/api/relic/${address}`, { cache: "no-store" });
    if (!r.ok) return [];
    const j = await r.json().catch(() => ({ tokens: [] as any[] }));
    const raw: any[] = Array.isArray(j?.tokens) ? j.tokens : [];
    return raw
      .map(normalizeToken)
      .sort((a, b) => (b.days || 0) - (a.days || 0))
      .slice(0, 3);
  } catch {
    return [];
  }
}

// Fast HEAD for “is it alive?”
export async function HEAD() {
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "public, max-age=60" },
  });
}

export async function GET(_req: NextRequest, ctx: { params: { address: string } }) {
  try {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_URL?.replace(/\/$/, "") ||
      "https://proofoftime.vercel.app";

    const addr = (ctx.params?.address || "").toLowerCase();
    const items = await fetchRelicsAbs(origin, addr);

    const rows: Token[] =
      items.length > 0
        ? items
        : [
            {
              token_address: ZERO_ADDR,
              symbol: "RELIC",
              days: 0,
              no_sell_streak_days: 0,
              never_sold: true,
              tier: "Bronze",
            },
          ];

    const body = (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg,#0b0e14,#141a22)",
          color: "#fff",
          padding: 0,
          position: "relative",
        }}
      >
        <div style={{ padding: "56px 48px 0 48px" }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#f2e9d0", fontFamily: "serif" }}>Proof of Time</div>
          <div style={{ marginTop: 6, color: "rgba(255,255,255,0.78)", fontSize: 16 }}>Relics forged by patience</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 48px 0 48px" }}>
          {rows.map((t, i) => (
            <Row key={i} t={t} />
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 56,
            background: "rgba(255,255,255,0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: 56,
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 18 }}>Time &gt; hype • #ProofOfTime</div>
        </div>
      </div>
    );

    return new ImageResponse(body, {
      width: W,
      height: H,
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch {
    // Never 500 for previewers
    const fallback = (
      <div
        style={{
          width: W,
          height: H,
          display: "grid",
          placeItems: "center",
          background: "#0b0e14",
          color: "#d8d6cf",
          fontSize: 42,
          fontWeight: 800,
        }}
      >
        Proof of Time
      </div>
    );
    return new ImageResponse(fallback, {
      width: W,
      height: H,
      headers: { "content-type": "image/png", "cache-control": "no-store" },
    });
  }
}
