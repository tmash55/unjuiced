"use client"

import { cn } from "@/lib/utils"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { formatDistanceToNow } from "date-fns"

export interface MarketSide {
  name: string
  price: number
  insiderCount: number
  totalWagered: number
  percentOfMoney: number
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
  const timeDisplay = market.gameStartTime
    ? formatDistanceToNow(new Date(market.gameStartTime), { addSuffix: true })
    : market.time
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
              <span>{market.betType}</span>
            </>
          )}
        </div>
        <span className="text-[11px] text-neutral-400 dark:text-neutral-600">{timeDisplay}</span>
      </div>

      {/* Row 2: Matchup */}
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight mb-3">
        {market.matchup}
      </h3>

      {/* Flow comparison — compact two-row */}
      <div className="space-y-2">
        {[
          { side: market.sideA, isFavored: favoring === "A", color: "bg-sky-500" },
          { side: market.sideB, isFavored: favoring === "B", color: "bg-neutral-400 dark:bg-neutral-500" },
        ].map(({ side, isFavored, color }) => (
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
              <div className="flex-1 h-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800/50 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", color)}
                  style={{ width: `${side.percentOfMoney}%`, opacity: isFavored ? 0.7 : 0.35 }}
                />
              </div>
              <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-600 tabular-nums w-7 text-right">
                {side.percentOfMoney}%
              </span>
            </div>
          </div>
        ))}
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
