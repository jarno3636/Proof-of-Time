"use client";

import { useAccount } from "wagmi";
import { useCallback } from "react";
import cn from "clsx";

/* ---------- Helpers ---------- */
function isEthAddress(s: string): s is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

function isInWalletWebView() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /BaseWallet|Coinbase|TrustWallet|MetaMask/i.test(ua);
}

/* ---------- Component ---------- */
export default function RevealRelicsButton({
  size = "md",
}: {
  size?: "md" | "lg";
}) {
  const { address } = useAccount();

  const go = useCallback(() => {
    console.log("RevealRelicsButton pressed, address:", address);

    let target: `0x${string}` | null = address ?? null;

    if (!target) {
      const input = window.prompt("Enter a wallet address (0x…):", "") || "";
      const trimmed = input.trim();
      if (!isEthAddress(trimmed)) {
        if (trimmed) alert("That doesn’t look like a valid 0x address.");
        return;
      }
      target = trimmed; // ← now typed as `0x${string}` thanks to the type guard
    }

    const href = `/relic/${target}`;

    // Handle navigation differently inside wallet webviews
    if (isInWalletWebView()) {
      console.log("Detected wallet webview → using direct assign()");
      window.location.assign(href);
    } else {
      console.log("Standard browser → using href");
      window.location.href = href;
    }
  }, [address]);

  /* ---------- Styles ---------- */
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl border font-semibold transition " +
    "border-[#BBA46A] text-[#BBA46A] hover:bg-[#BBA46A]/10 active:scale-[0.98]";
  const sizes = {
    md: "px-5 py-3 text-base",
    lg: "px-7 py-4 text-lg md:text-xl",
  };

  return (
    <button
      onClick={go}
      onTouchStart={() => console.log("touchstart detected")}
      className={cn(base, sizes[size])}
      title={address ? "Open your altar" : "Enter an address or connect"}
      aria-label="Reveal your relics"
      type="button"
    >
      Reveal your relics
    </button>
  );
}
