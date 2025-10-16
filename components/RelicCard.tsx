"use client";
import { motion } from "framer-motion";
import cn from "clsx";

type Props = {
  symbol: string;
  days: number;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
  noSell?: number;
  neverSold?: boolean;

  // selection UX
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (symbol: string) => void;
};

const tierRing: Record<Props["tier"], string> = {
  Bronze: "from-yellow-700/40 to-amber-500/20",
  Silver: "from-slate-200/40 to-slate-400/20",
  Gold: "from-yellow-400/60 to-amber-300/20",
  Platinum: "from-indigo-300/50 to-blue-200/20",
  Obsidian: "from-slate-900/80 to-slate-700/40",
};

export default function RelicCard({
  symbol,
  days,
  tier,
  noSell,
  neverSold,
  selectable,
  selected,
  onSelect,
}: Props) {
  return (
    <button
      type={selectable ? "button" : "button"}
      onClick={() => selectable && onSelect?.(symbol)}
      className={cn(
        "relative rounded-2xl p-4 bg-[#0B0E14] text-[#EDEEF2] ring-1 ring-white/10 shadow-inner overflow-hidden text-left",
        selectable && "hover:ring-[#BBA46A]/50 transition",
        selected && "ring-2 ring-[#BBA46A]"
      )}
      aria-pressed={!!selected}
    >
      <div
        className={cn(
          "absolute inset-0 blur-2xl opacity-60 bg-gradient-to-br pointer-events-none",
          tierRing[tier]
        )}
      />
      <div className="relative flex items-center gap-4">
        <motion.div
          className={cn(
            "w-16 h-16 rounded-full ring-2 ring-white/20 grid place-items-center shadow",
            selected ? "bg-[#BBA46A]/20 ring-[#BBA46A]/40" : "bg-transparent"
          )}
          animate={{ rotate: 360 }}
          transition={{ ease: "linear", duration: 40, repeat: Infinity }}
        >
          <span className="text-xl font-black">{symbol.replace(/^(\$)?/, "")}</span>
        </motion.div>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider opacity-70">{tier} Relic</div>
          <div className="text-2xl font-semibold leading-tight">{days} days</div>
          <div className="mt-1 text-xs opacity-80">
            {neverSold ? (
              <span className="px-2 py-0.5 rounded-full bg-white/10">Never sold</span>
            ) : typeof noSell === "number" ? (
              <span className="px-2 py-0.5 rounded-full bg-white/10">
                No-sell {noSell}d
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {selectable && (
        <div className="pointer-events-none absolute top-3 right-3">
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
        </div>
      )}
    </button>
  );
}
