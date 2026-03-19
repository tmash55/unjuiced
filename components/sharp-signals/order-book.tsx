"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { OddsFormat, formatOdds } from "@/lib/odds"

interface OrderLevel {
  price: number
  size: number
}

interface OrderBookProps {
  currentPrice: number
  oddsFormat: OddsFormat
  bids: OrderLevel[]
  asks: OrderLevel[]
}

function formatSize(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export function OrderBook({ currentPrice, oddsFormat, bids, asks }: OrderBookProps) {
  const { processedBids, processedAsks } = useMemo(() => {
    if (bids.length === 0 && asks.length === 0) {
      const mockBids: OrderLevel[] = []
      const mockAsks: OrderLevel[] = []
      for (let i = 1; i <= 5; i++) {
        mockBids.push({ price: currentPrice - i, size: Math.round(20000 + Math.random() * 80000) })
      }
      for (let i = 1; i <= 5; i++) {
        mockAsks.push({ price: currentPrice + i, size: Math.round(5000 + Math.random() * 40000) })
      }
      return { processedBids: mockBids, processedAsks: mockAsks.reverse() }
    }

    const convertedBids = bids
      .map(bid => ({ price: Math.round(bid.price * 100), size: bid.size }))
      .sort((a, b) => b.price - a.price)
      .slice(0, 5)

    const convertedAsks = asks
      .map(ask => ({ price: Math.round(ask.price * 100), size: ask.size }))
      .sort((a, b) => a.price - b.price)
      .slice(0, 5)

    return { processedBids: convertedBids, processedAsks: convertedAsks.reverse() }
  }, [currentPrice, bids, asks])

  const maxSize = Math.max(
    ...processedBids.map((o) => o.size),
    ...processedAsks.map((o) => o.size)
  )

  if (processedBids.length === 0 && processedAsks.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center text-xs text-neutral-400 dark:text-neutral-600">
        No order book data
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800/40 overflow-hidden">
      {/* Asks (sell side) */}
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/20">
        {processedAsks.map((order, index) => (
          <div key={`ask-${order.price}-${index}`} className="relative flex items-center justify-between px-3 py-1.5 text-xs">
            <div
              className="absolute inset-y-0 right-0 bg-red-500/10 dark:bg-red-500/15"
              style={{ width: `${(order.size / maxSize) * 100}%` }}
            />
            <span className="relative z-10 font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
              {formatOdds(order.price, oddsFormat)}
            </span>
            <span className="relative z-10 font-mono tabular-nums text-neutral-400 dark:text-neutral-500">
              {formatSize(order.size)}
            </span>
          </div>
        ))}
      </div>

      {/* Spread */}
      <div className="flex items-center justify-between px-3 py-1.5 border-y border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/30 text-xs">
        <span className="font-mono font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
          {formatOdds(currentPrice, oddsFormat)}
        </span>
        <span className="text-neutral-400 dark:text-neutral-600">
          Spread: {oddsFormat === "american" ? "~2pts" : "1¢"}
        </span>
      </div>

      {/* Bids (buy side) */}
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/20">
        {processedBids.map((order, index) => (
          <div key={`bid-${order.price}-${index}`} className="relative flex items-center justify-between px-3 py-1.5 text-xs">
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500/10 dark:bg-emerald-500/15"
              style={{ width: `${(order.size / maxSize) * 100}%` }}
            />
            <span className="relative z-10 font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
              {formatOdds(order.price, oddsFormat)}
            </span>
            <span className="relative z-10 font-mono tabular-nums text-neutral-400 dark:text-neutral-500">
              {formatSize(order.size)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-neutral-200 dark:border-neutral-800/40 bg-neutral-50/50 dark:bg-transparent">
        <span className="text-[9px] text-emerald-600 dark:text-emerald-500 font-medium uppercase tracking-wider">Bids</span>
        <span className="text-[9px] text-red-500 dark:text-red-400 font-medium uppercase tracking-wider">Asks</span>
      </div>
    </div>
  )
}
