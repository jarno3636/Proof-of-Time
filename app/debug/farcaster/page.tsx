"use client";
import { useEffect, useState } from "react";
import { probeFarcaster } from "@/lib/farcasterDebug";
import { composeCast } from "@/lib/miniapp";

export default function FcDebugPage() {
  const [probe, setProbe] = useState<any>(null);
  const [last, setLast] = useState<string>("");

  useEffect(() => {
    setProbe(probeFarcaster());
  }, []);

  async function testCompose() {
    setLast("Testing…");
    try {
      const ok = await composeCast({
        text: "Test from /debug/farcaster ✅",
        embeds: [],
      });
      setLast(ok ? "SDK compose SUCCEEDED 🎉" : "SDK compose did NOT fire ❌");
    } catch (e: any) {
      setLast("Error: " + (e?.message || String(e)));
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Farcaster Debug</h1>

      <pre className="text-xs whitespace-pre-wrap rounded bg-black/30 p-3">
        {JSON.stringify(probe, null, 2)}
      </pre>

      <div className="text-xs opacity-80 rounded bg-black/20 p-3">
        <div className="font-mono">
          {(probe?.globalsSnapshot || []).map((line: string, i: number) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>

      <button
        onClick={testCompose}
        className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
      >
        Test composeCast()
      </button>

      {last && (
        <div className={`text-sm ${/SUCCEEDED/.test(last) ? "text-emerald-400" : "text-rose-400"}`}>
          {last}
        </div>
      )}

      <p className="text-xs opacity-70">
        Open this page <strong>inside Warpcast</strong> to verify SDK availability.
      </p>
    </div>
  );
}
