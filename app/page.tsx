// app/page.tsx
import Nav from "@/components/Nav";
import dynamic from "next/dynamic";
import type { Metadata } from "next";

/* ---------- Client islands ---------- */
const RevealRelicsButton = dynamic(() => import("@/components/RevealRelicsButton"), { ssr: false });
const HomeCountdown      = dynamic(() => import("@/components/HomeCountdown"), { ssr: false });
const LaunchShare        = dynamic(() => import("@/components/LaunchShare"), { ssr: false });
const RelicLegend        = dynamic(() => import("@/components/RelicLegend"), { ssr: false });

/* ---------- Stable absolute site URL (server-safe) ---------- */
function getSiteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
const site = getSiteUrl();

/* ---------- Metadata ---------- */
export const metadata: Metadata = {
  title: "Proof of Time",
  description: "Your longest-held tokens on Base. Time > hype.",
  openGraph: {
    title: "Proof of Time",
    description: "Your longest-held tokens on Base. Time > hype.",
    url: site,
    siteName: "Proof of Time",
    images: [{ url: `${site}/og.png`, width: 1200, height: 630, alt: "Proof of Time" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Proof of Time",
    description: "Your longest-held tokens on Base. Time > hype.",
    images: [`${site}/og.png`],
  },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": `${site}/og.png`,
    "fc:frame:post_url": `${site}/api/frame`,
    "fc:frame:button:1": "Enter Your Altar",
    "fc:frame:button:1:action": "link",
    "fc:frame:button:1:target": `${site}/`,
  },
};

export default function Home() {
  const hasCountdown = !!process.env.NEXT_PUBLIC_PRESALE_END_UNIX;

  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100">
      <Nav />

      {/* ---------- Hero ---------- */}
      <section
        className="
          mx-auto max-w-6xl px-6
          pt-[max(1.5rem,env(safe-area-inset-top))] md:pt-20
          pb-12 md:pb-16
        "
      >
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

            <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3 justify-center md:justify-start">
              <RevealRelicsButton size="lg" />
              <a
                href="/launch"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:text-zinc-100 transition"
              >
                View Token Launch
              </a>
            </div>
          </div>

          {/* Token Launch card (one countdown only) */}
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-5 sm:p-6">
            <h3 className="text-lg font-semibold">Token Launch</h3>

            <p className="mt-3 text-sm text-zinc-400">
              Fixed-price presale with LP seeding and a 500M holder rewards program.
            </p>

            {hasCountdown && (
              <div className="mt-2 text-xs text-zinc-500">
                Sale ends in{" "}
                <span className="text-[#BBA46A] font-semibold">
                  <HomeCountdown />
                </span>
              </div>
            )}

            {/* Share row (Farcaster + X) */}
            <div className="mt-4">
              <LaunchShare />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
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
                Holder Rewards (PoT)
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
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <RelicLegend />
        <p className="mt-10 text-sm text-zinc-500 max-w-3xl">
          Note: Proof of Time currently evaluates ERC-20 holdings on Base. LP positions and
          staked assets are not yet included in relic calculations.
        </p>
      </section>
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{text}</p>
    </div>
  );
}
