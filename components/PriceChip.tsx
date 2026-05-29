// components/PriceChip.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type PriceChipProps = {
  poolId: string;
  variant?: "chip" | "hero";
};

type PoolData = {
  priceUsd: number | null;
  change24h: number | null;
  volume24h: number | null;
  liquidityUsd: number | null;
};

function parsePoolId(poolId: string) {
  const [network, poolAddress] = poolId.split("/");

  if (!network || !poolAddress) {
    return null;
  }

  return {
    network,
    poolAddress,
  };
}

function compactUsd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  if (value < 0.01) {
    return `$${value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "")}`;
  }

  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 1 ? 6 : 4,
  });
}

function compactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

export default function PriceChip({
  poolId,
  variant = "chip",
}: PriceChipProps) {
  const parsed = useMemo(() => parsePoolId(poolId), [poolId]);

  const [data, setData] = useState<PoolData>({
    priceUsd: null,
    change24h: null,
    volume24h: null,
    liquidityUsd: null,
  });

  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    if (!parsed) {
      setStatus("error");
      return;
    }

    const controller = new AbortController();

    async function loadPool() {
      try {
        setStatus("loading");

        const res = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/${parsed.network}/pools/${parsed.poolAddress}`,
          {
            signal: controller.signal,
            headers: {
              accept: "application/json",
            },
            next: {
              revalidate: 30,
            } as RequestInit["next"],
          } as RequestInit
        );

        if (!res.ok) {
          throw new Error(`GeckoTerminal request failed: ${res.status}`);
        }

        const json = await res.json();
        const attrs = json?.data?.attributes;

        const priceUsd = Number(attrs?.base_token_price_usd);
        const change24h = Number(attrs?.price_change_percentage?.h24);
        const volume24h = Number(attrs?.volume_usd?.h24);
        const liquidityUsd = Number(attrs?.reserve_in_usd);

        setData({
          priceUsd: Number.isFinite(priceUsd) ? priceUsd : null,
          change24h: Number.isFinite(change24h) ? change24h : null,
          volume24h: Number.isFinite(volume24h) ? volume24h : null,
          liquidityUsd: Number.isFinite(liquidityUsd) ? liquidityUsd : null,
        });

        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setStatus("error");
      }
    }

    loadPool();

    const interval = window.setInterval(loadPool, 30_000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [parsed]);

  const isUp = (data.change24h ?? 0) >= 0;

  const geckoUrl = parsed
    ? `https://www.geckoterminal.com/${parsed.network}/pools/${parsed.poolAddress}`
    : "https://www.geckoterminal.com/";

  if (variant === "hero") {
    return (
      <a
        href={geckoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group block rounded-3xl border border-[#BBA46A]/30 bg-gradient-to-br from-[#BBA46A]/15 via-zinc-900/70 to-zinc-950/90 p-5 shadow-2xl shadow-black/30 transition hover:border-[#BBA46A]/60"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Live PØT Price
            </div>

            <div className="mt-2 text-3xl font-black tracking-tight text-[#d6c289]">
              {status === "loading" ? "Loading…" : compactUsd(data.priceUsd)}
            </div>
          </div>

          <div
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              status === "error"
                ? "bg-zinc-800 text-zinc-500"
                : isUp
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {status === "error"
              ? "Offline"
              : data.change24h === null
              ? "—"
              : `${isUp ? "+" : ""}${data.change24h.toFixed(2)}% 24h`}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-800/70 bg-black/20 p-3">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">
              Volume 24h
            </div>
            <div className="mt-1 text-sm font-bold text-zinc-200">
              ${compactNumber(data.volume24h)}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800/70 bg-black/20 p-3">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">
              Liquidity
            </div>
            <div className="mt-1 text-sm font-bold text-zinc-200">
              ${compactNumber(data.liquidityUsd)}
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs font-semibold text-zinc-500 transition group-hover:text-[#BBA46A]">
          View pool on GeckoTerminal ↗
        </div>
      </a>
    );
  }

  return (
    <a
      href={geckoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-[#BBA46A]/30 bg-[#BBA46A]/10 px-3 py-1.5 text-xs font-bold text-[#d6c289] transition hover:border-[#BBA46A]/60"
    >
      <span className="h-2 w-2 rounded-full bg-[#BBA46A]" />
      <span>
        {status === "loading" ? "Loading price…" : `PØT ${compactUsd(data.priceUsd)}`}
      </span>
    </a>
  );
}
