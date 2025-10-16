"use client";
import cn from "clsx";

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";

const TIERS: { tier: Tier; title: string; blurb: string }[] = [
  { tier: "Bronze",   title: "Bronze Relic",   blurb: "Awarded for sustained holding. Your continuous hold time determines tier." },
  { tier: "Silver",   title: "Silver Relic",   blurb: "A longer uninterrupted hold elevates your relic." },
  { tier: "Gold",     title: "Gold Relic",     blurb: "Significant time on chain. Consistency over hype." },
  { tier: "Platinum", title: "Platinum Relic", blurb: "Elite consistency. Your conviction shows." },
  { tier: "Obsidian", title: "Obsidian Relic", blurb: "Mythic patience. A relic forged over ages." },
];

const AURAS: Record<Tier, string> = {
  Bronze: "from-amber-700/30 via-amber-500/15 to-yellow-600/10",
  Silver: "from-zinc-300/40 via-slate-300/20 to-zinc-600/10",
  Gold: "from-yellow-500/40 via-amber-300/20 to-amber-200/10",
  Platinum: "from-indigo-300/40 via-blue-200/20 to-sky-200/10",
  Obsidian: "from-slate-900/60 via-slate-800/40 to-slate-700/20",
};

export default function RelicLegend() {
  return (
    <section className="mt-8">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-widest text-zinc-200 uppercase">Relics & Badges</h2>
        <p className="text-xs text-zinc-400">How tiers and streak badges are earned</p>
      </header>

      <div className="relative overflow-x-auto [-webkit-overflow-scrolling:touch] snap-x snap-mandatory">
        <div className="grid grid-flow-col auto-cols-[minmax(260px,320px)] gap-4 pr-4">
          {TIERS.map(({ tier, title, blurb }) => (
            <article
              key={tier}
              className={cn(
                "snap-start relative rounded-2xl border border-white/10 bg-white/[0.03] p-5",
                "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
              )}
            >
              <div className={cn("pointer-events-none absolute inset-0 rounded-2xl blur-2xl opacity-60 bg-gradient-to-br", AURAS[tier])} />
              <div className="relative">
                <div className="text-[11px] tracking-[0.18em] uppercase opacity-70">{tier}</div>
                <h3 className="text-xl font-semibold mt-1">{title}</h3>
                <p className="text-sm text-zinc-400 mt-2">{blurb}</p>

                <div className="mt-4 space-y-2 text-[12px]">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/30 px-3 py-1 text-emerald-200">
                    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
                      <path fill="currentColor" d="M12 2l8 4v6c0 5-3.4 7.7-8 10-4.6-2.3-8-5-8-10V6l8-4z" />
                      <path fill="#0b0e14" d="M10.5 12.5l-2-2 1.4-1.4 0.6 0.6 3-3 1.4 1.4z" />
                    </svg>
                    Never Sold — since first acquire
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full bg-sky-400/10 ring-1 ring-sky-400/30 px-3 py-1 text-sky-200">
                    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
                      <path fill="currentColor" d="M6 2h12v4a6 6 0 0 1-3 5.2V13a6 6 0 0 1 3 5.2V22H6v-3.8A6 6 0 0 1 9 13v-1.8A6 6 0 0 1 6 6.2V2z" />
                    </svg>
                    No-sell Streak — days since last sell
                  </div>

                  <p className="text-xs text-zinc-400 mt-2">
                    Tier is based on your <span className="font-medium text-zinc-300">continuous hold time</span> for a token.
                    Streak badges show either a current no-sell stretch or that you’ve never sold.
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
