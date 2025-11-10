// components/BuyButton.tsx
"use client";

import Link from "next/link";

const AERODROME_URL =
  "https://aerodrome.finance/swap?to=0xe4d22a9af4e14fdf70795dd9c9531295095f0cb6&from=eth&chain0=8453&chain1=8453";

export default function BuyButton() {
  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Glow backdrop */}
      <div className="pointer-events-none absolute -z-10 h-48 w-48 rounded-full blur-3xl opacity-40 bg-gradient-to-tr from-[#BBA46A] via-[#e7d8a5] to-transparent" />

      <Link
        href={AERODROME_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy PøT on Aerodrome"
        className="
          group relative inline-flex items-center gap-3
          rounded-2xl px-6 py-3
          font-semibold tracking-wide
          bg-gradient-to-r from-[#BBA46A] via-[#d6c284] to-[#b79f5a]
          text-black shadow-[0_0_25px_rgba(187,164,106,0.35)]
          hover:shadow-[0_0_45px_rgba(187,164,106,0.55)]
          transition-all duration-300
        "
      >
        {/* Subtle animated ring */}
        <span
          className="absolute inset-0 rounded-2xl ring-2 ring-black/10 group-hover:ring-black/20 transition"
          aria-hidden
        />

        {/* Aerodrome "A" mark (inline SVG) */}
        <span className="relative flex items-center justify-center">
          <svg
            width="20"
            height="20"
            viewBox="0 0 32 32"
            fill="currentColor"
            className="text-black/80"
            aria-hidden
          >
            <path d="M16 2c7.732 0 14 6.268 14 14s-6.268 14-14 14S2 23.732 2 16 8.268 2 16 2Zm0 4.5c-5.242 0-9.5 4.258-9.5 9.5s4.258 9.5 9.5 9.5 9.5-4.258 9.5-9.5S21.242 6.5 16 6.5Zm-1.2 14.6 3.85-9.9h2.52l-3.85 9.9h-2.52Zm-3.22-4.3 1.03-2.64h7.8l-1.02 2.64h-7.81Z" />
          </svg>
        </span>

        <span>Buy on Aerodrome</span>

        {/* Decorative sparkles */}
        <span
          className="absolute -right-2 -top-2 h-3 w-3 rounded-full bg-white/70 opacity-0 group-hover:opacity-100 transition"
          aria-hidden
        />
        <span
          className="absolute -right-4 -top-3 h-1.5 w-1.5 rounded-full bg-white/60 opacity-0 group-hover:opacity-100 transition delay-100"
          aria-hidden
        />
      </Link>

      {/* Quote line */}
      <p className="text-xs text-zinc-400/90">
        “Only what’s real survives the <span className="text-[#BBA46A] font-medium">test of time</span>.”
      </p>
    </div>
  );
}
