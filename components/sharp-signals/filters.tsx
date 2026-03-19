"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"

interface FiltersProps {
  selectedSport: string
  onSportChange: (sport: string) => void
  selectedTier: string
  onTierChange: (tier: string) => void
  availableSports?: string[]
}

// Known sport labels — any sport not here will auto-display uppercased
const SPORT_LABELS: Record<string, string> = {
  nba: "NBA",
  nhl: "NHL",
  soccer: "Soccer",
  mlb: "MLB",
  nfl: "NFL",
  tennis: "Tennis",
  ufc: "UFC",
  ncaab: "NCAAB",
  "march-madness": "NCAAB",
  ncaaf: "NCAAF",
  wnba: "WNBA",
  esports: "Esports",
}

// Preferred display order
const SPORT_ORDER = ["nba", "nhl", "ncaab", "march-madness", "mlb", "nfl", "soccer", "tennis", "ufc", "wnba", "ncaaf"]

// Always show these sports even if no data yet
const BASE_SPORTS = ["nba", "nhl", "ncaab", "mlb", "nfl", "soccer", "tennis", "ufc"]

function buildSportsList(available?: string[]) {
  // Normalize march-madness → ncaab, then merge and deduplicate
  const normalized = (available || []).map(s => s === "march-madness" ? "ncaab" : s)
  const merged = [...new Set([...BASE_SPORTS, ...normalized])]

  const sorted = merged.sort((a, b) => {
    const ai = SPORT_ORDER.indexOf(a)
    const bi = SPORT_ORDER.indexOf(b)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  return [
    { id: "all", label: "All" },
    ...sorted.map((s) => ({ id: s, label: SPORT_LABELS[s] || s.toUpperCase() })),
  ]
}

const TIERS = [
  { id: "all", label: "All", color: "default", dot: null },
  { id: "sharp", label: "Sharps", color: "emerald", dot: "bg-emerald-500 dark:bg-emerald-400" },
  { id: "whale", label: "Insiders", color: "purple", dot: "bg-purple-500 dark:bg-purple-400" },
  { id: "burner", label: "New", color: "neutral", dot: "bg-neutral-400 dark:bg-neutral-500" },
]

const TIER_INFO = [
  { label: "Sharps", color: "bg-emerald-500 dark:bg-emerald-400", desc: "Proven profitable bettors with 10+ bets, positive ROI, and tracked history." },
  { label: "Insiders", color: "bg-purple-500 dark:bg-purple-400", desc: "High-volume bettors with large positions. Less track record, but sizing shows conviction." },
  { label: "New Accounts", color: "bg-neutral-400 dark:bg-neutral-500", desc: "Fresh wallets with fewer than 20 trades. Could be sharp or noise." },
]

export function Filters({
  selectedSport,
  onSportChange,
  selectedTier,
  onTierChange,
  availableSports,
}: FiltersProps) {
  const [showTierInfo, setShowTierInfo] = useState(false)
  const sports = buildSportsList(availableSports)

  return (
    <div className="px-4 py-2 space-y-1.5">
      {/* Single row: Sports | divider | Tiers | info */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {/* Sports */}
        {sports.map((sport) => {
          const isActive = (selectedSport === sport.id) || (selectedSport === "" && sport.id === "all")
          return (
            <button
              key={sport.id}
              onClick={() => {
                if (sport.id === "all") {
                  onSportChange("")
                } else {
                  onSportChange(selectedSport === sport.id ? "" : sport.id)
                }
              }}
              className={cn(
                "px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 whitespace-nowrap",
                isActive
                  ? "bg-neutral-200/80 text-neutral-900 dark:text-neutral-100 dark:bg-neutral-800/60"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {sport.label}
            </button>
          )
        })}

        {/* Divider */}
        <span className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-800/60 mx-1 shrink-0" />

        {/* Tiers */}
        {TIERS.map((tier) => {
          const isActive = (selectedTier === tier.id) || (selectedTier === "" && tier.id === "all")

          return (
            <button
              key={tier.id}
              onClick={() => onTierChange(tier.id === "all" ? "" : tier.id)}
              className={cn(
                "px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 flex items-center gap-1 whitespace-nowrap",
                isActive
                  ? tier.color === "emerald" ? "bg-emerald-50 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/10"
                    : tier.color === "purple" ? "bg-purple-50 text-purple-600 dark:text-purple-400 dark:bg-purple-500/10"
                    : tier.color === "neutral" ? "bg-neutral-200/60 text-neutral-500 dark:text-neutral-400 dark:bg-neutral-500/10"
                    : "bg-neutral-200/80 text-neutral-900 dark:text-neutral-100 dark:bg-neutral-800/60"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {tier.dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", tier.dot)} />}
              {tier.label}
            </button>
          )
        })}

        <button
          onClick={() => setShowTierInfo(!showTierInfo)}
          className="ml-0.5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-400 transition-colors shrink-0"
          title="What are tiers?"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
        </button>

      </div>

      {/* Tier info */}
      {showTierInfo && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800/40 dark:bg-transparent p-3 space-y-2 mt-1">
          {TIER_INFO.map((tier) => (
            <div key={tier.label} className="flex gap-2.5">
              <div className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", tier.color)} />
              <div>
                <p className="text-xs font-medium text-neutral-900 dark:text-neutral-300">{tier.label}</p>
                <p className="text-[11px] text-neutral-500 leading-relaxed">{tier.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
