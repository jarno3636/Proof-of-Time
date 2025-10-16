// types/farcaster-miniapp-sdk.d.ts

declare module "@farcaster/miniapp-sdk" {
  export interface ComposeArgs {
    text?: string;
    embeds?: string[];
  }

  export interface MiniAppActions {
    /** Signal that your mini app is ready (optional). */
    ready?: () => Promise<void> | void;

    /** Open a URL inside Warpcast’s in-app browser/webview. */
    openURL?: (url: string) => Promise<void> | void;

    /** Open the composer with optional text and embeds. */
    composeCast?: (args: ComposeArgs) => Promise<void> | void;
  }

  export interface MiniAppSDK {
    /** True/false if currently inside the Farcaster Mini App environment (if provided by the SDK). */
    isInMiniApp?: () => boolean;

    /** Imperative actions exposed by the Mini App runtime. */
    actions?: MiniAppActions;
  }

  export const sdk: MiniAppSDK;
  export default sdk;
}

// Optional: if you ever attach the SDK to window, this keeps TS happy.
declare global {
  interface Window {
    FarcasterMiniApp?: import("@farcaster/miniapp-sdk").MiniAppSDK;
  }
}
