"use client";

import { useAccount } from "wagmi";
import { useCallback } from "react";
import cn from "clsx";

function isEthAddress(s: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export default function RevealRelicsButton({ size = "md" }: { size?: "md" | "lg" }) {
  const { address } = useAccount();

  const go = useCallback(async () => {
    if (address) {
      window.location.href = `/relic/${address}`;
      return;
    }
    const input = window.prompt("Enter a wallet address (0x…):", "");
    if (!input) return;
    if (!isEthAddress(input)) {
      alert("That doesn’t look like a valid 0x address.");
      return;
    }
    window.location.href = `/relic/${input.trim()}`;
  }, [address]);

  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl border border-[#BBA46A] font-semibold text-[#BBA46A] hover:bg-[#BBA46A]/10 transition";
  const sizes = {
    md: "px-5 py-3 text-base",
    lg: "px-7 py-4 text-lg md:text-xl",
  };

  return (
    <button
      onClick={go}
      className={cn(base, sizes[size])}
      title={address ? "Open your altar" : "Enter an address or connect"}
      aria-label="Reveal your relics"
      type="button"
    >
      Reveal your relics
    </button>
  );
}
