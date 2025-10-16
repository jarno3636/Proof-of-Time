// app/card/[address]/page.tsx
import type { Metadata } from "next";

type Props = { params: { address: string } };

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` ||
    "http://localhost:3000"
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = siteUrl();
  const address = params.address;
  const img = `${site}/api/card/${address}`;
  const title = "Proof of Time — Altar";

  return {
    title,
    description: "Your longest-held tokens on Base.",
    openGraph: {
      title,
      description: "Your longest-held tokens on Base.",
      images: [{ url: img, width: 1200, height: 630, alt: "Proof of Time" }],
      url: `${site}/card/${address}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      images: [img],
    },
  };
}

export default function Page() {
  // Simple, fast page — OG is what matters for embeds
  return (
    <main className="min-h-[60vh] grid place-items-center bg-[#0b0e14] text-zinc-200">
      <p className="opacity-70 text-sm">Loading altar…</p>
    </main>
  );
}
