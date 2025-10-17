// lib/share.ts
import { composeCast, openInMini, safeUrl, siteOrigin } from "./miniapp";

const FARCASTER_MINIAPP_LINK =
  process.env.NEXT_PUBLIC_FC_MINIAPP_LINK ||
  "https://farcaster.xyz/miniapps/-_2261xu85R_/proof-of-time";

const MINI_BASE =
  process.env.NEXT_PUBLIC_FC_MINIAPP_URL /* optional custom host for mini */ ||
  FARCASTER_MINIAPP_LINK;

/** helpers */
function isWarpcastUA() {
  return typeof navigator !== "undefined" && /Warpcast|FarcasterMini/i.test(navigator.userAgent || "");
}
function isMiniRuntime() {
  return typeof window !== "undefined" && !!(window as any).Farcaster?.mini;
}
function isWarpcastEnv() {
  return isMiniRuntime() || isWarpcastUA();
}
function isSameOrigin(urlA: string, urlB: string) {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    return a.origin === b.origin;
  } catch {
    return false;
  }
}
function normEmbeds(embeds?: string | string[]) {
  if (!embeds) return [] as string[];
  const list = Array.isArray(embeds) ? embeds : [embeds];
  return list
    .map((e) => safeUrl(e))
    .filter(Boolean)
    .filter((u) => /^https?:\/\//i.test(u));
}

/**
 * If we’re inside Warpcast, rewrite same-origin links to the Mini directory link,
 * so opening stays in-app. Otherwise keep canonical web URL.
 */
export function preferMiniUrlIfPossible(webUrl: string, { forceMini = false } = {}) {
  const canonical = safeUrl(webUrl);
  if (!canonical) return "";

  // Don’t rewrite compose/deep links
  if (/^warpcast:|^farcaster:/i.test(canonical)) return canonical;
  if (/^https:\/\/warpcast\.com\/~\/compose/i.test(canonical)) return canonical;

  const inWarpcast = isWarpcastEnv() || forceMini;
  if (!MINI_BASE || !inWarpcast) return canonical;

  // Only rewrite if link is same origin as our site
  if (!isSameOrigin(canonical, siteOrigin())) return canonical;

  try {
    const u = new URL(canonical);
    const mini = new URL(MINI_BASE);

    const normalizedPath = u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`;
    mini.pathname = (mini.pathname.replace(/\/$/, "") + normalizedPath).replace(/\/{2,}/g, "/");
    mini.search = u.search;
    mini.hash = u.hash;
    return mini.toString();
  } catch {
    return canonical;
  }
}

/** Warpcast web composer */
export function buildWarpcastCompose({
  url = "",
  text = "",
  embeds = [],
  forceMini = false,
}: {
  url?: string;
  text?: string;
  embeds?: string[];
  forceMini?: boolean;
}) {
  const shareUrl = preferMiniUrlIfPossible(url, { forceMini }) || url;
  const embedList = normEmbeds(embeds);

  const base = "https://warpcast.com/~/compose";
  const params = new URLSearchParams();
  const wcText = shareUrl && !(text || "").includes(shareUrl) ? `${text} ${shareUrl}`.trim() : (text || "").trim();
  if (wcText) params.set("text", wcText);
  for (const e of embedList) params.append("embeds[]", e);
  return `${base}?${params.toString()}`;
}

/** Open a share window (inside Warpcast uses SDK, else normal) */
export async function openShareWindow(href: string) {
  if (!href) return;
  await openInMini(href); // falls back to same-tab when not in mini
}

/** High-level: try in-app compose first, else web composer */
export async function shareOrCast({
  text = "",
  embeds = [],
  url = "",
  forceMini = false,
}: {
  text?: string;
  embeds?: string[];
  url?: string;
  forceMini?: boolean;
}) {
  // Prefer in-app compose (no download-page trap)
  const fullText =
    url && !String(text).includes(url)
      ? `${text}\n${preferMiniUrlIfPossible(url, { forceMini }) || url}`.trim()
      : (text || "").trim();

  const ok = await composeCast({ text: fullText, embeds: normEmbeds(embeds) });
  if (ok) return true;

  // Fallback: open web composer
  const href = buildWarpcastCompose({ text, url, embeds, forceMini });
  await openShareWindow(href);
  return true;
}
