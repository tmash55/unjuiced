"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Clock, Users, Target } from "lucide-react"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { MarketPriceChart } from "./market-price-chart"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

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
  // Get the two main outcomes (we sort by dollars in API)
  const mainOutcome = game.outcomes[0] || null
  const secondOutcome = game.outcomes[1] || null

  const timeDisplay = game.game_start_time 
    ? formatDistanceToNow(new Date(game.game_start_time), { addSuffix: true })
    : "TBD"

  // Collect all bets across outcomes for the feed
  const allBets = game.outcomes.flatMap(outcome => 
    outcome.bets.map(bet => ({
      ...bet,
      outcome: outcome.outcome,
      outcome_total: outcome.total_dollars
    }))
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "strong": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      case "lean": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
      default: return "text-neutral-400 bg-neutral-500/10 border-neutral-700"
    }
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case "s": return "bg-purple-500/20 text-purple-300 border-purple-500/30"
      case "a": return "bg-blue-500/20 text-blue-300 border-blue-500/30"
      case "b": return "bg-green-500/20 text-green-300 border-green-500/30"
      case "c": return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
      case "whale": return "bg-sky-500/20 text-sky-300 border-sky-500/30"
      case "sharp": return "bg-orange-500/20 text-orange-300 border-orange-500/30"
      case "fade": return "bg-red-500/20 text-red-300 border-red-500/30"
      default: return "bg-neutral-500/20 text-neutral-300 border-neutral-700"
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {/* Market Header */}
      <Card className="border-neutral-800 bg-neutral-900">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-400">
                  {game.sport} • {game.market_type}
                </span>
                <span 
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium border",
                    getConfidenceColor(game.confidence)
                  )}
                >
                  {game.confidence.toUpperCase()}
                </span>
              </div>
              <CardTitle className="text-xl text-neutral-200">{game.market_title}</CardTitle>
            </div>
            <div className="flex items-center gap-1 text-sm text-neutral-500">
              <Clock className="h-4 w-4" />
              {timeDisplay}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Market Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-lg font-bold text-neutral-200">${(game.total_dollars / 1000).toFixed(1)}k</div>
              <p className="text-xs text-neutral-500">Total Flow</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-neutral-200">{game.total_bets}</div>
              <p className="text-xs text-neutral-500">Positions</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-sky-400">{game.total_sharps}</div>
              <p className="text-xs text-neutral-500">Sharps</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-400">{game.total_whales}</div>
              <p className="text-xs text-neutral-500">Whales</p>
            </div>
          </div>

          {/* Two Outcomes Comparison */}
          <div className="grid grid-cols-1 gap-4">
            {/* Main Outcome (Consensus) */}
            {mainOutcome && (
              <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-neutral-200">{mainOutcome.outcome}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-neutral-400">
                      <Users className="h-3 w-3" />
                      {mainOutcome.total_bets}
                    </div>
                    {mainOutcome.best_book_price && (
                      <span className="text-xs text-neutral-400">
                        Best: {mainOutcome.best_book} {mainOutcome.best_book_price}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-neutral-500">Wagered</p>
                    <p className="font-semibold text-neutral-200">${(mainOutcome.total_dollars / 1000).toFixed(1)}k</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Avg Entry</p>
                    <p className="font-semibold text-neutral-200">
                      {formatOdds(mainOutcome.avg_entry_price * 100, oddsFormat)}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Record</p>
                    <p className={cn(
                      "font-semibold",
                      mainOutcome.wins > mainOutcome.losses ? "text-emerald-400" : "text-red-400"
                    )}>
                      {mainOutcome.wins}-{mainOutcome.losses}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="h-2 rounded-full bg-neutral-700 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-sky-500 transition-all"
                      style={{ width: `${game.flow_pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-sky-400 mt-1 font-medium">{game.flow_pct}% of insider flow</p>
                </div>
              </div>
            )}

            {/* Secondary Outcome */}
            {secondOutcome && (
              <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-neutral-300">{secondOutcome.outcome}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                      <Users className="h-3 w-3" />
                      {secondOutcome.total_bets}
                    </div>
                    {secondOutcome.best_book_price && (
                      <span className="text-xs text-neutral-500">
                        Best: {secondOutcome.best_book} {secondOutcome.best_book_price}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-neutral-500">Wagered</p>
                    <p className="font-semibold text-neutral-300">${(secondOutcome.total_dollars / 1000).toFixed(1)}k</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Avg Entry</p>
                    <p className="font-semibold text-neutral-300">
                      {formatOdds(secondOutcome.avg_entry_price * 100, oddsFormat)}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Record</p>
                    <p className={cn(
                      "font-semibold",
                      secondOutcome.wins > secondOutcome.losses ? "text-emerald-400" : "text-red-400"
                    )}>
                      {secondOutcome.wins}-{secondOutcome.losses}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="h-2 rounded-full bg-neutral-700 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-neutral-500 transition-all"
                      style={{ width: `${100 - game.flow_pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 font-medium">{100 - game.flow_pct}% of insider flow</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Price Movement Chart */}
      {mainOutcome && secondOutcome && (
        <Card className="border-neutral-800 bg-neutral-900">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-neutral-200">
              <Target className="h-4 w-4 text-sky-400" />
              Price Movement & Position Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MarketPriceChart 
              sideAPrice={mainOutcome.avg_entry_price * 100}
              sideBPrice={secondOutcome.avg_entry_price * 100}
              sideAName={mainOutcome.outcome}
              sideBName={secondOutcome.outcome}
              oddsFormat={oddsFormat}
            />
          </CardContent>
        </Card>
      )}

      {/* Positions Feed */}
      <Card className="border-neutral-800 bg-neutral-900 flex-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base text-neutral-200">
              <Users className="h-4 w-4 text-sky-400" />
              Insider Positions ({allBets.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-neutral-800">
            {allBets.slice(0, 20).map((bet, index) => {
              const isMainOutcome = bet.outcome === mainOutcome?.outcome
              const timeAgo = formatDistanceToNow(new Date(bet.created_at), { addSuffix: true })
              const priceInCents = bet.entry_price * 100
              
              return (
                <div 
                  key={`${bet.anon_id}-${index}`}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 hover:bg-neutral-800/50 transition-colors",
                    isMainOutcome ? "border-l-2 border-l-sky-500" : "border-l-2 border-l-neutral-600"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded text-xs font-bold border",
                      getTierBadgeColor(bet.tier)
                    )}>
                      {bet.tier?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-neutral-200">{bet.anon_id}</span>
                        <span className={cn(
                          "text-xs font-medium",
                          isMainOutcome ? "text-sky-400" : "text-neutral-400"
                        )}>
                          {bet.outcome}
                        </span>
                        {bet.result && (
                          <span className={cn(
                            "px-1 rounded text-xs font-medium",
                            bet.result === "win" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                          )}>
                            {bet.result}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500">{timeAgo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-200">
                        ${bet.bet_size.toLocaleString()}
                      </span>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 font-mono text-xs font-medium",
                        isMainOutcome 
                          ? "bg-sky-500/20 text-sky-400" 
                          : "bg-neutral-500/20 text-neutral-400"
                      )}>
                        {formatOdds(priceInCents, oddsFormat)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {Math.round(bet.bet_size / bet.entry_price).toLocaleString()} shares
                    </p>
                  </div>
                </div>
              )
            })}
            
            {allBets.length === 0 && (
              <div className="flex items-center justify-center py-8 text-neutral-500">
                No positions found for this market
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}