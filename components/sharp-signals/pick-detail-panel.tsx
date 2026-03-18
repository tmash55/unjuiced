"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, BarChart3, ExternalLink } from "lucide-react"
import { PriceChart } from "./price-chart"
import { OrderBook } from "./order-book"
import { TierBadge } from "./tier-badge"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { WhaleSignal } from "@/lib/polymarket/types"
import { getSportsbookById } from "@/lib/data/sportsbooks"
import { formatDistanceToNow } from "date-fns"
import useSWR from "swr"

interface PickDetailPanelProps {
  pick: WhaleSignal
  oddsFormat: OddsFormat
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function PickDetailPanel({ pick, oddsFormat }: PickDetailPanelProps) {
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

  const { data: priceData, isLoading: priceLoading } = useSWR(
    pick.token_id ? `/api/polymarket/price-chart?token_id=${pick.token_id}` : null,
    fetcher
  )
  const { data: orderBookData } = useSWR(
    pick.token_id ? `/api/polymarket/orderbook?token_id=${pick.token_id}` : null,
    fetcher
  )

  const liveOdds = pick.live_odds
  const allBooks = liveOdds?.all || []
  const bestBookId = liveOdds?.best?.book

  // Current Polymarket price from chart data (last data point)
  const currentPolyPrice = priceData?.history?.length > 0
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
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <TierBadge tier={pick.tier} size="sm" />
              <span className="font-mono text-sm font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
                {walletDisplay}
              </span>
              {pick.wallet_record && (
                <span className="text-xs text-neutral-500 tabular-nums">{pick.wallet_record}</span>
              )}
            </div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-200 leading-snug">{matchup}</h2>
            <p className="text-xs text-neutral-500 mt-0.5">{betType}</p>
          </div>
          {pick.token_id && (
            <button
              className="flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-300 shrink-0"
              onClick={() => window.open(`https://polymarket.com/event/${pick.event_slug || pick.condition_id}`, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
              Polymarket
            </button>
          )}
        </div>
      </div>

      {/* Selection + Pricing */}
      <div className="space-y-3">
        {/* Selection header */}
        <div>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-1">Sharp money on</p>
          <div className="flex items-baseline justify-between">
            <p className="text-base font-semibold text-neutral-900 dark:text-neutral-200">{selection}</p>
            <span className="font-mono text-lg font-bold text-sky-600 dark:text-sky-400 tabular-nums">
              {formatOdds(price, oddsFormat)}
            </span>
          </div>
        </div>

        {/* Price + Slippage row */}
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800/40 divide-y divide-neutral-200 dark:divide-neutral-800/30">
          {/* Entry → Current */}
          <div className="flex items-center justify-between px-3 py-2.5 text-xs tabular-nums">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-neutral-500">Entry</span>
                <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                  {formatOdds(entryPriceCents, oddsFormat)}
                </span>
              </div>
              {currentPolyPrice != null && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-700">&rarr;</span>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-sky-400" />
                    <span className="text-neutral-500">Now</span>
                    <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300">
                      {formatOdds(currentPolyPrice, oddsFormat)}
                    </span>
                  </div>
                </>
              )}
            </div>
            {priceChange != null && priceChange !== 0 && (
              <span className={cn(
                "font-mono font-semibold",
                priceChange > 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
              )}>
                {priceChange > 0 ? "+" : ""}{priceChange}¢
              </span>
            )}
          </div>

          {/* Slippage indicator */}
          {slippage != null && (() => {
            const info = getSlippageInfo(slippage)
            return (
              <div className="group relative px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">Slippage</span>
                    <svg className="h-3 w-3 text-neutral-400 dark:text-neutral-600 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", info.color, info.bg, info.border)}>
                      {info.label}
                    </span>
                    <span className={cn("font-mono text-xs font-bold tabular-nums", info.color)}>
                      {slippage >= 0 ? "+" : ""}{slippage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                {/* Tooltip on hover */}
                <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block z-10 w-64 pointer-events-none">
                  <div className="bg-neutral-900 dark:bg-neutral-800 text-neutral-200 text-[11px] leading-relaxed rounded-lg px-3 py-2 shadow-lg border border-neutral-700">
                    {info.tip}
                    <div className="absolute bottom-0 right-6 translate-y-1/2 rotate-45 w-2 h-2 bg-neutral-900 dark:bg-neutral-800 border-r border-b border-neutral-700" />
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Bet stats */}
          <div className="flex items-center justify-between px-3 py-2.5 text-xs tabular-nums">
            <span className="text-neutral-500 dark:text-neutral-400">{shares.toLocaleString()} shares</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">{formatMoney(amount)}</span>
              <span className={cn(
                "font-mono font-semibold",
                parseFloat(multiplier) >= 3 ? "text-emerald-500 dark:text-emerald-400"
                  : parseFloat(multiplier) >= 1.5 ? "text-amber-500 dark:text-amber-400"
                  : "text-neutral-500 dark:text-neutral-400"
              )}>
                {multiplier}x
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sportsbook Odds Comparison */}
      {allBooks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-neutral-500">Sportsbook odds</h3>
            {liveOdds?.updated_at && (
              <span className="text-[10px] text-neutral-400 dark:text-neutral-600">
                Updated {formatDistanceToNow(new Date(liveOdds.updated_at), { addSuffix: true })}
              </span>
            )}
          </div>
          <div className="space-y-1">
            {allBooks.map((book, i) => {
              const sb = getSportsbookById(book.book)
              const isBest = book.book === bestBookId

              return (
                <div
                  key={`${book.book}-${i}`}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                    isBest
                      ? "bg-emerald-50 dark:bg-emerald-500/[0.06] border border-emerald-200 dark:border-emerald-500/15"
                      : "bg-neutral-50 dark:bg-neutral-800/30 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {sb?.image?.light ? (
                      <img src={sb.image.light} alt={sb.name} className="h-5 w-5 rounded-sm object-contain" />
                    ) : (
                      <div className="h-5 w-5 rounded-sm bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-500 dark:text-neutral-400">
                        {book.book.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className={cn("font-medium", isBest ? "text-emerald-700 dark:text-emerald-300" : "text-neutral-700 dark:text-neutral-300")}>
                      {sb?.name || book.book}
                    </span>
                    {isBest && (
                      <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        BEST
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "font-mono font-bold tabular-nums",
                      isBest ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-neutral-200"
                    )}>
                      {book.price}
                    </span>
                    {book.mobile_link && (
                      <a
                        href={book.mobile_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 px-2.5 py-1 text-xs font-medium text-sky-600 dark:text-sky-400 transition-colors hover:bg-sky-100 dark:hover:bg-sky-500/20 active:scale-95"
                      >
                        Bet
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Insider profile */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400 dark:text-neutral-500">Insider</span>
            <span className="font-mono font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">{walletDisplay}</span>
          </div>
          <div className="flex items-center gap-2 text-xs tabular-nums">
            {pick.wallet_avg_stake != null && (
              <span className="text-neutral-500">${Math.round(pick.wallet_avg_stake).toLocaleString()} avg</span>
            )}
            {pick.stake_vs_avg != null && pick.stake_vs_avg >= 1.5 && (
              <span className={cn(
                "font-mono font-semibold",
                pick.stake_vs_avg >= 3 ? "text-emerald-500 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"
              )}>
                {pick.stake_vs_avg}x
              </span>
            )}
          </div>
        </div>

        {/* Polymarket history vs Our tracked — the transparency section */}
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800/40 divide-y divide-neutral-200 dark:divide-neutral-800/30">
          {pick.wallet_total_trades != null && (
            <div className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-neutral-500">All-time trades</span>
              <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300 tabular-nums">
                {pick.wallet_total_trades.toLocaleString()}
              </span>
            </div>
          )}
          {pick.wallet_total_bets != null && (
            <div className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-neutral-500">Sports tracked</span>
              <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300 tabular-nums">
                {pick.wallet_total_bets.toLocaleString()}
                {pick.wallet_record && (
                  <span className="text-neutral-400 dark:text-neutral-500 ml-1.5">({pick.wallet_record})</span>
                )}
              </span>
            </div>
          )}
          {pick.wallet_roi != null && (
            <div className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-neutral-500">ROI (tracked)</span>
              <span className={cn(
                "font-mono font-semibold tabular-nums",
                pick.wallet_roi >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
              )}>
                {pick.wallet_roi >= 0 ? "+" : ""}{pick.wallet_roi.toFixed(1)}%
              </span>
            </div>
          )}
          {pick.wallet_hot_cold && (
            <div className="flex items-center justify-between px-3 py-2 text-xs">
              <span className="text-neutral-500">Recent form</span>
              <span className={cn(
                "font-medium",
                pick.wallet_hot_cold === "hot" ? "text-emerald-600 dark:text-emerald-400" : "text-sky-600 dark:text-sky-400"
              )}>
                {pick.wallet_hot_cold === "hot" ? "Hot streak" : "Cold streak"}
              </span>
            </div>
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
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="flex items-center gap-2 text-xs font-medium text-neutral-500">
            <Activity className="h-3.5 w-3.5" />
            Price chart
          </h3>
          <Tabs defaultValue="1W" className="h-auto">
            <TabsList className="h-7 bg-neutral-100 dark:bg-neutral-800/60 p-0.5">
              <TabsTrigger value="1D" className="h-6 px-2 text-[10px]">1D</TabsTrigger>
              <TabsTrigger value="1W" className="h-6 px-2 text-[10px]">1W</TabsTrigger>
              <TabsTrigger value="1M" className="h-6 px-2 text-[10px]">1M</TabsTrigger>
              <TabsTrigger value="MAX" className="h-6 px-2 text-[10px]">MAX</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <PriceChart
          currentPrice={price}
          oddsFormat={oddsFormat}
          data={priceData?.history || []}
          entryPrice={price}
          loading={priceLoading}
          fills={pick.fills}
        />
      </div>

      {/* Fills Timeline */}
      {pick.fills && pick.fills.length > 1 && (
        <div>
          <p className="text-[11px] text-neutral-500 mb-2">
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

      {/* Order Book */}
      <div>
        <h3 className="flex items-center gap-2 text-xs font-medium text-neutral-500 mb-2">
          <BarChart3 className="h-3.5 w-3.5" />
          Order book
        </h3>
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
