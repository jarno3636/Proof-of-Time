"use client";

import { useCallback, useMemo } from "react";
import { buildFarcasterComposeUrl, composeCast } from "@/lib/miniapp";

type Token = {
  token_address: string;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
};

export default function ShareBar({
  address,
  tokens,
  selectedSymbols = [],
}: {
  address: string;
  tokens: Token[];
  selectedSymbols?: string[];
}) {
  const selected = useMemo(
    () =>
      (selectedSymbols.length
        ? tokens.filter((t) => selectedSymbols.includes(t.symbol))
        : []),
    [tokens, selectedSymbols]
  );

  const makeText = (list: Token[]) => {
    const parts = list.map((t) =>
      `$${t.symbol} ${t.days}d${
        t.never_sold ? " (never sold)" : ` (no-sell ${t.no_sell_streak_days}d)`
      }`
    );
    // short, punchy message
    return `Proof of Time: ${parts.join(" • ")}\nTime > hype. #ProofOfTime ⏳`;
  };

  const cardUrlAll = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/card/${address}`;
  const shareAll = useCallback(() => {
    const text = makeText(tokens);
    const url = buildFarcasterComposeUrl({ text, embeds: [cardUrlAll] });
    composeCast(url);
  }, [tokens, cardUrlAll]);

  const shareSelected = useCallback(() => {
    if (!selected.length) return;
    const text = makeText(selected);
    const url = buildFarcasterComposeUrl({ text, embeds: [cardUrlAll] });
    composeCast(url);
  }, [selected, cardUrlAll]);

  const shareOne = useCallback(
    (t: Token) => {
      const text = makeText([t]);
      const url = buildFarcasterComposeUrl({ text, embeds: [cardUrlAll] });
      composeCast(url);
    },
    [cardUrlAll]
  );

  return (
    <div className="mt-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={shareAll}
          className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition"
          title="Share all relics"
        >
          Share Altar
        </button>
        <button
          onClick={shareSelected}
          disabled={!selected.length}
          className="px-4 py-2 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed bg-white/10 hover:bg-white/20"
          title="Share selected relics"
        >
          Share Selected
        </button>
      </div>

      {/* Per-relic quick shares */}
      <div className="flex flex-wrap gap-2 text-xs opacity-80">
        {tokens.map((t) => (
          <button
            key={t.symbol}
            onClick={() => shareOne(t)}
            className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition"
            title={`Share $${t.symbol}`}
          >
            Share ${t.symbol}
          </button>
        ))}
      </div>
    </div>
  );
}
