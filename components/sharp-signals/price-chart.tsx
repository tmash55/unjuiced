"use client"

import { useMemo } from "react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from "recharts"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { format } from "date-fns"

interface PriceDataPoint {
  t: number // epoch seconds
  p: number // price 0-1
}

interface PriceChartProps {
  currentPrice: number // cents (0-100)
  oddsFormat: OddsFormat
  data?: PriceDataPoint[]
  entryPrice?: number // cents (0-100)
}

export function PriceChart({ currentPrice, oddsFormat, data, entryPrice }: PriceChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    return data.map((d) => ({
      time: d.t * 1000, // to ms
      price: Math.round(d.p * 100), // to cents
      label: format(new Date(d.t * 1000), "MMM d, h:mm a"),
    }))
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className="flex h-[180px] w-full items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800/50">
        <p className="text-sm text-neutral-500">No price history available</p>
      </div>
    )
  }

  const prices = chartData.map((d) => d.price)
  const minPrice = Math.max(0, Math.min(...prices) - 5)
  const maxPrice = Math.min(100, Math.max(...prices) + 5)

  // Find the closest point to entry price for the reference dot
  const entryIdx = entryPrice
    ? chartData.reduce((best, d, i) => {
        const diff = Math.abs(d.price - entryPrice)
        return diff < Math.abs(chartData[best].price - entryPrice) ? i : best
      }, 0)
    : Math.floor(chartData.length * 0.3)

  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
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
            formatter={(value: any) => [
              formatOdds(Number(value), oddsFormat),
              oddsFormat === "american" ? "Odds" : "Price",
            ]}
          />
          {entryPrice && (
            <ReferenceLine
              y={entryPrice}
              stroke="#34D399"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
          )}
          <Area
            type="monotone"
            dataKey="price"
            stroke="#7DD3FC"
            strokeWidth={2}
            fill="url(#priceGradient)"
            animationDuration={600}
          />
          {/* Entry point dot */}
          {entryPrice && chartData[entryIdx] && (
            <ReferenceDot
              x={chartData[entryIdx].time}
              y={chartData[entryIdx].price}
              r={5}
              fill="#34D399"
              stroke="#0B1014"
              strokeWidth={2}
            />
          )}
          {/* Current price dot */}
          <ReferenceDot
            x={chartData[chartData.length - 1].time}
            y={chartData[chartData.length - 1].price}
            r={5}
            fill="#7DD3FC"
            stroke="#0B1014"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-center gap-6 text-xs">
        {entryPrice && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-neutral-500">
              Entry: {formatOdds(entryPrice, oddsFormat)}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-sky-400" />
          <span className="text-neutral-500">
            Current: {formatOdds(currentPrice, oddsFormat)}
          </span>
        </div>
      </div>
    </div>
  )
}
