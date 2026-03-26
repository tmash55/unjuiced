"use client"

import { cn } from "@/lib/utils"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { WhaleSignal } from "@/lib/polymarket/types"
import { TierBadge } from "./tier-badge"
import { SportIcon } from "@/components/icons/sport-icons"
import { EyeOff, Eye } from "lucide-react"
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
  onHide?: () => void
  isHidden?: boolean
  isTourTarget?: boolean
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export function PickCard({ pick, isSelected, onSelect, oddsFormat, isSplitMarket, onViewMarket, onViewInsider, onHide, isHidden, isTourTarget }: PickCardProps) {
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
  const isSell = (pick.side || "").toUpperCase() === "SELL"
  const rawPrice = Math.round(pick.entry_price * 100)
  const price = isSell ? (100 - rawPrice) : rawPrice
  const multiplier = pick.stake_vs_avg?.toFixed(1) || "1.0"
  const walletDisplay = pick.wallet_address
    ? `#${pick.wallet_address.slice(0, 4).toUpperCase()}`
    : "Anon"

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-emerald-600 dark:text-emerald-400"
    if (s >= 60) return "text-sky-600 dark:text-sky-400"
    if (s >= 40) return "text-neutral-500 dark:text-neutral-400"
    return "text-neutral-400 dark:text-neutral-600"
  }

  const selectionLabel = (() => {
    const label = (betType || "").toLowerCase()
    const title = (pick.market_title || "").toLowerCase()
    const lineMatch = (betType || pick.market_title || "").match(/-?\d+\.?\d*/)
    const line = lineMatch ? lineMatch[0] : null

    if (label.includes("spread") || title.includes("spread")) {
      if (pick.spread_display) return pick.spread_display
      return line ? `${selection} ${line}` : selection
    }
    if (label.includes("total") || label.includes("o/u") || title.includes("total") || title.includes("o/u")) {
      const selLower = selection.toLowerCase()
      const isUnder = selLower.includes("under") || selLower === "no"
      const ou = isSell ? (isUnder ? "Over" : "Under") : (isUnder ? "Under" : "Over")
      return line ? `${ou} ${line}` : ou
    }
    if (isSell) {
      const opp = selection === pick.home_team ? pick.away_team
        : selection === pick.away_team ? pick.home_team
        : null
      return opp || `Against ${selection}`
    }
    return selection
  })()

  const hasBanner = (pick.has_opposing_position && pick.opposing_position) || (isSplitMarket && !pick.has_opposing_position)

  return (
    <div
      onClick={() => onSelect(pick)}
      className={cn(
        "group cursor-pointer rounded-xl border transition-all duration-150 relative",
        isHidden && "opacity-30 border-dashed border-neutral-300 dark:border-neutral-700",
        !isHidden && isSelected
          ? "border-sky-200 dark:border-sky-500/20 bg-sky-50/30 dark:bg-sky-500/[0.04]"
          : !isHidden && "border-neutral-200/60 dark:border-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-600/40",
        "active:scale-[0.998]"
      )}
      {...(isTourTarget ? { "data-tour": "pick-card" } : {})}
    >
      <div className="px-3.5 py-3">
        {/* ── Desktop layout ── */}
        <div className="flex gap-3">
          {/* Left: info stack */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Score + tier + wallet + hide */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn("font-mono text-base font-bold tabular-nums leading-none tracking-tighter", getScoreColor(score))}>
                {score}
              </span>
              <TierBadge tier={pick.tier} size="xs" {...(isTourTarget ? { "data-tour": "tier-badge" } : {})} />
              <button
                onClick={(e) => { e.stopPropagation(); onViewInsider?.(pick.wallet_address); }}
                className="font-mono text-[11px] font-semibold text-neutral-500 dark:text-neutral-500 tabular-nums hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              >
                {walletDisplay}
              </button>
              <div className="flex-1" />
              {/* Sport label — desktop */}
              <span className="hidden sm:inline text-[10px] font-semibold text-neutral-400 dark:text-neutral-600 uppercase tracking-wider">
                {sport}
              </span>
              {/* Hide button — desktop */}
              {onHide && (
                <button
                  onClick={(e) => { e.stopPropagation(); onHide(); }}
                  className="hidden sm:flex p-1 rounded-md text-neutral-400/60 hover:text-neutral-600 dark:hover:text-neutral-300 opacity-0 group-hover:opacity-100 transition-all"
                  title={isHidden ? "Unhide this pick" : "Hide this pick"}
                >
                  {isHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Row 2: Matchup title */}
            <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 leading-snug tracking-tight truncate mb-1">
              {matchup}
            </h3>

            {/* Row 3: Meta — bet type, time, amount, multiplier */}
            <div {...(isTourTarget ? { "data-tour": "meta-row" } : {})} className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
              {betType && <span className="text-neutral-500 dark:text-neutral-400">{betType}</span>}
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span>{time}</span>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span className="font-mono font-medium tabular-nums text-neutral-600 dark:text-neutral-300">{formatMoney(amount)}</span>
              <span
                {...(isTourTarget ? { "data-tour": "multiplier" } : {})}
                className={cn(
                  "font-mono font-bold tabular-nums ml-0.5",
                  parseFloat(multiplier) >= 3 ? "text-emerald-600 dark:text-emerald-400"
                    : parseFloat(multiplier) >= 1.5 ? "text-emerald-500 dark:text-emerald-400"
                    : "text-neutral-400 dark:text-neutral-500"
                )}>
                {multiplier}x
              </span>
            </div>
          </div>

          {/* Right: Selection block — desktop only */}
          <div {...(isTourTarget ? { "data-tour": "selection-block" } : {})} className="hidden sm:flex shrink-0 w-[120px] flex-col items-center justify-center rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/40 dark:border-neutral-700/20 px-2.5 py-2">
            <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 text-center leading-tight truncate w-full mb-0.5">
              {selectionLabel}
            </span>
            <span className="font-mono text-lg font-bold text-neutral-900 dark:text-neutral-100 tabular-nums leading-none">
              {formatOdds(price, oddsFormat)}
            </span>
          </div>
        </div>

        {/* ── Mobile: selection row ── */}
        <div {...(isTourTarget ? { "data-tour": "selection-block-mobile" } : {})} className="sm:hidden flex items-center gap-2 mt-2.5 pt-2 border-t border-neutral-200/30 dark:border-neutral-700/20">
          {/* Sport + hide */}
          <div className="flex items-center gap-1 shrink-0">
            <SportIcon sport={(pick.sport || "").toLowerCase()} className="h-3.5 w-3.5 text-neutral-400" />
            <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">{sport}</span>
          </div>

          {onHide && (
            <button
              onClick={(e) => { e.stopPropagation(); onHide(); }}
              className="p-1 rounded-md text-neutral-400/60 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              {isHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </button>
          )}

          <div className="flex-1" />

          {/* Selection + odds */}
          <div className="flex items-center gap-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/40 dark:border-neutral-700/20 px-2.5 py-1.5">
            <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 truncate max-w-[100px]">
              {selectionLabel}
            </span>
            <span className="font-mono text-sm font-bold text-neutral-900 dark:text-neutral-100 tabular-nums leading-none">
              {formatOdds(price, oddsFormat)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Banners ── */}
      {hasBanner && (
        <div className="px-3.5 pb-2.5 -mt-0.5">
          {pick.has_opposing_position && pick.opposing_position && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-600/80 dark:text-amber-400/70">
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <span>
                {pick.opposing_position.type === "same_market"
                  ? `Hedged — also has ${formatMoney(Math.round(pick.opposing_position.total_size))} on ${pick.opposing_position.outcome}`
                  : `Also bet opposing ${pick.opposing_position.opposing_markets?.join(", ") || "market"} — ${formatMoney(Math.round(pick.opposing_position.total_size))} on ${pick.opposing_position.outcome}`
                }
              </span>
            </div>
          )}
          {isSplitMarket && !pick.has_opposing_position && (
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 text-neutral-500/80 dark:text-neutral-500">
                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                <span>Split market — insiders on both sides</span>
              </div>
              {onViewMarket && (
                <button
                  onClick={(e) => { e.stopPropagation(); onViewMarket(); }}
                  className="text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300 font-medium transition-colors"
                >
                  View market
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
