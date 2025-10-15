"use client";
import RelicCard from "./RelicCard";

type Item = {
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier: "Bronze"|"Silver"|"Gold"|"Platinum"|"Obsidian";
};

export default function RelicAltar({ items }: { items: Item[] }) {
  return (
    <section className="mx-auto max-w-3xl grid gap-4 sm:grid-cols-3">
      {items.map((it) => (
        <RelicCard
          key={it.symbol}
          symbol={it.symbol}
          days={it.days}
          tier={it.tier}
          noSell={it.no_sell_streak_days}
          neverSold={it.never_sold}
        />
      ))}
    </section>
  );
}
