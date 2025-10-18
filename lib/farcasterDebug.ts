// lib/farcasterDebug.ts
export type FcProbe = {
  inUA: boolean;
  has_farcaster: boolean;
  has_Farcaster_mini_sdk: boolean;
  has_farcaster_miniapp_sdk: boolean;
  has_farcaster_actions: boolean;
  actions: string[];
  globalsSnapshot: string[];
};

export function probeFarcaster(): FcProbe {
  const g: any = (typeof window !== "undefined" ? window : {}) || {};
  const inUA =
    typeof navigator !== "undefined" &&
    /Warpcast|Farcaster|FarcasterMini/i.test(navigator.userAgent || "");

  const cand1 = g?.Farcaster?.mini?.sdk;       // NEWER path some builds use
  const cand2 = g?.farcaster?.miniapp?.sdk;    // classic miniapp runtime
  const cand3 = g?.farcaster?.actions;         // classic actions only
  const cand4 = g?.sdk;                        // very old/experimental

  const winner = cand1 || cand2 || cand3 || cand4 || null;
  const acts = winner?.actions || {};
  const actions = Object.keys(acts || {}).filter(Boolean);

  const globalsSnapshot = [
    `!!window.Farcaster: ${!!g.Farcaster}`,
    `!!window.Farcaster?.mini: ${!!g?.Farcaster?.mini}`,
    `!!window.Farcaster?.mini?.sdk: ${!!g?.Farcaster?.mini?.sdk}`,
    `!!window.farcaster: ${!!g.farcaster}`,
    `!!window.farcaster?.miniapp: ${!!g?.farcaster?.miniapp}`,
    `!!window.farcaster?.miniapp?.sdk: ${!!g?.farcaster?.miniapp?.sdk}`,
    `!!window.farcaster?.actions: ${!!g?.farcaster?.actions}`,
    `!!window.sdk: ${!!g.sdk}`,
  ];

  return {
    inUA,
    has_farcaster: !!g.farcaster || !!g.Farcaster,
    has_Farcaster_mini_sdk: !!cand1,
    has_farcaster_miniapp_sdk: !!cand2,
    has_farcaster_actions: !!cand3,
    actions,
    globalsSnapshot,
  };
}
