// app/api/share/relic/[address]/image/route.tsx
import { ImageResponse } from "next/og";
import { headers } from "next/headers";

/** Keep this on Node; we call our API and OpenAI */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
type Token = {
  token_address: `0x${string}`;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier: Tier;
};

function baseUrlFromHeaders(): string {
  try {
    const h = headers();
    const proto = h.get("x-forwarded-proto") || "https";
    const host  = h.get("x-forwarded-host") || h.get("host") || process.env.VERCEL_URL;
    if (host) return `${proto}://${host}`;
  } catch {}
  const env = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || "").trim();
  if (env) return env.replace(/\/$/, "");
  return "http://localhost:3000";
}

function parseSelected(search: URLSearchParams): string[] {
  const raw = (search.get("selected") || search.get("pick") || "").trim();
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 3);
}

/** -------- Quotes (fallbacks) ---------- */
const FALLBACK_QUOTES = [
  "Time rewards the stubborn heart.",
  "Patience is speed disguised as wisdom.",
  "Discipline turns minutes into monuments.",
  "Loyalty is the slow forge of trust.",
  "Happiness blooms where consistency lives.",
  "Will is the quiet engine of destiny.",
];

/** Try OpenAI for a 1-liner; fall back instantly on failure. */
async function getLineFromAI(symbols: string[]): Promise<string> {
  const key = process.env.OPENAI_API_KEY || "";
  if (!key) return pickQuote(symbols);
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 2200); // 2.2s guard

  try {
    const prompt = [
      "Write ONE short, profound line (≤120 chars) about time, patience, discipline, loyalty, happiness, or will.",
      "No hashtags. No emojis. Must stand alone as a caption.",
      symbols.length
        ? `Optional nod to: ${symbols.map((s) => "$" + s).join(", ")} (keep subtle, no symbols required).`
        : "",
    ].join(" ");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You craft brief, timeless aphorisms. Max 120 chars. No hashtags. No emojis." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 60,
      }),
    });
    clearTimeout(to);

    if (!r.ok) return pickQuote(symbols);
    const j = await r.json().catch(() => ({}));
    const txt =
      j?.choices?.[0]?.message?.content?.trim?.() ||
      j?.choices?.[0]?.message?.content ||
      "";
    if (!txt) return pickQuote(symbols);
    return txt.length <= 120 ? txt : txt.slice(0, 119) + "…";
  } catch {
    clearTimeout(to);
    return pickQuote(symbols);
  }
}

function pickQuote(symbols: string[]) {
  // simple deterministic-ish pick for stability per selection
  const seed = symbols.join("|").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_QUOTES[seed % FALLBACK_QUOTES.length];
}

/** Fetch relics from your existing API */
async function fetchRelics(address: string): Promise<Token[]> {
  const base = baseUrlFromHeaders();
  const u = `${base}/api/relic/${address}`;
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 3500);

  try {
    const r = await fetch(u, { cache: "no-store", signal: controller.signal });
    clearTimeout(to);
    if (!r.ok) return [];
    const j = await r.json().catch(() => ({ tokens: [] as Token[] }));
    return (j?.tokens || []) as Token[];
  } catch {
    clearTimeout(to);
    return [];
  }
}

export async function GET(req: Request, { params }: { params: { address: string } }) {
  const W = 1200, H = 630;

  try {
    const url = new URL(req.url);
    const selected = parseSelected(url.searchParams);
    const address = (params.address || "").toLowerCase();

    const all = await fetchRelics(address);
    const chosen =
      selected.length > 0
        ? all
            .filter((t) => selected.includes(t.symbol.toUpperCase()))
            .filter((t, i, arr) => arr.findIndex((x) => x.symbol === t.symbol) === i)
            .slice(0, 3)
        : [...all].sort((a, b) => (b.days || 0) - (a.days || 0)).slice(0, 3);

    const symbols = chosen.map((t) => t.symbol.toUpperCase());
    const line = await getLineFromAI(symbols);

    const Row = (t: Token) => {
      const badge = t.never_sold ? "Never sold" : `No-sell ${Math.max(0, t.no_sell_streak_days || 0)}d`;
      return (
        <div
          style={{
            display: "flex",
            gap: 22,
            width: W - 120,
            padding: 18,
            borderRadius: 22,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            alignItems: "center",
          }}
        >
          {/* coin medallion */}
          <div style={{ position: "relative", width: 120, height: 120 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "rgba(255,255,255,0.12)" }} />
            <div style={{ position: "absolute", inset: 10, borderRadius: 999, background: "#111922", border: "5px solid #C8AC6B" }} />
            <div style={{ position: "absolute", inset: 26, borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.25)" }} />
            <div style={{ position: "absolute", left: 50, top: 50, width: 20, height: 20, borderRadius: 4, background: "#fff", opacity: 0.95 }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ color: "#d8d6cf", fontSize: 18, letterSpacing: 2 }}>{t.tier} Relic</div>
            <div style={{ color: "#f6f1e6", fontSize: 48, fontWeight: 800, fontFamily: "serif", lineHeight: 1 }}>
              ${t.symbol}
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
              <span
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(120,190,255,0.35)",
                  background: t.never_sold ? "rgba(16,120,80,0.18)" : "rgba(60,140,210,0.18)",
                  color: t.never_sold ? "#b8f8d2" : "#d6ecff",
                  fontSize: 14,
                }}
              >
                {badge}
              </span>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#fff", fontSize: 80, fontWeight: 800, lineHeight: 0.9 }}>
              {Math.max(0, t.days || 0)}
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 22, marginTop: 6 }}>days held</div>
          </div>
        </div>
      );
    };

    const rows = (chosen.length ? chosen : [{
      token_address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      symbol: "RELIC",
      days: 0,
      no_sell_streak_days: 0,
      never_sold: true,
      tier: "Bronze" as const,
    }]).map((t, i) => <Row key={i as any} {...t} />);

    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            flexDirection: "column",
            background: "radial-gradient(1200px 600px at 0% 0%, #111826, #0b0e14)",
            color: "#fff",
            position: "relative",
          }}
        >
          {/* header */}
          <div style={{ padding: "40px 48px 0 48px" }}>
            <div style={{ fontSize: 44, fontWeight: 900, color: "#f2e9d0", fontFamily: "serif" }}>✦ Relics Revealed</div>
            <div style={{ marginTop: 6, color: "rgba(255,255,255,0.78)", fontSize: 18 }}>
              Proof of Time — {address.slice(0, 6)}…{address.slice(-4)}
            </div>
          </div>

          {/* rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "18px 48px 0 48px" }}>
            {rows}
          </div>

          {/* quote */}
          <div
            style={{
              marginTop: 18,
              marginLeft: 48,
              marginRight: 48,
              padding: "14px 18px",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.035)",
              fontSize: 24,
              color: "#EDEEF2",
            }}
          >
            “{line}”
          </div>

          {/* footer */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 54,
              background: "rgba(255,255,255,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 48px",
              fontSize: 18,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            <span>Time &gt; hype • #ProofOfTime</span>
            <span>Relics: {symbols.join(" · ") || "—"}</span>
          </div>
        </div>
      ),
      { width: W, height: H }
    );
  } catch {
    // never throw
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            background: "linear-gradient(135deg,#0b0e14,#141a22)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            fontWeight: 800,
          }}
        >
          Proof of Time
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}
