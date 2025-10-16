"use client";

import Link from "next/link";
import WalletConnect from "./WalletConnect";

export default function Nav() {
  return (
    <nav className="sticky top-0 z-40 w-full border-b border-zinc-800/60 bg-[#0b0e14]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-extrabold tracking-tight text-zinc-100">
          Proof of Time
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/test" className="text-sm text-zinc-300 hover:text-white">
            API Test
          </Link>
          <WalletConnect />
        </div>
      </div>
    </nav>
  );
}
