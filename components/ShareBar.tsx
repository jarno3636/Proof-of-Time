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
  const env = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Quick HEAD check with timeout to see if an embed URL will resolve */
async function headOk(url: string, timeoutMs = 2000): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(url, { method: "HEAD", signal: ctl.signal });
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
    list.length === 1
      ? "⟡ Relic Revealed"
      : list.length <= 3
      ? "⟡ Relics Revealed"
      : "⟡ Proof of Time — Altar";

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

  /**
   * Build a stable page path (optionally filtered to current selection)
   * and the /api/snap URL that screenshots the live altar DOM.
   */
  const buildPaths = (useSelected: boolean) => {
    const basePage = `/relic/${address?.toLowerCase?.() ?? ""}`;
    const qs =
      useSelected && selectedSymbols.length
        ? `?selected=${encodeURIComponent(selectedSymbols.join(","))}`
        : "";
    const pagePath = `${basePage}${qs}`;

    const snap = `/api/snap?path=${encodeURIComponent(pagePath)}&selector=${encodeURIComponent(
      '[data-share="altar"]'
    )}&dpr=2&w=1200&wait=1200`;

    return { pagePath, snap };
  };

  /** Farcaster: include a link to the page and embed the snap image if available.
   *  If snap is unavailable, we fall back to sharing with just the page URL (no image). */
  const shareAllFC = useCallback(async () => {
    try {
      setMsg(null);
      const text = buildText(tokens, 320);
      const { pagePath, snap } = buildPaths(false);
      const origin = siteOrigin();

      const snapUrl = origin + snap;
      const canEmbed = await headOk(snapUrl);

      const ok = await shareOrCast({
        text,
        url: origin + pagePath,
        // if snap can’t be fetched, omit embeds entirely (fallback = clean link share)
        embeds: canEmbed ? [snapUrl] : [],
      });

      if (!ok) setMsg("Could not open Farcaster composer in-app. Try updating Warpcast.");
      if (!canEmbed) setMsg((m) => (m ? m : "Using link preview fallback (image generator busy)."));
    } catch {
      setMsg("Sharing failed. Please try again.");
    }
  }, [tokens, address, selectedSymbols]);

  const shareSelectedFC = useCallback(async () => {
    if (!selected.length) return;
    try {
      setMsg(null);
      const text = buildText(selected, 320);
      const { pagePath, snap } = buildPaths(true);
      const origin = siteOrigin();

      const snapUrl = origin + snap;
      const canEmbed = await headOk(snapUrl);

      const ok = await shareOrCast({
        text,
        url: origin + pagePath,
        embeds: canEmbed ? [snapUrl] : [],
      });

      if (!ok) setMsg("Could not open Farcaster composer in-app. Try updating Warpcast.");
      if (!canEmbed) setMsg((m) => (m ? m : "Using link preview fallback (image generator busy)."));
    } catch {
      setMsg("Sharing failed. Please try again.");
    }
  }, [selected, address, selectedSymbols]);

  /** X/Twitter: link to the live page (X handles the preview) */
  const openXShare = useCallback((text: string, url?: string) => {
    const base = "https://x.com/intent/tweet";
    const params = new URLSearchParams({ text });
    if (url) params.set("url", url);
    const href = `${base}?${params.toString()}`;
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }, []);

  const shareAllX = useCallback(() => {
    const { pagePath } = buildPaths(false);
    openXShare(buildText(tokens, 280), siteOrigin() + pagePath);
  }, [tokens, address, selectedSymbols, openXShare]);

  const shareSelectedX = useCallback(() => {
    if (!selected.length) return;
    const { pagePath } = buildPaths(true);
    openXShare(buildText(selected, 280), siteOrigin() + pagePath);
  }, [selected, address, selectedSymbols, openXShare]);

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

        <button onClick={shareAllX} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition">
          Share Altar (X)
        </button>
        <button
          onClick={shareSelectedX}
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
