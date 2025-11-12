// components/ShareBar.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { shareOrCast, isInFarcasterEnv } from "@/lib/share";

type Token = {
  token_address: `0x${string}`;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier?: "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
};

function siteOrigin() {
  const env = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || "").trim();
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://proofoftime.vercel.app";
}

export default function ShareBar({
  address,
  tokens,
  selectedSymbols = [],
}: {
  address: string;
  tokens: Token[];
  selectedSymbols?: string[];
}) {
  const [msg, setMsg] = useState<string | null>(null);

  const selected = useMemo(() => {
    if (!selectedSymbols.length) return [] as Token[];
    const wanted = new Set(selectedSymbols.map((s) => s.toUpperCase()));
    const seen = new Set<string>();
    return tokens.filter((t) => {
      const sym = t.symbol.toUpperCase();
      if (!wanted.has(sym)) return false;
      if (seen.has(sym)) return false;
      seen.add(sym);
      return true;
    });
  }, [tokens, selectedSymbols]);

  const titleLine = (list: Token[]) =>
    list.length === 1 ? "✨ Relic Revealed" : "✨ Relics Revealed";

  const lineFor = (t: Token) => {
    const badge = t.never_sold ? "never sold" : `no-sell ${t.no_sell_streak_days}d`;
    return `⌛ $${t.symbol} — ${t.days}d (${badge})`;
  };

  const safeTrim = (s: string, cap = 320) => (s.length <= cap ? s : s.slice(0, cap - 1) + "…");
  const buildText = (list: Token[], cap?: number) => {
    const lines = [titleLine(list), ...list.map(lineFor), "Time > hype. #ProofOfTime"];
    const out = lines.join("\n");
    return cap ? safeTrim(out, cap) : out;
  };

  const buildTargets = useCallback(
    (list: Token[]) => {
      const origin = siteOrigin();
      const addr = (address || "").toLowerCase();
      const pageUrl = `${origin}/relic/${addr}`; // main altar page
      const sel = list.map((t) => t.symbol.toUpperCase()).join(",");
      const imgUrl =
        `${origin}/api/share/relic/${addr}/image` +
        (sel ? `?selected=${encodeURIComponent(sel)}` : "") +
        `&v=${Date.now().toString().slice(-6)}`;
      return { pageUrl, imgUrl };
    },
    [address]
  );

  const shareFC = useCallback(
    async (list: Token[]) => {
      setMsg(null);
      const { pageUrl, imgUrl } = buildTargets(list);
      const text = buildText(list, 320);
      const ok = await shareOrCast({
        text,
        // Warpcast supports multiple embeds: first image, second page (for click-through)
        embeds: [imgUrl, pageUrl],
      });
      if (!ok) setMsg("Could not open Farcaster composer. Update Warpcast and try again.");
    },
    [buildTargets]
  );

  const shareX = useCallback(
    (list: Token[]) => {
      // X cards won’t render raw images via URL param, so share the page.
      const { pageUrl } = buildTargets(list);
      const text = buildText(list, 280);
      const u = new URL("https://x.com/intent/tweet");
      u.searchParams.set("text", text);
      u.searchParams.set("url", pageUrl);
      const href = u.toString();
      const w = window.open(href, "_top", "noopener,noreferrer");
      if (!w) window.location.href = href;
    },
    [buildTargets]
  );

  return (
    <div className="mt-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => shareFC(selected.length ? selected : tokens)} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition">
          Share on Farcaster
        </button>
        <button onClick={() => shareX(selected.length ? selected : tokens)} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition">
          Share on X
        </button>
      </div>
      {msg && <div className="text-xs text-amber-300 mt-1">{msg}</div>}
    </div>
  );
}
