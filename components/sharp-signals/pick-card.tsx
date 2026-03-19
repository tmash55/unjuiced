"use client"

import { cn } from "@/lib/utils"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { WhaleSignal } from "@/lib/polymarket/types"
import { TierBadge } from "./tier-badge"
import { format, isToday, isTomorrow } from "date-fns"
import { getSportsbookById } from "@/lib/data/sportsbooks"

interface PickCardProps {
  pick: WhaleSignal
  isSelected: boolean
  onSelect: (pick: WhaleSignal) => void
  oddsFormat: OddsFormat
  isSplitMarket?: boolean
  onViewMarket?: () => void
  onViewInsider?: (walletAddress: string) => void
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export function PickCard({ pick, isSelected, onSelect, oddsFormat, isSplitMarket, onViewMarket, onViewInsider }: PickCardProps) {
  const score = Math.round(pick.signal_score || 0)
  const sport = (pick.sport || "").toUpperCase()
  const matchup = pick.event_title || pick.market_title
  const betType = pick.market_label || pick.market_type || ""
  const time = (() => {
    if (!pick.game_start_time) return "TBD"
    const d = new Date(pick.game_start_time)
    if (isToday(d)) return `Today ${format(d, "h:mm a")}`
    if (isTomorrow(d)) return `Tomorrow ${format(d, "h:mm a")}`
    return format(d, "MMM d, h:mm a")
  })()
  const selection = pick.outcome
  const amount = pick.bet_size
  const price = Math.round(pick.entry_price * 100)
  const multiplier = pick.stake_vs_avg?.toFixed(1) || "1.0"
  const walletDisplay = pick.wallet_address
    ? `#${pick.wallet_address.slice(0, 4).toUpperCase()}`
    : "Anon"
  const walletRecord = pick.wallet_record || null
  const walletRoi = pick.wallet_roi

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-emerald-600 dark:text-emerald-400"
    if (s >= 60) return "text-sky-600 dark:text-sky-400"
    if (s >= 40) return "text-neutral-500 dark:text-neutral-400"
    return "text-neutral-400 dark:text-neutral-600"
  }

  const bestBook = pick.live_odds?.best
  const bestBookInfo = bestBook ? getSportsbookById(bestBook.book) : null

  const selectionLabel = (() => {
    const label = (betType || "").toLowerCase()
    const title = (pick.market_title || "").toLowerCase()
    const side = (pick.side || "").toLowerCase()
    const lineMatch = (betType || pick.market_title || "").match(/-?\d+\.?\d*/)
    const line = lineMatch ? lineMatch[0] : null

    if (label.includes("spread") || title.includes("spread")) {
      if (pick.spread_display) return pick.spread_display
      return line ? `${selection} ${line}` : selection
    }
    if (label.includes("total") || label.includes("o/u") || title.includes("total") || title.includes("o/u")) {
      // Use the outcome (selection) to determine Over/Under, not the side
      // On Polymarket, BUY just means they bought that token — could be Over or Under
      const selLower = selection.toLowerCase()
      const ou = selLower.includes("under") || selLower === "no" ? "Under" : "Over"
      return line ? `${ou} ${line}` : ou
    }
    return selection
  })()

  const isHedge = pick.opposing_position?.is_hedge === true

  return (
    <div
      onClick={() => onSelect(pick)}
      className={cn(
        "group cursor-pointer rounded-lg border transition-all duration-150",
        isHedge && "opacity-60",
        isSelected
          ? "border-neutral-300 dark:border-neutral-700/50 bg-sky-50/40 dark:bg-sky-500/[0.03]"
          : "border-neutral-200/80 dark:border-neutral-800/30 bg-white dark:bg-transparent hover:border-neutral-300 dark:hover:border-neutral-700/40",
        "active:scale-[0.998]"
      )}
    >
      {/* Hedge warning banner */}
      {pick.has_opposing_position && pick.opposing_position && (
        <div className="px-4 pt-2.5 pb-0">
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span>
              {pick.opposing_position.type === "same_market"
                ? `Hedged — also has $${Math.round(pick.opposing_position.total_size).toLocaleString()} on ${pick.opposing_position.outcome}`
                : `Also bet opposing ${pick.opposing_position.opposing_markets?.join(", ") || "market"} — $${Math.round(pick.opposing_position.total_size).toLocaleString()} on ${pick.opposing_position.outcome}`
              }
            </span>
          </div>
        </div>
      )}

      {/* Split market indicator */}
      {isSplitMarket && !pick.has_opposing_position && (
        <div className="px-4 pt-2.5 pb-0">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              <span>Split market — insiders on both sides</span>
            </div>
            {onViewMarket && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewMarket(); }}
                className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium transition-colors"
              >
                View market
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top row: Score + Identity + Time */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <span className={cn("font-mono text-lg font-bold tabular-nums leading-none tracking-tight", getScoreColor(score))}>
          {score}
        </span>
        <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-800/60" />
        <TierBadge tier={pick.tier} size="xs" />
        <button
          onClick={(e) => { e.stopPropagation(); onViewInsider?.(pick.wallet_address); }}
          className="font-mono text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 tabular-nums hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
        >
          {walletDisplay}
        </button>
        <span className="ml-auto text-[11px] text-neutral-400 dark:text-neutral-600">
          {time}
        </span>
      </div>

      {/* Content: Left (matchup + meta) | Right (odds + selection) */}
      <div className="flex gap-4 px-4 pb-3">
        {/* Left column */}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-snug tracking-tight mb-1">
            {matchup}
          </h3>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
            {sport && <span className="text-neutral-500 dark:text-neutral-400">{sport}</span>}
            {betType && (
              <>
                <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                <span className="truncate">{betType}</span>
              </>
            )}
            <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
            <span className="font-mono tabular-nums">{formatMoney(amount)}</span>
            {parseFloat(multiplier) >= 1.5 && (
              <>
                <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                <span className={cn(
                  "font-mono font-semibold tabular-nums",
                  parseFloat(multiplier) >= 3 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                )}>
                  {multiplier}x
                </span>
              </>
            )}
            {bestBook && bestBookInfo?.image?.light && (
              <>
                <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                <img
                  src={bestBookInfo.image.light}
                  alt={bestBookInfo.name}
                  className="h-3.5 w-3.5 rounded-sm object-contain opacity-50"
                />
              </>
            )}
          </div>
        </div>

        {/* Right column — stacked: odds on top, selection below */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="font-mono text-base font-bold text-sky-600 dark:text-sky-400 tabular-nums leading-none">
            {formatOdds(price, oddsFormat)}
          </span>
          <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100/80 dark:bg-neutral-800/40 px-2 py-0.5 rounded border border-neutral-200/60 dark:border-neutral-700/30">
            {selectionLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
