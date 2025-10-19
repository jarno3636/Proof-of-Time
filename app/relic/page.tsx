"use client";

import { useAccount } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";

function isHexAddress(s: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export default function RelicLanding() {
  const router = useRouter();
  const { address } = useAccount();

  // Auto-redirect if connected
  useEffect(() => {
    if (address) router.replace(`/relic/${address}`);
  }, [address, router]);

  // Minimal address entry (only shown when NOT connected)
  const [addr, setAddr] = useState("");
  const valid = useMemo(() => isHexAddress(addr), [addr]);

  const go = () => {
    if (!valid) return;
    router.push(`/relic/${addr.toLowerCase()}`);
  };

  return (
    <>
      <Nav />

      <main className="mx-auto max-w-5xl px-4 py-12 text-[#EDEEF2]">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Reveal your relics
        </h1>
        <p className="mt-2 text-zinc-400">
          Connect your wallet (top right) to jump in — or paste any Base address to view its altar.
        </p>

        {!address && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <label htmlFor="addr" className="text-xs text-zinc-400">
              View any altar by address (0x…)
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="addr"
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
                placeholder="0xabc…"
                className="flex-1 rounded-xl bg-zinc-900/60 border border-white/10 px-4 py-3 outline-none focus:border-[#BBA46A] transition"
              />
              <button
                onClick={go}
                disabled={!valid}
                className="rounded-2xl bg-[#BBA46A] hover:bg-[#d6c289] px-5 py-3 font-semibold text-[#0b0e14] transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reveal altar by address"
              >
                Reveal
              </button>
            </div>
            {!valid && addr.trim().length > 0 && (
              <div className="mt-2 text-xs text-red-300">Enter a valid 0x address</div>
            )}

            <p className="mt-3 text-[11px] text-zinc-400">
              Tip: Use the wallet connect button to verify instantly.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
