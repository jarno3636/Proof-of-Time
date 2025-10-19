"use client";

import { useAccount } from "wagmi";
import cn from "clsx";

/* ---------- Helpers ---------- */
function isEthAddress(s: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

function getSiteOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

/* ---------- Component ---------- */
export default function RevealRelicsButton({
  size = "md",
}: {
  size?: "md" | "lg";
}) {
  const { address } = useAccount();
  const origin = getSiteOrigin();

  // Styles
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl border font-semibold transition " +
    "border-[#BBA46A] text-[#BBA46A] hover:bg-[#BBA46A]/10 active:scale-[0.98]";
  const sizes = {
    md: "px-5 py-3 text-base",
    lg: "px-7 py-4 text-lg md:text-xl",
  };

  // 1) CONNECTED WALLET → render a *real link* (absolute URL, target _self).
  if (address) {
    const hrefAbs = `${origin}/relic/${address}`;
    return (
      <div className="flex items-center gap-3">
        <a
          href={hrefAbs}
          target="_self"
          rel="noreferrer noopener"
          className={cn(base, sizes[size])}
          title="Open your altar"
          aria-label="Reveal your relics"
        >
          Reveal your relics
        </a>

        {/* optional helper link (kept since you asked for it) */}
        <a
          href={hrefAbs}
          target="_self"
          rel="noreferrer noopener"
          className="ml-1 text-sm underline text-[#BBA46A]/80 hover:text-[#BBA46A]"
        >
          Open as link
        </a>
      </div>
    );
  }

  // 2) NO CONNECTED WALLET → use a button that prompts for an address and then navigates.
  async function handleClick() {
    const input = window.prompt("Enter a wallet address (0x…):", "") || "";
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!isEthAddress(trimmed)) {
      alert("That doesn’t look like a valid 0x address.");
      return;
    }

    const abs = `${origin}/relic/${trimmed}`;
    // Hard navigation to play nice with wallet webviews
    try { window.location.assign(abs); return; } catch {}
    try { window.location.href = abs; return; } catch {}
    try { window.location.replace(abs); return; } catch {}
    try { window.open(abs, "_self", "noopener,noreferrer"); return; } catch {}
    try {
      const a = document.createElement("a");
      a.href = abs;
      a.target = "_self";
      a.rel = "noreferrer noopener";
      a.style.position = "absolute";
      a.style.left = "-9999px";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 1500);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(base, sizes[size])}
      title="Enter an address or connect"
      aria-label="Reveal your relics"
    >
      Reveal your relics
    </button>
  );
}
