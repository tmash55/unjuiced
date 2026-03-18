"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"
import { Info } from "lucide-react"

interface FiltersProps {
  selectedSport: string
  onSportChange: (sport: string) => void
  selectedTier: string
  onTierChange: (tier: string) => void
  counts?: Record<string, number>
  tierCounts?: Record<string, number>
}

const SPORTS = [
  { id: "all", label: "All Sports" },
  { id: "nba", label: "NBA" },
  { id: "nhl", label: "NHL" },
  { id: "soccer", label: "Soccer" },
  { id: "mlb", label: "MLB" },
  { id: "nfl", label: "NFL" },
  { id: "tennis", label: "Tennis" },
  { id: "ufc", label: "UFC" },
]

const TIERS = [
  { 
    id: "all", 
    label: "All Insiders",
    color: "sky",
    description: null,
  },
  { 
    id: "sharp", 
    label: "Sharps",
    color: "emerald",
    description: "Top-ranked sports bettors on Polymarket with proven track records. These insiders have high ROI, large sample sizes, and consistently beat closing lines. Our highest-conviction signals.",
  },
  { 
    id: "whale", 
    label: "Insiders",
    color: "purple",
    description: "Large-stake bettors placing $5K+ on individual plays. May not have long track records, but their bet sizing shows serious conviction. Watch for bets significantly above their average stake.",
  },
]

export function Filters({ 
  selectedSport, 
  onSportChange, 
  selectedTier,
  onTierChange,
  counts = {},
  tierCounts = {},
}: FiltersProps) {
  const [showTierInfo, setShowTierInfo] = useState(false)

  return (
    <div className="space-y-2 border-b border-neutral-800 bg-neutral-900 px-4 py-2">
      {/* Sport filters */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {SPORTS.map((sport) => {
          const count = counts[sport.id === "all" ? "total" : sport.id] || 0
          return (
            <button
              key={sport.id}
              onClick={() => onSportChange(sport.id === "all" ? "" : sport.id)}
              className={cn(
                "px-3 py-1.5 rounded-md gap-1.5 text-sm transition-all flex items-center whitespace-nowrap",
                (selectedSport === sport.id) || (selectedSport === "" && sport.id === "all")
                  ? "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
              )}
            >
              {sport.label}
              {count > 0 && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs",
                    (selectedSport === sport.id) || (selectedSport === "" && sport.id === "all")
                      ? "bg-sky-500/20 text-sky-400"
                      : "bg-neutral-700 text-neutral-400"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tier filters */}
      <div className="flex items-center gap-2">
        {TIERS.map((tier) => {
          const count = tierCounts[tier.id === "all" ? "total" : tier.id] || 0
          const isActive = (selectedTier === tier.id) || (selectedTier === "" && tier.id === "all")
          
          const colorClasses = {
            sky: { active: "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20", badge: "bg-sky-500/20 text-sky-400" },
            emerald: { active: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20", badge: "bg-emerald-500/20 text-emerald-400" },
            purple: { active: "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20", badge: "bg-purple-500/20 text-purple-400" },
          }[tier.color]!

          return (
            <button
              key={tier.id}
              onClick={() => onTierChange(tier.id === "all" ? "" : tier.id)}
              className={cn(
                "px-3 py-1.5 rounded-md gap-1.5 text-sm transition-all flex items-center whitespace-nowrap",
                isActive
                  ? colorClasses.active
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
              )}
            >
              {tier.label}
              {count > 0 && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs",
                    isActive ? colorClasses.badge : "bg-neutral-700 text-neutral-400"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
        
        <button
          onClick={() => setShowTierInfo(!showTierInfo)}
          className="ml-1 text-neutral-500 hover:text-neutral-300 transition-colors"
          title="What are tiers?"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>

      {/* Tier info panel */}
      {showTierInfo && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4 space-y-3">
          <p className="text-xs font-medium text-neutral-300 uppercase tracking-wider">Insider Tiers</p>
          {TIERS.filter(t => t.description).map((tier) => (
            <div key={tier.id} className="flex gap-3">
              <div className={cn(
                "mt-1 h-2 w-2 rounded-full shrink-0",
                tier.color === "emerald" ? "bg-emerald-400" : "bg-purple-400"
              )} />
              <div>
                <p className={cn(
                  "text-sm font-medium",
                  tier.color === "emerald" ? "text-emerald-400" : "text-purple-400"
                )}>
                  {tier.label}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">{tier.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
