"use client";
import { motion } from "framer-motion";
import cn from "clsx";

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";

type Props = {
  symbol: string;
  tokenAddress: `0x${string}`;
  days: number;
  tier: Tier;
  noSell?: number;
  neverSold?: boolean;

  selectable?: boolean;
  selected?: boolean;
  onSelect?: (symbol: string) => void;

  onShareFarcaster?: (symbol: string, tokenAddress: string) => void;
  onShareX?: (symbol: string, tokenAddress: string) => void;
};

/* ── Visual system: each tier looks/feels different ─────────────────── */

const tierGlow: Record<Tier, string> = {
  Bronze: "from-amber-900/50 via-amber-700/30 to-amber-600/20",
  Silver: "from-zinc-400/60 via-slate-300/30 to-zinc-600/20",
  Gold: "from-yellow-500/70 via-amber-300/35 to-amber-200/20",
  Platinum: "from-indigo-300/60 via-blue-200/35 to-sky-200/20",
  Obsidian: "from-slate-900/80 via-slate-800/60 to-slate-700/40",
};

const tierRim: Record<Tier, string> = {
  Bronze: "ring-amber-400/50",
  Silver: "ring-slate-200/60",
  Gold: "ring-amber-300/70",
  Platinum: "ring-indigo-200/70",
  Obsidian: "ring-slate-500/60",
};

const metalStops: Record<Tier, { a: string; b: string; c: string }> = {
  Bronze:   { a: "#7a4b26", b: "#b07438", c: "#f0c27a" },
  Silver:   { a: "#8e9eab", b: "#cfd9df", c: "#ffffff" },
  Gold:     { a: "#b9931a", b: "#f6d365", c: "#fda085" },
  Platinum: { a: "#8a9ad1", b: "#c4d4ff", c: "#f0f5ff" },
  Obsidian: { a: "#0b0e14", b: "#2a2f3a", c: "#5a657a" },
};

/** Tier-specific inner glyphs so each coin is recognizable at a glance */
function TierGlyph({ tier }: { tier: Tier }) {
  switch (tier) {
    case "Bronze":
      return <polygon points="0,-12 12,0 0,12 -12,0" />; // diamond
    case "Silver":
      return <circle r="10" />; // circle
    case "Gold":
      return <polygon points="0,-12 4,-4 12,0 4,4 0,12 -4,4 -12,0 -4,-4" />; // 8-point
    case "Platinum":
      return <polygon points="0,-12 6,-6 12,0 6,6 0,12 -6,6 -12,0 -6,-6" />; // rounded star
    case "Obsidian":
      return <path d="M0,-12 L7,-3 L12,0 L7,3 L0,12 L-7,3 L-12,0 L-7,-3 Z" />; // rune-like
  }
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Spinning relic disc—now with per-tier glyph */
function RelicDisc({ tier }: { tier: Tier }) {
  const s = metalStops[tier];
  return (
    <motion.div
      aria-hidden
      className={cn("relative grid place-items-center rounded-full w-16 h-16 ring-2 shadow", tierRim[tier])}
      animate={{ rotate: 360 }}
      transition={{ ease: "linear", duration: 36, repeat: Infinity }}
    >
      <div
        className="absolute inset-0 rounded-full opacity-60"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.18), rgba(255,255,255,0) 30%, rgba(255,255,255,0.18) 60%, rgba(255,255,255,0))",
          filter: "blur(0.5px)",
        }}
      />
      <svg width="56" height="56" viewBox="0 0 56 56" className="relative">
        <defs>
          <radialGradient id={`metal-${tier}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={s.c} />
            <stop offset="55%" stopColor={s.b} />
            <stop offset="100%" stopColor={s.a} />
          </radialGradient>
          <linearGradient id={`glyph-${tier}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        <circle cx="28" cy="28" r="26" fill={`url(#metal-${tier})`} />
        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <g transform="translate(28 28)" fill={`url(#glyph-${tier})`} opacity="0.95">
          <TierGlyph tier={tier} />
        </g>
      </svg>
    </motion.div>
  );
}

/** Badge styles: stronger separation for “Never sold” vs “No-sell” */
function Badge({
  kind,
  children,
}: {
  kind: "never" | "nosell";
  children: React.ReactNode;
}) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium";
  if (kind === "never") {
    return (
      <span className={cn(base, "bg-emerald-500/12 text-emerald-200 ring-1 ring-emerald-400/30")}>
        {/* shield icon */}
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden className="-mt-[1px]">
          <path fill="currentColor" d="M12 2l8 4v6c0 5-3.4 7.7-8 10-4.6-2.3-8-5-8-10V6l8-4z" />
          <path fill="#0b0e14" d="M10.5 12.5l-2-2 1.4-1.4 0.6 0.6 3-3 1.4 1.4z" />
        </svg>
        {children}
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-sky-400/12 text-sky-200 ring-1 ring-sky-400/30")}>
      {/* hourglass icon */}
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden className="-mt-[1px]">
        <path fill="currentColor" d="M6 2h12v4a6 6 0 0 1-3 5.2V13a6 6 0 0 1 3 5.2V22H6v-3.8A6 6 0 0 1 9 13v-1.8A6 6 0 0 1 6 6.2V2z" />
      </svg>
      {children}
    </span>
  );
}

/* ── Component ───────────────────────────────────────────────────────── */

export default function RelicCard({
  symbol,
  tokenAddress,
  days,
  tier,
  noSell,
  neverSold,
  selectable,
  selected,
  onSelect,
  onShareFarcaster,
  onShareX,
}: Props) {
  return (
    <div
      className={cn(
        "relative rounded-2xl p-4 bg-[#0B0E14]/95 backdrop-blur text-[#EDEEF2] ring-1 ring-white/10 shadow-inner overflow-hidden",
        selectable && "hover:ring-[#BBA46A]/50 transition",
        selected && "ring-2 ring-[#BBA46A]"
      )}
    >
      {/* tier aura */}
      <div className={cn("absolute inset-0 blur-2xl opacity-60 bg-gradient-to-br pointer-events-none", tierGlow[tier])} />

      <div className="relative flex items-center gap-4">
        <RelicDisc tier={tier} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="truncate">
              <div className="text-[11px] tracking-[0.18em] uppercase opacity-70">{tier} Relic</div>
              <div className="text-2xl font-semibold leading-tight">{symbol.replace(/^(\$)?/, "$")}</div>
              <div className="mt-0.5 text-[11px] opacity-70 font-mono">{shortAddr(tokenAddress)}</div>
            </div>

            {(onShareFarcaster || onShareX) && (
              <div className="flex items-center gap-2">
                {onShareFarcaster && (
                  <button
                    type="button"
                    onClick={() => onShareFarcaster(symbol, tokenAddress)}
                    title="Share this relic on Farcaster"
                    className="rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1 text-xs"
                  >
                    Cast
                  </button>
                )}
                {onShareX && (
                  <button
                    type="button"
                    onClick={() => onShareX(symbol, tokenAddress)}
                    title="Share this relic on X"
                    className="rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1 text-xs"
                  >
                    Tweet
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-2 text-sm">
            <span className="text-3xl font-bold tracking-tight">{days}</span>
            <span className="ml-2 opacity-80">days held</span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {neverSold && <Badge kind="never">Never sold</Badge>}
            {!neverSold && typeof noSell === "number" && noSell >= 0 && (
              <Badge kind="nosell">No-sell {noSell}d</Badge>
            )}
          </div>
        </div>
      </div>

      {selectable && (
        <button
          type="button"
          onClick={() => onSelect?.(symbol)}
          className="absolute top-3 right-3"
          aria-pressed={!!selected}
          aria-label={selected ? "Unselect relic" : "Select relic"}
        >
          <span
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full border",
              selected ? "bg-[#BBA46A] border-[#BBA46A] text-[#0b0e14]" : "border-white/30"
            )}
          >
            {selected ? "✓" : ""}
          </span>
        </button>
      )}
    </div>
  );
}
