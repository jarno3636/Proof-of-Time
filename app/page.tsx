import Nav from "@/components/Nav";

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
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
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
            title="Celebrate Endurance"
            text="Show off your will to hold on — not through hype or minting, but by proving your commitment directly from the chain."
          />
        </div>

        <p className="mt-12 text-sm text-zinc-500 max-w-3xl">
          Note: Proof of Time currently evaluates ERC-20 holdings on Base. LP positions and
          staked assets are not yet included in relic calculations.
        </p>
      </section>
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{text}</p>
    </div>
  );
}
