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
          Proof of Time finds your longest-held tokens on Base and turns them into
          <em className="not-italic"> relics</em>—proud badges of on-chain patience.
        </p>

        <div className="mt-8">
          {/* WalletConnect sits in the Nav. No extra form here. */}
          <p className="text-sm text-zinc-400">
            Farcaster-friendly: share cards & stats directly from your altar.
            Neynar integration is built-in for easy casts.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard title="Discover Relics" text="We reconstruct holding streaks from on-chain transfers, then rank tokens by uninterrupted time held." />
          <FeatureCard title="Zero Minting" text="Nothing to mint or stake here—just pure on-chain history, measured and displayed." />
          <FeatureCard title="Share Anywhere" text="Post your altar to Farcaster or X with dynamic images and copy. Flex your hold streaks." />
        </div>
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
