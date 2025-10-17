// components/MiniAppBoot.tsx
'use client';

import { useEffect } from 'react';
import useMiniAppReady from '@/hooks/useMiniAppReady';
import { ensureReady } from '@/lib/miniapp';

export default function MiniAppBoot() {
  const { isReady, isInFarcaster } = useMiniAppReady(1200);

  // Optional: call ensureReady once more after hook resolves, harmless if SDK isn’t present.
  useEffect(() => {
    if (isReady && isInFarcaster) {
      ensureReady().catch(() => {});
    }
  }, [isReady, isInFarcaster]);

  return null; // no UI; just primes the environment
}
