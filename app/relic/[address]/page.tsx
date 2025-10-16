"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import RelicAltar from "@/components/RelicAltar";
import ShareBar from "@/components/ShareBar";

type ApiToken = {
  token_address: `0x${string}`;
  symbol: string;
  days: number;
  no_sell_streak_days: number;
  never_sold: boolean;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Obsidian";
  balance?: number;
};

async function getRelics(address: string) {
  const r = await fetch(`/api/relic/${address}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`relic api failed: ${r.status} ${r.statusText}`);
  return (await r.json()) as { address: string; tokens: ApiToken[] };
}

export default function Page({ params }: { params: { address: string } }) {
  const { address: connected } = useAccount();
  const targetAddr = useMemo(() => params.address, [params.address]);

  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [selected, setSelected] = useState<string[]>([]); // symbols selected

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await getRelics(targetAddr);
      setTokens(j.tokens || []);
      setSelected((prev) =>
        prev.filter((sym) => (j.tokens || []).some((t) => t.symbol === sym))
      );
    } catch (e: any) {
      setError(e?.message || "Unknown relic fetch error");
    } finally {
      setLoading(false);
    }
  }, [targetAddr]);

  useEffect(() => {
    load();
  }, [load]);

  const onCompute = useCallback(async () => {
    setComputing(true);
    setError(null);
    try {
      const r = await fetch("/api/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddr }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Compute failed");
      await load();
    } catch (e: any) {
      setError(e?.message || "Compute error");
    } finally {
      setComputing(false);
    }
  }, [targetAddr, load]);

  const toggleSelect = useCallback((symbol: string) => {
    setSelected((cur) =>
      cur.includes(symbol) ? cur.filter((s) => s !== symbol) : [...cur, symbol]
    );
  }, []);

  const isOwnerView =
    connected &&
    typeof connected === "string" &&
    connected.toLowerCase() === targetAddr.toLowerCase();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-[#EDEEF2]">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Your Relic Altar</h1>
          <p className="opacity-70 mt-1">Longest-held tokens on Base.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-sm"
            disabled={loading || computing}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={onCompute}
            className="rounded-xl bg-[#BBA46A] hover:bg-[#d6c289] px-4 py-2 text-sm text-[#0b0e14]"
            disabled={computing}
            title={isOwnerView ? "Recalculate from chain & DB" : "Recalculate (anyone can trigger)"}
          >
            {computing ? "Verifying…" : "Verify your will to hold"}
          </button>
        </div>
      </header>

      {computing && (
        <div className="mt-4 rounded-xl border border-[#BBA46A]/30 bg-[#BBA46A]/10 px-4 py-3 text-sm text-[#EDEEF2] flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#BBA46A] animate-pulse" />
          Verifying your will to hold on…
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : tokens.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="opacity-80">
            No relics yet. Click <span className="font-semibold">“Verify your will to hold on”</span>{" "}
            to compute, then refresh.
          </p>
          <p className="opacity-60 text-sm mt-2">
            Note: LP positions and some programmatic movements can complicate “time held”.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <RelicAltar
              items={tokens.map((t) => ({
                token_address: t.token_address,
                symbol: t.symbol,
                days: t.days,
                no_sell_streak_days: t.no_sell_streak_days,
                never_sold: t.never_sold,
                tier: t.tier,
              }))}
              selectable
              selected={selected}
              onToggle={toggleSelect}
            />
          </div>

          {/* ShareBar now autoselects the correct OG card: altar vs single-relic */}
          <ShareBar address={targetAddr} tokens={tokens} selectedSymbols={selected} />

          <p className="opacity-60 text-xs mt-6">
            Heads up: LP activity and wrapping/unwrapping patterns may affect continuous hold time.
          </p>
        </>
      )}
    </main>
  );
}

function SkeletonCard() {
  return (
    <div className="relative rounded-2xl p-4 bg-[#0B0E14] ring-1 ring-white/10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0" />
      <div className="relative flex items-center gap-4">
        <div className="w-16 h-16 rounded-full ring-2 ring-white/10 bg-white/5 animate-pulse" />
        <div className="flex-1">
          <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
          <div className="h-5 w-32 bg-white/10 rounded mt-2 animate-pulse" />
          <div className="h-3 w-20 bg-white/10 rounded mt-2 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
