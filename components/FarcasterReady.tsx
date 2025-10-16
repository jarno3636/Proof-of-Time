// components/FarcasterReady.tsx
"use client";
import { useEffect } from "react";

export default function FarcasterReady() {
  useEffect(() => {
    let done = false;
    const tryReady = () => {
      try {
        (window as any)?.farcaster?.actions?.ready?.();
        done = !!(window as any)?.farcaster?.actions;
      } catch {}
    };

    // First shot, then poll for a few seconds in case the bridge injects late
    tryReady();
    const iv = setInterval(() => {
      if (done) return clearInterval(iv);
      tryReady();
    }, 200);

    // Stop after ~8s
    const timeout = setTimeout(() => clearInterval(iv), 8000);

    return () => {
      clearInterval(iv);
      clearTimeout(timeout);
    };
  }, []);

  return null;
}
