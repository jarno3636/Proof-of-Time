import Link from "next/link";

/** Shared types */
type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
type Token = {
  token_address: `0x${string}`;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier: Tier;
};

function absOrigin() {
  const env = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || "").trim();
  if (env) return env.replace(/\/$/, "");
  return "https://proofoftime.vercel.app";
}

async function fetchRelics(addr: string): Promise<Token[]> {
  try {
    const r = await fetch(`${absOrigin()}/api/relic/${addr}`, { cache: "no-store" });
    if (!r.ok) return [];
    const j = await r.json().catch(() => ({ tokens: [] as Token[] }));
    return (j?.tokens || []) as Token[];
  } catch {
    return [];
  }
}

/** Parse “selected” (preferred) or “pick” (legacy). */
function parseSelected(sp: URLSearchParams): string[] {
  const raw = (sp.get("selected") || sp.get("pick") || "").trim();
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 3);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { address: string };
  searchParams: { [k: string]: string | string[] | undefined };
}) {
  const origin = absOrigin();
  const address = (params.address || "").toLowerCase();
  const sp = new URLSearchParams(Object.entries(searchParams).flatMap(([k, v]) => (Array.isArray(v) ? v.map(x => [k, x]) : [[k, v ?? ""]])));

  const picks = parseSelected(sp);
  const all = await fetchRelics(address);

  const chosen =
    picks.length > 0
      ? all
          .filter((t) => picks.includes(t.symbol.toUpperCase()))
          .filter((t, i, arr) => arr.findIndex((x) => x.symbol === t.symbol) === i)
          .slice(0, 3)
      : all.sort((a, b) => (b.days || 0) - (a.days || 0)).slice(0, 3);

  // Canonical share URL (we keep the new param name “selected”)
  const shareUrl = `${origin}/share/${address}${picks.length ? `?selected=${encodeURIComponent(picks.join(","))}` : ""}`;

  return (
    <main className="min-h-[100svh] bg-[#0b0e14] text-white">
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-extrabold">Relics to Share</h1>
          <p className="text-white/70">
            Page URL (embeds a preview automatically):{" "}
            <a href={shareUrl} className="underline break-all">
              {shareUrl}
            </a>
          </p>
        </header>

        {/* Simple on-page preview of what the OG image conveys */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/70 mb-3">Preview</div>
          <div className="space-y-3">
            {(chosen.length ? chosen : [{
              token_address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
              symbol: "RELIC",
              days: 0,
              no_sell_streak_days: 0,
              never_sold: true,
              tier: "Bronze" as Tier,
            }]).map((t, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-white/60">{t.tier} Relic</div>
                  <div className="text-xl font-bold">${t.symbol}</div>
                  <div className="text-white/70 text-sm">
                    {t.never_sold ? "Never sold" : `No-sell ${Math.max(0, t.no_sell_streak_days || 0)}d`}
                  </div>
                </div>
                <div className="text-4xl font-extrabold">{Math.max(0, t.days || 0)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Share actions: open composer with this page URL (which has OG image) */}
        <section className="flex flex-wrap gap-3">
          <Link
            href={`https://warpcast.com/~/compose?embeds[]=${encodeURIComponent(shareUrl)}`}
            className="rounded-xl px-4 py-2 font-semibold bg-[#8a66ff] hover:bg-[#7b58ef] border border-white/20"
          >
            Share on Farcaster
          </Link>

          <Link
            href={`https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(
              "⟡ Relics Revealed\nTime > hype. #ProofOfTime ⏳"
            )}`}
            className="rounded-xl px-4 py-2 font-semibold bg-[#1d9bf0] hover:bg-[#168bd9] border border-white/20"
          >
            Share on X
          </Link>

          <Link
            href={`/relic/${address}`}
            className="rounded-xl px-4 py-2 font-semibold bg-white/10 hover:bg-white/20 border border-white/20"
          >
            Back to Altar
          </Link>
        </section>
      </div>
    </main>
  );
}
