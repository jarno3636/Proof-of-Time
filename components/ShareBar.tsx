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
  className,
  address,
  tokens,
  selectedSymbols = [],
}: {
  className?: string;         // <— NEW (fixes TS error if you pass className)
  address: string;
  tokens: Token[];
  selectedSymbols?: string[];
}) {
  const [msg, setMsg] = useState<string | null>(null);

  /** Resolve exactly ONE token to share:
   *  1) first symbol in `selectedSymbols` (case-insensitive) if it exists in `tokens`
   *  2) otherwise the user's top token by `days`
   */
  const token = useMemo(() => {
    if (!tokens?.length) return null;
    const map = new Map(tokens.map((t) => [t.symbol.toUpperCase(), t]));
    for (const s of selectedSymbols) {
      const hit = map.get((s || "").toUpperCase());
      if (hit) return hit;
    }
    // default: top by days
    return [...tokens].sort((a, b) => (b.days || 0) - (a.days || 0))[0] || null;
  }, [tokens, selectedSymbols]);

  const titleLine = "✨ Relic Revealed";
  const lineFor = (t: Token) => {
    const badge = t.never_sold ? "never sold" : `no-sell ${Math.max(0, t.no_sell_streak_days || 0)}d`;
    return `⌛ $${t.symbol} — ${Math.max(0, t.days || 0)}d (${badge})`;
  };

  const caption = useMemo(() => {
    if (!token) return "✨ Relic Revealed\nProof of Time";
    return [titleLine, lineFor(token), "Time > hype. #ProofOfTime"].join("\n");
  }, [token]);

  const buildTargets = useCallback(() => {
    const origin = siteOrigin();
    const addr = (address || "").toLowerCase();
    const pageUrl = `${origin}/relic/${addr}`;
    const imgUrl =
      `${origin}/api/share/relic/${addr}/image` +
      (token ? `?selected=${encodeURIComponent(token.symbol.toUpperCase())}` : "") +
      `&v=${Date.now().toString().slice(-6)}`;
    return { pageUrl, imgUrl };
  }, [address, token]);

  const shareFC = useCallback(async () => {
    setMsg(null);
    const { pageUrl, imgUrl } = buildTargets();
    const ok = await shareOrCast({
      text: caption.slice(0, 320),
      // Warpcast: put image first, page second (click-through)
      embeds: [imgUrl, pageUrl],
    });
    if (!ok) {
      setMsg(
        isInFarcasterEnv()
          ? "Could not open composer."
          : "Could not open Farcaster composer. Update Warpcast and try again."
      );
    }
  }, [buildTargets, caption]);

  const shareX = useCallback(() => {
    const { pageUrl } = buildTargets();
    const u = new URL("https://x.com/intent/tweet");
    u.searchParams.set("text", caption.slice(0, 280));
    u.searchParams.set("url", pageUrl);
    const href = u.toString();
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }, [buildTargets, caption]);

  if (!token) return null;

  const { imgUrl } = buildTargets();

  return (
    <div className={["mt-6 space-y-2", className].filter(Boolean).join(" ")}>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={imgUrl}
          download={`relic-${address.slice(0, 6)}.png`}
          className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 transition"
        >
          Download image
        </a>

        <button
          onClick={shareFC}
          className="px-4 py-2 rounded-full bg-[#7C4DFF]/90 hover:bg-[#7C4DFF] text-white transition"
        >
          Share on Farcaster
        </button>

        <button
          onClick={shareX}
          className="px-4 py-2 rounded-full bg-[#1DA1F2]/90 hover:bg-[#1DA1F2] text-white transition"
        >
          Share on X
        </button>
      </div>

      {msg && <div className="text-xs text-amber-300">{msg}</div>}
    </div>
  );
}
