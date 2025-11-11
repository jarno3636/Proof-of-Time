export const dynamic = "force-dynamic";

/**
 * Add explicit OG/Twitter metadata pointing to our opengraph-image.
 * Farcaster & Twitter will fetch this image when the share page URL is embedded.
 */
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

  // Build absolute OG image URL so crawlers fetch it from edge
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
