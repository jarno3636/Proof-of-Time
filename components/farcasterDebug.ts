// lib/farcasterDebug.ts
export type FcProbe = {
  inUA: boolean;
  hasGlobal: boolean;
  hasMiniAppSdk: boolean;
  hasActions: boolean;
  actions: string[];
  errors: string[];
};

export function probeFarcaster(): FcProbe {
  const errors: string[] = [];
  const g = (typeof window !== "undefined" ? (window as any) : {}) || {};
  const inUA =
    typeof navigator !== "undefined" &&
    /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent || "");

  const hasGlobal =
    !!g.farcaster || !!g.sdk || !!(g.farcaster?.miniapp?.sdk) || !!(g.farcaster?.actions);

  const cand =
    g.farcaster?.miniapp?.sdk ||
    g.farcaster?.actions ||
    g.sdk ||
    null;

  const hasMiniAppSdk = !!cand;
  const acts = cand?.actions || {};
  const actions = Object.keys(acts || {}).filter(Boolean);

  // sanity: some builds expose only composeCast OR only share, and openUrl vs openURL
  if (hasMiniAppSdk && !("composeCast" in (acts || {})) && !("share" in (acts || {}))) {
    errors.push("No composeCast/share in actions");
  }
  if (hasMiniAppSdk && !("ready" in (acts || {}))) {
    errors.push("No ready() in actions");
  }

  return {
    inUA,
    hasGlobal,
    hasMiniAppSdk,
    hasActions: actions.length > 0,
    actions,
    errors,
  };
}
