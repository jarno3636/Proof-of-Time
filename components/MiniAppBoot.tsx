// components/MiniAppBoot.tsx
'use client';

import { useEffect } from 'react';

export default function MiniAppBoot() {
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | undefined;
    let to: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      // 1) Try official SDK (loaded dynamically so SSR/build never break)
      try {
        const mod: any = await import('@farcaster/miniapp-sdk');
        const sdk = mod?.sdk ?? mod?.default;
        if (sdk?.actions?.ready) {
          await Promise.race([
            Promise.resolve(sdk.actions.ready()),
            new Promise((r) => setTimeout(r, 900)),
          ]);
        }
      } catch {}

      // 2) Also ping the global just in case SDK object is injected later
      const ping = () => {
        try { (window as any)?.farcaster?.actions?.ready?.(); } catch {}
        try { (window as any)?.farcaster?.miniapp?.sdk?.actions?.ready?.(); } catch {}
      };
      ping();

      // 3) Retry briefly to catch late injection
      iv = setInterval(ping, 200);
      to = setTimeout(() => iv && clearInterval(iv), 6000);
    })();

    return () => {
      if (iv) clearInterval(iv);
      if (to) clearTimeout(to);
    };
  }, []);

  return null;
}
