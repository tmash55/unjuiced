"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { SignalPreferences } from "@/lib/polymarket/types"

const DEFAULTS: SignalPreferences = {
  signal_followed_wallets: [],
  signal_sport_filters: null,
  signal_excluded_sports: ["esports"],
  signal_tier_filters: ["sharp"], // Sharps only by default
  signal_min_stake: 0,
  signal_sort_by: "score",
  signal_show_resolved: false,
  signal_timeframe: "30d",
  signal_alert_enabled: false,
  signal_alert_min_stake: 5000,
  signal_alert_sports: null,
  signal_alert_wallets: null,
}

export function useSignalPreferences() {
  const [prefs, setPrefs] = useState<SignalPreferences>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate from API on mount
  useEffect(() => {
    fetch("/api/polymarket/preferences")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch")
        return r.json()
      })
      .then((data: SignalPreferences) => {
        setPrefs((prev) => ({ ...prev, ...data }))
      })
      .catch(() => {
        // Use defaults on error (new user, not logged in, etc.)
      })
      .finally(() => setLoaded(true))
  }, [])

  // Debounced PATCH to API
  const persistToApi = useCallback((updates: Partial<SignalPreferences>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetch("/api/polymarket/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).catch(() => {
        // Silent fail — preferences are best-effort
      })
    }, 500)
  }, [])

  // Update a preference field (optimistic + debounced save)
  const updatePref = useCallback(
    <K extends keyof SignalPreferences>(key: K, value: SignalPreferences[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value }
        persistToApi({ [key]: value })
        return next
      })
    },
    [persistToApi]
  )

  // Bulk update
  const updatePrefs = useCallback(
    (updates: Partial<SignalPreferences>) => {
      setPrefs((prev) => ({ ...prev, ...updates }))
      persistToApi(updates)
    },
    [persistToApi]
  )

  // Follow/unfollow wallet
  const toggleFollowWallet = useCallback(
    (walletAddress: string) => {
      setPrefs((prev) => {
        const current = prev.signal_followed_wallets || []
        const isFollowing = current.includes(walletAddress)
        const next = isFollowing
          ? current.filter((w) => w !== walletAddress)
          : [...current, walletAddress]
        persistToApi({ signal_followed_wallets: next })
        return { ...prev, signal_followed_wallets: next }
      })
    },
    [persistToApi]
  )

  const isFollowing = useCallback(
    (walletAddress: string) => {
      return (prefs.signal_followed_wallets || []).includes(walletAddress)
    },
    [prefs.signal_followed_wallets]
  )

  return {
    prefs,
    loaded,
    updatePref,
    updatePrefs,
    toggleFollowWallet,
    isFollowing,
    followedWallets: prefs.signal_followed_wallets || [],
  }
}
