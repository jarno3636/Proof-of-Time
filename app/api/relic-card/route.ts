// app/api/relic-card/route.ts
import { ImageResponse } from "next/server";

export const runtime = "edge";            // render on Edge (fast, no native deps)
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

function parseItems(u: URL): Item[] {
  const sp = u.searchParams;
  const sym = sp.getAll("symbol[]");
  const days = sp.getAll("days[]");
  const tier = sp.getAll("tier[]");
  const never = sp.getAll("never_sold[]");
  const nosell = sp.getAll("no_sell_streak_days[]");
  const token = sp.getAll("token[]");

  const list: Item[] = sym.length
    ? sym.map((_, i) => ({
        symbol: sym[i] || "RELIC",
        days: Number(days[i] ?? 0) || 0,
        tier: ((tier[i] as Tier) || "Bronze"),
        never_sold: /^(1|true|yes)$/i.test(never[i] || ""),
        no_sell_streak_days: Number(nosell[i] ?? 0) || 0,
        token: token[i] || "",
      }))
    : [{
        symbol: sp.get("symbol") || "RELIC",
        days: Number(sp.get("days") || 0) || 0,
        tier: (sp.get("tier") as Tier) || "Bronze",
        never_sold: /^(1|true|yes)$/i.test(sp.get("never_sold") || ""),
        no_sell_streak_days: Number(sp.get("no_sell_streak_days") || 0) || 0,
        token: sp.get("token") || "",
      }];

  return list.slice(0, 3);
}

// note: load fonts once per edge instance
let _fonts: Promise<{ cinzel: ArrayBuffer; inter: ArrayBuffer; interBold: ArrayBuffer }> | null = null;
function loadFonts() {
  if (_fonts) return _fonts;
  _fonts = (async () => {
    const [cinzel, inter, interBold] = await Promise.all([
      fetch(new URL("/public/fonts/Cinzel-SemiBold.ttf", import.meta.url)).then(r => r.arrayBuffer()),
      fetch(new URL("/public/fonts/Inter-Regular.ttf", import.meta.url)).then(r => r.arrayBuffer()),
      fetch(new URL("/public/fonts/Inter-SemiBold.ttf", import.meta.url)).then(r => r.arrayBuffer()),
    ]);
    return { cinzel, inter, interBold };
  })();
  return _fonts;
}

function Coin({ tier }: { tier: Tier }) {
  const c = tierColors[tier];
  return (
    <div
      style={{
        width: 120, height: 120, borderRadius: 999,
        background: `radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,0.08), transparent 60%)`,
        position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 0 4px ${c.rim} inset, 0 0 80px ${c.glow}`,
        backgroundColor: c.bg,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 8,
          borderRadius: 999,
          border: "2px solid rgba(255,255,255,0.25)",
        }}
      />
      <div
        style={{
          width: 24, height: 24, background: "#fff", borderRadius: 4, opacity: 0.9,
        }}
      />
    </div>
  );
}

function Badge({ kind, text }: { kind: "never" | "nosell"; text: string }) {
  const styles =
    kind === "never"
      ? { bg: "rgba(16,120,80,0.18)", br: "rgba(80,225,160,0.35)", color: "#b8f8d2" }
      : { bg: "rgba(60,140,210,0.18)", br: "rgba(120,190,255,0.35)", color: "#d6ecff" };

  return (
    <div
      style={{
        display: "inline-flex",
        padding: "6px 12px",
        borderRadius: 16,
        background: styles.bg,
        border: `1px solid ${styles.br}`,
        color: styles.color,
        fontFamily: "Inter",
        fontSize: 18,
      }}
    >
      {text}
    </div>
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const items = parseItems(url);
  const fonts = await loadFonts();

  // vertical positions for 1–3 rows
  const ys = [H / 2 - 190, H / 2, H / 2 + 190].slice(0, items.length);

  return new ImageResponse(
    (
      <div
        style={{
          width: W, height: H,
          display: "flex", flexDirection: "column",
          background: "linear-gradient(135deg, #0b0e14 0%, #141a22 100%)",
          color: "#EDEEF2",
          position: "relative",
          padding: 0,
        }}
      >
        {/* title */}
        <div style={{ position: "absolute", left: 64, top: 40 }}>
          <div style={{ fontFamily: "Cinzel", fontSize: 34, fontWeight: 600, color: "#f2e9d0" }}>
            Proof of Time
          </div>
          <div style={{ fontFamily: "Inter", fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
            Relics forged by patience
          </div>
        </div>

        {/* rows */}
        {items.map((it, i) => {
          const y = ys[i];
          const tierLabel = `${it.tier} Relic`;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 64, right: 64,
                top: y - 88, height: 176,
                borderRadius: 20,
                background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                border: "1px solid rgba(255,255,255,0.10)",
                display: "flex", alignItems: "center", gap: 28, padding: "24px 28px",
              }}
            >
              {/* coin + glow */}
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: -8,
                    background: tierColors[it.tier].glow,
                    filter: "blur(18px)",
                    borderRadius: 999,
                  }}
                />
                <Coin tier={it.tier} />
              </div>

              {/* copy */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <div style={{ fontFamily: "Inter", fontSize: 22, letterSpacing: 3, opacity: 0.8, color: "#d8d6cf" }}>
                  {tierLabel}
                </div>
                <div style={{ fontFamily: "Cinzel", fontSize: 46, fontWeight: 700, color: "#f6f1e6", lineHeight: 1 }}>
                  {it.symbol.startsWith("$") ? it.symbol : `$${it.symbol}`}
                </div>
                {!!it.token && (
                  <div style={{ fontFamily: "Inter", fontSize: 18, color: "rgba(255,255,255,0.6)" }}>
                    {short(it.token)}
                  </div>
                )}

                <div style={{ marginTop: 8 }}>
                  {it.never_sold ? (
                    <Badge kind="never" text="Never sold" />
                  ) : (
                    <Badge kind="nosell" text={`No-sell ${Math.max(0, it.no_sell_streak_days || 0)}d`} />
                  )}
                </div>
              </div>

              {/* right side days */}
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: "Inter",
                    fontWeight: 800,
                    fontSize: 64,
                    color: "#fff",
                    lineHeight: 1,
                  }}
                >
                  {Math.max(0, it.days || 0)}
                </div>
                <div style={{ fontFamily: "Inter", fontSize: 22, color: "rgba(255,255,255,0.72)" }}>days held</div>
              </div>
            </div>
          );
        })}

        {/* footer bar */}
        <div
          style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: 60,
            background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "flex-end",
            paddingRight: 64, fontFamily: "Inter", fontSize: 18, color: "rgba(255,255,255,0.7)",
          }}
        >
          Time &gt; hype • #ProofOfTime
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      // force PNG (Warpcast/X both fine with PNG)
      headers: { "content-type": "image/png" },
      fonts: [
        { name: "Cinzel", data: fonts.cinzel, weight: 600, style: "normal" },
        { name: "Inter", data: fonts.inter, weight: 400, style: "normal" },
        { name: "Inter", data: fonts.interBold, weight: 600, style: "normal" },
        { name: "Inter", data: fonts.interBold, weight: 800, style: "normal" },
      ],
    }
  );
}
