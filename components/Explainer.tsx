"use client";

import { Share2, Castle } from "lucide-react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useMemo } from "react";

export default function Explainer() {
  const { address } = useAccount();

  const relicUrl = useMemo(() => {
    if (!address) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://proofoftime.vercel.app";
    return `${origin}/relic/${address}`;
  }, [address]);

  const shareText = encodeURIComponent(
    "Behold my on-chain Relic Altar—how long have you held yours? ⟡"
  );

  const warpcast = relicUrl
    ? `https://warpcast.com/~/compose?text=${shareText}&embeds[]=${encodeURIComponent(relicUrl)}`
    : "https://warpcast.com/~/compose";
  const xshare = relicUrl
    ? `https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(relicUrl)}`
    : "https://twitter.com/intent/tweet?text=Proof%20of%20Time";

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 grid lg:grid-cols-2 gap-10">
      <div>
        <h1 className="text-5xl lg:text-6xl font-semibold leading-tight">
          Carve your <span className="text-[#BBA46A]">Relics</span> in time.
        </h1>
        <p className="mt-4 text-zinc-300/90 leading-relaxed">
          We study your Base wallet’s history, uncover your longest-held tokens, and mint your legacy
          into a living <em>altar</em>. The older the holding, the rarer the relic.
        </p>

        <ul className="mt-6 space-y-3 text-zinc-300/90">
          <li>• Purely on-chain: transfers, balances, and time held</li>
          <li>• Works with Farcaster + Base wallets</li>
          <li>• Share your altar to Warpcast or X</li>
        </ul>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href={address ? `/relic/${address}` : "/test"}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#BBA46A] px-4 py-3 text-black font-semibold hover:brightness-95"
          >
            <Castle className="h-5 w-5" />
            Visit Your Altar
          </Link>
          <a
            href={warpcast}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 hover:bg-white/5"
          >
            <Share2 className="h-5 w-5" />
            Share on Farcaster
          </a>
          <a
            href={xshare}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 hover:bg-white/5"
          >
            <Share2 className="h-5 w-5" />
            Share on X
          </a>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_-10%,rgba(187,164,106,.25),transparent)]" />
        <h3 className="relative text-xl font-semibold mb-3 text-[#BBA46A]">How it works</h3>
        <ol className="relative space-y-4 text-zinc-200">
          <li><b>Connect</b> your Base wallet. We also try to pull your Farcaster avatar via Neynar.</li>
          <li><b>Compute</b> via our endpoint. We scan ERC-20 transfers and balances (Infura/Base RPC with fallbacks).</li>
          <li><b>Score</b> each token by continuous hold time and no-sell streaks, then display your top relics.</li>
        </ol>
        <div className="relative mt-6 rounded-2xl bg-black/40 p-4 text-sm text-zinc-400">
          Tip: Big, old wallets can take a moment on first compute while we fetch logs. Subsequent visits are instant.
        </div>
      </div>
    </section>
  );
}
