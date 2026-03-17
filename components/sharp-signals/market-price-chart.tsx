"use client"

import { OddsFormat, formatOdds } from "@/lib/odds"

interface MarketPriceChartProps {
  sideAPrice: number
  sideBPrice: number
  sideAName: string
  sideBName: string
  oddsFormat: OddsFormat
}

export function MarketPriceChart({ 
  sideAPrice, 
  sideBPrice, 
  sideAName, 
  sideBName,
  oddsFormat 
}: MarketPriceChartProps) {
  return (
    <div className="h-[220px] w-full">
      {/* Placeholder chart */}
      <div className="flex h-full items-center justify-center border border-neutral-700 rounded-lg bg-neutral-800/50">
        <div className="text-center text-neutral-400">
          <div className="text-sm mb-2">Market Price Chart</div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-sky-400">{sideAName}</div>
              <div>{formatOdds(sideAPrice, oddsFormat)}</div>
            </div>
            <div>
              <div className="text-red-400">{sideBName}</div>
              <div>{formatOdds(sideBPrice, oddsFormat)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-sky-400" />
          <span className="text-neutral-500">{sideAName}: {formatOdds(sideAPrice, oddsFormat)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-neutral-500">{sideBName}: {formatOdds(sideBPrice, oddsFormat)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full border-2 border-neutral-500" />
          <span className="text-neutral-500">Wager Entry</span>
        </div>
      </div>
    </div>
  )
}