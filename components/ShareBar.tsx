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

/** Detect Farcaster/Warpcast environment (webview/mini) */
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

/** HEAD probe with timeout */
async function headOk(url: string, timeoutMs = 1800): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(url, { method: "HEAD", cache: "no-store", signal: ctl.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

/** Pre-warm the lambda: try HEAD, then a super-fast GET ?ping=1 */
async function prewarm(snapUrl: string) {
  try {
    // 1) HEAD on the exact URL (fast path in our /api/snap)
    const ok = await headOk(snapUrl, 1200);
    if (ok) return;

    // 2) GET ?ping=1 (your /api/snap should return 204 immediately)
    const u = new URL(snapUrl);
    u.searchParams.set("ping", "1");
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1200);
    await fetch(u.toString(), { method: "GET", cache: "no-store", signal: ctl.signal });
    clearTimeout(t);
  } catch {
    /* ignore */
  }
}

/** Copy helper for webviews */
async function tryCopy(s: string) {
  try {
    await navigator.clipboard.writeText(s);
    return true;
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
    list.length === 1 ? "⟡ Relic Revealed"
    : list.length <= 3 ? "⟡ Relics Revealed"
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

  /** Build the live page (optionally filtered) and the /api/snap URL */
  const buildPaths = (useSelected: boolean) => {
    const basePage = `/relic/${address?.toLowerCase?.() ?? ""}`;
    const qs =
      useSelected && selectedSymbols.length
        ? `?selected=${encodeURIComponent(selectedSymbols.join(","))}`
        : "";
    const pagePath = `${basePage}${qs}`;

    const snap = `/api/snap?path=${encodeURIComponent(pagePath)}&selector=${encodeURIComponent(
      '[data-share="altar"]'
    )}&dpr=2&w=1200&wait=1000`;

    return { pagePath, snap };
  };

  /** Core share to Farcaster with embed-if-ready + URL fallback */
  const shareToFarcaster = useCallback(
    async (list: Token[], useSelected: boolean) => {
      setMsg(null);
      const origin = siteOrigin();
      const { pagePath, snap } = buildPaths(useSelected);
      const pageUrl = origin + pagePath;
      const snapUrl = origin + snap;

      // Warm the lambda before the composer fetches it
      await prewarm(snapUrl);

      const baseText = buildText(list, 320);
      const inFC = isInFarcasterEnv();
      const canEmbed = await headOk(snapUrl);

      // If we’re inside Warpcast and the image isn’t ready, append the page URL to text.
      const text = inFC && !canEmbed ? `${baseText}\n${pageUrl}` : baseText;

      const ok = await shareOrCast({
        text,
        url: inFC ? undefined : pageUrl,     // web composer can keep a URL param
        embeds: canEmbed ? [snapUrl] : [],   // only embed if snap answers fast
      });

      if (!ok) {
        setMsg("Could not open Farcaster composer. Update Warpcast and try again.");
      } else if (!canEmbed) {
        setMsg("Image generator wasn’t ready — shared with page link instead.");
      }
    },
    [address, selectedSymbols, tokens]
  );

  const shareAllFC = useCallback(() => shareToFarcaster(tokens, false), [tokens, shareToFarcaster]);

  const shareSelectedFC = useCallback(() => {
    if (!selected.length) return;
    return shareToFarcaster(selected, true);
  }, [selected, shareToFarcaster]);

  /** X/Twitter: avoid navigation loop inside Warpcast */
  const openXShare = useCallback(async (text: string, url?: string) => {
    const base = "https://x.com/intent/tweet";
    const params = new URLSearchParams({ text });
    if (url) params.set("url", url);
    const href = `${base}?${params.toString()}`;

    // Try popup first
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (w) return;

    // If in Warpcast webview and popup blocked, don’t redirect this view
    if (isInFarcasterEnv()) {
      const copied = await tryCopy(href);
      setMsg(
        copied
          ? "X composer link copied. Paste it into Safari to tweet."
          : "Couldn’t open X here. Open in Safari and tweet from there."
      );
      return;
    }

    // Normal web fallback
    try {
      window.location.href = href;
    } catch {
      setMsg("Couldn’t open X composer.");
    }
  }, []);

  const shareAllX = useCallback(() => {
    const { pagePath } = buildPaths(false);
    openXShare(buildText(tokens, 280), siteOrigin() + pagePath);
  }, [tokens, openXShare]);

  const shareSelectedX = useCallback(() => {
    if (!selected.length) return;
    const { pagePath } = buildPaths(true);
    openXShare(buildText(selected, 280), siteOrigin() + pagePath);
  }, [selected, openXShare]);

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
