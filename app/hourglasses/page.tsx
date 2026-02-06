"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { POTHOURGLASS_ABI, POTHOURGLASS_ADDRESS } from "@/lib/pothourglass";

/* ---------- constants ---------- */

const SITE_URL = "https://proofoftime.vercel.app";
const SHARE_LINE =
  "Proof of Time Hourglass\nPatience made permanent\n\nPOT";

/* ---------- env helpers ---------- */

function isInBaseOrFarcaster() {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|Base/i.test(navigator.userAgent || "");
}

/* ---------- share ---------- */

function shareHourglass(imageUrl: string, tokenId: number) {
  const text =
    `${SHARE_LINE}\n\n` +
    `Hourglass #${tokenId}\n` +
    `${SITE_URL}/hourglasses`;

  // ✅ Base app / Farcaster native share (THIS is the fix)
  if (navigator.share && isInBaseOrFarcaster()) {
    navigator.share({
      title: `Hourglass #${tokenId}`,
      text,
      url: SITE_URL,
    });
    return;
  }

  // ✅ Normal browser Warpcast compose
  const params = new URLSearchParams();
  params.set("text", `${text}\n${imageUrl}`);

  window.open(
    `https://warpcast.com/~/compose?${params.toString()}`,
    "_blank"
  );
}

/* ---------- rarity ---------- */

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
  const { data: supply } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "totalSupply",
  });

  const total = Number(supply ?? 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-black tracking-tight">
        Proof of Time Hourglasses
      </h1>

      <p className="mt-2 text-sm text-zinc-400 max-w-xl">
        Fully on-chain hourglasses forged by burning POT.
        Each one permanently records conviction in time.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: total }).map((_, i) => (
          <HourglassCard key={i} tokenId={i + 1} />
        ))}
      </div>
    </main>
  );
}

/* ---------- card ---------- */

function HourglassCard({ tokenId }: { tokenId: number }) {
  const { data: uri } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
    query: { staleTime: 60_000 },
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
    <div className="group relative rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-3 transition hover:border-[#BBA46A]/60">
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
        <div className="text-sm font-semibold">#{tokenId}</div>

        <button
          onClick={() => shareHourglass(json.image, tokenId)}
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
