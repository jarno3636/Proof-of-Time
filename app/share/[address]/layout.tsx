// app/share/[address]/layout.tsx (optional but nice)
export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: any) {
  const addr = (params.address || "").toLowerCase();
  const pick = (searchParams?.pick || "").toString();
  const title = pick ? `Relics: ${pick}` : `Relics for ${addr.slice(0,6)}…${addr.slice(-4)}`;
  const description = "Time > hype. #ProofOfTime";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      // Next will auto-wire opengraph-image.tsx; you don't need to set images here.
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
