"use client"

import { cn } from "@/lib/utils"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { MarketPriceChart } from "./market-price-chart"
import { TierBadge } from "./tier-badge"
import { formatDistanceToNow } from "date-fns"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then(r => r.json())

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

interface MarketOutcome {
  outcome: string
  total_dollars: number
  sharp_count: number
  whale_count: number
  total_bets: number
  avg_entry_price: number
  best_book: string | null
  best_book_price: string | null
  best_book_decimal: number | null
  wins: number
  losses: number
  token_id?: string | null
  bets: Array<{
    anon_id: string
    tier: string
    bet_size: number
    entry_price: number
    american_odds: number | null
    result: string | null
    quality_score: number | null
    created_at: string
  }>
}

interface GameData {
  condition_id: string
  market_title: string
  sport: string | null
  market_type: string | null
  game_date: string | null
  game_start_time: string | null
  resolved: boolean
  consensus_outcome: string
  consensus_result: "win" | "loss" | "pending"
  flow_pct: number
  confidence: "strong" | "lean" | "split"
  total_dollars: number
  total_bets: number
  total_sharps: number
  total_whales: number
  outcomes: MarketOutcome[]
  first_signal_at: string
  last_signal_at: string
}

interface MarketDetailPanelProps {
  game: GameData
  oddsFormat: OddsFormat
}

export function MarketDetailPanel({ game, oddsFormat }: MarketDetailPanelProps) {
  const mainOutcome = game.outcomes[0] || null
  const secondOutcome = game.outcomes[1] || null

  const { data: sideAHistory } = useSWR(
    mainOutcome?.token_id ? `/api/polymarket/price-chart?token_id=${mainOutcome.token_id}` : null,
    fetcher
  )
  const { data: sideBHistory } = useSWR(
    secondOutcome?.token_id ? `/api/polymarket/price-chart?token_id=${secondOutcome.token_id}` : null,
    fetcher
  )

  const timeDisplay = game.game_start_time
    ? formatDistanceToNow(new Date(game.game_start_time), { addSuffix: true })
    : "TBD"

  const allBets = game.outcomes.flatMap(outcome =>
    outcome.bets.map(bet => ({
      ...bet,
      outcome: outcome.outcome,
      outcome_total: outcome.total_dollars
    }))
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "strong": return "text-emerald-600 dark:text-emerald-400"
      case "lean": return "text-amber-600 dark:text-amber-400"
      default: return "text-neutral-500"
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto pr-1">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-[11px] text-neutral-500 mb-1">
          <span className="text-neutral-500 dark:text-neutral-400">{game.sport?.toUpperCase()}</span>
          {game.market_type && (
            <>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span>{game.market_type}</span>
            </>
          )}
          <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
          <span className={getConfidenceColor(game.confidence)}>{game.confidence}</span>
          <span className="ml-auto text-neutral-400 dark:text-neutral-600">{timeDisplay}</span>
        </div>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-200 leading-snug tracking-tight">
          {game.market_title}
        </h2>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Flow", value: formatMoney(game.total_dollars) },
          { label: "Positions", value: String(game.total_bets) },
          { label: "Sharps", value: String(game.total_sharps), color: "text-sky-600 dark:text-sky-400" },
          { label: "Insiders", value: String(game.total_whales), color: "text-purple-600 dark:text-purple-400" },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <div className={cn("font-mono text-sm font-bold tabular-nums", stat.color || "text-neutral-900 dark:text-neutral-200")}>
              {stat.value}
            </div>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Outcomes comparison */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800/40 divide-y divide-neutral-200 dark:divide-neutral-800/30">
        {/* Main outcome (consensus) */}
        {mainOutcome && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">{mainOutcome.outcome}</span>
              <span className="font-mono text-sm font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                {formatOdds(mainOutcome.avg_entry_price * 100, oddsFormat)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] tabular-nums mb-2">
              <span className="text-neutral-500">{formatMoney(mainOutcome.total_dollars)} wagered</span>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span className="text-neutral-500">{mainOutcome.total_bets} bets</span>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span className={cn("font-mono font-medium", mainOutcome.wins > mainOutcome.losses ? "text-emerald-500 dark:text-emerald-400" : "text-red-400")}>
                {mainOutcome.wins}-{mainOutcome.losses}
              </span>
              {mainOutcome.best_book_price && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                  <span className="text-neutral-400">{mainOutcome.best_book} {mainOutcome.best_book_price}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800/50 overflow-hidden">
                <div className="h-full rounded-full bg-sky-500/70 transition-all duration-500" style={{ width: `${game.flow_pct}%` }} />
              </div>
              <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 tabular-nums">{game.flow_pct}%</span>
            </div>
          </div>
        )}

        {/* Secondary outcome */}
        {secondOutcome && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{secondOutcome.outcome}</span>
              <span className="font-mono text-sm font-semibold text-neutral-600 dark:text-neutral-400 tabular-nums">
                {formatOdds(secondOutcome.avg_entry_price * 100, oddsFormat)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] tabular-nums mb-2">
              <span className="text-neutral-500">{formatMoney(secondOutcome.total_dollars)} wagered</span>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span className="text-neutral-500">{secondOutcome.total_bets} bets</span>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span className={cn("font-mono font-medium", secondOutcome.wins > secondOutcome.losses ? "text-emerald-500 dark:text-emerald-400" : "text-red-400")}>
                {secondOutcome.wins}-{secondOutcome.losses}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-neutral-200/80 dark:bg-neutral-800/50 overflow-hidden">
                <div className="h-full rounded-full bg-neutral-400/40 dark:bg-neutral-500/40 transition-all duration-500" style={{ width: `${100 - game.flow_pct}%` }} />
              </div>
              <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-600 tabular-nums">{100 - game.flow_pct}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Price chart */}
      {mainOutcome && secondOutcome && (
        <div>
          <p className="text-[11px] text-neutral-500 mb-2">Price movement</p>
          <MarketPriceChart
            sideAPrice={mainOutcome.avg_entry_price * 100}
            sideBPrice={secondOutcome.avg_entry_price * 100}
            sideAName={mainOutcome.outcome}
            sideBName={secondOutcome.outcome}
            oddsFormat={oddsFormat}
            sideAHistory={sideAHistory?.history}
            sideBHistory={sideBHistory?.history}
          />
        </div>
      )}

      {/* Positions */}
      <div className="flex-1">
        <p className="text-[11px] text-neutral-500 mb-2">Positions ({allBets.length})</p>
        {allBets.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-6">No positions found</p>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800/20">
            {allBets.slice(0, 20).map((bet, index) => {
              const isMainOutcome = bet.outcome === mainOutcome?.outcome
              const timeAgo = formatDistanceToNow(new Date(bet.created_at), { addSuffix: true })
              const priceInCents = bet.entry_price * 100

              return (
                <div
                  key={`${bet.anon_id}-${index}`}
                  className="flex items-center justify-between py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <TierBadge tier={bet.tier} size="xs" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-medium text-neutral-900 dark:text-neutral-200">{bet.anon_id}</span>
                        <span className={cn(
                          "font-medium",
                          isMainOutcome ? "text-sky-600 dark:text-sky-400" : "text-neutral-400"
                        )}>
                          {bet.outcome}
                        </span>
                        {bet.result && (
                          <span className={cn(
                            "font-mono font-medium",
                            bet.result === "win" ? "text-emerald-500 dark:text-emerald-400" : "text-red-400"
                          )}>
                            {bet.result === "win" ? "W" : "L"}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-600">{timeAgo}</p>
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <span className="font-mono font-medium text-neutral-900 dark:text-neutral-200">
                      {formatOdds(priceInCents, oddsFormat)}
                    </span>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-600">
                      {formatMoney(bet.bet_size)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
