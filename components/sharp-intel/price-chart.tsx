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

interface Fill {
  price: number    // 0-1
  size: number     // USD
  created_at: string
  american_odds: number | null
}

interface PriceChartProps {
  currentPrice: number // cents (0-100)
  oddsFormat: OddsFormat
  data?: PriceDataPoint[]
  entryPrice?: number // cents (0-100)
  loading?: boolean
  fills?: Fill[]
}

function formatMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export function PriceChart({ currentPrice, oddsFormat, data, entryPrice, loading, fills }: PriceChartProps) {
  // Build chart data and inject fill points directly into the timeline
  const { chartData, fillDots } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], fillDots: [] }

    const points = data.map((d) => ({
      time: d.t * 1000,
      price: Math.round(d.p * 100),
      isFill: false,
    }))

    const dots: { x: number; y: number; size: number }[] = []

    if (fills && fills.length > 0 && points.length >= 2) {
      const chartStart = points[0].time
      const chartEnd = points[points.length - 1].time

      for (const fill of fills) {
        const fillTime = new Date(fill.created_at).getTime()
        const fillPrice = Math.round(fill.price * 100)

        // Skip fills outside the chart's visible time range
        if (fillTime < chartStart || fillTime > chartEnd) continue

        // Find insertion position to keep sorted
        let insertIdx = points.length
        for (let i = 0; i < points.length; i++) {
          if (points[i].time >= fillTime) {
            insertIdx = i
            break
          }
        }

        // Check if near an existing point (within 60s)
        const nearby = points[insertIdx] && Math.abs(points[insertIdx].time - fillTime) < 60000
        const nearbyPrev = insertIdx > 0 && Math.abs(points[insertIdx - 1].time - fillTime) < 60000

        if (!nearby && !nearbyPrev) {
          // Interpolate chart price at this time for line continuity
          let interpolatedPrice = fillPrice
          if (insertIdx > 0 && insertIdx < points.length) {
            const prev = points[insertIdx - 1]
            const next = points[insertIdx]
            const ratio = (fillTime - prev.time) / (next.time - prev.time)
            interpolatedPrice = Math.round(prev.price + ratio * (next.price - prev.price))
          }
          points.splice(insertIdx, 0, { time: fillTime, price: interpolatedPrice, isFill: true })
        }

        // Snap to the chart point — use chart's price so dot sits on the line
        const snapIdx = nearby ? insertIdx
          : nearbyPrev ? insertIdx - 1
          : insertIdx
        const snapTime = points[snapIdx]?.time ?? fillTime
        const snapPrice = points[snapIdx]?.price ?? fillPrice

        dots.push({ x: snapTime, y: snapPrice, size: fill.size })
      }
    }

    return {
      chartData: points.map(({ time, price }) => ({ time, price })),
      fillDots: dots,
    }
  }, [data, fills])

  if (loading || chartData.length === 0) {
    return (
      <div className="h-[180px] w-full rounded-lg bg-neutral-800/15 animate-pulse flex items-center justify-center">
        {!loading && <p className="text-xs text-neutral-600">No price history</p>}
      </div>
    )
  }

  const prices = chartData.map((d) => d.price)
  const fillPrices = fillDots.map((f) => f.y)
  const allPrices = [...prices, ...fillPrices]
  const priceRange = Math.max(...allPrices) - Math.min(...allPrices)
  // Tighter zoom: pad by 2 cents or 20% of range, whichever is larger (min 2, max 8)
  const padding = Math.max(2, Math.min(8, Math.ceil(priceRange * 0.2) || 2))
  const minPrice = Math.max(0, Math.min(...allPrices) - padding)
  const maxPrice = Math.min(100, Math.max(...allPrices) + padding)

  return (
    <div>
      <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#525252", fontSize: 10 }}
            tickFormatter={(ts) => format(new Date(ts), "MMM d")}
            dy={10}
            minTickGap={40}
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#525252", fontSize: 10 }}
            tickFormatter={(value) => formatOdds(value, oddsFormat)}
            width={oddsFormat === "american" ? 55 : 35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0a0a0a",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "6px",
              color: "#E5E7EB",
              fontSize: 11,
              padding: "6px 10px",
            }}
            labelFormatter={(ts) => format(new Date(ts), "MMM d, h:mm a")}
            formatter={(value: any) => [
              formatOdds(Number(value), oddsFormat),
              "Price",
            ]}
          />
          {/* Entry price reference line */}
          {entryPrice && (
            <ReferenceLine
              y={entryPrice}
              stroke="#34D399"
              strokeDasharray="3 3"
              strokeOpacity={0.3}
            />
          )}
          <Area
            type="monotone"
            dataKey="price"
            stroke="#7DD3FC"
            strokeWidth={1.5}
            fill="url(#priceGradient)"
            animationDuration={400}
          />
          {/* Fill markers — vertical line + dot at each order placement */}
          {fillDots.map((dot, i) => (
            <ReferenceLine
              key={`fill-line-${i}`}
              x={dot.x}
              stroke="#34D399"
              strokeDasharray="2 3"
              strokeOpacity={0.3}
            />
          ))}
          {fillDots.map((dot, i) => (
            <ReferenceDot
              key={`fill-dot-${i}`}
              x={dot.x}
              y={dot.y}
              r={4}
              fill="#34D399"
              stroke="#0a0a0a"
              strokeWidth={2}
            />
          ))}
          {/* Current price dot */}
          <ReferenceDot
            x={chartData[chartData.length - 1].time}
            y={chartData[chartData.length - 1].price}
            r={4}
            fill="#7DD3FC"
            stroke="#0a0a0a"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
      </div>
      <div className="mt-2 pt-2 border-t border-neutral-200/50 dark:border-neutral-700/30 flex items-center justify-center gap-5 text-[10px]">
        {fills && fills.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-neutral-400 dark:text-neutral-500">
              {fills.length} fill{fills.length !== 1 ? "s" : ""} @ avg {formatOdds(entryPrice || currentPrice, oddsFormat)}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          <span className="text-neutral-400 dark:text-neutral-500">
            Current {formatOdds(currentPrice, oddsFormat)}
          </span>
        </div>
      </div>
    </div>
  )
}
