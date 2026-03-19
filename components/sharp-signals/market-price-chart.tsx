"use client"

import { useMemo } from "react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { format } from "date-fns"

interface PriceDataPoint {
  t: number
  p: number
}

interface MarketPriceChartProps {
  sideAPrice: number
  sideBPrice: number
  sideAName: string
  sideBName: string
  oddsFormat: OddsFormat
  sideAHistory?: PriceDataPoint[]
  sideBHistory?: PriceDataPoint[]
}

export function MarketPriceChart({
  sideAPrice,
  sideBPrice,
  sideAName,
  sideBName,
  oddsFormat,
  sideAHistory,
  sideBHistory,
}: MarketPriceChartProps) {
  const chartData = useMemo(() => {
    const histA = sideAHistory || []
    const histB = sideBHistory || []

    if (histA.length === 0 && histB.length === 0) return []

    // Merge both histories by timestamp
    const timeMap = new Map<number, { sideA?: number; sideB?: number }>()

    for (const d of histA) {
      const existing = timeMap.get(d.t) || {}
      existing.sideA = Math.round(d.p * 100)
      timeMap.set(d.t, existing)
    }
    for (const d of histB) {
      const existing = timeMap.get(d.t) || {}
      existing.sideB = Math.round(d.p * 100)
      timeMap.set(d.t, existing)
    }

    return Array.from(timeMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([t, prices]) => ({
        time: t * 1000,
        sideA: prices.sideA ?? sideAPrice,
        sideB: prices.sideB ?? sideBPrice,
      }))
  }, [sideAHistory, sideBHistory, sideAPrice, sideBPrice])

  if (chartData.length === 0) {
    return (
      <div className="flex h-[220px] w-full items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800/30 animate-pulse">
        <div className="text-center text-neutral-400 dark:text-neutral-500">
          <div className="text-xs mb-2">Loading price history</div>
          <div className="grid grid-cols-2 gap-4 text-[11px]">
            <div>
              <div className="text-sky-600 dark:text-sky-400">{sideAName}</div>
              <div className="font-mono tabular-nums text-neutral-500">{formatOdds(sideAPrice, oddsFormat)}</div>
            </div>
            <div>
              <div className="text-neutral-500 dark:text-red-400">{sideBName}</div>
              <div className="font-mono tabular-nums text-neutral-500">{formatOdds(sideBPrice, oddsFormat)}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const allPrices = chartData.flatMap((d) => [d.sideA, d.sideB].filter(Boolean) as number[])
  const minPrice = Math.max(0, Math.min(...allPrices) - 5)
  const maxPrice = Math.min(100, Math.max(...allPrices) + 5)

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sideAGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="sideBGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F87171" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#F87171" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickFormatter={(ts) => format(new Date(ts), "MMM d")}
            dy={10}
            minTickGap={40}
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#94A3B8", fontSize: 10 }}
            tickFormatter={(value) => formatOdds(value, oddsFormat)}
            width={oddsFormat === "american" ? 55 : 35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#12181F",
              border: "1px solid #1F2937",
              borderRadius: "8px",
              color: "#E5E7EB",
              fontSize: 12,
            }}
            labelFormatter={(ts) => format(new Date(ts), "MMM d, h:mm a")}
            formatter={(value: any, name: any) => [
              formatOdds(Number(value), oddsFormat),
              name === "sideA" ? sideAName : sideBName,
            ]}
          />
          <Area
            type="monotone"
            dataKey="sideA"
            stroke="#7DD3FC"
            strokeWidth={2}
            fill="url(#sideAGrad)"
            animationDuration={600}
          />
          <Area
            type="monotone"
            dataKey="sideB"
            stroke="#F87171"
            strokeWidth={2}
            fill="url(#sideBGrad)"
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-sky-400" />
          <span className="text-neutral-500">{sideAName}: {formatOdds(sideAPrice, oddsFormat)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-neutral-500">{sideBName}: {formatOdds(sideBPrice, oddsFormat)}</span>
        </div>
      </div>
    </div>
  )
}
