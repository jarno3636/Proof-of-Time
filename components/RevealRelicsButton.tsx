"use client";

import { useAccount } from "wagmi";
import cn from "clsx";

/* ---------- Helpers ---------- */
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

  // Choose destination
  const hrefAbs = address
    ? `${origin}/relic/${address}`
    : `${origin}/relic`; // fallback landing page for unconnected users

  return (
    <div className="flex items-center gap-3">
      {/* Main button */}
      <a
        href={hrefAbs}
        target="_self"
        rel="noreferrer noopener"
        className={cn(base, sizes[size])}
        title={address ? "Open your altar" : "Go to relics page"}
        aria-label="Reveal your relics"
      >
        Reveal your relics
      </a>

      {/* Optional helper link for connected users */}
      {address && (
        <a
          href={hrefAbs}
          target="_self"
          rel="noreferrer noopener"
          className="ml-1 text-sm underline text-[#BBA46A]/80 hover:text-[#BBA46A]"
        >
          Open as link
        </a>
      )}
    </div>
  );
}
