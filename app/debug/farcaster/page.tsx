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
      setLast(ok ? "SDK compose succeeded 🎉" : "SDK compose did not fire ❌");
    } catch (e: any) {
      setLast("Error: " + (e?.message || String(e)));
    }
  }

  return (
    <div className="mx-auto max-w-xl p-4 space-y-4">
      <h1 className="text-xl font-semibold">Farcaster Debug</h1>
      <pre className="text-xs whitespace-pre-wrap rounded bg-black/30 p-3">
        {JSON.stringify(probe, null, 2)}
      </pre>
      <button
        onClick={testCompose}
        className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
      >
        Test composeCast()
      </button>
      {last && <div className="text-sm">{last}</div>}
      <p className="text-xs opacity-70">
        Open this page **inside Warpcast** to verify SDK availability.
      </p>
    </div>
  );
}
