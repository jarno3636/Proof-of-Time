"use client";

import { useAccount } from "wagmi";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import cn from "clsx";

/* ---------- Helpers ---------- */
function isEthAddress(s: string): s is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

function getSiteOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

function isInWalletWebView() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Cover Base, Coinbase, Trust, MetaMask, Rainbow, etc.
  return /BaseWallet|BaseBrowser|Coinbase|CBBrowser|TrustWallet|MetaMask|Rainbow|Phantom/i.test(ua);
}

/* Navigate very defensively for wallet in-app browsers */
function hardNavigate(absUrl: string) {
  // 1) Try the most reliable first
  try {
    window.location.assign(absUrl);
    return;
  } catch {}

  // 2) Fallbacks
  try {
    window.location.href = absUrl;
  } catch {}

  try {
    window.location.replace(absUrl);
  } catch {}

  try {
    window.open(absUrl, "_self", "noopener,noreferrer");
  } catch {}

  // 3) Last-ditch: programmatic anchor click
  try {
    const a = document.createElement("a");
    a.href = absUrl;
    a.rel = "noreferrer noopener";
    a.target = "_self";
    // Make it keyboard/touch accessible for some webviews
    a.style.position = "absolute";
    a.style.left = "-9999px";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 2000);
  } catch {}
}

/* ---------- Component ---------- */
export default function RevealRelicsButton({
  size = "md",
}: {
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const { address } = useAccount();
  const origin = useMemo(getSiteOrigin, []);

  const go = useCallback(async () => {
    // 1) Decide target address
    let target: `0x${string}` | null = address ?? null;

    if (!target) {
      const input = window.prompt("Enter a wallet address (0x…):", "") || "";
      const trimmed = input.trim();
      if (!isEthAddress(trimmed)) {
        if (trimmed) alert("That doesn’t look like a valid 0x address.");
        return;
      }
      target = trimmed;
    }

    // 2) Build an ABSOLUTE URL — many webviews dislike relative paths
    const abs = `${origin || ""}/relic/${target}`;

    // 3) Try client router first (nice SPA nav), then hard fallbacks for webviews
    try {
      // router.push works in most normal browsers
      router.push(abs);
      // In some webviews push may noop; add a micro-fallback timer
      setTimeout(() => {
        if (document.visibilityState !== "hidden") {
          // If page didn't navigate, force it
          hardNavigate(abs);
        }
      }, 60);
    } catch {
      hardNavigate(abs);
    }
  }, [address, origin, router]);

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
      onTouchEnd={(e) => {
        // Some in-app browsers only fire touch events reliably
        // Prevent duplicate navigation when both fire
        if (isInWalletWebView()) {
          e.preventDefault();
          e.stopPropagation();
          go();
        }
      }}
      className={cn(base, sizes[size])}
      title={address ? "Open your altar" : "Enter an address or connect"}
      aria-label="Reveal your relics"
      type="button"
    >
      Reveal your relics
    </button>
  );
}
