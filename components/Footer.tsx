"use client";

import { Mail, Send } from "lucide-react";
import { SiReddit } from "react-icons/si";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-zinc-800/60 bg-[#0b0e14] text-zinc-400 py-10 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Brand */}
        <div className="text-center md:text-left">
          <p className="font-semibold text-[#BBA46A]">Proof of Time (PøT)</p>
          <p className="text-xs text-zinc-500">Built on Base ⏳</p>
        </div>

        {/* Middle: Links */}
        <div className="flex flex-wrap justify-center gap-4 text-sm">
          <Link
            href="mailto:proofoftime2025@outlook.com"
            target="_blank"
            className="flex items-center gap-1 hover:text-[#BBA46A] transition"
          >
            <Mail size={16} /> Email
          </Link>

          <Link
            href="https://coinsniper.net/coin/86992"
            target="_blank"
            className="hover:text-[#BBA46A] transition"
          >
            CoinSniper
          </Link>

          <span className="text-zinc-600 cursor-default">
            CoinMarketCap (coming soon)
          </span>
          <span className="text-zinc-600 cursor-default">
            CoinVote.cc (coming soon)
          </span>

          <Link
            href="https://www.reddit.com/r/proofoftime/s/0KTf7D2vaM"
            target="_blank"
            className="flex items-center gap-1 hover:text-[#BBA46A] transition"
          >
            <SiReddit size={16} /> Reddit
          </Link>

          <Link
            href="https://t.me/+pbiYRAUv3MY2MmZh"
            target="_blank"
            className="flex items-center gap-1 hover:text-[#BBA46A] transition"
          >
            <Send size={16} /> Telegram
          </Link>
        </div>

        {/* Right: Info */}
        <div className="text-xs text-center md:text-right text-zinc-500 leading-relaxed">
          <div>© {new Date().getFullYear()} Proof of Time — All Rights Reserved.</div>
          <div className="text-zinc-600 mt-1">
            Created on <span className="text-[#BBA46A]">October 26, 2025</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
