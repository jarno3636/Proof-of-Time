"use client";
import RelicCard from "./RelicCard";
import cn from "clsx";

export type Item = {
  token_address: `0x${string}`;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
};

export default function RelicAltar({
  items,
  selectable = false,
  selected = [],
  onToggle,
  className,
}: {
  items: Item[];
  selectable?: boolean;
  selected?: string[];                  // array of selected symbols
  onToggle?: (symbol: string) => void;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative mx-auto max-w-5xl",
        "rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        className
      )}
    >
      {/* subtle altar glow */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.06] to-transparent opacity-50" />

      {/* altar header strip */}
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#BBA46A]" />
          <h2 className="text-sm font-semibold tracking-widest text-zinc-200 uppercase">
            Relic Altar
          </h2>
        </div>
        <div className="text-xs text-zinc-400">
          {items.length ? `${items.length} Relic${items.length > 1 ? "s" : ""}` : "No Relics Yet"}
        </div>
      </div>

      {/* grid of relics */}
      <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <RelicCard
            key={`${it.symbol}-${it.token_address}`}
            tokenAddress={it.token_address}
            symbol={it.symbol}
            days={it.days}
            tier={it.tier}
            noSell={it.no_sell_streak_days}
            neverSold={it.never_sold}
            selectable={selectable}
            selected={selected.includes(it.symbol)}
            onSelect={onToggle}
          />
        ))}
      </div>
    </section>
  );
}
