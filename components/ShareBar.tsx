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

/** HEAD probe so we only attach images that are actually live. */
async function headOk(url: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(url, { method: "HEAD", signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
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
    list.length === 1 ? "⟡ Relic Revealed" : list.length <= 3 ? "⟡ Relics Revealed" : "⟡ Proof of Time — Altar";

  const lineFor = (t: Token) => {
    const badge = t.never_sold ? "✦ never sold" : `⏳ no-sell ${t.no_sell_streak_days}d`;
    return `• $${t.symbol} — ${t.days}d (${badge})`;
  };

  const safeTrim = (s: string, cap = 320) => (s.length <= cap ? s : s.slice(0, cap - 1) + "…");
  const buildText = (list: Token[], cap?: number) => {
    const lines = [titleLine(list), ...list.map(lineFor), "Time > hype. #ProofOfTime ⏳"];
    const out = lines.join("\n");
    return cap ? safeTrim(out, cap) : out;
  };

  /** Short, stable targets: human page + PNG card (server renders top 1–3 tokens). */
  function buildTargets() {
    const origin = siteOrigin();
    const addr = (address || "").toLowerCase();
    const altarUrl = `${origin}/relic/${addr}`;
    const imgUrl = `${origin}/api/relic-card/${addr}`; // <- no long querystrings
    return { altarUrl, imgUrl };
  }

  /** Farcaster: prefer embed image; if not ready, include page URL in text when in-app. */
  const shareFC = useCallback(
    async (list: Token[]) => {
      setMsg(null);
      const { altarUrl, imgUrl } = buildTargets();
      const baseText = buildText(list, 320);

      const ready = await headOk(imgUrl, 1500);
      const inApp = isInFarcasterEnv();
      const text = inApp && !ready ? `${baseText}\n${altarUrl}` : baseText;

      const ok = await shareOrCast({
        text,
        // Warpcast SDK ignores standalone `url`; embeds carry the image.
        embeds: ready ? [imgUrl] : [],
      });

      if (!ok) setMsg("Could not open Farcaster composer. Update Warpcast and try again.");
      else if (!ready) setMsg("Image still warming up — shared with page link instead.");
    },
    [address, tokens, selectedSymbols]
  );

  /** X/Twitter: share the human-readable page URL. */
  const shareX = useCallback(
    (list: Token[]) => {
      const { altarUrl } = buildTargets();
      const text = buildText(list, 280);
      const u = new URL("https://x.com/intent/tweet");
      u.searchParams.set("text", text);
      u.searchParams.set("url", altarUrl);
      const href = u.toString();
      const w = window.open(href, "_top", "noopener,noreferrer"); // escape in-app browsers
      if (!w) window.location.href = href;
    },
    [address, tokens, selectedSymbols]
  );

  const shareAllFC = useCallback(() => shareFC(tokens), [tokens, shareFC]);
  const shareSelectedFC = useCallback(() => selected.length && shareFC(selected), [selected, shareFC]);

  return (
    <div className="mt-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={shareAllFC} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition">
          Share Altar (Farcaster)
        </button>
        <button
          onClick={shareSelectedFC}
          disabled={!selected.length}
          className="px-4 py-2 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed bg-white/10 hover:bg-white/20"
        >
          Share Selected (Farcaster)
        </button>

        <button onClick={() => shareX(tokens)} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition">
          Share Altar (X)
        </button>
        <button
          onClick={() => selected.length && shareX(selected)}
          disabled={!selected.length}
          className="px-4 py-2 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed bg-white/10 hover:bg-white/20"
        >
          Share Selected (X)
        </button>
      </div>

      {msg && <div className="text-xs text-amber-300 mt-1">{msg}</div>}
    </div>
  );
}
