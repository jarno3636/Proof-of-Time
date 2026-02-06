"use client";

import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { useReadContract } from "wagmi";
import Nav from "@/components/Nav";
import { POTHOURGLASS_ABI, POTHOURGLASS_ADDRESS } from "@/lib/pothourglass";

/* ---------- constants ---------- */

const SITE_URL = "https://proofoftime.vercel.app";
const SHARE_LINE = "Proof of Time Hourglass\nPatience made permanent\n\nPOT";

/**
 * IMPORTANT:
 * - Use Warpcast Intent endpoint (best chance of working across environments)
 * - In iOS in-app browsers, popup blockers can block window.open unless it’s a real click.
 *   So we use an <a href> for the primary action, and only JS as a fallback.
 */
function buildWarpcastIntentUrl(imageUrl: string, tokenId: number) {
  const text =
    `${SHARE_LINE}\n\n` +
    `Hourglass #${tokenId}\n` +
    `${SITE_URL}/hourglasses`;

  const params = new URLSearchParams();
  params.set("text", text);

  // Warpcast supports embeds[] style; intent also accepts embeds, but array is safer.
  // We include both for maximum compatibility.
  params.append("embeds[]", imageUrl);
  params.set("embeds", imageUrl);

  return `https://warpcast.com/intent/post?${params.toString()}`;
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
  });

  const total = Number(supply ?? 0);

  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100 flex flex-col">
      <Nav />

      <section className="mx-auto max-w-6xl px-6 py-12 flex-grow">
        <h1 className="text-3xl font-black tracking-tight">
          Proof of Time Hourglasses
        </h1>

        <p className="mt-2 text-sm text-zinc-400 max-w-xl">
          Fully on-chain hourglasses forged by burning POT. Each one permanently
          records conviction in time.
        </p>

        {/* Grid (smaller cards: 3 cols on mobile) */}
        <div className="mt-8 grid gap-3 grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {isLoading &&
            Array.from({ length: 12 }).map((_, i) => (
              <HourglassSkeleton key={`skeleton-${i}`} />
            ))}

          {!isLoading &&
            Array.from({ length: total }).map((_, i) => (
              <HourglassCard key={i} tokenId={i + 1} />
            ))}
        </div>
      </section>
    </main>
  );
}

/* ---------- skeleton ---------- */

function HourglassSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-2 animate-pulse">
      <div className="aspect-square rounded-lg bg-zinc-800/60" />
      <div className="mt-2 h-3 w-14 rounded bg-zinc-800/60" />
      <div className="mt-1 h-2 w-20 rounded bg-zinc-800/50" />
    </div>
  );
}

/* ---------- card (lazy wrapper) ---------- */

function HourglassCard({ tokenId }: { tokenId: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(ref.current);
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
        ? uri.slice("data:application/json;base64,".length)
        : uri;
      return JSON.parse(atob(raw));
    } catch {
      return null;
    }
  }, [uri]);

  const imageUrl: string | null = json?.image ?? null;

  const bodyTrait = useMemo(() => {
    const attrs = json?.attributes;
    if (!Array.isArray(attrs)) return undefined;
    return attrs.find((a: any) => a?.trait_type === "Body")?.value as
      | string
      | undefined;
  }, [json]);

  const shareUrl = useMemo(() => {
    if (!imageUrl) return "";
    return buildWarpcastIntentUrl(imageUrl, tokenId);
  }, [imageUrl, tokenId]);

  // JS fallback if needed (still uses intent)
  const onShareClick = useCallback(
    (e: React.MouseEvent) => {
      // If we don't have a URL yet, prevent navigation.
      if (!shareUrl) {
        e.preventDefault();
        return;
      }

      // Some in-app browsers handle anchor targets weirdly; attempt window.open too.
      // If blocked, the anchor will still work.
      try {
        window.open(shareUrl, "_blank", "noopener,noreferrer");
      } catch {
        // ignore
      }
    },
    [shareUrl]
  );

  if (!imageUrl) return <HourglassSkeleton />;

  return (
    <div className="group relative rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-2 transition hover:border-[#BBA46A]/60 hover:-translate-y-0.5">
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
        src={imageUrl}
        alt={`Hourglass #${tokenId}`}
        loading="lazy"
        className="aspect-square rounded-lg bg-black object-contain"
      />

      <div className="mt-1 flex items-center justify-between">
        <div className="text-xs font-semibold">#{tokenId}</div>

        {/* Use anchor as primary (most reliable in-app) */}
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onShareClick}
          className="text-[11px] rounded-md border border-zinc-700/60 px-2 py-0.5 text-zinc-300 hover:text-[#BBA46A] hover:border-[#BBA46A]/60 transition"
        >
          Share
        </a>
      </div>

      {Array.isArray(json.attributes) && (
        <div className="mt-1 text-[10px] text-zinc-500 truncate">
          {json.attributes.map((a: any) => a?.value).filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}
