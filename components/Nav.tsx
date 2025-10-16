"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import Image from "next/image";

function FarAvatar({ address }: { address?: `0x${string}` }) {
  const [pfp, setPfp] = useState<string | null>(null);
  useEffect(() => {
    let stop = false;
    (async () => {
      if (!address) return setPfp(null);
      const r = await fetch(`/api/farcaster/profile?address=${address}`).catch(() => null);
      const j = await r?.json().catch(() => ({}));
      if (!stop) setPfp(j?.pfpUrl || null);
    })();
    return () => { stop = true; };
  }, [address]);

  if (!address || !pfp) return null;
  return (
    <Image
      src={pfp}
      alt="Farcaster avatar"
      width={28}
      height={28}
      className="rounded-full ring-1 ring-white/20"
    />
  );
}

export default function Nav() {
  const { address } = useAccount();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/20 bg-black/5 border-b border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-xl font-semibold tracking-wide">
          <span className="text-[#BBA46A]">⟡</span> Proof of Time
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <Link href="/test" className="hidden sm:inline text-sm text-zinc-300 hover:text-white">
            Test Compute
          </Link>
          <Link href={address ? `/relic/${address}` : "/"} className="text-sm text-zinc-300 hover:text-white">
            Your Altar
          </Link>
          <FarcasterAvatarGate address={address as `0x${string}` | undefined} />
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
        </div>
      </div>
    </nav>
  );
}

function FarcasterAvatarGate({ address }: { address?: `0x${string}` }) {
  // small guard so layout doesn’t jump
  if (!address) return null;
  return <FarAvatar address={address} />;
}
