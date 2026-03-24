"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { MarketPriceChart } from "./market-price-chart"
import { TierBadge } from "./tier-badge"
import { getSportsbookById, normalizeSportsbookId } from "@/lib/data/sportsbooks"
import { useSignalOdds, type OddsEntry } from "@/hooks/use-signal-odds"
import { useIsMobile } from "@/hooks/use-media-query"
import { format, isToday, isTomorrow, formatDistanceToNow } from "date-fns"
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
  odds_key?: { sport: string; event_id: string; market: string; outcome?: string | null; line?: string | null } | null
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

/** Two-column odds comparison: one row per sportsbook, both sides shown */
function OddsComparison({
  sideALabel, sideBLabel, sideAKey, sideBKey, oddsFormat,
}: {
  sideALabel: string; sideBLabel: string
  sideAKey: any; sideBKey: any
  oddsFormat: OddsFormat
}) {
  const { odds: sideABooks, isLoading: loadingA } = useSignalOdds(sideAKey)
  const { odds: sideBBooks, isLoading: loadingB } = useSignalOdds(sideBKey)
  const isMobile = useIsMobile()

  const loading = (loadingA && sideABooks.length === 0) || (loadingB && sideBBooks.length === 0)

  if (loading) {
    return (
      <div className="space-y-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-neutral-100 dark:bg-neutral-800/20 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  // Merge both sides by book name — one row per sportsbook
  const bookMap = new Map<string, { a?: OddsEntry; b?: OddsEntry; name: string; logo: string | null }>()
  for (const entry of sideABooks) {
    const nid = normalizeSportsbookId(entry.book)
    const sb = getSportsbookById(nid)
    const name = sb?.name || entry.book
    if (!bookMap.has(name)) bookMap.set(name, { name, logo: sb?.image?.light || sb?.image?.dark || sb?.image?.square || null })
    bookMap.get(name)!.a = entry
  }
  for (const entry of sideBBooks) {
    const nid = normalizeSportsbookId(entry.book)
    const sb = getSportsbookById(nid)
    const name = sb?.name || entry.book
    if (!bookMap.has(name)) bookMap.set(name, { name, logo: sb?.image?.light || sb?.image?.dark || sb?.image?.square || null })
    bookMap.get(name)!.b = entry
  }

  const rows = Array.from(bookMap.values())
  if (rows.length === 0) return null

  const bestA = sideABooks[0]?.decimal
  const bestB = sideBBooks[0]?.decimal

  const formatPrice = (entry: OddsEntry) =>
    oddsFormat === "cents" && entry.decimal ? `${Math.round((1 / entry.decimal) * 100)}¢` : entry.price

  const getLink = (entry: OddsEntry) =>
    isMobile ? (entry.mobile_link || entry.link) : (entry.link || entry.mobile_link)

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="w-[100px]" />
        <div className="flex-1 text-center text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider font-medium truncate">
          {sideALabel}
        </div>
        <div className="flex-1 text-center text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider font-medium truncate">
          {sideBLabel}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200/50 dark:border-neutral-700/20 divide-y divide-neutral-200/50 dark:divide-neutral-700/20 overflow-hidden">
        {rows.map((row) => {
          const aBest = row.a?.decimal === bestA
          const bBest = row.b?.decimal === bestB
          const highlight = aBest || bBest

          return (
            <div
              key={row.name}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-xs",
                highlight ? "bg-emerald-50/30 dark:bg-emerald-500/[0.03]" : ""
              )}
            >
              {/* Sportsbook name + logo */}
              <div className="flex items-center gap-2 w-[100px] shrink-0 min-w-0">
                {row.logo ? (
                  <img src={row.logo} alt={row.name} className="h-4 w-4 rounded object-contain shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[7px] font-bold text-neutral-500 shrink-0">
                    {row.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate text-[11px]">
                  {row.name}
                </span>
              </div>

              {/* Side A odds */}
              <div className="flex-1 flex items-center justify-center gap-1.5">
                {row.a ? (
                  <>
                    <span className={cn(
                      "font-mono text-sm font-bold tabular-nums",
                      aBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-neutral-200"
                    )}>
                      {formatPrice(row.a)}
                    </span>
                    {getLink(row.a) && (
                      <a href={getLink(row.a)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="rounded bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20">
                        Bet
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-neutral-300 dark:text-neutral-700">—</span>
                )}
              </div>

              {/* Side B odds */}
              <div className="flex-1 flex items-center justify-center gap-1.5">
                {row.b ? (
                  <>
                    <span className={cn(
                      "font-mono text-sm font-bold tabular-nums",
                      bBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-neutral-200"
                    )}>
                      {formatPrice(row.b)}
                    </span>
                    {getLink(row.b) && (
                      <a href={getLink(row.b)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="rounded bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-500/20">
                        Bet
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-neutral-300 dark:text-neutral-700">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function MarketDetailPanel({ game, oddsFormat }: MarketDetailPanelProps) {
  const mainOutcome = game.outcomes[0] || null
  const secondOutcome = game.outcomes[1] || null

  const INTERVAL_MAP: Record<string, string> = { "1D": "1d", "1W": "1w", "1M": "1m", "MAX": "all" }
  const [chartInterval, setChartInterval] = useState("1W")

  const { data: sideAHistory } = useSWR(
    mainOutcome?.token_id ? `/api/polymarket/price-chart?token_id=${mainOutcome.token_id}&interval=${INTERVAL_MAP[chartInterval]}` : null,
    fetcher,
    { keepPreviousData: true }
  )
  const { data: sideBHistory } = useSWR(
    secondOutcome?.token_id ? `/api/polymarket/price-chart?token_id=${secondOutcome.token_id}&interval=${INTERVAL_MAP[chartInterval]}` : null,
    fetcher,
    { keepPreviousData: true }
  )

  const timeDisplay = (() => {
    if (!game.game_start_time) return "TBD"
    const d = new Date(game.game_start_time)
    if (isToday(d)) return `Today ${format(d, "h:mm a")}`
    if (isTomorrow(d)) return `Tomorrow ${format(d, "h:mm a")}`
    return format(d, "MMM d, h:mm a")
  })()

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
              <span className="capitalize">{game.market_type}</span>
            </>
          )}
          <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
          <span className={cn("capitalize", getConfidenceColor(game.confidence))}>{game.confidence}</span>
          <span className="ml-auto text-neutral-400 dark:text-neutral-600">{timeDisplay}</span>
        </div>
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-200 leading-snug tracking-tight">
          {game.market_title}
        </h2>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
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
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 divide-y divide-neutral-200/60 dark:divide-neutral-700/30">
        {/* Main outcome (consensus) */}
        {mainOutcome && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">{mainOutcome.outcome}</span>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                avg entry {formatOdds(mainOutcome.avg_entry_price * 100, oddsFormat)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] tabular-nums mb-2">
              <span className="text-neutral-500">{formatMoney(mainOutcome.total_dollars)} wagered</span>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span className="text-neutral-500">{mainOutcome.total_bets} bets</span>
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
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                avg entry {formatOdds(secondOutcome.avg_entry_price * 100, oddsFormat)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] tabular-nums mb-2">
              <span className="text-neutral-500">{formatMoney(secondOutcome.total_dollars)} wagered</span>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span className="text-neutral-500">{secondOutcome.total_bets} bets</span>
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
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] text-neutral-500">Price movement</p>
            <div className="flex gap-0.5 bg-white dark:bg-neutral-900/60 rounded-md p-0.5 border border-neutral-200 dark:border-neutral-800/30">
              {["1D", "1W", "1M", "MAX"].map((interval) => (
                <button
                  key={interval}
                  onClick={() => setChartInterval(interval)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-medium rounded transition-all duration-150",
                    chartInterval === interval
                      ? "bg-neutral-100 shadow-sm text-neutral-900 dark:bg-neutral-800/80 dark:text-neutral-200"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  {interval}
                </button>
              ))}
            </div>
          </div>
          <MarketPriceChart
            sideAPrice={mainOutcome.avg_entry_price * 100}
            sideBPrice={secondOutcome.avg_entry_price * 100}
            sideAName={mainOutcome.outcome}
            sideBName={secondOutcome.outcome}
            oddsFormat={oddsFormat}
            sideAHistory={sideAHistory?.history}
            sideBHistory={sideBHistory?.history}
            fills={allBets.map(b => ({
              time: new Date(b.created_at).getTime(),
              price: Math.round(b.entry_price * 100),
              outcome: b.outcome,
            }))}
          />
        </div>
      )}

      {/* Where to bet — side-by-side comparison */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-3">Where to bet</p>
        {mainOutcome?.odds_key || secondOutcome?.odds_key ? (
          <OddsComparison
            sideALabel={mainOutcome?.outcome || "Side A"}
            sideBLabel={secondOutcome?.outcome || "Side B"}
            sideAKey={mainOutcome?.odds_key}
            sideBKey={secondOutcome?.odds_key}
            oddsFormat={oddsFormat}
          />
        ) : (
          <p className="text-xs text-neutral-400 dark:text-neutral-600 py-3 text-center">
            No sportsbook odds available for this market
          </p>
        )}
      </div>

      {/* Positions */}
      <div className="flex-1 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
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
