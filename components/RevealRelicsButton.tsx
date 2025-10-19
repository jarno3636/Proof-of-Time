"use client";

import { useAccount } from "wagmi";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import cn from "clsx";

/* ---------- Helpers ---------- */
function isEthAddress(s: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

function getSiteOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

function hardNavigate(absUrl: string) {
  try { window.location.assign(absUrl); return; } catch {}
  try { window.location.href = absUrl; return; } catch {}
  try { window.location.replace(absUrl); return; } catch {}
  try { window.open(absUrl, "_self", "noopener,noreferrer"); return; } catch {}
  try {
    const a = document.createElement("a");
    a.href = absUrl;
    a.rel = "noreferrer noopener";
    a.target = "_self";
    a.style.position = "absolute";
    a.style.left = "-9999px";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1500);
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
  const absHref = address ? `${origin}/relic/${address}` : ""; // used for the anchor

  const go = useCallback(() => {
    // 1) Resolve target address
    let target = address || "";
    if (!target) {
      const input = window.prompt("Enter a wallet address (0x…):", "") || "";
      const trimmed = input.trim();
      if (!trimmed) return;
      if (!isEthAddress(trimmed)) {
        alert("That doesn’t look like a valid 0x address.");
        return;
      }
      target = trimmed;
    }

    // 2) Absolute URL (more reliable in webviews)
    const abs = `${origin}/relic/${target}`;

    // 3) Try SPA nav, then force hard navigation
    try {
      router.push(abs);
      setTimeout(() => {
        if (document.visibilityState !== "hidden") {
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
    <div className="flex items-center gap-3">
      <button
        onClick={go}
        className={cn(base, sizes[size])}
        title={address ? "Open your altar" : "Enter an address or connect"}
        aria-label="Reveal your relics"
        type="button"
      >
        Reveal your relics
      </button>

      {/* Visible link for stubborn in-app browsers (shows only when connected) */}
      {address && (
        <a
          href={absHref || `/relic/${address}`}
          className="ml-1 text-sm underline text-[#BBA46A]/80 hover:text-[#BBA46A]"
        >
          Open as link
        </a>
      )}
    </div>
  );
}
