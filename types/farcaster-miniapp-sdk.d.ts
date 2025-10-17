declare module '@farcaster/miniapp-sdk' {
  export const sdk: {
    isInMiniApp?: () => boolean;
    actions?: {
      ready?: () => Promise<void> | void;
      openUrl?: (url: string | { url: string }) => Promise<void> | void;
      openURL?: (url: string) => Promise<void> | void;
      composeCast?: (args: { text?: string; embeds?: string[] }) => Promise<void> | void;
    };
  };
  const _default: typeof sdk;
  export default _default;
}
