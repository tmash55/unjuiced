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
import { useStateLink } from "@/hooks/use-state-link"

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
    wallet_address?: string
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

type FlowMode = "liquidity" | "bettors" | "conviction"

interface MarketDetailPanelProps {
  game: GameData
  oddsFormat: OddsFormat
  onViewInsider?: (walletAddress: string) => void
  flowMode?: FlowMode
  onFlowModeChange?: (mode: FlowMode) => void
}

/** Two-column odds comparison: one row per sportsbook, both sides shown */
function OddsComparison({
  sideALabel, sideBLabel, sideAKey, sideBKey, oddsFormat,
}: {
  sideALabel: string; sideBLabel: string
  sideAKey: any; sideBKey: any
  oddsFormat: OddsFormat
}) {
  const applyState = useStateLink()
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
                      <a href={applyState(getLink(row.a)) || getLink(row.a)!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
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
                      <a href={applyState(getLink(row.b)) || getLink(row.b)!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
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

export function MarketDetailPanel({ game, oddsFormat, onViewInsider, flowMode: externalFlowMode, onFlowModeChange }: MarketDetailPanelProps) {
  const mainOutcome = game.outcomes[0] || null
  const secondOutcome = game.outcomes[1] || null

  const INTERVAL_MAP: Record<string, string> = { "1D": "1d", "1W": "1w", "1M": "1m", "MAX": "all" }
  const [chartInterval, setChartInterval] = useState("1W")
  const [internalFlowMode, setInternalFlowMode] = useState<FlowMode>("liquidity")
  const flowMode = externalFlowMode ?? internalFlowMode
  const setFlowMode = onFlowModeChange ?? setInternalFlowMode

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

  // Compute per-side analytics: unique wallets, sharps, insiders, conviction
  const sideAnalytics = (outcome: MarketOutcome | null) => {
    if (!outcome) return { uniqueWallets: 0, uniqueSharps: 0, uniqueInsiders: 0, avgStake: 0, maxStake: 0, totalVolume: 0 }
    const wallets = new Set<string>()
    const sharps = new Set<string>()
    const insiders = new Set<string>()
    let totalStake = 0, maxStake = 0
    for (const bet of outcome.bets) {
      const id = bet.wallet_address || bet.anon_id
      wallets.add(id)
      if (bet.tier === "sharp") sharps.add(id)
      else if (bet.tier === "whale") insiders.add(id)
      totalStake += bet.bet_size
      if (bet.bet_size > maxStake) maxStake = bet.bet_size
    }
    return {
      uniqueWallets: wallets.size,
      uniqueSharps: sharps.size,
      uniqueInsiders: insiders.size,
      avgStake: wallets.size > 0 ? totalStake / wallets.size : 0,
      maxStake,
      totalVolume: totalStake,
    }
  }

  const sideA = sideAnalytics(mainOutcome)
  const sideB = sideAnalytics(secondOutcome)
  const totalUniqueSharps = sideA.uniqueSharps + sideB.uniqueSharps
  const totalUniqueInsiders = sideA.uniqueInsiders + sideB.uniqueInsiders
  const totalUniqueWallets = sideA.uniqueWallets + sideB.uniqueWallets

  // Compute flow % for each mode
  const flowPctA = (() => {
    if (flowMode === "liquidity") return game.flow_pct
    if (flowMode === "bettors") {
      const total = sideA.uniqueWallets + sideB.uniqueWallets
      return total > 0 ? Math.round((sideA.uniqueWallets / total) * 100) : 50
    }
    // Conviction: weight volume by tier quality
    const convA = sideA.totalVolume * (1 + sideA.uniqueSharps * 0.5 + sideA.uniqueInsiders * 0.25)
    const convB = sideB.totalVolume * (1 + sideB.uniqueSharps * 0.5 + sideB.uniqueInsiders * 0.25)
    const total = convA + convB
    return total > 0 ? Math.round((convA / total) * 100) : 50
  })()

  const FLOW_MODES: { value: FlowMode; label: string }[] = [
    { value: "liquidity", label: "Liquidity" },
    { value: "bettors", label: "Bettors" },
    { value: "conviction", label: "Conviction" },
  ]

  // Group positions by wallet + outcome (same wallet on both sides = two rows)
  const walletPositions = (() => {
    const map = new Map<string, { anon_id: string; wallet_address?: string; tier: string; outcome: string; totalSize: number; betCount: number; avgPrice: number; lastBet: string; hasBothSides?: boolean }>()
    // Track which wallets bet on multiple sides
    const walletOutcomes = new Map<string, Set<string>>()

    for (const bet of allBets) {
      const walletId = bet.wallet_address || bet.anon_id
      const key = `${walletId}:${bet.outcome}`

      // Track outcomes per wallet
      const outcomes = walletOutcomes.get(walletId) || new Set()
      outcomes.add(bet.outcome)
      walletOutcomes.set(walletId, outcomes)

      const existing = map.get(key)
      if (existing) {
        existing.totalSize += bet.bet_size
        existing.betCount += 1
        existing.avgPrice = (existing.avgPrice * (existing.betCount - 1) + bet.entry_price) / existing.betCount
        if (bet.created_at > existing.lastBet) existing.lastBet = bet.created_at
      } else {
        map.set(key, {
          anon_id: bet.anon_id,
          wallet_address: bet.wallet_address,
          tier: bet.tier,
          outcome: bet.outcome,
          totalSize: bet.bet_size,
          betCount: 1,
          avgPrice: bet.entry_price,
          lastBet: bet.created_at,
        })
      }
    }

    // Mark wallets that bet on both sides
    const positions = Array.from(map.values())
    for (const pos of positions) {
      const walletId = pos.wallet_address || pos.anon_id
      const outcomes = walletOutcomes.get(walletId)
      if (outcomes && outcomes.size > 1) pos.hasBothSides = true
    }

    return positions.sort((a, b) => new Date(b.lastBet).getTime() - new Date(a.lastBet).getTime())
  })()

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "strong": return "text-[#22C55E]"
      case "lean": return "text-[#F59E0B]"
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

      {/* Stats row — highlight the stat matching the current flow mode */}
      <div className="grid grid-cols-4 gap-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
        {[
          { label: "Flow", value: formatMoney(game.total_dollars), highlight: flowMode === "liquidity" },
          { label: "Bettors", value: String(totalUniqueWallets), highlight: flowMode === "bettors" },
          { label: "Sharps", value: String(totalUniqueSharps), color: "text-sky-600 dark:text-sky-400", highlight: flowMode === "bettors" },
          { label: "Insiders", value: String(totalUniqueInsiders), color: "text-purple-600 dark:text-purple-400", highlight: flowMode === "conviction" },
        ].map((stat) => (
          <div key={stat.label} className={cn("text-center rounded-md py-1 transition-all", stat.highlight && "bg-white dark:bg-neutral-700/40 shadow-sm ring-1 ring-neutral-200/60 dark:ring-neutral-600/30")}>
            <div className={cn("font-mono text-sm font-bold tabular-nums", stat.color || "text-neutral-900 dark:text-neutral-200")}>
              {stat.value}
            </div>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Outcomes comparison */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30">
        {/* Flow mode toggle */}
        <div className="flex items-center gap-0.5 p-1.5 bg-neutral-100/50 dark:bg-neutral-800/30 border-b border-neutral-200/40 dark:border-neutral-700/20">
          {FLOW_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setFlowMode(mode.value)}
              className={cn(
                "flex-1 px-2 py-1 text-[10px] font-medium rounded-md transition-all duration-150",
                flowMode === mode.value
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-200 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-neutral-200/60 dark:divide-neutral-700/30">
        {/* Main outcome (consensus) */}
        {mainOutcome && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">{mainOutcome.outcome}</span>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                avg entry {formatOdds(mainOutcome.avg_entry_price * 100, oddsFormat)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] tabular-nums mb-2">
              <span className={cn(flowMode === "liquidity" ? "text-neutral-900 dark:text-neutral-200 font-semibold" : "text-neutral-500")}>{formatMoney(mainOutcome.total_dollars)}</span>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span className={cn(flowMode === "bettors" ? "text-neutral-900 dark:text-neutral-200 font-semibold" : "text-neutral-500")}>{sideA.uniqueWallets} bettor{sideA.uniqueWallets !== 1 ? "s" : ""}</span>
              {sideA.uniqueSharps > 0 && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                  <span className={cn("font-medium", flowMode === "bettors" ? "text-sky-500" : "text-sky-600 dark:text-sky-400")}>{sideA.uniqueSharps} sharp{sideA.uniqueSharps !== 1 ? "s" : ""}</span>
                </>
              )}
              {sideA.uniqueInsiders > 0 && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                  <span className="text-purple-600 dark:text-purple-400 font-medium">{sideA.uniqueInsiders} insider{sideA.uniqueInsiders !== 1 ? "s" : ""}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-neutral-200/80 dark:bg-neutral-800/50 overflow-hidden">
                <div className="h-full rounded-full bg-sky-500/70 transition-all duration-500" style={{ width: `${flowPctA}%` }} />
              </div>
              <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 tabular-nums font-bold">{flowPctA}%</span>
            </div>
            {sideA.maxStake > 0 && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-neutral-400">
                <span>Avg <span className="font-mono font-medium text-neutral-600 dark:text-neutral-300">{formatMoney(sideA.avgStake)}</span></span>
                <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                <span>Max <span className="font-mono font-medium text-neutral-600 dark:text-neutral-300">{formatMoney(sideA.maxStake)}</span></span>
              </div>
            )}
          </div>
        )}

        {/* Secondary outcome */}
        {secondOutcome && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{secondOutcome.outcome}</span>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                avg entry {formatOdds(secondOutcome.avg_entry_price * 100, oddsFormat)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] tabular-nums mb-2">
              <span className={cn(flowMode === "liquidity" ? "text-neutral-900 dark:text-neutral-200 font-semibold" : "text-neutral-500")}>{formatMoney(secondOutcome.total_dollars)}</span>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span className={cn(flowMode === "bettors" ? "text-neutral-900 dark:text-neutral-200 font-semibold" : "text-neutral-500")}>{sideB.uniqueWallets} bettor{sideB.uniqueWallets !== 1 ? "s" : ""}</span>
              {sideB.uniqueSharps > 0 && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                  <span className={cn("font-medium", flowMode === "bettors" ? "text-sky-500" : "text-sky-600 dark:text-sky-400")}>{sideB.uniqueSharps} sharp{sideB.uniqueSharps !== 1 ? "s" : ""}</span>
                </>
              )}
              {sideB.uniqueInsiders > 0 && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                  <span className="text-purple-600 dark:text-purple-400 font-medium">{sideB.uniqueInsiders} insider{sideB.uniqueInsiders !== 1 ? "s" : ""}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-neutral-200/80 dark:bg-neutral-800/50 overflow-hidden">
                <div className="h-full rounded-full bg-neutral-400/40 dark:bg-neutral-500/40 transition-all duration-500" style={{ width: `${100 - flowPctA}%` }} />
              </div>
              <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-600 tabular-nums font-bold">{100 - flowPctA}%</span>
            </div>
            {sideB.maxStake > 0 && (
              <div className="mt-2 flex items-center gap-2 text-[10px] text-neutral-400">
                <span>Avg <span className="font-mono font-medium text-neutral-600 dark:text-neutral-300">{formatMoney(sideB.avgStake)}</span></span>
                <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                <span>Max <span className="font-mono font-medium text-neutral-600 dark:text-neutral-300">{formatMoney(sideB.maxStake)}</span></span>
              </div>
            )}
          </div>
        )}
        </div>
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

      {/* Positions — grouped by unique wallet, sorted by total size */}
      <div className="flex-1 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] text-neutral-500">{new Set(walletPositions.map(p => p.wallet_address || p.anon_id)).size} unique bettor{new Set(walletPositions.map(p => p.wallet_address || p.anon_id)).size !== 1 ? "s" : ""}</p>
          <p className="text-[10px] text-neutral-400">{allBets.length} total positions</p>
        </div>
        {walletPositions.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-6">No positions found</p>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800/20">
            {walletPositions.map((pos, index) => {
              const isMainOutcome = pos.outcome === mainOutcome?.outcome
              const timeAgo = formatDistanceToNow(new Date(pos.lastBet), { addSuffix: true })
              const priceInCents = pos.avgPrice * 100

              return (
                <div
                  key={`${pos.anon_id}-${index}`}
                  className="flex items-center justify-between py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <TierBadge tier={pos.tier} size="xs" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        {pos.wallet_address && onViewInsider ? (
                          <button
                            onClick={() => onViewInsider(pos.wallet_address!)}
                            className="font-mono text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300 transition-colors"
                          >
                            {pos.anon_id}
                          </button>
                        ) : (
                          <span className="font-mono text-xs font-medium text-neutral-900 dark:text-neutral-200">{pos.anon_id}</span>
                        )}
                        <span className={cn(
                          "font-medium",
                          isMainOutcome ? "text-sky-600 dark:text-sky-400" : "text-neutral-400"
                        )}>
                          {pos.outcome}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 dark:text-neutral-600">
                        <span>{timeAgo}</span>
                        {pos.betCount > 1 && (
                          <>
                            <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                            <span className="font-medium text-neutral-500">{pos.betCount} fills</span>
                          </>
                        )}
                        {pos.hasBothSides && (
                          <>
                            <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                            <span className="font-medium text-amber-500 dark:text-amber-400">Both sides</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <span className="font-mono font-medium text-neutral-900 dark:text-neutral-200">
                      {formatOdds(priceInCents, oddsFormat)}
                    </span>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-600">
                      {formatMoney(pos.totalSize)}
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
