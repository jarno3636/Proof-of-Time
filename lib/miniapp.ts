// lib/miniapp.ts

/** Minimal types for the SDKs (tolerant to older builds) */
type MiniAppSdk = {
  actions?: {
    openUrl?: (url: string | { url: string }) => Promise<void> | void;
    openURL?: (url: string) => Promise<void> | void; // legacy
    composeCast?: (args: { text?: string; embeds?: string[] }) => Promise<void> | void;
    share?: (args: { text?: string; embeds?: string[] }) => Promise<void> | void; // frame-sdk
    ready?: () => Promise<void> | void;
  };
};

export function siteOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://proofoftime.vercel.app";
}

export function safeUrl(u = ""): string {
  try {
    return new URL(String(u || ""), siteOrigin()).toString();
  } catch {
    return "";
  }
}

/** Load @farcaster/miniapp-sdk (Warpcast Mini App SDK) */
export async function getMiniSdk(): Promise<MiniAppSdk | null> {
  try {
    const mod: any = await import("@farcaster/miniapp-sdk");
    return (mod?.sdk || mod?.default || null) as MiniAppSdk | null;
  } catch {
    return null;
  }
}

/** Load @farcaster/frame-sdk (some clients inject this first) */
export async function getFrameSdk(): Promise<MiniAppSdk | null> {
  try {
    const mod: any = await import("@farcaster/frame-sdk");
    return (mod?.sdk || mod?.default || null) as MiniAppSdk | null;
  } catch {
    return null;
  }
}

/** Are we in the mini app? (best-effort) */
export async function isMiniApp(): Promise<boolean> {
  const mini = await getMiniSdk();
  const frame = await getFrameSdk();
  return Boolean(mini || frame);
}

/**
 * Try to open a URL *inside* the Farcaster mini app. Falls back to same-tab.
 * We do NOT rewrite the URL here; pass in a final absolute URL.
 */
export async function openInMini(url: string): Promise<boolean> {
  if (!url) return false;
  const safe = safeUrl(url);
  if (!safe) return false;

  // Try frame-sdk then miniapp-sdk (both expose openUrl/openURL variants)
  const frame = await getFrameSdk();
  if (frame?.actions?.openUrl) {
    try {
      await (frame.actions.openUrl as any)(safe);
      return true;
    } catch {}
  }
  if (frame?.actions?.openURL) {
    try {
      await frame.actions.openURL(safe);
      return true;
    } catch {}
  }

  const mini = await getMiniSdk();
  if (mini?.actions?.openUrl) {
    try {
      await (mini.actions.openUrl as any)(safe);
      return true;
    } catch {}
  }
  if (mini?.actions?.openURL) {
    try {
      await mini.actions.openURL(safe);
      return true;
    } catch {}
  }

  // Fallback to same-tab navigation
  if (typeof window !== "undefined") {
    try {
      window.location.assign(safe);
      return true;
    } catch {}
    try {
      window.open(safe, "_self", "noopener,noreferrer");
      return true;
    } catch {}
  }
  return false;
}

/**
 * Compose a cast in-app when possible.
 * - First try frame-sdk share/compose
 * - Then miniapp-sdk composeCast
 * Return true if handled in-app, false to let caller fallback (web composer).
 */
export async function composeCast({
  text = "",
  embeds = [],
}: {
  text?: string;
  embeds?: string[];
} = {}): Promise<boolean> {
  // Normalize embeds to absolute http(s)
  const normEmbeds = (embeds || [])
    .map((e) => safeUrl(e))
    .filter(Boolean)
    .filter((u) => /^https?:\/\//i.test(u));

  // Frame SDK (some clients expose share() or openUrl())
  const frame = await getFrameSdk();
  if (frame?.actions?.share) {
    try {
      await frame.actions.share({ text, embeds: normEmbeds });
      return true;
    } catch {}
  }
  if (frame?.actions?.composeCast) {
    try {
      await frame.actions.composeCast({ text, embeds: normEmbeds });
      return true;
    } catch {}
  }

  // Mini App SDK (official)
  const mini = await getMiniSdk();
  if (mini?.actions?.composeCast) {
    try {
      await mini.actions.composeCast({ text, embeds: normEmbeds });
      return true;
    } catch {}
  }

  return false;
}
