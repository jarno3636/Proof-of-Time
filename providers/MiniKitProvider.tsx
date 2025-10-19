// providers/MiniKitProvider.tsx

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Unified Farcaster Mini App provider that:
 * - Never touches browser globals at module scope (SSR safe)
 * - Dynamically imports @farcaster/miniapp-sdk on client
 * - Works in Warpcast (frame/mini) and has a dev fallback in normal browsers
 */

const FarcasterContext = createContext(null)

function normalizeUser(raw) {
  if (!raw) return null
  // Try common shapes coming from different SDK versions
  const u = raw.user || raw.requesterUser || raw
  if (!u) return null
  return {
    fid: u.fid ?? null,
    username: u.username ?? null,
    displayName: u.displayName ?? u.display_name ?? null,
    pfpUrl: u.pfpUrl ?? u.pfp_url ?? null,
    custodyAddress: u.custodyAddress ?? u.custody_address ?? null,
  }
}

function detectFarcasterEnv() {
  if (typeof window === 'undefined') return false
  try {
    const inIframe = window.parent !== window
    // Common mini paths or query hints
    const inMiniPath =
      window.location.pathname.startsWith('/mini') ||
      window.location.search.includes('frame') ||
      window.location.search.includes('fcframe')
    // If Warpcast injects globals in the future, add detection here
    return inIframe || inMiniPath
  } catch {
    return false
  }
}

export function FarcasterProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isFarcasterEnvironment, setIsFarcasterEnvironment] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Hold an sdk instance (client-only) without creating it on the server
  const [sdkRef, setSdkRef] = useState(null)

  useEffect(() => {
    let active = true

    async function init() {
      setIsLoading(true)
      setError(null)

      const inFarcaster = detectFarcasterEnv()
      setIsFarcasterEnvironment(inFarcaster)

      if (!inFarcaster) {
        // Dev/browser fallback user for local testing
        if (active) {
          setUser({
            fid: 1,
            username: 'dev-user',
            displayName: 'Developer',
            pfpUrl: '/default.png',
            custodyAddress: '0x0000000000000000000000000000000000000000',
          })
          setIsLoading(false)
        }
        return
      }

      try {
        const mod = await import('@farcaster/miniapp-sdk')
        const MiniAppSDK = mod?.MiniAppSDK || mod?.default
        if (!MiniAppSDK) throw new Error('MiniAppSDK export not found')

        const sdk = new MiniAppSDK()
        setSdkRef(sdk)

        // Some versions expose `context` as a Promise, some as a function.
        const ctx =
          typeof sdk.context === 'function' ? await sdk.context() : await sdk.context
        const normalized = normalizeUser(ctx)
        if (active) setUser(normalized)
      } catch (e) {
        if (active) {
          // Non-fatal: permit app to run with a dev fallback
          setError(e?.message || 'Farcaster SDK initialization failed')
          setUser({
            fid: 1,
            username: 'dev-user',
            displayName: 'Developer',
            pfpUrl: '/default.png',
            custodyAddress: '0x0000000000000000000000000000000000000000',
          })
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    init()
    return () => {
      active = false
    }
  }, [])

  const signIn = async () => {
    if (!isFarcasterEnvironment) {
      // Dev/browser mock sign-in
      const mock = {
        fid: Math.floor(Math.random() * 100000) + 2,
        username: `user${Math.floor(Math.random() * 10000)}`,
        displayName: 'Test User',
        pfpUrl: '/default.png',
        custodyAddress: `0x${Math.random().toString(16).slice(2).padEnd(40, '0').slice(0, 40)}`,
      }
      setUser(mock)
      return mock
    }
    try {
      if (!sdkRef) throw new Error('Farcaster SDK not ready')
      const res = await sdkRef?.actions?.signIn?.()
      if (res?.isError) throw new Error(res?.error?.message || 'Sign in failed')
      const normalized = normalizeUser(res?.data)
      setUser(normalized)
      return normalized
    } catch (e) {
      setError(e?.message || 'Sign in failed')
      throw e
    }
  }

  const logout = async () => {
    if (!isFarcasterEnvironment) {
      setUser(null)
      return
    }
    try {
      await sdkRef?.actions?.logout?.()
    } catch {
      // best effort; don't throw from logout
    } finally {
      setUser(null)
    }
  }

  const refresh = async () => {
    if (!isFarcasterEnvironment) return
    try {
      const ctx =
        typeof sdkRef?.context === 'function'
          ? await sdkRef.context()
          : await sdkRef?.context
      const normalized = normalizeUser(ctx)
      setUser(normalized)
      return normalized
    } catch (e) {
      setError(e?.message || 'Failed to refresh Farcaster context')
      return null
    }
  }

  const value = useMemo(
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
  )

  return <FarcasterContext.Provider value={value}>{children}</FarcasterContext.Provider>
}

export function useFarcaster() {
  const ctx = useContext(FarcasterContext)
  if (!ctx) {
    throw new Error('useFarcaster must be used within a FarcasterProvider')
  }
  return ctx
}

export default FarcasterProvider
