"use client";
import { useCallback } from "react";
import { buildFarcasterComposeUrl, composeCast } from "@/lib/miniapp";

export default function ShareBar({ address, tokens }: { address: string; tokens: { symbol: string; days: number; no_sell_streak_days: number; never_sold: boolean }[] }) {
  const onShare = useCallback(() => {
    const parts = tokens.map(t =>
      `$${t.symbol} ${t.days}d${t.never_sold ? " (never sold)" : ` (no-sell ${t.no_sell_streak_days}d)`}`
    ).join(" • ");

    const text = `Proof of Time: ${parts}\nTime > hype. #ProofOfTime ⏳`;
    const cardUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/card/${address}`;

    const url = buildFarcasterComposeUrl({
      text,
      embeds: [cardUrl],
    });

    composeCast(url);
  }, [address, tokens]);

  return (
    <div className="mt-6 flex items-center gap-3">
      <button onClick={onShare} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition">
        Share Relic
      </button>
      <a href={`/leaderboard`} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition">
        Leaderboard
      </a>
    </div>
  );
}
