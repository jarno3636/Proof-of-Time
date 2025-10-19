// components/ShareBar.tsx
"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { shareOrCast } from "@/lib/share";

/***** Types *****/
type Token = {
  token_address: `0x${string}`;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier?: "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
};

/***** Constants *****/
const FARCASTER_MINIAPP_LINK =
  process.env.NEXT_PUBLIC_FC_MINIAPP_LINK ||
  "https://farcaster.xyz/miniapps/-_2261xu85R_/proof-of-time";

const LIMITS = { fc: 320, x: 280 } as const;

/***** Helpers *****/
function tierHue(t?: Token["tier"]) {
  switch (t) {
    case "Bronze":
      return "from-amber-700/80 to-amber-500/40 border-amber-400/30";
    case "Silver":
      return "from-slate-500/80 to-slate-300/40 border-slate-300/30";
    case "Gold":
      return "from-yellow-600/80 to-yellow-400/40 border-yellow-300/30";
    case "Platinum":
      return "from-cyan-600/80 to-cyan-300/40 border-cyan-300/30";
    case "Obsidian":
      return "from-zinc-800/90 to-zinc-600/40 border-zinc-400/30";
    default:
      return "from-purple-700/70 to-fuchsia-500/30 border-white/10";
  }
}

const titleFor = (list: Token[]) =>
  list.length === 1
    ? "⟡ Relic Revealed"
    : list.length <= 3
    ? "⟡ Relics Revealed"
    : "⟡ Proof of Time — Altar";

const lineFor = (t: Token) => {
  const badge = t.never_sold ? "✦ never sold" : `⏳ no-sell ${t.no_sell_streak_days}d`;
  return `• $${t.symbol} — ${t.days}d (${badge})`;
};

const safeTrim = (s: string, cap: number) => (s.length <= cap ? s : s.slice(0, cap - 1) + "…");

function buildText(list: Token[], cap?: number) {
  const lines = [titleFor(list), ...list.map(lineFor), "Time > hype. #ProofOfTime ⏳"];
  const out = lines.join("\n");
  return cap ? safeTrim(out, cap) : out;
}

function useSiteOrigin() {
  const [site, set] = useState<string>(
    process.env.NEXT_PUBLIC_SITE_URL || (typeof window === "undefined" ? "" : window.location.origin)
  );
  useEffect(() => {
    if (typeof window !== "undefined") set(window.location.origin);
  }, []);
  return site.replace(/\/$/, "");
}

/***** UI atoms *****/
function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs leading-none flex items-center gap-1">
      <span className="opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function ProgressCount({ current, max }: { current: number; max: number }) {
  const pct = Math.min(100, Math.round((current / max) * 100));
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] mb-1 opacity-70">
        <span>Characters</span>
        <span>
          {current}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full ${pct > 95 ? "bg-red-400" : pct > 80 ? "bg-amber-300" : "bg-emerald-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TokenChip({ t }: { t: Token }) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2 bg-gradient-to-br ${tierHue(
        t.tier
      )} text-sm shadow-sm backdrop-blur-sm`}
      title={`${t.tier ?? "Unranked"}`}
    >
      <div className="flex items-center gap-2">
        <div className="text-base font-bold">${t.symbol}</div>
        <div className="text-xs opacity-80">{t.days}d</div>
        <div className="text-[10px] opacity-80">
          {t.never_sold ? "✦ never sold" : `⏳ ${t.no_sell_streak_days}d`}
        </div>
      </div>
    </div>
  );
}

/***** Main *****/
export default function ShareBarV2({
  address: _unused,
  tokens,
  selectedSymbols = [],
}: {
  address: string;
  tokens: Token[];
  selectedSymbols?: string[];
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<"all" | "selected">("all");
  const site = useSiteOrigin();

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

  const list = mode === "selected" && selected.length ? selected : tokens;
  const previewFC = buildText(list, LIMITS.fc);
  const previewX = buildText(list, LIMITS.x);

  // —— Share logic: unchanged ——
  const shareFC = useCallback(async () => {
    setMsg(null);
    const text = buildText(list, LIMITS.fc);
    const url = site + "/";
    const ok = await shareOrCast({ text, url, embeds: [FARCASTER_MINIAPP_LINK] });
    if (!ok)
      setMsg("Could not open Farcaster composer in-app. Try updating Warpcast.");
  }, [list, site]);

  const openXShare = useCallback((text: string, url?: string) => {
    const base = "https://twitter.com/intent/tweet";
    const params = new URLSearchParams({ text });
    if (url) params.set("url", url);
    const href = `${base}?${params.toString()}`;
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
  }, []);

  const shareX = useCallback(() => openXShare(previewX, site + "/"), [openXShare, previewX, site]);

  const copy = useCallback(async (s: string) => {
    try {
      await navigator.clipboard.writeText(s);
      setMsg("Copied preview to clipboard.");
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setMsg("Copy failed. Select and copy manually.");
    }
  }, []);

  return (
    <div className="mt-6 space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">Share your Proof of Time</span>
          <div className="hidden sm:flex items-center gap-2">
            <StatPill label="Relics" value={list.length} />
            <StatPill label="Mode" value={mode === "all" ? "All" : "Selected"} />
          </div>
        </div>
        <div className="inline-flex rounded-xl overflow-hidden border border-white/10">
          <button
            onClick={() => setMode("all")}
            className={`px-3 py-1.5 text-sm transition ${
              mode === "all" ? "bg-white/15" : "hover:bg-white/5"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setMode("selected")}
            className={`px-3 py-1.5 text-sm transition ${
              mode === "selected" ? "bg-white/15" : "hover:bg-white/5"
            }`}
            disabled={!selected.length}
          >
            Selected
          </button>
        </div>
      </div>

      {/* Token chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {(mode === "selected" && selected.length ? selected : tokens).slice(0, 12).map((t) => (
          <TokenChip key={t.token_address + t.symbol} t={t} />
        ))}
      </div>

      {/* Preview card */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-950/50 to-purple-900/20 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-white/10 grid place-content-center text-xl">⏳</div>
          <div className="grow">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="font-semibold">Farcaster preview</div>
              <button
                onClick={() => copy(previewFC)}
                className="text-xs px-2 py-1 rounded-md border border-white/10 hover:bg-white/10"
              >
                Copy text
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono bg-black/20 rounded-lg p-3 max-h-64 overflow-auto">
{previewFC}
            </pre>
            <div className="mt-3">
              <ProgressCount current={previewFC.length} max={LIMITS.fc} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={shareFC}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition"
            title="Share on Farcaster"
          >
            Share on Farcaster
          </button>
          <button
            onClick={shareX}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition"
            title="Share on X"
          >
            Share on X
          </button>
          <span className="text-xs opacity-70">Embed preserved • share logic unchanged</span>
        </div>

        {msg && <div className="text-xs text-amber-300 mt-2">{msg}</div>}
      </div>

      {/* Subtle footer note */}
      <div className="text-[11px] opacity-60">
        Tip: Switch to <span className="font-medium">Selected</span> to craft a tighter cast. We’ll automatically respect the character limits.
      </div>
    </div>
  );
}
