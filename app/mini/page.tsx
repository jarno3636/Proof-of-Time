// app/mini/page.tsx
"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function MiniEntry() {
  useEffect(() => {
    // light safety net after hydration
    try { (window as any)?.farcaster?.actions?.ready?.(); } catch {}
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-black">Proof of Time</h1>
        <p className="mt-2 text-zinc-400">Your longest-held tokens on Base. Time &gt; hype.</p>

        <div className="mt-6 grid gap-3">
          <Link href="/" className="rounded-2xl bg-[#BBA46A] text-[#0b0e14] px-4 py-3 font-semibold">
            Enter Your Altar
          </Link>
          <Link
            href="/relic/0x0000000000000000000000000000000000000000"
            className="rounded-2xl border border-white/10 px-4 py-3 text-zinc-200"
          >
            View Example Altar
          </Link>
        </div>

        <p className="mt-4 text-xs text-zinc-500">Tip: Share from inside Warpcast to keep posts in-app.</p>
      </div>
    </main>
  );
}
