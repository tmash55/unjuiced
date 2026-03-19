"use client"

import { cn } from "@/lib/utils"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { format, isToday, isTomorrow } from "date-fns"

export interface MarketSide {
  name: string
  price: number
  insiderCount: number
  totalWagered: number
  percentOfMoney: number
  sharpPct?: number   // % of this side's dollars from sharps
  insiderPct?: number // % of this side's dollars from insiders
}

export interface Market {
  id: string
  sport: string
  league: string
  matchup: string
  betType: string
  time: string
  sideA: MarketSide
  sideB: MarketSide
  totalVolume: number
  wagerCount: number
  gameStartTime?: string
}

interface MarketCardProps {
  market: Market
  isSelected: boolean
  onSelect: (market: Market) => void
  oddsFormat: OddsFormat
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export function MarketCard({ market, isSelected, onSelect, oddsFormat }: MarketCardProps) {
  const timeDisplay = (() => {
    if (!market.gameStartTime) return market.time
    const d = new Date(market.gameStartTime)
    if (isToday(d)) return `Today ${format(d, "h:mm a")}`
    if (isTomorrow(d)) return `Tomorrow ${format(d, "h:mm a")}`
    return format(d, "MMM d, h:mm a")
  })()
  const favoring = market.sideA.percentOfMoney >= market.sideB.percentOfMoney ? "A" : "B"

  return (
    <div
      onClick={() => onSelect(market)}
      className={cn(
        "cursor-pointer rounded-lg border px-4 py-3.5 transition-all duration-150",
        isSelected
          ? "border-neutral-300 dark:border-neutral-700/50 bg-sky-50/40 dark:bg-sky-500/[0.03]"
          : "border-neutral-200/80 dark:border-neutral-800/30 bg-white dark:bg-transparent hover:border-neutral-300 dark:hover:border-neutral-700/40",
        "active:scale-[0.998]"
      )}
    >
      {/* Row 1: Sport + Time */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          <span className="text-neutral-500 dark:text-neutral-400">{market.sport.toUpperCase()}</span>
          {market.betType && (
            <>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span className="capitalize">{market.betType}</span>
            </>
          )}
        </div>
        <span className="text-[11px] text-neutral-400 dark:text-neutral-600">{timeDisplay}</span>
      </div>

      {/* Row 2: Matchup */}
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight mb-3">
        {market.matchup}
      </h3>

      {/* Flow comparison — stacked tier bars */}
      <div className="space-y-2">
        {[
          { side: market.sideA, isFavored: favoring === "A" },
          { side: market.sideB, isFavored: favoring === "B" },
        ].map(({ side, isFavored }) => {
          const sharpPct = side.sharpPct ?? 100
          const insiderPct = side.insiderPct ?? 0
          const otherPct = Math.max(0, 100 - sharpPct - insiderPct)
          const barWidth = side.percentOfMoney

          return (
            <div key={side.name}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={cn(
                  "text-xs font-medium",
                  isFavored ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-500"
                )}>
                  {side.name}
                </span>
                <div className="flex items-center gap-2 text-[11px] tabular-nums">
                  <span className="text-neutral-400 dark:text-neutral-500">{side.insiderCount}</span>
                  <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-200">
                    {formatOdds(side.price, oddsFormat)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-neutral-200/80 dark:bg-neutral-800/50 overflow-hidden">
                  <div
                    className="h-full flex rounded-full overflow-hidden transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  >
                    {/* Sharp segment — emerald */}
                    {sharpPct > 0 && (
                      <div
                        className="h-full bg-emerald-500/70 dark:bg-emerald-500/60"
                        style={{ width: `${sharpPct}%` }}
                      />
                    )}
                    {/* Insider segment — purple */}
                    {insiderPct > 0 && (
                      <div
                        className="h-full bg-purple-500/60 dark:bg-purple-500/50"
                        style={{ width: `${insiderPct}%` }}
                      />
                    )}
                    {/* Other/burner segment — neutral */}
                    {otherPct > 0 && (
                      <div
                        className="h-full bg-neutral-400/40 dark:bg-neutral-500/30"
                        style={{ width: `${otherPct}%` }}
                      />
                    )}
                  </div>
                </div>
                <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-600 tabular-nums w-7 text-right">
                  {side.percentOfMoney}%
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-2.5 pt-2 border-t border-neutral-200/60 dark:border-neutral-800/30 flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
        <span>{formatMoney(market.totalVolume)} &middot; {market.wagerCount} positions</span>
        <span className={cn("font-medium", favoring === "A" ? "text-sky-600 dark:text-sky-400" : "text-neutral-500")}>
          {favoring === "A" ? market.sideA.name : market.sideB.name}
        </span>
      </div>
    </div>
  )
}
