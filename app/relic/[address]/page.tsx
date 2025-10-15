import RelicAltar from "@/components/RelicAltar";
import { headers } from "next/headers";

async function getTop3(address: string) {
  try {
    // Build a safe absolute origin that works in Prod/Preview
    const hdrs = headers();
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
    const proto = (hdrs.get("x-forwarded-proto") || "https").split(",")[0].trim();
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;

    const res = await fetch(`${origin}/api/relic/${address}`, { cache: "no-store" });
    if (!res.ok) {
      return { error: `relic api failed: ${res.status} ${res.statusText}`, tokens: [] as any[] };
    }
    return res.json();
  } catch (e: any) {
    return { error: e?.message || "Unknown relic fetch error", tokens: [] as any[] };
  }
}

export default async function Page({ params }: { params: { address: string } }) {
  const data = await getTop3(params.address);

  if ((data as any).error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-extrabold">Your Relic Altar</h1>
        <p className="mt-2 text-red-400">Error loading relics: {(data as any).error}</p>
        <p className="opacity-70 mt-2">
          Try running <a className="underline" href="/test">/test</a> to compute first, then refresh.
        </p>
        <p className="opacity-70 mt-2">
          You can also open <code className="bg-white/10 px-1 rounded">/api/relic/{params.address}</code> directly to see raw JSON.
        </p>
      </main>
    );
  }

  const items = (data as any).tokens ?? [];
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Your Relic Altar</h1>
      <p className="opacity-70 mt-1">Longest-held tokens on Base.</p>
      <div className="mt-6">
        <RelicAltar items={items} />
      </div>
    </main>
  );
}
