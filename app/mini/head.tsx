// app/mini/page.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function MiniEntry() {
  useEffect(() => {
    const w = window as any;

    const tryReady = () => {
      try { w.farcaster?.actions?.ready?.(); } catch {}
      try { w.farcaster?.miniapp?.sdk?.actions?.ready?.(); } catch {}
      try { w.Farcaster?.mini?.sdk?.actions?.ready?.(); } catch {}
      // Some older builds listen to a postMessage poke:
      try { w.parent?.postMessage({ type: "farcaster:miniapp:ready" }, "*"); } catch {}
    };

    // 1) Try immediately
    tryReady();

    // 2) Try repeatedly for a short window (covers late injection)
    const iv = setInterval(tryReady, 200);
    const stopIv = setTimeout(() => clearInterval(iv), 6000);

    // 3) If SDK is not present, load the official CDN build and try again onload
    const hasSdk =
      !!w.Farcaster?.mini?.sdk ||
      !!w.farcaster?.miniapp?.sdk ||
      !!w.farcaster?.actions ||
      !!w.sdk;

    let tag: HTMLScriptElement | null = null;
    if (!hasSdk) {
      tag = document.createElement("script");
      // official CDN (same as we load in layout, but this catches deep links straight to /mini)
      tag.src = "https://cdn.farcaster.xyz/sdk/miniapp/v2.js";
      tag.async = true;
      tag.onload = () => setTimeout(tryReady, 50);
      document.head.appendChild(tag);
    }

    return () => {
      clearInterval(iv);
      clearTimeout(stopIv);
      if (tag) tag.remove();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-black">Proof of Time</h1>
        <p className="mt-2 text-zinc-400">
          Your longest-held tokens on Base. Time &gt; hype.
        </p>

        <div className="mt-6 grid gap-3">
          <Link
            href="/"
            className="rounded-2xl bg-[#BBA46A] text-[#0b0e14] px-4 py-3 font-semibold"
          >
            Enter Your Altar
          </Link>
          <Link
            href="/relic/0x0000000000000000000000000000000000000000"
            className="rounded-2xl border border-white/10 px-4 py-3 text-zinc-200"
          >
            View Example Altar
          </Link>
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Tip: Share from inside Warpcast to keep posts in-app.
        </p>
      </div>
    </main>
  );
}
