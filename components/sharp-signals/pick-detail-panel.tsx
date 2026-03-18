"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, BarChart3, Target, Zap, Activity, ExternalLink } from "lucide-react"
import { PriceChart } from "./price-chart"
import { OrderBook } from "./order-book"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { WhaleSignal } from "@/lib/polymarket/types"
import { formatDistanceToNow } from "date-fns"
import useSWR from "swr"

interface PickDetailPanelProps {
  pick: WhaleSignal
  oddsFormat: OddsFormat
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function PickDetailPanel({ pick, oddsFormat }: PickDetailPanelProps) {
  // Convert real data to display format
  const score = Math.round(pick.signal_score || 0)
  const matchup = pick.event_title || pick.market_title
  const betType = pick.market_label || pick.market_type || ""
  const selection = pick.outcome
  const shares = pick.total_shares || Math.round(pick.bet_size / pick.entry_price)
  const amount = pick.bet_size
  const price = Math.round(pick.entry_price * 100) // Convert to cents, rounded
  const multiplier = pick.stake_vs_avg?.toFixed(1) || "1.0"
  const walletRoi = pick.wallet_roi ? `${(pick.wallet_roi * 100).toFixed(1)}%` : "N/A"
  
  // Anonymous wallet display
  const walletDisplay = pick.wallet_address ? `#${pick.wallet_address.slice(2, 6).toUpperCase()}` : "Anon"

  // Fetch price chart data
  const { data: priceData } = useSWR(
    pick.token_id ? `/api/polymarket/price-chart?token_id=${pick.token_id}` : null,
    fetcher
  )

  // Fetch order book data
  const { data: orderBookData } = useSWR(
    pick.token_id ? `/api/polymarket/orderbook?token_id=${pick.token_id}` : null,
    fetcher
  )

  // Find best sportsbook offer
  const bestBookOdds = pick.all_book_odds?.find(book => 
    book.book === pick.best_book
  )

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 font-mono text-lg font-bold text-sky-400">
              {score}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-neutral-200">{matchup}</h2>
              <p className="text-sm text-neutral-500">{betType}</p>
            </div>
          </div>
        </div>
        {pick.token_id && (
          <button 
            className="flex items-center gap-1 rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
            onClick={() => window.open(`https://polymarket.com/event/${pick.token_id}`, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            View on Polymarket
          </button>
        )}
      </div>

      {/* Selection Card */}
      <Card className="border-sky-500/30 bg-sky-500/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500">Sharp Money On</p>
              <p className="text-xl font-bold text-neutral-200">{selection}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-500">{shares.toLocaleString()} shares</p>
              <p className="text-xl font-bold text-sky-400">${amount.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-sky-500 px-4 py-2">
              <TrendingUp className="h-4 w-4 text-white" />
              <span className="font-mono text-lg font-bold text-white">
                {formatOdds(price, oddsFormat)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fills Timeline (when multiple wagers are aggregated) */}
      {pick.fills && pick.fills.length > 1 && (
        <Card className="border-neutral-800 bg-neutral-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-400">
              Order Fills ({pick.fills.length} wagers)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {pick.fills.map((fill, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-neutral-800/50 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-500 font-mono text-xs w-5">{i + 1}</span>
                    <span className="text-neutral-400">
                      {new Date(fill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-neutral-400">
                      {fill.american_odds ? formatOdds(Math.round(fill.price * 100), oddsFormat) : `${Math.round(fill.price * 100)}¢`}
                    </span>
                    <span className="font-medium text-neutral-200 tabular-nums w-20 text-right">
                      ${fill.size.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-700 text-sm font-medium">
                <span className="text-neutral-400">Total</span>
                <div className="flex items-center gap-4">
                  <span className="text-neutral-400">
                    avg {Math.round(pick.entry_price * 100)}¢
                  </span>
                  <span className="text-sky-400 tabular-nums w-20 text-right">
                    ${pick.bet_size.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Why This Bet */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
            <Target className="h-4 w-4" />
            WHY THIS BET?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-neutral-200">
                <TrendingUp className="h-4 w-4 text-sky-400" />
                {multiplier}x
              </div>
              <p className="text-xs text-neutral-500">Rel. Bet Size</p>
            </div>
            <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-3 text-center">
              <div className="text-lg font-bold text-neutral-200">
                ${amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount}
              </div>
              <p className="text-xs text-neutral-500">Bet Size</p>
            </div>
            <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-neutral-200">
                <span 
                  className={`px-1.5 py-0.5 rounded text-xs font-medium border ${
                    pick.wallet_tier === "S" ? "bg-purple-500/20 text-purple-300 border-purple-500/30" :
                    pick.wallet_tier === "A" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                    pick.wallet_tier === "B" ? "bg-green-500/20 text-green-300 border-green-500/30" :
                    pick.wallet_tier === "C" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" :
                    pick.wallet_tier === "FADE" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                    "bg-neutral-500/20 text-neutral-300 border-neutral-700"
                  }`}
                >
                  {pick.wallet_tier}
                </span>
              </div>
              <p className="text-xs text-neutral-500">Tier</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insider Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
            <BarChart3 className="h-4 w-4" />
            WHALE STATS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-neutral-200">{walletDisplay}</div>
              <p className="text-xs text-neutral-500">Insider ID</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-sky-400">
                {pick.wallet_polymarket_rank ? `#${pick.wallet_polymarket_rank}` : "—"}
              </div>
              <p className="text-xs text-neutral-500">Sports Rank</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-neutral-200">
                {pick.wallet_record || "—"}
              </div>
              <p className="text-xs text-neutral-500">Record</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-neutral-200">
                {pick.wallet_total_bets != null ? pick.wallet_total_bets.toLocaleString() : "—"}
              </div>
              <p className="text-xs text-neutral-500">Tracked Bets</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-neutral-200">
                {pick.wallet_avg_stake != null ? `$${Math.round(pick.wallet_avg_stake).toLocaleString()}` : "—"}
              </div>
              <p className="text-xs text-neutral-500">Avg Stake</p>
            </div>
            <div className="text-center">
              <div className={`text-lg font-bold ${(pick.stake_vs_avg ?? 0) >= 3 ? 'text-emerald-400' : (pick.stake_vs_avg ?? 0) >= 1.5 ? 'text-yellow-400' : 'text-neutral-200'}`}>
                {pick.stake_vs_avg != null ? `${pick.stake_vs_avg}x` : "—"}
              </div>
              <p className="text-xs text-neutral-500">Stake vs Avg</p>
            </div>
          </div>
          {/* Lifetime volume bar */}
          {pick.wallet_lifetime_volume != null && pick.wallet_lifetime_volume > 0 && (
            <div className="mt-4 pt-3 border-t border-neutral-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Lifetime Volume</span>
                <span className="font-medium text-neutral-300">
                  ${pick.wallet_lifetime_volume >= 1_000_000 
                    ? `${(pick.wallet_lifetime_volume / 1_000_000).toFixed(1)}M`
                    : pick.wallet_lifetime_volume >= 1_000
                    ? `${(pick.wallet_lifetime_volume / 1_000).toFixed(0)}K`
                    : pick.wallet_lifetime_volume.toLocaleString()
                  }
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Best Sportsbook */}
      {bestBookOdds && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
              <ExternalLink className="h-4 w-4" />
              BEST SPORTSBOOK
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800/50 p-3">
              <div>
                <p className="font-medium text-neutral-200">{bestBookOdds.displayBook || bestBookOdds.book}</p>
                <p className="text-xs text-neutral-500">Best odds available</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-emerald-400">
                  {bestBookOdds.american && bestBookOdds.american > 0 ? `+${bestBookOdds.american}` : bestBookOdds.american || "N/A"}
                </p>
                <p className="text-xs text-neutral-500">American odds</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price Chart */}
      <Card className="flex-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
              <Activity className="h-4 w-4" />
              PRICE CHART
            </CardTitle>
            <div className="flex items-center gap-4">
              <Tabs defaultValue="1W" className="h-auto">
                <TabsList className="h-7 bg-neutral-800 p-0.5">
                  <TabsTrigger value="1D" className="h-6 px-2 text-xs">1D</TabsTrigger>
                  <TabsTrigger value="1W" className="h-6 px-2 text-xs">1W</TabsTrigger>
                  <TabsTrigger value="1M" className="h-6 px-2 text-xs">1M</TabsTrigger>
                  <TabsTrigger value="MAX" className="h-6 px-2 text-xs">MAX</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-2">
          <PriceChart 
            currentPrice={price} 
            oddsFormat={oddsFormat}
            data={priceData?.history || []}
            entryPrice={price}
          />
        </CardContent>
      </Card>

      {/* Order Book */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
            <BarChart3 className="h-4 w-4" />
            ORDER BOOK
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrderBook 
            currentPrice={price} 
            oddsFormat={oddsFormat}
            bids={orderBookData?.bids || []}
            asks={orderBookData?.asks || []}
          />
        </CardContent>
      </Card>
    </div>
  )
}