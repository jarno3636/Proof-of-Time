// app/relic-card/page.tsx
import type { Metadata } from "next";

type Props = { searchParams?: Record<string, string | string[] | undefined> };

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    "http://localhost:3000"
  );
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const site = siteUrl();
  const sp = new URLSearchParams();

  for (const [k, v] of Object.entries(searchParams || {})) {
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)));
    else if (v != null) sp.set(k, String(v));
  }

  const img = `${site}/api/relic-card?${sp.toString()}`;
  const sym = searchParams?.symbol ? `$${searchParams.symbol}` : "Relic";
  const title = `Proof of Time — ${sym}`;

  return {
    title,
    description: "Relic forged by time.",
    openGraph: {
      title,
      description: "Relic forged by time.",
      images: [{ url: img, width: 1200, height: 630, alt: "Relic" }],
      url: `${site}/relic-card?${sp.toString()}`,
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
  return (
    <main className="min-h-[60vh] grid place-items-center bg-[#0b0e14] text-zinc-200">
      <p className="opacity-70 text-sm">Loading relic…</p>
    </main>
  );
}
