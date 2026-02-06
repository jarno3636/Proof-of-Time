"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import Nav from "@/components/Nav";
import POTHourglassMint from "@/components/POTHourglassMint";
import { POTHOURGLASS_ABI, POTHOURGLASS_ADDRESS } from "@/lib/pothourglass";

/* ---------- constants ---------- */

const SITE_URL = "https://proofoftime.vercel.app";
const SHARE_LINE = "Proof of Time Hourglass\nPatience made permanent\n\nPOT";

/**
 * Farcaster-safe share:
 * - Uses Mini App SDK when available (no app-store redirect)
 * - Falls back to Warpcast web compose for browsers
 */
async function shareHourglass(imageUrl: string, tokenId: number) {
  const text =
    `${SHARE_LINE}\n\n` +
    `Hourglass #${tokenId}\n` +
    `${SITE_URL}/hourglasses`;

  // 1) Farcaster Mini App SDK (correct + official)
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");

    await sdk.actions.composeCast({
      text,
      embeds: [imageUrl],
    });

    return;
  } catch {
    // fall through to browser fallback
  }

  // 2) Browser fallback
  const params = new URLSearchParams();
  params.set("text", text);
  params.append("embeds[]", imageUrl);

  window.open(
    `https://warpcast.com/~/compose?${params.toString()}`,
    "_blank",
    "noopener,noreferrer"
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
  const { data: supply, isLoading } = useReadContract({
    address: POTHOURGLASS_ADDRESS,
    abi: POTHOURGLASS_ABI,
    functionName: "totalSupply",
    query: { staleTime: 10_000 },
  });

  const total = Number(supply ?? 0);

  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100 flex flex-col">
      <Nav />

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-12 flex-grow">
        {/* Header */}
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Proof of Time Hourglasses
            </h1>
            <p className="mt-2 text-sm text-zinc-400 max-w-xl">
              Fully on-chain hourglasses forged by burning POT.
              Each one permanently records conviction in time.
            </p>
          </div>

          {/* 🔥 Mint Module */}
          <POTHourglassMint />

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="rounded-full border border-zinc-800/70 bg-zinc-900/40 px-3 py-1">
              Minted:{" "}
              <span className="text-zinc-100 font-semibold">{total}</span>
            </span>
          </div>
        </div>

        {/* Grid (3 per row on mobile) */}
        <div className="mt-8 grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {isLoading &&
            Array.from({ length: 18 }).map((_, i) => (
              <HourglassSkeleton key={`skeleton-${i}`} />
            ))}

          {!isLoading &&
            Array.from({ length: total }).map((_, i) => (
              <HourglassCard key={i} tokenId={i + 1} />
            ))}
        </div>

        {!isLoading && total === 0 && (
          <div className="mt-10 text-sm text-zinc-400">
            No hourglasses minted yet.
          </div>
        )}
      </section>
    </main>
  );
}

/* ---------- skeleton ---------- */

function HourglassSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-2 animate-pulse">
      <div className="aspect-square rounded-lg bg-zinc-800/60" />
      <div className="mt-2 h-3 w-12 rounded bg-zinc-800/60" />
      <div className="mt-1 h-2 w-16 rounded bg-zinc-800/50" />
    </div>
  );
}

/* ---------- card (lazy wrapper) ---------- */

function HourglassCard({ tokenId }: { tokenId: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {visible ? <HourglassCardInner tokenId={tokenId} /> : <HourglassSkeleton />}
    </div>
  );
}

/* ---------- card inner ---------- */

function HourglassCardInner({ tokenId }: { tokenId: number }) {
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
      const raw = uri.startsWith("data:application/json;base64,")
        ? atob(uri.replace("data:application/json;base64,", ""))
        : uri;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [uri]);

  if (!json?.image) return <HourglassSkeleton />;

  const bodyTrait = json.attributes?.find(
    (a: any) => a?.trait_type === "Body"
  )?.value;

  return (
    <div className="group relative rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-2 transition hover:border-[#BBA46A]/60 hover:-translate-y-0.5">
      {bodyTrait && (
        <div
          className={[
            "absolute top-2 left-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold border backdrop-blur",
            rarityBadge(bodyTrait),
          ].join(" ")}
        >
          {bodyTrait}
        </div>
      )}

      <img
        src={json.image}
        alt={`Hourglass #${tokenId}`}
        loading="lazy"
        className="aspect-square rounded-lg bg-black object-contain"
      />

      <div className="mt-1 flex items-center justify-between">
        <div className="text-[11px] font-semibold">#{tokenId}</div>

        <button
          onClick={() => shareHourglass(json.image, tokenId)}
          className="text-[11px] rounded-md border border-zinc-700/60 px-2 py-0.5 text-zinc-300 hover:text-[#BBA46A] hover:border-[#BBA46A]/60 transition"
        >
          Share
        </button>
      </div>

      {Array.isArray(json.attributes) && (
        <div className="mt-1 text-[10px] text-zinc-500 truncate">
          {json.attributes
            .map((a: any) => a?.value)
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}
    </div>
  );
}
