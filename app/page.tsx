import Nav from "@/components/Nav";
import dynamic from "next/dynamic";
import type { Metadata } from "next";
import RevealRelicsButton from "@/components/RevealRelicsButton"; // ⬅️ new client button

const HomeShareBar = dynamic(() => import("@/components/HomeShareBar"), { ssr: false });
const RelicLegend  = dynamic(() => import("@/components/RelicLegend"),  { ssr: false });

/* ---------- Stable absolute site URL (server-safe) ---------- */
function getSiteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env; // e.g. https://proof-of-time.xyz
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
  return (
    <main className="min-h-screen bg-[#0b0e14] text-zinc-100">
      <Nav />

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-20">
        <h1 className="text-5xl md:text-6xl font-black tracking-tight">
          Claim your<span className="text-zinc-400"> time on chain.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-400">
          Proof of Time reveals your longest-held tokens on Base — turning
          consistent holders into living records of patience, loyalty, and belief.
        </p>

        {/* Share the app CTA */}
        <HomeShareBar />

        {/* Gold “Reveal your relics” button (now under the share section) */}
        <div className="mt-5">
          <RevealRelicsButton />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Discover Relics"
            text="Each relic represents a token you’ve held through time — measured block by block, proof that you stayed the course."
          />
          <FeatureCard
            title="Track Your Journey"
            text="View your altar to see how long your relics have endured and what streaks continue unbroken."
          />
          <FeatureCard
            title="Celebrate Patience"
            text="Show off your will to hold on — not through hype or minting, but by proving your commitment directly from the chain."
          />
        </div>
      </section>

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
