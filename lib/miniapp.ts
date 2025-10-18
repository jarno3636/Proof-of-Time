// lib/miniapp.ts
export async function getMiniSdk() {
  try {
    const mod = await import('@farcaster/miniapp-sdk')
    return mod?.sdk || null
  } catch {
    return null
  }
}

export async function isMiniApp() {
  return !!(await getMiniSdk())
}

/**
 * Try to open a URL *inside* the Farcaster mini app. Falls back to same-tab.
 */
export async function openInMini(url) {
  if (!url) return false
  const safe = new URL(
    String(url),
    (typeof window !== 'undefined' && window.location?.origin) || 'https://madfill.vercel.app'
  ).toString()

  const sdk = await getMiniSdk()
  if (sdk?.actions?.openURL) {
    try {
      await sdk.actions.openURL(safe)
      return true
    } catch {/* fall through */}
  }

  if (typeof window !== 'undefined') {
    try { window.location.assign(safe); return true } catch {/* ignore */}
    try { window.open(safe, '_self', 'noopener,noreferrer'); return true } catch {/* ignore */}
  }
  return false
}

/**
 * If Warpcast adds a compose API in the SDK, try it first.
 * For now we still build a compose URL and openInMini().
 */
export async function composeCast({ text = '', embeds = [] } = {}) {
  const sdk = await getMiniSdk()
  if (sdk?.actions?.composeCast) {
    try {
      await sdk.actions.composeCast({ text, embeds })
      return true
    } catch {/* fall back */}
  }
  // fallback handled by caller (use openInMini with compose URL)
  return false
}

