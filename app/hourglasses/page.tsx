"use client";

import { useReadContract } from "wagmi";
import {
  POTHOURGLASS_ABI,
  POTHOURGLASS_ADDRESS,
} from "@/lib/pothourglass";

export default function HourglassGallery() {
  const { data: supply } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "totalSupply",
  });

  const total = Number(supply ?? 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-black tracking-tight">
        Minted Hourglasses
      </h1>
      <p className="mt-2 text-zinc-400 text-sm">
        Fully on-chain. Rendered live from Base.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: total }).map((_, i) => (
          <HourglassCard key={i} tokenId={i + 1} />
        ))}
      </div>
    </main>
  );
}

function HourglassCard({ tokenId }: { tokenId: number }) {
  const { data: uri } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
  });

  if (!uri) return null;

  const json = JSON.parse(
    atob(uri.replace("data:application/json;base64,", ""))
  );

  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-3">
      <img
        src={json.image}
        alt={`Hourglass #${tokenId}`}
        className="rounded-lg bg-black"
      />
      <div className="mt-2 text-sm font-semibold">
        #{tokenId}
      </div>
      <div className="text-xs text-zinc-400">
        {json.attributes.map((a: any) => a.value).join(" · ")}
      </div>
    </div>
  );
}
