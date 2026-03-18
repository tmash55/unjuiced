"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import useSWR from "swr"

interface TierStats {
  wins: number
  losses: number
  total: number
  winRate: number
  roi: number
  pnl100: number
}

interface TopWallet {
  anonymousId: string
  record: string
  winRate: number
  roi: number
  sport: string | null
}

interface StatsResponse {
  overall: TierStats & { since: string | null }
  byTier: { sharp: TierStats; whale: TierStats }
  bySport: Record<string, TierStats>
  byTimeframe: Record<string, TierStats>
  topWallets: TopWallet[]
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

const TIMEFRAMES = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "all", label: "All" },
] as const

const SPORT_META: Record<string, string> = {
  nba: "NBA",
  nhl: "NHL",
  tennis: "Tennis",
  soccer: "Soccer",
  mlb: "MLB",
  nfl: "NFL",
  "march-madness": "MM",
  ufc: "UFC",
}

function formatPnl(n: number): string {
  if (n >= 10000) return `$${(n / 1000).toFixed(0)}k`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export function StatsDashboard() {
  const [timeframe, setTimeframe] = useState("30d")

  const { data, isLoading } = useSWR<StatsResponse>(
    `/api/polymarket/stats?timeframe=${timeframe}`,
    fetcher,
    { refreshInterval: 60000 }
  )

  if (isLoading || !data) {
    return (
      <div className="animate-pulse">
        <div className="flex items-baseline justify-between mb-3">
          <div className="h-7 w-36 bg-neutral-200/50 dark:bg-neutral-800/40 rounded" />
          <div className="h-6 w-24 bg-neutral-200/50 dark:bg-neutral-800/30 rounded" />
        </div>
        <div className="flex gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-10 bg-neutral-200/50 dark:bg-neutral-800/30 rounded" />
              <div className="h-5 w-14 bg-neutral-200/50 dark:bg-neutral-800/25 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const overall = data.overall
  const positive = overall.roi >= 0
  const sports = Object.entries(data.bySport)
    .filter(([, s]) => s.total >= 5)
    .sort((a, b) => b[1].total - a[1].total)

  return (
    <div>
      {/* Headline */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] text-sky-500/60 font-medium tracking-wider uppercase">
            ROI
          </span>
          <span
            className={cn(
              "text-xl font-bold tabular-nums tracking-tight font-mono",
              positive ? "text-emerald-400" : "text-red-400"
            )}
          >
            {positive ? "+" : ""}{overall.roi}%
          </span>
          <span className="text-sm text-neutral-400 dark:text-neutral-400 tabular-nums">
            {overall.wins}<span className="text-neutral-400 dark:text-neutral-600">-</span>{overall.losses}
            <span className="text-neutral-400 dark:text-neutral-600 ml-1.5">({overall.winRate}%)</span>
          </span>
          <span className="text-xs text-neutral-400 dark:text-neutral-600 tabular-nums">
            {positive ? "+" : ""}{formatPnl(overall.pnl100)} on $100
          </span>
        </div>

        {/* Timeframe */}
        <div className="flex gap-0.5 bg-neutral-100 dark:bg-neutral-900/60 rounded-md p-0.5 border border-neutral-200 dark:border-neutral-800/30">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.key}
              onClick={() => setTimeframe(tf.key)}
              className={cn(
                "px-2 py-0.5 text-[11px] font-medium rounded transition-all duration-150",
                timeframe === tf.key
                  ? "bg-white shadow-sm text-neutral-900 dark:bg-neutral-800/80 dark:text-neutral-200"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Per-Sport — inline, no cards */}
      {sports.length > 0 && (
        <div className="flex items-center gap-5 overflow-x-auto scrollbar-none text-xs">
          {sports.map(([sport, stats]) => {
            const label = SPORT_META[sport] || sport.toUpperCase()
            const sp = stats.roi >= 0
            return (
              <div key={sport} className="flex items-center gap-1.5 shrink-0">
                <span className="text-neutral-500">{label}</span>
                <span className={cn("font-mono font-semibold tabular-nums", sp ? "text-emerald-400" : "text-red-400")}>
                  {sp ? "+" : ""}{stats.roi}%
                </span>
                <span className="text-neutral-400 dark:text-neutral-600 tabular-nums">
                  {stats.wins}-{stats.losses}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
