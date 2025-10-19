// providers/MiniKitProvider.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Unified Farcaster Mini App provider that:
 * - Never touches browser globals at module scope (SSR safe)
 * - Dynamically imports @farcaster/miniapp-sdk on client
 * - Works in Warpcast (frame/mini) and has a dev fallback in normal browsers
 */

/* ----------------- Local types (minimal) ----------------- */
type RawUser = {
  fid?: number | null;
  username?: string | null;
  displayName?: string | null;
  display_name?: string | null;
  pfpUrl?: string | null;
  pfp_url?: string | null;
  custodyAddress?: string | null;
  custody_address?: string | null;
};

type CtxLike =
  | { user?: RawUser; requesterUser?: RawUser }
  | RawUser
  | null
  | undefined;

type MiniSdkLike = {
  actions?: {
    signIn?: () => Promise<
      | { isError?: false; data?: RawUser | { user?: RawUser } }
      | { isError: true; error?: { message?: string } }
    >;
    logout?: () => Promise<void> | void;
  };
  context?:
    | (() => Promise<CtxLike> | CtxLike)
    | Promise<CtxLike>
    | CtxLike;
};

type FCUser = {
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  custodyAddress: string | null;
};

type FarcasterContextValue = {
  user: FCUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isFarcasterEnvironment: boolean;
  signIn: () => Promise<FCUser>;
  logout: () => Promise<void> | void;
  refresh: () => Promise<FCUser | null>;
};

/* ----------------- Context ----------------- */
const FarcasterContext = createContext<FarcasterContextValue | null>(null);

/* ----------------- Helpers ----------------- */
function normalizeUser(raw: CtxLike): FCUser | null {
  if (!raw) return null;
  // Try common shapes coming from different SDK versions
  const u =
    (raw as any).user ||
    (raw as any).requesterUser ||
    (raw as RawUser);

  if (!u) return null;

  return {
    fid: u.fid ?? null,
    username: u.username ?? null,
    displayName: (u as any).displayName ?? (u as any).display_name ?? null,
    pfpUrl: (u as any).pfpUrl ?? (u as any).pfp_url ?? null,
    custodyAddress:
      (u as any).custodyAddress ?? (u as any).custody_address ?? null,
  };
}

function detectFarcasterEnv(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const inIframe = window.parent !== window;
    // Common mini paths or query hints
    const inMiniPath =
      window.location.pathname.startsWith("/mini") ||
      window.location.search.includes("frame") ||
      window.location.search.includes("fcframe");
    // If Warpcast injects globals in the future, add detection here
    return inIframe || inMiniPath;
  } catch {
    return false;
  }
}

/* ----------------- Provider ----------------- */
export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FCUser | null>(null);
  const [isFarcasterEnvironment, setIsFarcasterEnvironment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hold an sdk instance (client-only) without creating it on the server
  const [sdkRef, setSdkRef] = useState<MiniSdkLike | null>(null);

  useEffect(() => {
    let active = true;

    async function init() {
      setIsLoading(true);
      setError(null);

      const inFarcaster = detectFarcasterEnv();
      setIsFarcasterEnvironment(inFarcaster);

      if (!inFarcaster) {
        // Dev/browser fallback user for local testing
        if (active) {
          setUser({
            fid: 1,
            username: "dev-user",
            displayName: "Developer",
            pfpUrl: "/default.png",
            custodyAddress:
              "0x0000000000000000000000000000000000000000",
          });
          setIsLoading(false);
        }
        return;
      }

      try {
        const mod: any = await import("@farcaster/miniapp-sdk");
        const MiniAppSDK = mod?.MiniAppSDK || mod?.default;
        if (!MiniAppSDK) throw new Error("MiniAppSDK export not found");

        const sdk: MiniSdkLike = new MiniAppSDK();
        setSdkRef(sdk);

        // Some versions expose `context` as a Promise, some as a function.
        const ctx =
          typeof sdk.context === "function"
            ? await (sdk.context as () => Promise<CtxLike> | CtxLike)()
            : await (sdk.context as Promise<CtxLike> | CtxLike);

        const normalized = normalizeUser(ctx);
        if (active) setUser(normalized);
      } catch (e: any) {
        if (active) {
          // Non-fatal: permit app to run with a dev fallback
          setError(e?.message || "Farcaster SDK initialization failed");
          setUser({
            fid: 1,
            username: "dev-user",
            displayName: "Developer",
            pfpUrl: "/default.png",
            custodyAddress:
              "0x0000000000000000000000000000000000000000",
          });
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void init();
    return () => {
      active = false;
    };
  }, []);

  const signIn = async (): Promise<FCUser> => {
    if (!isFarcasterEnvironment) {
      // Dev/browser mock sign-in
      const mock: FCUser = {
        fid: Math.floor(Math.random() * 100000) + 2,
        username: `user${Math.floor(Math.random() * 10000)}`,
        displayName: "Test User",
        pfpUrl: "/default.png",
        custodyAddress: `0x${Math.random()
          .toString(16)
          .slice(2)
          .padEnd(40, "0")
          .slice(0, 40)}`,
      };
      setUser(mock);
      return mock;
    }
    try {
      if (!sdkRef) throw new Error("Farcaster SDK not ready");
      const res = await sdkRef?.actions?.signIn?.();
      if ((res as any)?.isError) {
        throw new Error(
          (res as any)?.error?.message || "Sign in failed"
        );
      }
      const normalized = normalizeUser((res as any)?.data) as FCUser;
      setUser(normalized);
      return normalized;
    } catch (e: any) {
      setError(e?.message || "Sign in failed");
      throw e;
    }
  };

  const logout = async (): Promise<void> => {
    if (!isFarcasterEnvironment) {
      setUser(null);
      return;
    }
    try {
      await sdkRef?.actions?.logout?.();
    } catch {
      // best effort; don't throw from logout
    } finally {
      setUser(null);
    }
  };

  const refresh = async (): Promise<FCUser | null> => {
    if (!isFarcasterEnvironment) return null;
    try {
      const ctx =
        typeof sdkRef?.context === "function"
          ? await (sdkRef.context as () => Promise<CtxLike> | CtxLike)()
          : await (sdkRef?.context as Promise<CtxLike> | CtxLike);
      const normalized = normalizeUser(ctx);
      setUser(normalized);
      return normalized;
    } catch (e: any) {
      setError(e?.message || "Failed to refresh Farcaster context");
      return null;
    }
  };

  const value = useMemo<FarcasterContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      isFarcasterEnvironment,
      signIn,
      logout,
      refresh,
    }),
    [user, isLoading, error, isFarcasterEnvironment]
  );

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  );
}

/* ----------------- Hook ----------------- */
export function useFarcaster(): FarcasterContextValue {
  const ctx = useContext(FarcasterContext);
  if (!ctx) {
    throw new Error("useFarcaster must be used within a FarcasterProvider");
  }
  return ctx;
}

export default FarcasterProvider;
