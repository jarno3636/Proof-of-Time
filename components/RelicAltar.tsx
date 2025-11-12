"use client";
import cn from "clsx";
import RelicCard from "./RelicCard";

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
  limitTo,          // UPPERCASED symbols that may be selected (e.g., Top-3)
  maxSelectable,    // e.g., 1 to force single-select
}: {
  items: Item[];
  selectable?: boolean;
  selected?: string[];     // case-sensitive symbols as displayed
  onToggle?: (symbol: string) => void;
  className?: string;
  limitTo?: string[];      // compare with item.symbol.toUpperCase()
  maxSelectable?: number;  // 1 ⇒ single-select
}) {
  const canPick = (sym: string) => !limitTo || limitTo.includes(sym.toUpperCase());

  const handleSelect = (sym: string) => {
    if (!selectable) return;
    if (!canPick(sym)) return;
    // parent enforces single-select; still call normally
    onToggle?.(sym);
  };

  return (
    <section
      data-share="altar"
      className={cn(
        "relative mx-auto max-w-5xl",
        "rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.06] to-transparent opacity-50" />
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

      <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const isAllowed = canPick(it.symbol);
          const isSelected = selected.includes(it.symbol);
          const disabled =
            selectable &&
            ((!isAllowed) || (maxSelectable === 1 && !isSelected && selected.length >= 1));

          return (
            <div
              key={`${it.symbol}-${it.token_address}`}
              className={cn(disabled && "opacity-40 pointer-events-none")}
            >
              <RelicCard
                tokenAddress={it.token_address}
                symbol={it.symbol}
                days={it.days}
                tier={it.tier}
                noSell={it.no_sell_streak_days}
                neverSold={it.never_sold}
                selectable={selectable}
                selected={isSelected}
                onSelect={handleSelect}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
