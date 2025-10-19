// app/share/page.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function originFromHeaders(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = (h.get("x-forwarded-proto") || "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

// Build absolute URL for the OG image using incoming search params
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || originFromHeaders();

  // Reuse incoming query params for the OG image
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") qp.set(k, v);
  }
  const imageUrl = `${origin.replace(/\/$/, "")}/share/opengraph-image?${qp.toString()}`;

  const title = (searchParams.title as string) || "Relics Revealed";
  const description = "Time > hype — #ProofOfTime";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function SharePage() {
  return (
    <div style={{ padding: 24, color: "white", background: "#0b0b10", minHeight: "100vh" }}>
      <p>Sharing your Proof of Time…</p>
      <p>This page contains Open Graph tags for Warpcast/X.</p>
    </div>
  );
}
