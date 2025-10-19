"use client";

import { useAccount } from "wagmi";
import { useEffect, useMemo, useState, useCallback } from "react";
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

  // Address entry (shown only when NOT connected)
  const [addr, setAddr] = useState("");
  const trimmed = useMemo(() => addr.trim(), [addr]);
  const valid = useMemo(() => isHexAddress(trimmed), [trimmed]);

  const go = useCallback(() => {
    if (!valid) return;
    router.push(`/relic/${trimmed.toLowerCase()}`);
  }, [router, valid, trimmed]);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      go();
    },
    [go]
  );

  return (
    <>
      <Nav />

      <main className="mx-auto max-w-5xl px-4 py-12 text-[#EDEEF2]">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Reveal your relics
        </h1>
        <p className="mt-2 text-zinc-400 max-w-2xl">
          Connect your wallet (top right) to jump in — or paste any Base address to view its altar.
        </p>

        {!address && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                  <label htmlFor="addr" className="text-xs text-zinc-400">
                    View any altar by address (0x…)
                  </label>
                  <input
                    id="addr"
                    value={addr}
                    onChange={(e) => setAddr(e.target.value)}
                    placeholder="0xabc…"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="mt-1 w-full rounded-xl bg-zinc-900/60 border border-white/10 px-4 py-3 outline-none focus:border-[#BBA46A] transition"
                  />
                  {!valid && trimmed.length > 0 && (
                    <div className="mt-1 text-xs text-red-300">
                      Enter a valid 0x address
                    </div>
                  )}
                </div>

                <div className="sm:pt-6">
                  <button
                    type="submit"
                    disabled={!valid}
                    className="w-full sm:w-auto rounded-2xl bg-[#BBA46A] hover:bg-[#d6c289] px-5 py-3 font-semibold text-[#0b0e14] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Reveal altar by address"
                    aria-disabled={!valid}
                  >
                    Reveal
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400">
                Tip: Use the wallet connect button to verify instantly.
              </p>
            </form>
          </section>
        )}
      </main>
    </>
  );
}
