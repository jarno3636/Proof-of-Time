"use client";

import { useState } from "react";

function isHexAddress(s: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

export default function ComputeForm() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const addr = address.trim();

    if (!isHexAddress(addr)) {
      setMsg("Enter a valid Base address (0x…40 hex).");
      return;
    }

    setMsg(`⏳ Computing for ${addr.slice(0, 10)}…`);
    setLoading(true);

    try {
      const res = await fetch("/api/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setMsg("✅ Done! Redirecting to your Relic Altar…");
      // jump to /relic/[address]
      window.location.assign(`/relic/${addr}`);
    } catch (err: any) {
      setMsg(`❌ Request error: ${err?.message || "unknown"}`);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-2xl space-y-3">
      <div className="flex gap-3">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter a Base wallet address (0x...)"
          className="flex-1 rounded-xl bg-zinc-900/60 border border-zinc-800 px-4 py-3 text-sm outline-none focus:ring-2 ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-4 py-3 text-sm font-medium"
        >
          {loading ? "Computing…" : "Compute"}
        </button>
      </div>

      {msg && (
        <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 px-3 py-2 text-xs text-zinc-300">
          {msg}
        </div>
      )}
    </form>
  );
}
