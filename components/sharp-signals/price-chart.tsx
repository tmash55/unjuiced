"use client"

import { OddsFormat, formatOdds } from "@/lib/odds"
import { format } from "date-fns"

interface PriceDataPoint {
  t: number // timestamp
  p: number // price in cents
}

interface PriceChartProps {
  currentPrice: number
  oddsFormat: OddsFormat
  data: PriceDataPoint[]
}

export function PriceChart({ currentPrice, oddsFormat, data }: PriceChartProps) {
  // For now, just show a placeholder until recharts is installed
  const entryPrice = data.length > 0 ? data[Math.floor(data.length * 0.3)]?.p * 100 : currentPrice - 5

  return (
    <div className="h-[180px] w-full">
      {/* Placeholder chart */}
      <div className="flex h-full items-center justify-center border border-neutral-700 rounded-lg bg-neutral-800/50">
        <div className="text-center text-neutral-400">
          <div className="text-sm mb-2">Price Chart</div>
          <div className="text-xs">
            Current: {formatOdds(currentPrice, oddsFormat)}
            {entryPrice && (
              <>
                <br />
                Entry: {formatOdds(entryPrice, oddsFormat)}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-neutral-500">Entry: {entryPrice ? formatOdds(entryPrice, oddsFormat) : "N/A"}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-sky-400" />
          <span className="text-neutral-500">Current: {formatOdds(currentPrice, oddsFormat)}</span>
        </div>
      </div>
    </div>
  )
}