// components/AppReady.tsx
'use client';

import { useEffect } from 'react';

export default function AppReady() {
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      // 1) try SDK (dynamically, so build never breaks)
      try {
        const mod = await import('@farcaster/miniapp-sdk');
        const sdk: any = (mod as any).sdk ?? (mod as any).default;
        // race with small timeout so we don't hang the UI
        await Promise.race([
          Promise.resolve(sdk?.actions?.ready?.()),
          new Promise((r) => setTimeout(r, 900)),
        ]);
      } catch {
        // ignore — not in Warpcast or SDK not injected
      }

      // 2) also ping the global just in case
      const ping = () => {
        try { (window as any)?.farcaster?.actions?.ready?.(); } catch {}
        try { (window as any)?.farcaster?.miniapp?.sdk?.actions?.ready?.(); } catch {}
      };
      ping();

      // 3) retry briefly to catch late injection
      iv = setInterval(ping, 200);
      timeout = setTimeout(() => iv && clearInterval(iv), 6000);
    })();

    return () => {
      if (iv) clearInterval(iv);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return null;
}
