"use client";
import { motion } from "framer-motion";
import cn from "clsx";

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";

type Props = {
  symbol: string;
  tokenAddress: `0x${string}`;        // NEW: for trunc + sharing
  days: number;
  tier: Tier;
  noSell?: number;
  neverSold?: boolean;

  // selection (unchanged)
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (symbol: string) => void;

  // optional per-relic share actions (hook these into your ShareBar if you want)
  onShareFarcaster?: (symbol: string, tokenAddress: string) => void;
  onShareX?: (symbol: string, tokenAddress: string) => void;
};

/* ─── Visual system ───────────────────────────────────────────────────── */

const tierGlow: Record<Tier, string> = {
  Bronze: "from-amber-800/50 via-amber-500/20 to-yellow-600/20",
  Silver: "from-zinc-300/60 via-slate-200/25 to-zinc-400/20",
  Gold: "from-yellow-400/70 via-amber-300/30 to-amber-200/20",
  Platinum: "from-indigo-300/60 via-blue-200/30 to-sky-200/20",
  Obsidian: "from-slate-900/80 via-slate-800/50 to-slate-700/40",
};

// Outer disc rim color
const tierRim: Record<Tier, string> = {
  Bronze: "ring-amber-400/40",
  Silver: "ring-slate-200/50",
  Gold: "ring-amber-300/60",
  Platinum: "ring-indigo-200/60",
  Obsidian: "ring-slate-500/50",
};

// Relic “metal” gradients (SVG stops)
const metalStops: Record<Tier, { a: string; b: string; c: string }> = {
  Bronze:   { a: "#7a4b26", b: "#b07438", c: "#f0c27a" },
  Silver:   { a: "#8e9eab", b: "#cfd9df", c: "#ffffff" },
  Gold:     { a: "#b9931a", b: "#f6d365", c: "#fda085" },
  Platinum: { a: "#8a9ad1", b: "#c4d4ff", c: "#f0f5ff" },
  Obsidian: { a: "#0b0e14", b: "#2a2f3a", c: "#5a657a" },
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/* ─── Tiny SVG that feels “ancient / artifact” and spins ─────────────── */

function RelicDisc({ tier }: { tier: Tier }) {
  const s = metalStops[tier];
  return (
    <motion.div
      aria-hidden
      className={cn(
        "relative grid place-items-center rounded-full",
        "w-16 h-16 ring-2 shadow",
        tierRim[tier]
      )}
      animate={{ rotate: 360 }}
      transition={{ ease: "linear", duration: 36, repeat: Infinity }}
    >
      {/* subtle conic shimmer beneath the SVG */}
      <div
        className="absolute inset-0 rounded-full opacity-60"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.15), rgba(255,255,255,0) 30%, rgba(255,255,255,0.15) 60%, rgba(255,255,255,0))",
          filter: "blur(0.5px)",
        }}
      />
      <svg width="56" height="56" viewBox="0 0 56 56" className="relative">
        <defs>
          <radialGradient id="metal" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={s.c} />
            <stop offset="55%" stopColor={s.b} />
            <stop offset="100%" stopColor={s.a} />
          </radialGradient>
          <linearGradient id="glyph" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* outer coin */}
        <circle cx="28" cy="28" r="26" fill="url(#metal)" />
        {/* inner bevel */}
        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        {/* star/glyph */}
        <g transform="translate(28 28)">
          <polygon
            points="0,-12 3,-3 12,0 3,3 0,12 -3,3 -12,0 -3,-3"
            fill="url(#glyph)"
            opacity="0.9"
          />
        </g>
      </svg>
    </motion.div>
  );
}

/* ─── Component ───────────────────────────────────────────────────────── */

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
        "relative rounded-2xl p-4 bg-[#0B0E14] text-[#EDEEF2] ring-1 ring-white/10 shadow-inner overflow-hidden",
        selectable && "hover:ring-[#BBA46A]/50 transition",
        selected && "ring-2 ring-[#BBA46A]"
      )}
    >
      {/* tier glow */}
      <div
        className={cn(
          "absolute inset-0 blur-2xl opacity-60 bg-gradient-to-br pointer-events-none",
          tierGlow[tier]
        )}
      />

      <div className="relative flex items-center gap-4">
        {/* NEW: spinning relic disc */}
        <RelicDisc tier={tier} />

        {/* Token + stats (symbol moved here, not inside spinner) */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate">
              <div className="text-xs uppercase tracking-wider opacity-70">{tier} Relic</div>
              <div className="text-xl font-semibold leading-tight">{symbol.replace(/^(\$)?/, "$")}</div>
              <div className="mt-0.5 text-[11px] opacity-70 font-mono">
                {shortAddr(tokenAddress)}
              </div>
            </div>

            {/* Optional share controls (hidden if no handlers passed) */}
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
            <span className="text-2xl font-semibold">{days}</span> days held
          </div>

          <div className="mt-1 text-xs opacity-80">
            {neverSold ? (
              <span className="px-2 py-0.5 rounded-full bg-white/10">Never sold</span>
            ) : typeof noSell === "number" ? (
              <span className="px-2 py-0.5 rounded-full bg-white/10">No-sell {noSell}d</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Selection tick (unchanged) */}
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
              selected
                ? "bg-[#BBA46A] border-[#BBA46A] text-[#0b0e14]"
                : "border-white/30"
            )}
          >
            {selected ? "✓" : ""}
          </span>
        </button>
      )}
    </div>
  );
}
