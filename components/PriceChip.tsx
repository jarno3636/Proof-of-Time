// components/PriceChip.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  /** GeckoTerminal pool id, e.g., "base/0x...poolAddress" */
  poolId: string;
  className?: string;
};

type GTResp = {
  data?: {
    attributes?: {
      base_token_price_usd?: string;
      price_change_percentage_24h?: { base?: string };
    };
  };
};

export default function PriceChip({ poolId, className }: Props) {
  const [price, setPrice] = useState<number | null>(null);
  const [chg, setChg] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: any;

    const fetchOnce = async () => {
      try {
        const url = `https://api.geckoterminal.com/api/v2/networks/${poolId}`;
        // poolId might be "base/0xpool" OR "base/pools/0xpool"
        const normalized = url.includes("/pools/") ? url : `https://api.geckoterminal.com/api/v2/networks/${poolId.replace(/\/(0x)/, "/pools/$1")}`;
        const r = await fetch(normalized, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as GTResp;
        const p = Number(j?.data?.attributes?.base_token_price_usd ?? NaN);
        const c = Number(j?.data?.attributes?.price_change_percentage_24h?.base ?? NaN);
        if (!alive) return;
        setPrice(Number.isFinite(p) ? p : null);
        setChg(Number.isFinite(c) ? c : null);
      } catch {
        if (!alive) return;
        setPrice((prev) => prev ?? null);
        setChg((prev) => prev ?? null);
      }
    };

    const kickoff = async () => {
      await fetchOnce();
      timer = setInterval(fetchOnce, 60_000);
    };

    kickoff();
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [poolId]);

  const sign = chg == null ? "" : chg > 0 ? "+" : "";
  const chgFmt = useMemo(() => {
    if (chg == null) return "—";
    return `${sign}${chg.toFixed(2)}%`;
  }, [chg, sign]);

  const priceFmt = useMemo(() => {
    if (price == null) return "—";
    const digits = price < 0.01 ? 6 : price < 1 ? 4 : 2;
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
  }, [price]);

  const up = (chg ?? 0) > 0;
  const color = chg == null ? "text-zinc-400" : up ? "text-emerald-400" : "text-rose-400";
  const ring  = chg == null ? "ring-zinc-700/60" : up ? "ring-emerald-500/30" : "ring-rose-500/30";
  const bg    = chg == null ? "bg-zinc-900/40" : up ? "bg-emerald-500/10" : "bg-rose-500/10";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${bg} ${color} ring-1 ${ring} ${className ?? ""}`}
      title="GeckoTerminal (pool price & 24h change)"
    >
      <span className="hidden sm:inline text-zinc-400">PØT</span>
      <span>{priceFmt}</span>
      <span className="opacity-80">{chgFmt}</span>
    </span>
  );
}
