// components/AppReady.tsx
'use client'
import { useEffect } from 'react'

export default function AppReady() {
  useEffect(() => {
    (async () => {
      try {
        const mod = await import('@farcaster/miniapp-sdk')
        // Let Farcaster know the UI is ready; avoids odd redirects/openURL issues.
        await mod.sdk.actions.ready()
      } catch {
        // Not in a Mini App or SDK not available — safe to ignore.
      }
    })()
  }, [])
  return null
}
