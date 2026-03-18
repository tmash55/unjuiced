"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"

interface FiltersProps {
  selectedSport: string
  onSportChange: (sport: string) => void
  selectedTier: string
  onTierChange: (tier: string) => void
  minScore: number
  onMinScoreChange: (score: number) => void
  counts?: Record<string, number>
  tierCounts?: Record<string, number>
}

const SPORTS = [
  { id: "all", label: "All" },
  { id: "nba", label: "NBA" },
  { id: "nhl", label: "NHL" },
  { id: "ncaab", label: "NCAAB" },
  { id: "soccer", label: "Soccer" },
  { id: "mlb", label: "MLB" },
  { id: "nfl", label: "NFL" },
  { id: "tennis", label: "Tennis" },
  { id: "ufc", label: "UFC" },
]

const TIERS = [
  { id: "all", label: "All", color: "default" },
  { id: "sharp", label: "Sharps", color: "emerald" },
  { id: "whale", label: "Insiders", color: "purple" },
  { id: "burner", label: "New", color: "neutral" },
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
  counts = {},
  minScore = 0,
  onMinScoreChange,
  tierCounts = {},
}: FiltersProps) {
  const [showTierInfo, setShowTierInfo] = useState(false)

  return (
    <div className="px-4 py-2 space-y-1.5">
      {/* Single row: Sports | divider | Tiers | info */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {/* Sports */}
        {SPORTS.map((sport) => {
          const count = counts[sport.id === "all" ? "total" : sport.id] || 0
          const isActive = (selectedSport === sport.id) || (selectedSport === "" && sport.id === "all")
          return (
            <button
              key={sport.id}
              onClick={() => {
                if (sport.id === "all") {
                  onSportChange("")
                } else {
                  // Toggle: clicking active sport deselects it (back to All)
                  onSportChange(selectedSport === sport.id ? "" : sport.id)
                }
              }}
              className={cn(
                "px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 flex items-center gap-1 whitespace-nowrap",
                isActive
                  ? "bg-neutral-200/80 text-neutral-900 dark:text-neutral-100 dark:bg-neutral-800/60"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {sport.label}
              {count > 0 && (
                <span className={cn(
                  "font-mono tabular-nums text-[9px]",
                  isActive ? "text-neutral-400" : "text-neutral-400 dark:text-neutral-600"
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}

        {/* Divider */}
        <span className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-800/60 mx-1 shrink-0" />

        {/* Tiers */}
        {TIERS.map((tier) => {
          const count = tierCounts[tier.id === "all" ? "total" : tier.id] || 0
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
              {tier.label}
              {count > 0 && (
                <span className={cn(
                  "font-mono tabular-nums text-[9px]",
                  isActive ? "opacity-60" : "text-neutral-400 dark:text-neutral-600"
                )}>
                  {count}
                </span>
              )}
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

        {/* Divider */}
        <span className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-800/60 mx-1 shrink-0" />

        {/* Min Score */}
        {[60, 70, 80, 90].map((threshold) => (
          <button
            key={threshold}
            onClick={() => onMinScoreChange(minScore === threshold ? 0 : threshold)}
            className={cn(
              "px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 whitespace-nowrap",
              minScore === threshold
                ? "bg-amber-50 text-amber-600 dark:text-amber-400 dark:bg-amber-500/10"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            {threshold}+
          </button>
        ))}
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
