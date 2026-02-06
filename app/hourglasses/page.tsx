"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import {
  POTHOURGLASS_ABI,
  POTHOURGLASS_ADDRESS,
} from "@/lib/pothourglass";
import POTHourglassMint from "@/components/POTHourglassMint";

export default function HourglassGallery() {
  const { address } = useAccount();
  const [showMine, setShowMine] = useState(false);

  const { data: supply } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "totalSupply",
  });

  const total = Number(supply ?? 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      {/* ---------- Mint Panel ---------- */}
      <div className="mb-10">
        <POTHourglassMint />
      </div>

      {/* ---------- Header ---------- */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Minted Hourglasses
          </h1>
          <p className="mt-1 text-zinc-400 text-sm">
            {total} / 1000 minted · Fully on-chain · Live from Base
          </p>
        </div>

        {address && (
          <button
            onClick={() => setShowMine((v) => !v)}
            className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-[#BBA46A]/60 hover:text-[#BBA46A] transition"
          >
            {showMine ? "Show all mints" : "Show my mints"}
          </button>
        )}
      </div>

      {/* ---------- Grid ---------- */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: total }).map((_, i) => (
          <HourglassCard
            key={i}
            tokenId={i + 1}
            filterMine={showMine}
          />
        ))}
      </div>
    </main>
  );
}

/* ────────────────────────────────────────────── */
/* Card */
/* ────────────────────────────────────────────── */

function HourglassCard({
  tokenId,
  filterMine,
}: {
  tokenId: number;
  filterMine: boolean;
}) {
  const { address } = useAccount();

  const { data: owner } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  });

  const owned =
    address &&
    owner &&
    owner.toLowerCase() === address.toLowerCase();

  if (filterMine && !owned) return null;

  const { data: uri } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
  });

  if (!uri) return null;

  let json: any;
  try {
    json = JSON.parse(
      atob(uri.replace("data:application/json;base64,", ""))
    );
  } catch {
    return null;
  }

  return (
    <div
      className={`
        group relative rounded-xl border
        ${owned ? "border-[#BBA46A]/60" : "border-zinc-800/70"}
        bg-zinc-900/40 p-3
        transition-all duration-300
        hover:scale-[1.03]
        hover:shadow-[0_0_40px_rgba(187,164,106,0.18)]
      `}
    >
      {/* Glow overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#BBA46A]/10 to-transparent" />
      </div>

      {/* Image */}
      <img
        src={json.image}
        alt={`Hourglass #${tokenId}`}
        className="relative z-10 rounded-lg bg-black"
      />

      {/* Meta */}
      <div className="relative z-10 mt-2 flex items-center justify-between">
        <div className="text-sm font-semibold">#{tokenId}</div>
        {owned && (
          <span className="text-[10px] rounded-full bg-[#BBA46A]/20 px-2 py-0.5 text-[#BBA46A] font-semibold">
            Owned
          </span>
        )}
      </div>

      <div className="relative z-10 text-xs text-zinc-400 mt-1">
        {json.attributes?.map((a: any) => a.value).join(" · ")}
      </div>
    </div>
  );
}
