// components/ShareBar.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
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

/** Quick HEAD probe so we only embed URLs that are actually alive. */
async function headOk(url: string, timeoutMs = 1800): Promise<boolean> {
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

/** Very light in-app detection (Warpcast webview / MiniApp SDK). */
function isInFarcasterEnv(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const w = window as any;
    const hasMini = !!w.farcaster || !!w.Farcaster?.mini || !!w.Farcaster?.mini?.sdk;
    const inIframe = window.self !== window.top;
    const ua = typeof navigator !== "undefined" && /Warpcast|Farcaster/i.test(navigator.userAgent || "");
    return hasMini || ua || inIframe;
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

  /** Build absolute /api/relic-og image URL for 1–3 items + the human altar page. */
  function buildShareTargets(list: Token[]) {
    const origin = siteOrigin();
    const altarUrl = `${origin}/relic/${(address || "").toLowerCase()}`;

    const u = new URL("/api/relic-og", origin);
    const pick = list.slice(0, 3);
    if (pick.length === 1) {
      const t = pick[0];
      u.searchParams.set("symbol", t.symbol);
      u.searchParams.set("days", String(t.days));
      u.searchParams.set("tier", (t.tier || "Bronze") as string);
      if (t.never_sold) u.searchParams.set("never_sold", "1");
      if (!t.never_sold) u.searchParams.set("no_sell_streak_days", String(t.no_sell_streak_days || 0));
      u.searchParams.set("token", t.token_address);
    } else {
      for (const t of pick) {
        u.searchParams.append("symbol[]", t.symbol);
        u.searchParams.append("days[]", String(t.days));
        u.searchParams.append("tier[]", (t.tier || "Bronze") as string);
        u.searchParams.append("token[]", t.token_address);
        u.searchParams.append("never_sold[]", t.never_sold ? "1" : "0");
        u.searchParams.append("no_sell_streak_days[]", String(t.no_sell_streak_days || 0));
      }
    }
    // tiny cache-buster so social scrapers refetch the latest
    u.searchParams.set("v", Date.now().toString().slice(-6));

    return { altarUrl, embedUrl: u.toString() };
  }

  /** Farcaster: prefer embed image; if not ready, include the page URL in text inside Warpcast. */
  const shareFC = useCallback(
    async (list: Token[]) => {
      setMsg(null);
      const { altarUrl, embedUrl } = buildShareTargets(list);
      const baseText = buildText(list, 320);

      const embedReady = await headOk(embedUrl, 1800);
      const inFC = isInFarcasterEnv();

      const text = inFC && !embedReady ? `${baseText}\n${altarUrl}` : baseText;

      const ok = await shareOrCast({
        text,
        url: inFC ? undefined : altarUrl, // Warpcast ignores url; keep it for web composer only
        embeds: embedReady ? [embedUrl] : [],
      });

      if (!ok) setMsg("Could not open Farcaster composer. Update Warpcast and try again.");
      else if (!embedReady) setMsg("Image still warming up — shared with page link instead.");
    },
    [address, tokens, selectedSymbols]
  );

  /** X/Twitter: share the page URL (OG tags can be added later if desired). */
  const shareX = useCallback(
    (list: Token[]) => {
      const { altarUrl } = buildShareTargets(list);
      const text = buildText(list, 280);
      const intent = new URL("https://x.com/intent/tweet");
      intent.searchParams.set("text", text);
      intent.searchParams.set("url", altarUrl);
      const href = intent.toString();

      // break out of in-app browsers that trap popups
      const w = window.open(href, "_top", "noopener,noreferrer");
      if (!w) window.location.href = href;
    },
    [address, tokens, selectedSymbols]
  );

  return (
    <div className="mt-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => shareFC(tokens)} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition">
          Share Altar (Farcaster)
        </button>
        <button
          onClick={() => selected.length && shareFC(selected)}
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
