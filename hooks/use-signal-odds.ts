"use client"

import useSWR from "swr"

interface OddsKey {
  sport: string
  event_id: string
  market: string
  outcome?: string | null
  line?: string | null
}

export interface OddsEntry {
  book: string
  price: string
  decimal: number
  line?: string
  link?: string
  mobile_link?: string
}

interface OddsResponse {
  results: Record<string, OddsEntry[]>
}

function makeComboKey(key: OddsKey): string {
  return `${key.sport}:${key.event_id}:${key.market}`
}

async function fetchOdds(keys: OddsKey[]): Promise<OddsResponse | null> {
  try {
    const res = await fetch("/api/polymarket/odds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys }),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/**
 * Fetch live sportsbook odds for a single signal.
 * Used in the detail panel when a pick is selected.
 * This is the only place we fetch odds — pick cards don't need them.
 */
export function useSignalOdds(oddsKey: OddsKey | null | undefined) {
  const comboKey = oddsKey ? makeComboKey(oddsKey) : null
  // Include outcome + line in SWR key so each side of a market caches independently
  const swrKey = oddsKey
    ? `signal-odds:${comboKey}:${oddsKey.outcome || ""}:${oddsKey.line || ""}`
    : null

  const { data, isLoading } = useSWR(
    swrKey,
    () => oddsKey ? fetchOdds([oddsKey]) : null,
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      dedupingInterval: 5000,
    }
  )

  const entries = comboKey && data?.results?.[comboKey]
    ? data.results[comboKey]
    : []

  return {
    odds: entries,
    best: entries.length > 0 ? entries[0] : null,
    isLoading,
    hasOdds: entries.length > 0,
  }
}
