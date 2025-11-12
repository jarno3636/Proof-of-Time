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

// 👇 Enforce a single, first valid embed (the image)
function normEmbeds(embeds?: string | string[]): string[] {
  if (!embeds) return [];
  const list = Array.isArray(embeds) ? embeds : [embeds];
  const one = list.map((e) => safeUrl(e)).filter(Boolean).slice(0, 1); // <= only one
  return one as string[];
}

/* ---------- Warpcast web composer URL (single embed) ---------- */
export function buildWarpcastCompose({
  text = "",
  embeds = [],
}: {
  text?: string;
  embeds?: string[];
}) {
  const wcText = (text || "").trim();
  const embedList = normEmbeds(embeds);

  const base = "https://warpcast.com/~/compose";
  const params = new URLSearchParams();
  if (wcText) params.set("text", wcText);
  for (const e of embedList) params.append("embeds[]", e);
  return `${base}?${params.toString()}`;
}

/* ---------- Main: SDK inside Warpcast; robust fallbacks (single embed) ---------- */
export async function shareOrCast({
  text = "",
  embeds = [],
}: {
  text?: string;
  embeds?: string[];
}) {
  const fullText = (text || "").trim();
  const embedList = normEmbeds(embeds); // <= single image only

  if (isInFarcasterEnv()) {
    // 1) Try MiniKit compose
    try {
      const ok = await (composeCast as unknown as (args: { text?: string; embeds?: string[] }) => Promise<boolean>)(
        { text: fullText, embeds: embedList }
      );
      if (ok) return true;
    } catch {
      /* continue */
    }

    // 2) If SDK present, open web composer inside the app
    try {
      const mod: any = await import("@farcaster/miniapp-sdk").catch(() => null);
      const sdk: any = mod?.sdk ?? mod?.default ?? null;
      if (sdk?.actions?.openUrl || sdk?.actions?.openURL) {
        const href = buildWarpcastCompose({ text: fullText, embeds: embedList });
        try {
          await Promise.resolve(sdk.actions.openUrl?.(href));
        } catch {
          await Promise.resolve(sdk.actions.openURL?.(href));
        }
        return true;
      }
    } catch {
      /* continue */
    }

    // 3) Final in-app fallback
    try {
      const href = buildWarpcastCompose({ text: fullText, embeds: embedList });
      const w = window.open(href, "_top", "noopener,noreferrer");
      if (!w) window.location.href = href;
      return true;
    } catch {
      return false;
    }
  }

  // Outside Warpcast: open web composer (single embed)
  try {
    const href = buildWarpcastCompose({ text: fullText, embeds: embedList });
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = href;
    return true;
  } catch {
    try {
      const href = buildWarpcastCompose({ text: fullText, embeds: embedList });
      window.location.href = href;
      return true;
    } catch {
      return false;
    }
  }
}
