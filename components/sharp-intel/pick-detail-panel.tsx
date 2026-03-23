"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ExternalLink } from "lucide-react"
import { PriceChart } from "./price-chart"
import { OrderBook } from "./order-book"
import { TierBadge } from "./tier-badge"
import { Tooltip } from "@/components/tooltip"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { WhaleSignal } from "@/lib/polymarket/types"
import { getSportsbookById, normalizeSportsbookId } from "@/lib/data/sportsbooks"
import { useSignalOdds } from "@/hooks/use-signal-odds"
import { useIsMobile } from "@/hooks/use-media-query"
import { formatDistanceToNow } from "date-fns"
import useSWR from "swr"

interface PickDetailPanelProps {
  pick: WhaleSignal
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

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function PickDetailPanel({ pick, oddsFormat, isSplitMarket, onViewMarket, onViewInsider }: PickDetailPanelProps) {
  const score = Math.round(pick.signal_score || 0)
  const matchup = pick.event_title || pick.market_title
  const betType = pick.market_label || pick.market_type || ""
  const selection = pick.outcome
  const shares = pick.total_shares || Math.round(pick.bet_size / pick.entry_price)
  const amount = pick.bet_size
  const price = Math.round(pick.entry_price * 100)
  const multiplier = pick.stake_vs_avg?.toFixed(1) || "1.0"
  const walletDisplay = pick.wallet_address
    ? `#${pick.wallet_address.slice(0, 4).toUpperCase()}`
    : "Anon"

  // Chart interval state — maps UI labels to API params
  const INTERVAL_MAP: Record<string, string> = { "1D": "1d", "1W": "1w", "1M": "1m", "MAX": "all" }
  const [chartInterval, setChartInterval] = useState("1W")

  const { data: priceData, isLoading: priceLoading, isValidating: priceValidating } = useSWR(
    pick.token_id ? `/api/polymarket/price-chart?token_id=${pick.token_id}&interval=${INTERVAL_MAP[chartInterval]}` : null,
    fetcher,
    { keepPreviousData: true }
  )
  const { data: orderBookData } = useSWR(
    pick.token_id ? `/api/polymarket/orderbook?token_id=${pick.token_id}` : null,
    fetcher
  )

  // Fetch live odds separately via dedicated endpoint
  const { odds: allBooks, best: bestBook, isLoading: oddsLoading } = useSignalOdds(pick.odds_key)
  const bestBookId = bestBook?.book
  const isMobile = useIsMobile()

  // Current Polymarket price — prefer live odds from Redis, fallback to chart's last point
  const polyOddsEntry = allBooks.find(b => b.book === "polymarket")
  const currentPolyPrice = polyOddsEntry?.decimal
    ? Math.round((1 / polyOddsEntry.decimal) * 100)
    : priceData?.history?.length > 0
      ? Math.round(priceData.history[priceData.history.length - 1].p * 100)
      : null
  const entryPriceCents = Math.round(pick.entry_price * 100)
  const priceChange = currentPolyPrice != null ? currentPolyPrice - entryPriceCents : null

  // Slippage calculation
  // For BUY/YES: market moved up = slippage (edge narrowed)
  // For SELL/NO: market moved down = slippage (edge narrowed)
  const isBuySide = pick.side === "BUY" || pick.side === "YES" || pick.side === "over"
  const slippage = currentPolyPrice != null && entryPriceCents > 0
    ? isBuySide
      ? ((currentPolyPrice - entryPriceCents) / entryPriceCents) * 100
      : ((entryPriceCents - currentPolyPrice) / entryPriceCents) * 100
    : null

  const getSlippageInfo = (s: number) => {
    const abs = Math.abs(s)
    if (s < 0) return {
      label: "Edge growing",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      border: "border-emerald-200 dark:border-emerald-500/20",
      tip: "The market has moved away from the sharp's position. The edge may be larger now than at entry.",
    }
    if (abs <= 3) return {
      label: "Low slippage",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      border: "border-emerald-200 dark:border-emerald-500/20",
      tip: "0-3% slippage is ideal. The market hasn't moved much since the sharp entered — most of the edge is still available.",
    }
    if (abs <= 5) return {
      label: "Moderate slippage",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      border: "border-amber-200 dark:border-amber-500/20",
      tip: "3-5% slippage means the market has started moving toward the sharp's position. Some edge remains but act quickly.",
    }
    return {
      label: "High slippage",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-500/10",
      border: "border-red-200 dark:border-red-500/20",
      tip: "5%+ slippage means the market has significantly moved toward the sharp's position. The edge is likely gone or very small.",
    }
  }

  return (
    <div data-tour="detail-panel" className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      {/* Header — game info */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <TierBadge tier={pick.tier} size="xs" />
              <button
                onClick={(e) => { e.stopPropagation(); onViewInsider?.(pick.wallet_address); }}
                className="font-mono text-xs font-semibold text-neutral-600 dark:text-neutral-400 tabular-nums hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
              >
                {walletDisplay}
              </button>
              {pick.wallet_record && (
                <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">{pick.wallet_record}</span>
              )}
            </div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-200 leading-snug tracking-tight">{matchup}</h2>
            {betType && <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">{betType}</p>}
          </div>
          {pick.token_id && (() => {
            // Use deep link from odds data if available, fallback to event page
            const polyOdds = allBooks.find(b => b.book === "polymarket")
            const polyLink = polyOdds?.link || polyOdds?.mobile_link || `https://polymarket.com/event/${(pick as any).event_slug || (pick as any).condition_id || pick.token_id}`
            return (
              <button
                className="flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700/40 px-2 py-1 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-300 shrink-0"
                onClick={() => window.open(polyLink, '_blank')}
              >
                <ExternalLink className="h-3 w-3" />
                Polymarket
              </button>
            )
          })()}
        </div>

        {/* Split market banner — inside header card */}
        {isSplitMarket && (
          <div className="flex items-center justify-between text-[11px] mt-2.5 pt-2.5 border-t border-neutral-200/50 dark:border-neutral-700/30">
          <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            <span>Insiders on both sides of this market</span>
          </div>
          {onViewMarket && (
            <button
              onClick={onViewMarket}
              className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium transition-colors"
            >
              View market
            </button>
          )}
        </div>
      )}
      </div>

      {/* Signal details */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Signal</p>
        <div className="divide-y divide-neutral-200/60 dark:divide-neutral-700/30">
          {/* Selection + Odds */}
          <div className="flex items-baseline justify-between pb-2">
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">{selection}</p>
            <Tooltip content="The price on Polymarket when this insider entered their position.">
              <span className="font-mono text-lg font-bold text-sky-600 dark:text-sky-400 tabular-nums cursor-help">
                {formatOdds(price, oddsFormat)}
              </span>
            </Tooltip>
          </div>

          {/* Entry → Now + Slippage */}
          <div className="flex items-center justify-between py-2 text-xs tabular-nums">
            <div className="flex items-center gap-2.5">
              <Tooltip content="The price when this insider opened their position.">
                <span className="text-neutral-500 cursor-help">
                  <span className="text-emerald-500 dark:text-emerald-400 mr-1">Entry</span>
                  <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">{formatOdds(entryPriceCents, oddsFormat)}</span>
                </span>
              </Tooltip>
              {currentPolyPrice != null && (
                <Tooltip content="The current live price on Polymarket for this market.">
                  <span className="text-neutral-500 cursor-help">
                    <span className="text-sky-500 dark:text-sky-400 mr-1">Now</span>
                    <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">{formatOdds(currentPolyPrice, oddsFormat)}</span>
                  </span>
                </Tooltip>
              )}
            </div>
            {slippage != null && (() => {
              const info = getSlippageInfo(slippage)
              return (
                <Tooltip content={info.tip}>
                  <div className="flex items-center gap-1.5 cursor-help">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", info.color, info.bg, info.border)}>
                      {info.label}
                    </span>
                    <span className={cn("font-mono text-[11px] font-bold", info.color)}>
                      {slippage >= 0 ? "+" : ""}{slippage.toFixed(1)}%
                    </span>
                  </div>
                </Tooltip>
              )
            })()}
          </div>

          {/* Bet size + avg */}
          <div className="flex items-center justify-between py-2 text-xs tabular-nums">
            <div className="flex items-center gap-1.5">
              <Tooltip content="Total amount wagered on this position.">
                <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300 cursor-help">{formatMoney(amount)}</span>
              </Tooltip>
              <Tooltip content={`This bet is ${multiplier}x their average stake of $${pick.wallet_avg_stake ? Math.round(pick.wallet_avg_stake).toLocaleString() : "—"}. Higher multiples indicate stronger conviction.`}>
                <span className={cn("font-mono font-semibold cursor-help", parseFloat(multiplier) >= 3 ? "text-emerald-500 dark:text-emerald-400" : parseFloat(multiplier) >= 1.5 ? "text-amber-500 dark:text-amber-400" : "text-neutral-400 dark:text-neutral-500")}>
                  {multiplier}x
                </span>
              </Tooltip>
            </div>
            <Tooltip content="This insider's average bet size across all tracked bets.">
              <span className="text-neutral-400 dark:text-neutral-500 cursor-help">
                {pick.wallet_avg_stake != null && <span className="font-mono">${Math.round(pick.wallet_avg_stake).toLocaleString()}</span>}
                <span className="ml-1">avg</span>
              </span>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Insider */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">
          {pick.tier === "sharp" ? "Sharp" : pick.tier === "whale" ? "Insider" : "New Account"}
        </p>
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
        {(pick.wallet_total_trades != null || pick.wallet_total_bets != null) && (
          <span><span className="font-mono text-neutral-600 dark:text-neutral-400">{((pick.wallet_total_trades ?? 0) + (pick.wallet_total_bets ?? 0)).toLocaleString()}</span> trades{pick.wallet_record && <span className="text-neutral-500"> ({pick.wallet_record})</span>}</span>
        )}
        {pick.wallet_roi != null && (
          <>
            <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
            <span className={cn("font-mono font-semibold", pick.wallet_roi >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-400")}>
              {pick.wallet_roi >= 0 ? "+" : ""}{pick.wallet_roi.toFixed(1)}%
            </span>
          </>
        )}
        {pick.wallet_hot_cold && (
          <>
            <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
            <span className={cn("font-medium", pick.wallet_hot_cold === "hot" ? "text-emerald-500 dark:text-emerald-400" : "text-sky-500 dark:text-sky-400")}>
              {pick.wallet_hot_cold === "hot" ? "Hot" : "Cold"}
            </span>
          </>
        )}
        </div>
      </div>

      {/* Opposing Position Warning */}
      {pick.has_opposing_position && pick.opposing_position && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Opposing position detected</span>
          </div>
          <div className="text-[11px] space-y-1.5">
            <p className="text-amber-800/80 dark:text-amber-300/70">
              This insider has positions on both sides:
            </p>
            <div className="space-y-1 font-mono tabular-nums">
              <div className="flex items-center justify-between text-amber-800/80 dark:text-amber-300/70">
                <span className="flex items-center gap-1.5">
                  <span className="text-neutral-400 dark:text-neutral-600">&rarr;</span>
                  <span className="font-medium text-amber-900 dark:text-amber-200">{selection}</span>
                  <span className="text-[10px]">(this pick)</span>
                </span>
                <span className="font-medium">{formatMoney(amount)}</span>
              </div>
              <div className="flex items-center justify-between text-amber-800/80 dark:text-amber-300/70">
                <span className="flex items-center gap-1.5">
                  <span className="text-neutral-400 dark:text-neutral-600">&larr;</span>
                  <span className="font-medium text-amber-900 dark:text-amber-200">{pick.opposing_position.outcome}</span>
                  <span className="text-[10px]">(opposing)</span>
                </span>
                <span className="font-medium">{formatMoney(pick.opposing_position.total_size)}</span>
              </div>
            </div>
            <div className="h-px bg-amber-200 dark:bg-amber-500/20 my-1.5" />
            <p className="text-amber-700/70 dark:text-amber-400/60">
              Net: {formatMoney(pick.opposing_position.net_size)} toward{" "}
              <span className="font-medium">
                {pick.opposing_position.net_direction === "this" ? selection : pick.opposing_position.outcome}
              </span>
              . Likely hedging or position management.
            </p>
          </div>
        </div>
      )}

      {/* Price Chart */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <img src="/images/sports-books/polymarket.png" alt="Polymarket" className="h-3.5 w-3.5 rounded-sm object-contain opacity-50" />
            Polymarket price
          </p>
          <div className="flex gap-0.5 bg-white dark:bg-neutral-900/60 rounded-md p-0.5 border border-neutral-200 dark:border-neutral-800/30">
            {["1D", "1W", "1M", "MAX"].map((interval) => (
              <button
                key={interval}
                onClick={() => setChartInterval(interval)}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-medium rounded transition-all duration-150",
                  chartInterval === interval
                    ? "bg-white shadow-sm text-neutral-900 dark:bg-neutral-800/80 dark:text-neutral-200"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                {interval}
              </button>
            ))}
          </div>
        </div>
        <PriceChart
          currentPrice={price}
          oddsFormat={oddsFormat}
          data={priceData?.history || []}
          entryPrice={price}
          loading={priceLoading}
          fills={pick.fills && pick.fills.length > 0 ? pick.fills : [{ price: pick.entry_price, size: pick.bet_size, created_at: pick.created_at, american_odds: pick.american_odds }]}
        />
      </div>

      {/* Fills Timeline */}
      {pick.fills && pick.fills.length > 1 && (
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
          <p className="text-[11px] text-neutral-500 mb-2 flex items-center gap-1.5">
            <img src="/images/sports-books/polymarket.png" alt="Polymarket" className="h-3.5 w-3.5 rounded-sm object-contain opacity-50" />
            Order fills ({pick.fills.length})
          </p>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800/20">
            {pick.fills.map((fill, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-neutral-400 dark:text-neutral-600 font-mono tabular-nums w-4">{i + 1}</span>
                  <span className="text-neutral-500">
                    {new Date(fill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {formatOdds(Math.round(fill.price * 100), oddsFormat)}
                  </span>
                  <span className="font-mono font-medium text-neutral-900 dark:text-neutral-200 w-20 text-right">
                    ${fill.size.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between py-1.5 text-xs font-medium">
              <span className="text-neutral-500 dark:text-neutral-400">Total</span>
              <div className="flex items-center gap-3 tabular-nums">
                <span className="text-neutral-500">
                  avg {Math.round(pick.entry_price * 100)}{"\u00A2"}
                </span>
                <span className="font-mono text-sky-600 dark:text-sky-400 w-20 text-right">
                  ${pick.bet_size.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sportsbook Odds — Where to bet */}
      <div data-tour="where-to-bet" className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Where to bet</p>
        {oddsLoading && allBooks.length === 0 ? (
          <div className="space-y-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-neutral-100 dark:bg-neutral-800/20 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : allBooks.length === 0 ? (
          <p className="text-xs text-neutral-400 dark:text-neutral-600 py-3 text-center">
            {(() => {
              const sport = pick.sport?.toLowerCase() || ""
              if (sport.includes("soccer")) return "Soccer odds coming soon"
              if (sport.includes("tennis")) return "Tennis odds coming soon"
              if (sport.includes("ufc") || sport.includes("mma")) return "UFC odds coming soon"
              return "No sportsbook odds available"
            })()}
          </p>
        ) : (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800/40 divide-y divide-neutral-200 dark:divide-neutral-800/30 overflow-hidden">
            {allBooks.map((book, i) => {
              const normalizedId = normalizeSportsbookId(book.book)
              const sb = getSportsbookById(normalizedId)
              const bestDecimal = allBooks[0]?.decimal
              const isBest = book.decimal === bestDecimal
              const bookLink = isMobile
                ? (book.mobile_link || book.link)
                : (book.link || book.mobile_link)

              // Calculate slippage: how much better/worse is the sharp's entry vs this book's current price
              // Positive = sharp got better odds than what the book offers now (edge captured)
              // Negative = book currently offers better odds than the sharp's entry
              let bookSlippage: number | null = null
              if (book.decimal && book.decimal > 1 && price > 0) {
                const entryDecimal = 100 / price
                bookSlippage = ((entryDecimal - book.decimal) / book.decimal) * 100
              }

              // Get the right logo — try multiple image fields
              const logo = sb?.image?.light || sb?.image?.dark || sb?.image?.square || null

              return (
                <div
                  key={`${book.book}-${i}`}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 text-xs transition-colors",
                    isBest ? "bg-emerald-50/50 dark:bg-emerald-500/[0.04]" : ""
                  )}
                >
                  {/* Left: Logo + Name + Best badge */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    {logo ? (
                      <img src={logo} alt={sb?.name || book.book} className="h-5 w-5 rounded object-contain shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[8px] font-bold text-neutral-500 dark:text-neutral-400 shrink-0">
                        {(sb?.name || book.book).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "font-medium truncate",
                          isBest ? "text-emerald-700 dark:text-emerald-300" : "text-neutral-700 dark:text-neutral-300"
                        )}>
                          {sb?.name || book.book}
                        </span>
                        {isBest && (
                          <span className="text-[8px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-1 py-px rounded shrink-0">
                            BEST
                          </span>
                        )}
                      </div>
                      {/* Slippage per book */}
                      {bookSlippage != null && (
                        <span className={cn(
                          "text-[10px] font-mono tabular-nums",
                          bookSlippage <= 0 ? "text-sky-500 dark:text-sky-400"
                            : bookSlippage <= 3 ? "text-emerald-500 dark:text-emerald-400"
                            : bookSlippage <= 5 ? "text-amber-500 dark:text-amber-400"
                            : "text-red-500 dark:text-red-400"
                        )}>
                          {bookSlippage > 0 ? "+" : ""}{bookSlippage.toFixed(1)}% vs entry
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Odds + Bet link */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={cn(
                      "font-mono text-sm font-bold tabular-nums",
                      isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-neutral-200"
                    )}>
                      {oddsFormat === "cents" && book.decimal
                        ? `${Math.round((1 / book.decimal) * 100)}¢`
                        : book.price}
                    </span>
                    {bookLink && (
                      <a
                        href={bookLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 px-2 py-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 transition-colors hover:bg-sky-100 dark:hover:bg-sky-500/20 active:scale-95"
                      >
                        Bet
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Order Book */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
        <p className="text-[11px] text-neutral-500 mb-2 flex items-center gap-1.5">
          <img src="/images/sports-books/polymarket.png" alt="Polymarket" className="h-3.5 w-3.5 rounded-sm object-contain opacity-50" />
          Polymarket order book
        </p>
        <OrderBook
          currentPrice={price}
          oddsFormat={oddsFormat}
          bids={orderBookData?.bids || []}
          asks={orderBookData?.asks || []}
        />
      </div>
    </div>
  )
}
