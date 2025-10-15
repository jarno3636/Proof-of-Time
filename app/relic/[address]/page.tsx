import RelicAltar from "@/components/RelicAltar";

async function getTop3(address: string) {
  // Use a RELATIVE URL so it works in any env (preview/prod/local)
  const res = await fetch(`/api/relic/${address}`, { cache: "no-store" });
  if (!res.ok) {
    // Return a shaped error the page can render instead of crashing
    return { error: `relic api failed: ${res.status} ${res.statusText}`, tokens: [] };
  }
  return res.json();
}

export default async function Page({ params }: { params: { address: string } }) {
  const data = await getTop3(params.address);

  if ((data as any).error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-extrabold">Your Relic Altar</h1>
        <p className="mt-2 text-red-400">Error loading relics: {(data as any).error}</p>
        <p className="opacity-70 mt-2">Visit <code className="bg-white/10 px-1 rounded">/test</code> and run Compute first.</p>
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
