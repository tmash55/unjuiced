"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  ReferenceArea,
} from "recharts"
import { OddsFormat, formatOdds } from "@/lib/odds"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import useSWR from "swr"

// ─── Types ──────────────────────────────────────────────────────────────────

interface RawMarker {
  t: number       // epoch ms
  p: number       // price 0-1
  tier: string    // "sharp" | "whale" | "burner"
  side: string    // "BUY" | "SELL" | "YES" | "NO"
  size: number    // USD
  outcome: string
  tokenId: string | null
}

interface PriceHistoryResponse {
  history: { t: number; p: number }[]   // t = epoch seconds
  markers: RawMarker[]
  tokenId: string | null
  currentPrice: number | null
  priceChange: number | null
}

interface ChartPoint {
  time: number    // epoch ms
  price: number   // 0-100 cents
}

interface FillDot {
  x: number
  y: number
  tier: string
  side: string
  size: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TIME_RANGES = [
  { label: "1H",  value: "1h"  },
  { label: "6H",  value: "6h"  },
  { label: "24H", value: "24h" },
  { label: "7D",  value: "7d"  },
]

// Colors match the TierBadge system: sharp=emerald, whale=purple, burner=gray
const TIER_DOT_COLOR: Record<string, string> = {
  sharp:  "#10B981",  // emerald-500
  whale:  "#A855F7",  // purple-500
  burner: "#737373",  // neutral-500
}

function markerColor(tier: string, side: string): string {
  const isSell = side === "SELL" || side === "NO"
  if (isSell) return "#EF4444"
  return TIER_DOT_COLOR[tier?.toLowerCase()] ?? "#737373"
}

function tierLabel(tier: string): string {
  if (tier === "sharp") return "Sharp"
  if (tier === "whale") return "Insider"
  return "Bettor"
}

function isSellSide(side: string): boolean {
  return side === "SELL" || side === "NO"
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${Math.round(n).toLocaleString()}`
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean
  payload?: { value: number }[]
  label?: number
  markers: RawMarker[]
  oddsFormat: OddsFormat
  timeRange: string
}

function ChartTooltip({ active, payload, label, markers, oddsFormat, timeRange }: TooltipProps) {
  if (!active || !payload?.length || label == null) return null

  const price = payload[0]?.value
  const time = label  // epoch ms

  // Collect any markers within a 5-min window of this hover point
  const window = timeRange === "1h" ? 2 * 60 * 1000 : 5 * 60 * 1000
  const nearMarkers = markers.filter((m) => Math.abs(m.t - time) < window)

  return (
    <div className="bg-neutral-950/95 border border-white/[0.07] rounded-lg shadow-2xl p-3 min-w-[148px] backdrop-blur-sm">
      <div className="text-[10px] text-neutral-500 mb-2 tabular-nums">
        {format(new Date(time), timeRange === "1h" || timeRange === "6h" ? "h:mm a" : "MMM d, h:mm a")}
      </div>
      <div className="font-mono font-bold text-white text-sm tabular-nums">
        {formatOdds(Math.round(price), oddsFormat)}
      </div>
      {nearMarkers.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1.5">
          {nearMarkers.map((m, i) => {
            const color = markerColor(m.tier, m.side)
            const sell = isSellSide(m.side)
            return (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="font-medium text-[10px]" style={{ color }}>
                    {sell ? "Exit" : tierLabel(m.tier)}
                  </span>
                  <span className={cn("text-[9px] font-semibold", sell ? "text-red-400" : "text-emerald-400")}>
                    {sell ? "SELL" : "BUY"}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-neutral-400 tabular-nums">
                  {formatMoney(m.size)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="space-y-2.5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-20 rounded-md bg-neutral-200/60 dark:bg-neutral-800/60" />
          <div className="h-5 w-14 rounded-full bg-neutral-200/40 dark:bg-neutral-800/40" />
        </div>
        <div className="h-6 w-36 rounded-lg bg-neutral-200/40 dark:bg-neutral-800/40" />
      </div>
      <div className="h-[260px] w-full rounded-lg bg-neutral-100 dark:bg-neutral-800/25" />
      <div className="h-4 w-40 rounded bg-neutral-200/40 dark:bg-neutral-800/40" />
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface SharpPriceChartProps {
  /** Polymarket condition_id for the market */
  conditionId: string
  /** Sharp's entry price in cents (0-100) — draws a reference dashed line */
  entryPrice?: number
  oddsFormat?: OddsFormat
  className?: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function SharpPriceChart({
  conditionId,
  entryPrice,
  oddsFormat = "american",
  className,
}: SharpPriceChartProps) {
  const [timeRange, setTimeRange] = useState("24h")

  const { data, isLoading } = useSWR<PriceHistoryResponse>(
    conditionId
      ? `/api/polymarket/price-history?condition_id=${encodeURIComponent(conditionId)}&timeRange=${timeRange}`
      : null,
    fetcher,
    { keepPreviousData: true, refreshInterval: 60_000 }
  )

  // ── Derived chart data ──────────────────────────────────────────────────
  const {
    chartData,
    fillDots,
    entryZone,
    isTrendingUp,
    currentPriceCents,
    changeAbs,
    yDomain,
  } = useMemo(() => {
    const empty = {
      chartData: [] as ChartPoint[],
      fillDots: [] as FillDot[],
      entryZone: null as { y1: number; y2: number } | null,
      isTrendingUp: null as boolean | null,
      currentPriceCents: null as number | null,
      changeAbs: null as number | null,
      yDomain: [0, 100] as [number, number],
    }

    if (!data?.history?.length) return empty

    // Build chart points (history uses epoch seconds → convert to ms)
    const chartData: ChartPoint[] = data.history.map((d) => ({
      time: d.t * 1000,
      price: Math.round(d.p * 100),
    }))

    const firstPrice = chartData[0].price
    const lastPrice = chartData[chartData.length - 1].price
    const isTrendingUp = lastPrice >= firstPrice
    const currentPriceCents = lastPrice
    const changeAbs = data.priceChange ?? (firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0)

    // Snap each marker to the nearest chart time for dot placement
    const fillDots: FillDot[] = (data.markers ?? []).map((m) => {
      const nearest = chartData.reduce((prev, curr) =>
        Math.abs(curr.time - m.t) < Math.abs(prev.time - m.t) ? curr : prev
      )
      return {
        x: nearest.time,
        y: nearest.price,
        tier: m.tier,
        side: m.side,
        size: m.size,
      }
    })

    // Sharp entry zone: 20th–80th percentile of BUY entry prices
    const buyPrices = (data.markers ?? [])
      .filter((m) => !isSellSide(m.side))
      .map((m) => Math.round(m.p * 100))
      .sort((a, b) => a - b)

    let entryZone: { y1: number; y2: number } | null = null
    if (buyPrices.length >= 3) {
      const lo = buyPrices[Math.floor(buyPrices.length * 0.2)]
      const hi = buyPrices[Math.min(Math.ceil(buyPrices.length * 0.8), buyPrices.length - 1)]
      if (hi > lo) entryZone = { y1: lo, y2: hi }
    }

    // Y-axis domain with tight padding
    const allPrices = [
      ...chartData.map((d) => d.price),
      ...fillDots.map((d) => d.y),
      ...(entryPrice ? [entryPrice] : []),
    ]
    const pad = Math.max(3, Math.ceil((Math.max(...allPrices) - Math.min(...allPrices)) * 0.15))
    const yDomain: [number, number] = [
      Math.max(0, Math.min(...allPrices) - pad),
      Math.min(100, Math.max(...allPrices) + pad),
    ]

    return { chartData, fillDots, entryZone, isTrendingUp, currentPriceCents, changeAbs, yDomain }
  }, [data, entryPrice])

  // ── Colors ──────────────────────────────────────────────────────────────
  const trendColor = isTrendingUp === null ? "#7DD3FC" : isTrendingUp ? "#22C55E" : "#EF4444"
  // Unique gradient id per condition to avoid SVG id collisions across chart instances
  const gradId = `sg-${conditionId.slice(0, 8).replace(/[^a-z0-9]/gi, "")}`

  if (isLoading && !data) return <ChartSkeleton />

  const hasData = chartData.length > 0
  const markers = data?.markers ?? []

  // ── Tier summary for legend ─────────────────────────────────────────────
  const hasSharps   = markers.some((m) => m.tier === "sharp"  && !isSellSide(m.side))
  const hasWhales   = markers.some((m) => m.tier === "whale"  && !isSellSide(m.side))
  const hasSells    = markers.some((m) => isSellSide(m.side))

  return (
    <div className={cn("space-y-2", className)}>

      {/* ── Header row: current price + change + time range ─────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">

        {/* Price + change pill */}
        <div className="flex items-center gap-2.5 min-w-0">
          {currentPriceCents != null ? (
            <>
              <span className="font-mono text-xl font-bold tabular-nums text-neutral-900 dark:text-white leading-none">
                {formatOdds(currentPriceCents, oddsFormat)}
              </span>
              {changeAbs != null && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums leading-none",
                    changeAbs > 0.1
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : changeAbs < -0.1
                      ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-500"
                  )}
                >
                  {changeAbs > 0 ? "+" : ""}{changeAbs.toFixed(1)}%
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-neutral-400 dark:text-neutral-600">No price data</span>
          )}
        </div>

        {/* Time range toggle */}
        <div className="flex gap-px bg-neutral-100 dark:bg-neutral-900/60 rounded-lg p-0.5 border border-neutral-200/80 dark:border-neutral-800/40 shrink-0">
          {TIME_RANGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all duration-150",
                timeRange === value
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm"
                  : "text-neutral-400 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-400"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart body ─────────────────────────────────────────────────── */}
      {!hasData ? (
        <div className="h-[260px] w-full flex flex-col items-center justify-center rounded-lg bg-neutral-50 dark:bg-neutral-800/20 border border-neutral-200/50 dark:border-neutral-700/20">
          <div className="text-xs text-neutral-400 dark:text-neutral-600">No price history</div>
          <div className="text-[10px] text-neutral-300 dark:text-neutral-700 mt-1">Try a wider time range</div>
        </div>
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            >
              {/* Gradient fill direction follows trend */}
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={trendColor} stopOpacity={0.18} />
                  <stop offset="75%"  stopColor={trendColor} stopOpacity={0.04} />
                  <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#737373", fontSize: 9 }}
                tickFormatter={(ts) =>
                  format(
                    new Date(ts),
                    timeRange === "1h" || timeRange === "6h" ? "h:mm a" : "MMM d"
                  )
                }
                dy={6}
                minTickGap={55}
              />
              <YAxis
                domain={yDomain}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#737373", fontSize: 9 }}
                tickFormatter={(v) => formatOdds(v, oddsFormat)}
                width={oddsFormat === "american" ? 52 : 30}
              />

              <Tooltip
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    markers={markers}
                    oddsFormat={oddsFormat}
                    timeRange={timeRange}
                  />
                )}
                cursor={{ stroke: "rgba(255,255,255,0.07)", strokeWidth: 1 }}
              />

              {/* Sharp entry zone band */}
              {entryZone && (
                <ReferenceArea
                  y1={entryZone.y1}
                  y2={entryZone.y2}
                  fill="#3B82F6"
                  fillOpacity={0.07}
                  stroke="#3B82F6"
                  strokeOpacity={0.2}
                  strokeDasharray="4 3"
                  strokeWidth={1}
                />
              )}

              {/* Entry price reference line */}
              {entryPrice != null && (
                <ReferenceLine
                  y={entryPrice}
                  stroke="#34D399"
                  strokeDasharray="3 3"
                  strokeOpacity={0.45}
                  strokeWidth={1}
                  label={false}
                />
              )}

              {/* Price area */}
              <Area
                type="monotone"
                dataKey="price"
                stroke={trendColor}
                strokeWidth={1.5}
                fill={`url(#${gradId})`}
                animationDuration={500}
                animationEasing="ease-out"
                dot={false}
                activeDot={{
                  r: 3.5,
                  fill: trendColor,
                  stroke: "#0a0a0a",
                  strokeWidth: 2,
                }}
              />

              {/* Tier-colored entry/exit markers */}
              {fillDots.map((dot, i) => {
                const color = markerColor(dot.tier, dot.side)
                const sell = isSellSide(dot.side)
                return (
                  <ReferenceDot
                    key={`d-${i}`}
                    x={dot.x}
                    y={dot.y}
                    r={sell ? 4 : 4.5}
                    fill={sell ? "transparent" : color}
                    stroke={color}
                    strokeWidth={sell ? 1.5 : 1}
                  />
                )
              })}

              {/* Live price dot at the end of the line */}
              <ReferenceDot
                x={chartData[chartData.length - 1].time}
                y={chartData[chartData.length - 1].price}
                r={4}
                fill={trendColor}
                stroke="#0a0a0a"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      {markers.length > 0 && (
        <div className="flex items-center gap-3.5 text-[9px] text-neutral-400 dark:text-neutral-600 flex-wrap">
          {hasSharps && (
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Sharp entry</span>
            </div>
          )}
          {hasWhales && (
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
              <span>Insider entry</span>
            </div>
          )}
          {hasSells && (
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full border border-red-400 shrink-0" />
              <span>Exit</span>
            </div>
          )}
          {entryZone && (
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-4 rounded-sm bg-blue-500/25 border border-blue-400/30 shrink-0" />
              <span>Sharp zone</span>
            </div>
          )}
          <span className="ml-auto tabular-nums text-neutral-300 dark:text-neutral-700">
            {markers.length} signal{markers.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  )
}
