"use client";

import Link from "next/link";

export default function BuyButton() {
  return (
    <div className="flex justify-center mt-6">
      <Link
        href="https://aerodrome.finance/swap?to=0xe4d22a9af4e14fdf70795dd9c9531295095f0cb6&from=eth&chain0=8453&chain1=8453"
        target="_blank"
        className="px-6 py-3 rounded-xl bg-[#BBA46A] text-black font-semibold hover:bg-[#c6b37c] transition"
      >
        Buy now on Aerodrome
      </Link>
    </div>
  );
}
