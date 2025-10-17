"use client";
import { useEffect } from "react";
import { ensureReady } from "@/lib/miniapp";

export default function FarcasterMiniBridge() {
  useEffect(() => {
    // try Farcaster SDK
    ensureReady();
    // tiny fallback if SDK isn’t present but window.farcaster is
    try { (window as any)?.farcaster?.actions?.ready?.(); } catch {}
  }, []);
  return null;
}
