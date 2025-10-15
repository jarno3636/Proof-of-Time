"use client";
import { useState } from "react";

export default function TestPage() {
  const [address, setAddress] = useState("");

  async function run() {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      alert("Enter a valid 0x address");
      return;
    }
    const res = await fetch("/api/compute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(`Compute failed: ${j.error || res.statusText}`);
      return;
    }
    // Go view your relics
    window.location.href = `/relic/${address}`;
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-bold">Compute Relics</h1>
      <p className="opacity-70 mt-1">Enter any Base wallet address to compute & view relics.</p>
      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 px-3 py-2 rounded-lg bg-white/10 outline-none"
          placeholder="0x…"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button onClick={run} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">
          Compute
        </button>
      </div>
    </main>
  );
}
