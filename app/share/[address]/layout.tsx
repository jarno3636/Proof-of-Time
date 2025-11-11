// app/share/[address]/layout.tsx
export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: any) {
  const origin =
    (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || "").replace(/\/$/, "") ||
    "https://proofoftime.vercel.app";

  const addr = (params?.address || "").toLowerCase();
  const selected = (searchParams?.selected || searchParams?.pick || "") as string;
  const selTxt = String(selected || "").trim();

  const title = selTxt
    ? `Relics: ${selTxt}`
    : `Relics for ${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const description = "Time > hype. #ProofOfTime";

  // Absolute OG image URL (so crawlers fetch from edge)
  const ogUrl = new URL(`${origin}/share/${addr}/opengraph-image`);
  if (selTxt) ogUrl.searchParams.set("selected", selTxt);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: ogUrl.toString(), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl.toString()],
    },
  };
}

/** ✅ Required default layout component */
export default function ShareAddressLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No extra wrappers needed—just pass through
  return <>{children}</>;
}
