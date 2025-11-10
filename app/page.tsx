// app/page.tsx
"use client";

import Nav from "@/components/Nav";
import dynamic from "next/dynamic";
import Footer from "@/components/Footer";

/* ---------- Client islands ---------- */
const RevealRelicsInline = dynamic(() => import("@/components/RevealRelicsInline"), { ssr: false });
// ⛔ Removed HomeCountdown + LaunchShare
const RelicLegend        = dynamic(() => import("@/components/RelicLegend"),        { ssr: false });
// ✅ Buy button
const BuyButton          = dynamic(() => import("@/components/BuyButton"),          { ssr: false });

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100 flex flex-col">
      <Nav />

      {/* ---------- Hero ---------- */}
      <section className="mx-auto max-w-6xl px-6 pt-[max(1.5rem,env(safe-area-inset-top))] md:pt-20 pb-12 md:pb-16 flex-grow">
        <div className="grid gap-8 md:grid-cols-2 md:items-start">
          {/* Headline + CTA */}
          <div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tight text-center md:text-left">
              Claim your <span className="text-zinc-400">time on chain.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-zinc-400 text-center md:text-left md:pr-10 mx-auto md:mx-0">
              Proof of Time reveals your longest-held tokens on Base—turning consistent
              holders into living records of patience, loyalty, and belief.
            </p>

            {/* Inline reveal / verify block */}
            <div className="mt-7">
              <RevealRelicsInline />
            </div>

            {/* Secondary CTA */}
            <div className="mt-4">
              <a
                href="/launch"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:text-zinc-100 transition"
              >
                View Token Launch
              </a>
            </div>
          </div>

          {/* Trade card (no countdown/share) */}
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-[#BBA46A]">Trade PøT</h3>

            <p className="mt-3 text-sm text-zinc-400">
              Live on Aerodrome. LP seeded. 500M holder rewards program.
            </p>

            <div className="mt-5">
              <BuyButton />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="/launch"
                className="inline-flex items-center justify-center rounded-xl bg-[#BBA46A] hover:bg-[#d6c289] px-4 py-2.5 text-sm font-semibold text-[#0b0e14] transition"
              >
                Go to Launch
              </a>
              <a
                href="/pot"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:text-zinc-100 transition"
              >
                Holder Rewards (PøT)
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Discover Relics"
            text="Each relic represents a token you’ve held through time—measured block by block, proving you stayed the course."
          />
          <FeatureCard
            title="Track Your Journey"
            text="View your altar to see how long your relics have endured and which streaks remain unbroken."
          />
          <FeatureCard
            title="Celebrate Patience"
            text="Show off your will to hold on—not through hype or minting, but straight from the chain."
          />
        </div>
      </section>

      {/* ---------- Legend + Note ---------- */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <RelicLegend />
        <p className="mt-10 text-sm text-zinc-500 max-w-3xl">
          Note: Proof of Time currently evaluates ERC-20 holdings on Base. LP positions and
          staked assets are not yet included in relic calculations.
        </p>
      </section>

      {/* ---------- Footer ---------- */}
      <Footer />
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
      <h3 className="font-semibold text-[#BBA46A]">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{text}</p>
    </div>
  );
}
