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

  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  // 🔑 Build a share image URL for 1–3 relics
  const buildEmbedUrl = (list: Token[]) => {
    const u = new URL("/api/relic-card", site);
    const pick = list.slice(0, 3); // keep it readable
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
    return u.toString();
  };

  const shareAllFC = useCallback(async () => {
    setMsg(null);
    const text = buildText(tokens, 320);
    const img = buildEmbedUrl(tokens);
    const ok = await shareOrCast({ text, embeds: [img] }); // 👈 embed the image URL
    if (!ok) setMsg("Could not open Farcaster composer in-app. Try updating Warpcast.");
  }, [tokens]);

  const shareSelectedFC = useCallback(async () => {
    if (!selected.length) return;
    setMsg(null);
    const text = buildText(selected, 320);
    const img = buildEmbedUrl(selected);
    const ok = await shareOrCast({ text, embeds: [img] }); // 👈 embed the image URL
    if (!ok) setMsg("Could not open Farcaster composer in-app. Try updating Warpcast.");
  }, [selected]);

  // X/Twitter (image comes from OG on /relic-card too, but adding URL helps CTR)
  const openXShare = useCallback((text: string, url?: string) => {
    const base = "https://x.com/intent/tweet";
    const params = new URLSearchParams({ text });
    if (url) params.set("url", url);
    const href = `${base}?${params.toString()}`;
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }, []);
  const shareAllX = useCallback(() => openXShare(buildText(tokens, 280), site + "/relic/" /* landing */), [tokens, site, openXShare]);
  const shareSelectedX = useCallback(() => {
    if (!selected.length) return;
    openXShare(buildText(selected, 280), site + "/relic/");
  }, [selected, site, openXShare]);

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
