"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import {
  POTHOURGLASS_ABI,
  POTHOURGLASS_ADDRESS,
} from "@/lib/pothourglass";

/* ---------- constants ---------- */

const SITE_URL = "https://proofoftime.vercel.app";
const SHARE_LINE =
  "Proof of Time Hourglass\nPatience made permanent\n\nPOT";

/* ---------- helpers ---------- */

function shareToFarcaster(imageUrl: string, tokenId: number) {
  const params = new URLSearchParams();
  params.set(
    "text",
    `${SHARE_LINE}\n\nHourglass #${tokenId}\n${SITE_URL}/hourglasses`
  );
  params.append("embeds[]", imageUrl);

  window.open(
    `https://warpcast.com/~/compose?${params.toString()}`,
    "_blank"
  );
}

function rarityBadge(body?: string) {
  switch (body) {
    case "Obsidian":
      return "bg-purple-500/20 text-purple-300 border-purple-400/40";
    case "Bronze":
      return "bg-amber-500/20 text-amber-300 border-amber-400/40";
    default:
      return "bg-zinc-700/30 text-zinc-300 border-zinc-600/40";
  }
}

/* ---------- page ---------- */

export default function HourglassesPage() {
  const { address } = useAccount();
  const [onlyMine, setOnlyMine] = useState(false);

  const { data: supply } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "totalSupply",
  });

  const total = Number(supply ?? 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Proof of Time Hourglasses
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-xl">
            Fully on-chain hourglasses forged by burning POT.
          </p>
        </div>

        {address && (
          <button
            onClick={() => setOnlyMine(v => !v)}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              onlyMine
                ? "bg-[#BBA46A] text-[#0b0e14]"
                : "border border-zinc-700/60 text-zinc-300 hover:border-[#BBA46A]/60",
            ].join(" ")}
          >
            {onlyMine ? "Showing Mine" : "Show My Hourglasses"}
          </button>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: total }).map((_, i) => (
          <HourglassCard
            key={i}
            tokenId={i + 1}
            onlyMine={onlyMine}
          />
        ))}
      </div>
    </main>
  );
}

/* ---------- card ---------- */

function HourglassCard({
  tokenId,
  onlyMine,
}: {
  tokenId: number;
  onlyMine: boolean;
}) {
  const { address } = useAccount();

  /* Only call ownerOf when filter is active */
  const { data: owner } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
    query: {
      enabled: !!address && onlyMine,
      retry: false,
    },
  });

  const isMine =
    onlyMine && address && owner
      ? owner.toLowerCase() === address.toLowerCase()
      : false;

  if (onlyMine && !isMine) return null;

  const { data: uri } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
  });

  const json = useMemo(() => {
    if (!uri) return null;
    try {
      return JSON.parse(
        atob(uri.replace("data:application/json;base64,", ""))
      );
    } catch {
      return null;
    }
  }, [uri]);

  if (!json?.image) return null;

  const bodyTrait = json.attributes?.find(
    (a: any) => a.trait_type === "Body"
  )?.value;

  return (
    <div
      className={[
        "group relative rounded-xl border bg-zinc-900/40 p-3 transition",
        isMine
          ? "border-[#BBA46A] shadow-[0_0_28px_rgba(187,164,106,0.35)]"
          : "border-zinc-800/70 hover:border-[#BBA46A]/60",
      ].join(" ")}
    >
      {/* Rarity badge */}
      {bodyTrait && (
        <div
          className={[
            "absolute top-2 left-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
            rarityBadge(bodyTrait),
          ].join(" ")}
        >
          {bodyTrait}
        </div>
      )}

      <img
        src={json.image}
        alt={`Hourglass #${tokenId}`}
        className="rounded-lg bg-black"
      />

      <div className="mt-2 flex items-center justify-between">
        <div className="text-sm font-semibold">
          #{tokenId}
          {isMine && (
            <span className="ml-1 text-xs text-[#BBA46A]">• owned</span>
          )}
        </div>

        <button
          onClick={() => shareToFarcaster(json.image, tokenId)}
          className="text-xs rounded-lg border border-zinc-700/60 px-2 py-1 text-zinc-300 hover:text-[#BBA46A] hover:border-[#BBA46A]/60 transition"
        >
          Share
        </button>
      </div>

      {Array.isArray(json.attributes) && (
        <div className="mt-1 text-[11px] text-zinc-500">
          {json.attributes.map((a: any) => a.value).join(" · ")}
        </div>
      )}
    </div>
  );
}
