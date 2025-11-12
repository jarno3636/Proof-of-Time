// components/ShareBar.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { shareOrCast } from "@/lib/share";

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

const LOCAL_QUOTES = [
  "Time rewards those who stay.",
  "Patience is a speed most miss.",
  "Discipline turns minutes into monuments.",
  "Loyalty is the slow forge of trust.",
  "Happiness grows where consistency lives.",
  "Will is the quiet engine of destiny.",
];

function localPick(seed: string) {
  const s = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return LOCAL_QUOTES[s % LOCAL_QUOTES.length];
}

async function fetchAIline(symbols: string[], signal?: AbortSignal): Promise<string> {
  try {
    const r = await fetch("/api/line", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols }),
    });
    const j = await r.json().catch(() => ({}));
    const line = (j?.line || "").toString().trim();
    return line || localPick(symbols.join("|"));
  } catch {
    return localPick(symbols.join("|"));
  }
}

export default function ShareBar({
  className,
  address,
  tokens,
  selectedSymbols = [],
}: {
  className?: string;
  address: string;
  tokens: Token[];
  selectedSymbols?: string[];
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [aiLine, setAiLine] = useState<string>("");      // AI line cache
  const [isFetching, setIsFetching] = useState(false);   // lock buttons while fetching once

  // Which tokens to mention in caption (up to 3, or selection if present)
  const chosen = useMemo(() => {
    if (!tokens?.length) return [] as Token[];
    const wants = selectedSymbols.map((s) => (s || "").toUpperCase()).filter(Boolean);
    if (wants.length) {
      const wanted = new Set(wants);
      const seen = new Set<string>();
      return tokens
        .filter((t) => {
          const S = t.symbol.toUpperCase();
          if (!wanted.has(S) || seen.has(S)) return false;
          seen.add(S);
          return true;
        })
        .slice(0, 3);
    }
    return [...tokens].sort((a, b) => (b.days || 0) - (a.days || 0)).slice(0, 3);
  }, [tokens, selectedSymbols]);

  // Preload the AI line for the current selection set
  useEffect(() => {
    const controller = new AbortController();
    const syms = chosen.map((t) => t.symbol.toUpperCase());
    setIsFetching(true);
    fetchAIline(syms, controller.signal)
      .then(setAiLine)
      .finally(() => setIsFetching(false));
    return () => controller.abort();
  }, [chosen]);

  const title = useMemo(
    () => (selectedSymbols.length ? "✨ Relics Revealed" : "✨ Relic Altar"),
    [selectedSymbols.length]
  );

  const lineFor = (t: Token) => {
    const badge = t.never_sold ? "never sold" : `no-sell ${Math.max(0, t.no_sell_streak_days || 0)}d`;
    return `⌛ $${t.symbol} — ${Math.max(0, t.days || 0)}d (${badge})`;
  };

  // Build caption from a provided line (so we can await fresh AI text right before share)
  const buildCaption = useCallback(
    (lineText: string) => {
      const quote = lineText || localPick(chosen.map((t) => t.symbol).join("|"));
      const lines = [title, ...chosen.map(lineFor), `“${quote}”`, "Time > hype. #ProofOfTime"];
      const out = lines.join("\n");
      return out.length <= 320 ? out : out.slice(0, 319);
    },
    [chosen, title]
  );

  const buildTargets = useCallback(() => {
    const origin = siteOrigin();
    const addr = (address || "").toLowerCase();

    // ✅ Use ONE static image for Warpcast embed
    const imgUrl = `${origin}/share.png`;

    // Keep a page deep-link for X (cards use OG meta), not embedded on Warpcast
    const page = new URL(`${origin}/relic/${addr}`);
    if (selectedSymbols.length) {
      page.searchParams.set("selected", selectedSymbols.join(","));
    }
    return { pageUrl: page.toString(), imgUrl };
  }, [address, selectedSymbols]);

  // Ensure we have an AI line before sharing; if cache empty, fetch once now.
  const ensureLine = useCallback(async (): Promise<string> => {
    if (aiLine) return aiLine;
    const syms = chosen.map((t) => t.symbol.toUpperCase());
    try {
      setIsFetching(true);
      const fresh = await fetchAIline(syms);
      setAiLine(fresh);
      return fresh;
    } finally {
      setIsFetching(false);
    }
  }, [aiLine, chosen]);

  const shareFC = useCallback(async () => {
    setMsg(null);
    // ⏳ wait for AI line (falls back internally if needed)
    const lineText = await ensureLine();
    const caption = buildCaption(lineText);
    const { imgUrl } = buildTargets();

    const ok = await shareOrCast({
      text: caption,
      // ✅ Only ONE embed (static share.png) for Warpcast
      embeds: [imgUrl],
    });
    if (!ok) setMsg("Could not open Farcaster composer. Update Warpcast and try again.");
  }, [ensureLine, buildCaption, buildTargets]);

  const shareX = useCallback(async () => {
    const lineText = await ensureLine();
    const caption = buildCaption(lineText);
    const { pageUrl } = buildTargets();

    const u = new URL("https://x.com/intent/tweet");
    u.searchParams.set("text", caption.slice(0, 280));
    u.searchParams.set("url", pageUrl);
    const href = u.toString();
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }, [ensureLine, buildCaption, buildTargets]);

  if (!tokens?.length) return null;

  return (
    <div className={["space-y-2", className].filter(Boolean).join(" ")}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={shareFC}
          disabled={isFetching}
          className={`px-4 py-2 rounded-full text-white transition ${
            isFetching
              ? "bg-white/10 cursor-wait"
              : "bg-[#7C4DFF]/90 hover:bg-[#7C4DFF]"
          }`}
          title={isFetching ? "Preparing your caption…" : "Share on Farcaster"}
        >
          {isFetching ? "Preparing…" : "Share on Farcaster"}
        </button>

        <button
          onClick={shareX}
          disabled={isFetching}
          className={`px-4 py-2 rounded-full text-white transition ${
            isFetching
              ? "bg-white/10 cursor-wait"
              : "bg-[#1DA1F2]/90 hover:bg-[#1DA1F2]"
          }`}
          title={isFetching ? "Preparing your caption…" : "Share on X"}
        >
          {isFetching ? "Preparing…" : "Share on X"}
        </button>
      </div>
      {msg && <div className="text-xs text-amber-300">{msg}</div>}
    </div>
  );
}
