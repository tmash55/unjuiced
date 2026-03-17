"use client"

import { cn } from "@/lib/utils"
import { Clock, Users, TrendingUp, TrendingDown } from "lucide-react"
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

export function MarketCard({ market, isSelected, onSelect, oddsFormat }: MarketCardProps) {
  const maxPercent = Math.max(market.sideA.percentOfMoney, market.sideB.percentOfMoney)
  const timeDisplay = market.gameStartTime 
    ? formatDistanceToNow(new Date(market.gameStartTime), { addSuffix: true })
    : market.time
  
  return (
    <div
      onClick={() => onSelect(market)}
      className={cn(
        "cursor-pointer rounded-xl border p-4 transition-all hover:border-sky-500/50",
        isSelected
          ? "border-sky-500 bg-sky-500/5"
          : "border-neutral-800 bg-neutral-900 hover:bg-neutral-800/50"
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-400">
            {market.sport} • {market.league}
          </span>
          <span className="rounded bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-400">
            {market.betType}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-neutral-500">
          <Clock className="h-3 w-3" />
          {timeDisplay}
        </div>
      </div>

      {/* Matchup Title */}
      <h3 className="mb-4 text-sm font-semibold text-neutral-200">{market.matchup}</h3>

      {/* Two Sides Comparison */}
      <div className="space-y-3">
        {/* Side A */}
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-200">{market.sideA.name}</span>
              <div className="flex items-center gap-1 text-xs text-neutral-500">
                <Users className="h-3 w-3" />
                {market.sideA.insiderCount}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-500">
                ${(market.sideA.totalWagered / 1000).toFixed(1)}k
              </span>
              <div className="flex items-center gap-1 rounded-full bg-sky-500 px-2.5 py-0.5">
                <TrendingUp className="h-3 w-3 text-white" />
                <span className="font-mono text-xs font-bold text-white">
                  {formatOdds(market.sideA.price, oddsFormat)}
                </span>
              </div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-neutral-700 overflow-hidden">
            <div 
              className="h-full rounded-full bg-sky-500 transition-all"
              style={{ width: `${market.sideA.percentOfMoney}%` }}
            />
          </div>
          <span className="text-xs text-neutral-500">{market.sideA.percentOfMoney}% of insider money</span>
        </div>

        {/* Side B */}
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-200">{market.sideB.name}</span>
              <div className="flex items-center gap-1 text-xs text-neutral-500">
                <Users className="h-3 w-3" />
                {market.sideB.insiderCount}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-500">
                ${(market.sideB.totalWagered / 1000).toFixed(1)}k
              </span>
              <div className="flex items-center gap-1 rounded-full bg-red-500/80 px-2.5 py-0.5">
                <TrendingDown className="h-3 w-3 text-white" />
                <span className="font-mono text-xs font-bold text-white">
                  {formatOdds(market.sideB.price, oddsFormat)}
                </span>
              </div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-neutral-700 overflow-hidden">
            <div 
              className="h-full rounded-full bg-red-500/60 transition-all"
              style={{ width: `${market.sideB.percentOfMoney}%` }}
            />
          </div>
          <span className="text-xs text-neutral-500">{market.sideB.percentOfMoney}% of insider money</span>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-3">
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span>Volume: <span className="font-medium text-neutral-200">${(market.totalVolume / 1000).toFixed(1)}k</span></span>
          <span>Wagers: <span className="font-medium text-neutral-200">{market.wagerCount}</span></span>
        </div>
        <div className="flex items-center gap-1">
          {market.sideA.percentOfMoney > market.sideB.percentOfMoney ? (
            <span className="text-xs font-medium text-sky-400">Favoring {market.sideA.name}</span>
          ) : (
            <span className="text-xs font-medium text-red-400">Favoring {market.sideB.name}</span>
          )}
        </div>
      </div>
    </div>
  )
}