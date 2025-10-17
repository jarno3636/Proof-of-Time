// components/FarcasterMiniBridge.tsx
"use client";

import { useEffect } from "react";
import { signalMiniAppReady } from "@/lib/miniapp";

export default function FarcasterMiniBridge() {
  useEffect(() => {
    // signal Warpcast mini app "ready" ASAP so splash doesn't hang
    signalMiniAppReady();
  }, []);
  return null;
}
