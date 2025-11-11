import { composeCast } from "./miniapp";

/* ---------- Config ---------- */
const FARCASTER_MINIAPP_LINK =
  process.env.NEXT_PUBLIC_FC_MINIAPP_LINK ||
  "https://farcaster.xyz/miniapps/-_2261xu85R_/proof-of-time";

/* ---------- URL + env helpers ---------- */
function siteOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "http://localhost:3000";
}

function safeUrl(input?: string | URL | null): string {
  if (!input) return "";
  try {
    const s = String(input);
    if (/^https?:\/\//i.test(s)) return new URL(s).toString();
    return new URL(s, siteOrigin()).toString();
  } catch {
    return "";
  }
}

function isWarpcastUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent || "");
}

function looksLikeMiniPath(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const p = window.location?.pathname || "";
    const q = window.location?.search || "";
    return p.startsWith("/mini") || /(?:\?|&)fcframe=|(?:\?|&)frame=/.test(q);
  } catch {
    return false;
  }
}

export function isInFarcasterEnv(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const hasGlobal =
      !!(window as any).farcaster ||
      !!(window as any).Farcaster?.mini ||
      !!(window as any).Farcaster?.mini?.sdk;
    const inIframe = window.self !== window.top;
    return hasGlobal || isWarpcastUA() || looksLikeMiniPath() || inIframe;
  } catch {
    return false;
  }
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

function normEmbeds(embeds?: string | string[]): string[] {
  if (!embeds) return [];
  const list = Array.isArray(embeds) ? embeds : [embeds];
  return list.map((e) => safeUrl(e)).filter(Boolean) as string[];
}

/* ---------- Prefer mini link in Warpcast (path rewrite), not injected into text ---------- */
export function preferMiniUrlIfPossible(webUrl: string, { forceMini = false } = {}) {
  const canonical = safeUrl(webUrl);
  if (!canonical) return "";

  if (/^warpcast:|^farcaster:/i.test(canonical)) return canonical;
  if (/^https:\/\/warpcast\.com\/~\/compose/i.test(canonical)) return canonical;

  const inWarpcast = isInFarcasterEnv() || forceMini;
  const MINI_BASE = process.env.NEXT_PUBLIC_FC_MINIAPP_URL || FARCASTER_MINIAPP_LINK;

  if (!MINI_BASE || !inWarpcast) return canonical;
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

/* ---------- Warpcast web composer URL (do NOT inject URL into text) ---------- */
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
  const wcText = (text || "").trim();
  const embedList = normEmbeds(embeds);

  const base = "https://warpcast.com/~/compose";
  const params = new URLSearchParams();
  if (wcText) params.set("text", wcText);
  for (const e of embedList) params.append("embeds[]", e);
  // If you ever want to include your mini link as a second embed:
  // if (forceMini && process.env.NEXT_PUBLIC_FC_MINIAPP_URL) {
  //   params.append("embeds[]", process.env.NEXT_PUBLIC_FC_MINIAPP_URL);
  // }
  return `${base}?${params.toString()}`;
}

/* ---------- Main: SDK inside Warpcast; web composer elsewhere ---------- */
export async function shareOrCast({
  text = "",
  embeds = [],
  url = "",
  forceMini = false,
}: {
  text?: string;
  embeds?: string[];
  url?: string;       // kept for future use; NOT injected into text
  forceMini?: boolean;
}) {
  const fullText = (text || "").trim();
  const embedList = normEmbeds(embeds);

  if (isInFarcasterEnv()) {
    // Inside Warpcast: use SDK only; text must already include any fallback URL
    const typedComposeCast = composeCast as unknown as (args: {
      text?: string;
      embeds?: string[];
    }) => Promise<boolean>;
    const ok = await typedComposeCast({ text: fullText, embeds: embedList });
    return !!ok;
  }

  // Outside Warpcast: open web composer
  const href = buildWarpcastCompose({ text: fullText, url, embeds: embedList, forceMini });
  try {
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
    return true;
  } catch {
    try {
      window.location.href = href;
      return true;
    } catch {
      return false;
    }
  }
}
