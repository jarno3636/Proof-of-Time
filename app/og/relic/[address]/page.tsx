// app/og/relic/[address]/page.tsx
import type { Metadata } from "next";

type Params = { address: string };
export const dynamic = "force-static";
export const revalidate = 300;

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://proofoftime.vercel.app"
  ).replace(/\/$/, "");
}

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { address } = await params;
  const addr = (address || "").toLowerCase();
  const base = baseUrl();

  const title = addr ? `Relic Altar — ${addr.slice(0,6)}…${addr.slice(-4)}` : "Relic Altar";
  const desc  = "Your longest-held Base tokens. Time > hype.";

  // Generic OG image (you’ll pass precise embeds at share time)
  const img = `${base}/api/relic-og?symbol=RELIC&days=0&tier=Obsidian&v=${Date.now().toString().slice(-6)}`;
  const url = `${base}/og/relic/${addr || "-"}`;

  return {
    title,
    description: desc,
    openGraph: { title, description: desc, url, images: [{ url: img, width: 1200, height: 630 }], type: "article" },
    twitter: { card: "summary_large_image", title, description: desc, images: [img] },
    other: { "twitter:image:alt": title },
  };
}

export default async function Page(
  { params }: { params: Promise<Params> }
) {
  const { address } = await params;
  const addr = (address || "").toLowerCase();

  return (
    <main style={{ padding: 24, color: "white", background: "#0a0b12", minHeight: "60vh" }}>
      <h1>Relic Altar</h1>
      <p>This page exists to provide rich previews on Warpcast/X.</p>
      {addr ? (
        <>
          <p>View altar: <a href={`/relic/${addr}`}>/relic/{addr}</a></p>
          <p>OG image (example): <a href={`/api/relic-og?symbol=RELIC&days=0&tier=Obsidian`}>/api/relic-og…</a></p>
        </>
      ) : null}
    </main>
  );
}
