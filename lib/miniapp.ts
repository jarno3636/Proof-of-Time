// lib/miniapp.ts

// Internal lightweight type to satisfy TS; not exported
type MiniSdk = {
  actions?: {
    openURL?: (url: string) => Promise<void> | void;
    composeCast?: (args: { text?: string; embeds?: unknown[] }) => Promise<void> | void;
  };
};

export async function getMiniSdk(): Promise<MiniSdk | null> {
  try {
    const mod: any = await import("@farcaster/miniapp-sdk");
    return (mod?.sdk as MiniSdk) || null;
  } catch {
    return null;
  }
}

export async function isMiniApp(): Promise<boolean> {
  return !!(await getMiniSdk());
}

/**
 * Try to open a URL *inside* the Farcaster mini app. Falls back to same-tab.
 */
export async function openInMini(url: string | URL): Promise<boolean> {
  if (!url) return false;
  const safe = new URL(
    String(url),
    (typeof window !== "undefined" && window.location?.origin) || "https://madfill.vercel.app"
  ).toString();

  const sdk = await getMiniSdk();
  if (sdk?.actions?.openURL) {
    try {
      await sdk.actions.openURL(safe);
      return true;
    } catch {
      /* fall through */
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.location.assign(safe);
      return true;
    } catch {
      /* ignore */
    }
    try {
      window.open(safe, "_self", "noopener,noreferrer");
      return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/**
 * If Warpcast adds a compose API in the SDK, try it first.
 * For now we still build a compose URL and openInMini().
 */
export async function composeCast(
  { text = "", embeds = [] }: { text?: string; embeds?: string[] } = {}
): Promise<boolean> {
  const sdk = await getMiniSdk();
  if (sdk?.actions?.composeCast) {
    try {
      // Accepts unknown[] in MiniSdk typing; string[] is fine to pass
      await sdk.actions.composeCast({ text, embeds });
      return true;
    } catch {
      /* fall back */
    }
  }
  // fallback handled by caller (use openInMini with compose URL)
  return false;
}
