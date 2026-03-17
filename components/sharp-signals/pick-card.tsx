"use client"

import { cn } from "@/lib/utils"
import { TrendingUp, Activity, Clock } from "lucide-react"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { WhaleSignal } from "@/lib/polymarket/types"
import { formatDistanceToNow } from "date-fns"

interface PickCardProps {
  pick: WhaleSignal
  isSelected: boolean
  onSelect: (pick: WhaleSignal) => void
  oddsFormat: OddsFormat
}

export function PickCard({ pick, isSelected, onSelect, oddsFormat }: PickCardProps) {
  // Map real data to display format
  const score = Math.round(pick.signal_score || 0) // Already 0-100
  const sport = pick.sport || "N/A"
  const league = pick.league || ""
  const matchup = pick.event_title || pick.market_title
  const betType = pick.market_label || pick.market_type || ""
  const time = pick.game_start_time 
    ? formatDistanceToNow(new Date(pick.game_start_time), { addSuffix: true })
    : "TBD"
  const selection = pick.outcome
  const shares = Math.round(pick.bet_size / pick.entry_price)
  const amount = pick.bet_size
  const price = pick.entry_price * 100 // Convert to cents
  const multiplier = pick.stake_vs_avg?.toFixed(1) || "1.0"
  const roi = pick.wallet_roi ? `${(pick.wallet_roi * 100).toFixed(1)}%` : "N/A"

  // Anonymous wallet display
  const walletDisplay = pick.wallet_username || 
    (pick.wallet_address ? `#${pick.wallet_address.slice(-4)}` : "Unknown")

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400"
    if (score >= 80) return "text-sky-400"
    if (score >= 70) return "text-yellow-400"
    return "text-neutral-500"
  }

  const getScoreBg = (score: number) => {
    if (score >= 90) return "bg-emerald-500/10 border-emerald-500/20"
    if (score >= 80) return "bg-sky-500/10 border-sky-500/20"
    if (score >= 70) return "bg-yellow-500/10 border-yellow-500/20"
    return "bg-neutral-500/10 border-neutral-700"
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier?.toUpperCase()) {
      case "S": return "bg-purple-500/20 text-purple-300 border-purple-500/30"
      case "A": return "bg-blue-500/20 text-blue-300 border-blue-500/30"
      case "B": return "bg-green-500/20 text-green-300 border-green-500/30"
      case "C": return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      case "FADE": return "bg-red-500/20 text-red-300 border-red-500/30"
      default: return "bg-neutral-500/20 text-neutral-300 border-neutral-700"
    }
  }

  return (
    <div
      onClick={() => onSelect(pick)}
      className={cn(
        "group relative cursor-pointer rounded-lg border p-4 transition-all duration-200",
        isSelected
          ? "border-sky-500/50 bg-sky-500/5"
          : "border-neutral-800 bg-neutral-900 hover:border-sky-500/30 hover:bg-neutral-800/50"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Score Badge */}
        <div
          className={cn(
            "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border font-mono text-lg font-bold",
            getScoreBg(score),
            getScoreColor(score)
          )}
        >
          {score}
        </div>

        {/* Main Content */}
        <div className="min-w-0 flex-1">
          {/* Sport & Time Row */}
          <div className="mb-1 flex items-center gap-2 text-xs">
            <span className="rounded bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-400">
              {sport}
            </span>
            {league && (
              <span className="text-neutral-500">{league}</span>
            )}
            <span 
              className={cn(
                "px-1.5 py-0.5 rounded text-xs font-medium border",
                getTierBadgeColor(pick.wallet_tier || "")
              )}
            >
              {pick.wallet_tier}
            </span>
            <span className="ml-auto flex items-center gap-1 text-neutral-500">
              <Clock className="h-3 w-3" />
              {time}
            </span>
          </div>

          {/* Matchup */}
          <h3 className="mb-1 truncate text-sm font-medium text-neutral-200">
            {matchup}
          </h3>
          <p className="text-xs text-neutral-500">{betType}</p>
        </div>

        {/* Selection & Price */}
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5">
            <div className="text-xs text-neutral-500">
              {shares.toLocaleString()} shares
            </div>
            <div className="text-sm font-medium text-neutral-200">
              {selection}
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-sky-500 px-3 py-1">
            <TrendingUp className="h-3 w-3 text-white" />
            <span className="font-mono text-sm font-bold text-white">
              {formatOdds(price, oddsFormat)}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="mt-3 flex items-center gap-4 border-t border-neutral-800 pt-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-neutral-500">Wallet:</span>
          <span className="font-medium text-neutral-200">{walletDisplay}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-neutral-500">Size:</span>
          <span className="font-medium text-neutral-200">
            ${amount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className="h-3 w-3 text-neutral-500" />
          <span className="font-medium text-neutral-200">{multiplier}x</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-neutral-500">ROI:</span>
          <span className="font-medium text-emerald-400">{roi}</span>
        </div>
        {pick.best_book && pick.best_book_price && (
          <div className="ml-auto text-neutral-500">
            Best: <span className="font-medium text-neutral-200">{pick.best_book} {pick.best_book_price}</span>
          </div>
        )}
      </div>
    </div>
  )
}