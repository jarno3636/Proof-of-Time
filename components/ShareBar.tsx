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
  const [aiLine, setAiLine] = useState<string>("");

  // Pick which tokens to list in caption (up to 3 lines)
  const chosen = useMemo(() => {
    if (!tokens?.length) return [] as Token[];
    const bySym = new Map(tokens.map((t) => [t.symbol.toUpperCase(), t]));
    const wants = selectedSymbols.map((s) => (s || "").toUpperCase()).filter(Boolean);
    if (wants.length) {
      const seen = new Set<string>();
      return tokens.filter((t) => {
        const S = t.symbol.toUpperCase();
        if (!wants.includes(S) || seen.has(S)) return false;
        seen.add(S);
        return true;
      }).slice(0, 3);
    }
    return [...tokens].sort((a, b) => (b.days || 0) - (a.days || 0)).slice(0, 3);
  }, [tokens, selectedSymbols]);

  // Fetch the AI line once per selection set
  useEffect(() => {
    const controller = new AbortController();
    const syms = chosen.map((t) => t.symbol.toUpperCase());
    fetchAIline(syms, controller.signal).then(setAiLine);
    return () => controller.abort();
  }, [chosen]);

  const title = useMemo(
    () => (selectedSymbols.length ? "✨ Relics Revealed" : "✨ Relic Altar"),
    [selectedSymbols.length]
  );

  const lineFor = (t: Token) => {
    const badge = t.never_sold ? "never sold" : `no-sell ${Math.max(0, t.no_sell_streak_days || 0)}d`;
    return `⌛ $${t.symbol} — ${Math.max(0, t.days || 0)}d (${badge})`;
    // (Keep lines short; Warpcast & X have tight text + embed layout)
  };

  const caption = useMemo(() => {
    const quote = aiLine || localPick(chosen.map((t) => t.symbol).join("|"));
    const lines = [title, ...chosen.map(lineFor), `“${quote}”`, "Time > hype. #ProofOfTime"];
    const out = lines.join("\n");
    return out.length <= 320 ? out : out.slice(0, 319);
  }, [aiLine, chosen, title]);

  const buildTargets = useCallback(() => {
    const origin = siteOrigin();
    const addr = (address || "").toLowerCase();

    // Static image for embeds (always works)
    const imgUrl = `${origin}/share.png`;

    // Page deep-link preserves selection
    const page = new URL(`${origin}/relic/${addr}`);
    if (selectedSymbols.length) {
      page.searchParams.set("selected", selectedSymbols.join(","));
    }
    return { pageUrl: page.toString(), imgUrl };
  }, [address, selectedSymbols]);

  const shareFC = useCallback(async () => {
    setMsg(null);
    const { pageUrl, imgUrl } = buildTargets();
    const ok = await shareOrCast({
      text: caption,
      embeds: [imgUrl, pageUrl], // image first, then link-through
    });
    if (!ok) setMsg("Could not open Farcaster composer. Update Warpcast and try again.");
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

  if (!tokens?.length) return null;

  return (
    <div className={["space-y-2", className].filter(Boolean).join(" ")}>
      <div className="flex flex-wrap items-center gap-2">
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
