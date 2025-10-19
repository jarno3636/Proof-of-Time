"use client";

import cn from "clsx";

/* ---------- Helpers ---------- */
function getSiteOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

/* ---------- Component ---------- */
export default function RevealRelicsButton({
  size = "md",
}: {
  size?: "md" | "lg";
}) {
  const origin = getSiteOrigin();

  // Always direct to the relic landing page
  const hrefAbs = `${origin}/relic`;

  // Styles
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl border font-semibold transition " +
    "border-[#BBA46A] text-[#BBA46A] hover:bg-[#BBA46A]/10 active:scale-[0.98]";
  const sizes = {
    md: "px-5 py-3 text-base",
    lg: "px-7 py-4 text-lg md:text-xl",
  };

  return (
    <div className="flex items-center gap-3">
      <a
        href={hrefAbs}
        target="_self"
        rel="noreferrer noopener"
        className={cn(base, sizes[size])}
        title="Go to your relic altar"
        aria-label="Reveal your relics"
      >
        Reveal your relics
      </a>
    </div>
  );
}
