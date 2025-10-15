import RelicAltar from "@/components/RelicAltar";

async function getTop3(address: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/relic/${address}`, { cache: "no-store" });
  return res.json();
}

export default async function Page({ params }: { params: { address: string } }) {
  const data = await getTop3(params.address);
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Your Relic Altar</h1>
      <p className="opacity-70 mt-1">Longest-held tokens on Base.</p>
      <div className="mt-6">
        <RelicAltar items={data.tokens ?? []} />
      </div>
    </main>
  );
}
