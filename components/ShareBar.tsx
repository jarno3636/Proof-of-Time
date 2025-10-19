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

const FARCASTER_MINIAPP_LINK =
  process.env.NEXT_PUBLIC_FC_MINIAPP_LINK ||
  "https://farcaster.xyz/miniapps/-_2261xu85R_/proof-of-time";

/* ---------- helpers ---------- */
const titleLine = (list: Token[]) =>
  list.length === 1
    ? "Relic Revealed"
    : list.length <= 3
    ? "Relics Revealed"
    : "Proof of Time — Altar";

const lineFor = (t: Token) => {
  const badge = t.never_sold ? "✦ never sold" : `⏳ no-sell ${t.no_sell_streak_days}d`;
  return `• $${t.symbol} — ${t.days}d (${badge})`;
};

const safeTrim = (s: string, cap = 320) =>
  s.length <= cap ? s : s.slice(0, cap - 1) + "…";

const buildText = (list: Token[], cap?: number) => {
  const lines = [titleLine(list), ...list.map(lineFor), "Time > hype. #ProofOfTime ⏳"];
  const out = lines.join("\n");
  return cap ? safeTrim(out, cap) : out;
};

// Keep image title ASCII-only to avoid OG engine font/glyph issues
const cleanTitle = (s: string) => s.replace(/[^\x20-\x7E]/g, "");

/* ---------- build .png OG URL for embeds ---------- */
function buildOgUrl(siteOrigin: string, list: Token[]): string {
  const top = list.slice(0, 4); // keep URL short
  const qp = new URLSearchParams();
  qp.set("title", cleanTitle(titleLine(top)));
  top.forEach((t, i) => {
    const n = i + 1;
    qp.set(`s${n}`, t.symbol);
    qp.set(`d${n}`, String(t.days));
    qp.set(`ns${n}`, t.never_sold ? "1" : String(t.no_sell_streak_days));
    if (t.tier) qp.set(`t${n}`, t.tier);
  });
  return `${siteOrigin.replace(/\/$/, "")}/api/og/relic.png?${qp.toString()}`;
}

export default function ShareBar({
  address: _unused,
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

  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  /* ---------- Farcaster ---------- */
  const shareAllFC = useCallback(async () => {
    setMsg(null);
    const text = buildText(tokens, 320);
    const url = site + "/";
    const imageURL = buildOgUrl(site, tokens);
    const ok = await shareOrCast({
      text,
      url,
      embeds: [imageURL, FARCASTER_MINIAPP_LINK],
    });
    if (!ok)
      setMsg("Could not open Farcaster composer in-app. Try updating Warpcast.");
  }, [tokens, site]);

  const shareSelectedFC = useCallback(async () => {
    if (!selected.length) return;
    setMsg(null);
    const text = buildText(selected, 320);
    const url = site + "/";
    const imageURL = buildOgUrl(site, selected);
    const ok = await shareOrCast({
      text,
      url,
      embeds: [imageURL, FARCASTER_MINIAPP_LINK],
    });
    if (!ok)
      setMsg("Could not open Farcaster composer in-app. Try updating Warpcast.");
  }, [selected, site]);

  /* ---------- X / Twitter ---------- */
  const openXShare = useCallback((text: string, url?: string) => {
    const base = "https://twitter.com/intent/tweet";
    const params = new URLSearchParams({ text });
    if (url) params.set("url", url);
    const href = `${base}?${params.toString()}`;
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }, []);

  const shareAllX = useCallback(
    () => openXShare(buildText(tokens, 280), site + "/"),
    [tokens, site, openXShare]
  );
  const shareSelectedX = useCallback(() => {
    if (!selected.length) return;
    openXShare(buildText(selected, 280), site + "/");
  }, [selected, site, openXShare]);

  return (
    <div className="mt-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Farcaster */}
        <button
          onClick={shareAllFC}
          className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition"
          title="Share all relics on Farcaster"
        >
          Share Altar (Farcaster)
        </button>
        <button
          onClick={shareSelectedFC}
          disabled={!selected.length}
          className="px-4 py-2 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed bg-white/10 hover:bg-white/20"
          title="Share selected relics on Farcaster"
        >
          Share Selected (Farcaster)
        </button>

        {/* X / Twitter */}
        <button
          onClick={shareAllX}
          className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition"
          title="Share all relics on X"
        >
          Share Altar (X)
        </button>
        <button
          onClick={shareSelectedX}
          disabled={!selected.length}
          className="px-4 py-2 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed bg-white/10 hover:bg-white/20"
          title="Share selected relics on X"
        >
          Share Selected (X)
        </button>
      </div>

      {msg && <div className="text-xs text-amber-300 mt-1">{msg}</div>}
    </div>
  );
}
