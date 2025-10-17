// types/farcaster-frame-sdk.d.ts
declare module '@farcaster/frame-sdk' {
  export const sdk: {
    actions?: {
      ready?: () => Promise<void> | void;
      openUrl?: (url: string | { url: string }) => Promise<void> | void;
      openURL?: (url: string) => Promise<void> | void;
      // Some runtimes expose share(); others expose composeCast()
      share?: (args: { text?: string; embeds?: string[] }) => Promise<void> | void;
      composeCast?: (args: { text?: string; embeds?: string[] }) => Promise<void> | void;
    };
  };
  const _default: typeof sdk;
  export default _default;
}
