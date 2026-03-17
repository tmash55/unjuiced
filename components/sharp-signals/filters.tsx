"use client"

import { cn } from "@/lib/utils"

interface FiltersProps {
  selectedSport: string
  onSportChange: (sport: string) => void
  counts?: Record<string, number>
}

export function Filters({ selectedSport, onSportChange, counts = {} }: FiltersProps) {
  const sports = [
    { id: "all", label: "All Sports" },
    { id: "nba", label: "NBA" },
    { id: "nfl", label: "NFL" }, 
    { id: "soccer", label: "Soccer" },
    { id: "mlb", label: "MLB" },
    { id: "politics", label: "Politics" },
    { id: "crypto", label: "Crypto" },
  ]

  return (
    <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4 py-2">
      {sports.map((sport) => {
        const count = counts[sport.id === "all" ? "total" : sport.id] || 0
        return (
          <button
            key={sport.id}
            onClick={() => onSportChange(sport.id === "all" ? "" : sport.id)}
            className={cn(
              "px-3 py-2 rounded-md gap-1.5 text-sm transition-all flex items-center",
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
  )
}