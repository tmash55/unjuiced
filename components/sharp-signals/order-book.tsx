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

export function OrderBook({ currentPrice, oddsFormat, bids, asks }: OrderBookProps) {
  const { processedBids, processedAsks } = useMemo(() => {
    // If no real data, generate mock data
    if (bids.length === 0 && asks.length === 0) {
      const mockBids: OrderLevel[] = []
      const mockAsks: OrderLevel[] = []
      
      // Generate bid levels (below current price)
      for (let i = 1; i <= 5; i++) {
        mockBids.push({
          price: currentPrice - i,
          size: Math.round(20000 + Math.random() * 80000),
        })
      }
      
      // Generate ask levels (above current price)
      for (let i = 1; i <= 5; i++) {
        mockAsks.push({
          price: currentPrice + i,
          size: Math.round(5000 + Math.random() * 40000),
        })
      }
      
      return { 
        processedBids: mockBids,
        processedAsks: mockAsks.reverse()
      }
    }

    // Convert real order book data (assume prices are in cents)
    const convertedBids = bids
      .map(bid => ({
        price: Math.round(bid.price * 100), // Convert to cents if needed
        size: bid.size
      }))
      .sort((a, b) => b.price - a.price) // Sort descending
      .slice(0, 5) // Take top 5

    const convertedAsks = asks
      .map(ask => ({
        price: Math.round(ask.price * 100), // Convert to cents if needed  
        size: ask.size
      }))
      .sort((a, b) => a.price - b.price) // Sort ascending
      .slice(0, 5) // Take top 5

    return {
      processedBids: convertedBids,
      processedAsks: convertedAsks.reverse() // Reverse for display (highest first)
    }
  }, [currentPrice, bids, asks])

  const maxSize = Math.max(
    ...processedBids.map((o) => o.size),
    ...processedAsks.map((o) => o.size)
  )

  if (processedBids.length === 0 && processedAsks.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-neutral-500">
        No order book data available
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Asks */}
      <div className="space-y-0.5">
        {processedAsks.map((order, index) => (
          <div key={`ask-${order.price}-${index}`} className="relative flex items-center justify-between text-xs">
            <div
              className="absolute inset-y-0 right-0 bg-red-500/20"
              style={{ width: `${(order.size / maxSize) * 100}%` }}
            />
            <span className="relative z-10 font-mono text-neutral-900 dark:text-neutral-200">{formatOdds(order.price, oddsFormat)}</span>
            <span className="relative z-10 font-mono text-neutral-400">
              ${(order.size / 1000).toFixed(1)}k
            </span>
          </div>
        ))}
      </div>

      {/* Spread */}
      <div className="flex items-center justify-between border-y border-neutral-200 dark:border-neutral-700 py-1 text-xs">
        <span className="font-medium text-sky-400">{formatOdds(currentPrice, oddsFormat)}</span>
        <span className="text-neutral-500">
          Spread: {oddsFormat === "american" ? "~2pts" : "1¢"}
        </span>
      </div>

      {/* Bids */}
      <div className="space-y-0.5">
        {processedBids.map((order, index) => (
          <div key={`bid-${order.price}-${index}`} className="relative flex items-center justify-between text-xs">
            <div
              className="absolute inset-y-0 left-0 bg-green-500/20"
              style={{ width: `${(order.size / maxSize) * 100}%` }}
            />
            <span className="relative z-10 font-mono text-neutral-900 dark:text-neutral-200">{formatOdds(order.price, oddsFormat)}</span>
            <span className="relative z-10 font-mono text-neutral-400">
              ${(order.size / 1000).toFixed(1)}k
            </span>
          </div>
        ))}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between pt-2 text-[10px] text-neutral-500">
        <span>BIDS</span>
        <span>ASKS</span>
      </div>
    </div>
  )
}