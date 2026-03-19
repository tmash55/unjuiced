"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/tooltip"
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

const SPORT_LABELS: Record<string, string> = {
  nba: "NBA", nhl: "NHL", tennis: "Tennis", soccer: "Soccer",
  mlb: "MLB", nfl: "NFL", ncaab: "NCAAB", "march-madness": "NCAAB",
  ufc: "UFC", wnba: "WNBA",
}

export function StatsDashboard() {
  const [timeframe, setTimeframe] = useState("30d")

  const { data, isLoading } = useSWR<StatsResponse>(
    `/api/polymarket/stats?timeframe=${timeframe}`,
    fetcher,
    { refreshInterval: 60000, keepPreviousData: true }
  )

  if (isLoading || !data) {
    return (
      <div className="animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-6 w-20 bg-neutral-200/50 dark:bg-neutral-800/40 rounded" />
          <div className="h-4 w-28 bg-neutral-200/40 dark:bg-neutral-800/30 rounded" />
        </div>
        <div className="h-5 w-20 bg-neutral-200/40 dark:bg-neutral-800/30 rounded" />
      </div>
    )
  }

  const overall = data.overall
  if (!overall) return null
  const positive = overall.roi >= 0

  // Get top 2-3 profitable sports to show as social proof
  const topSports = Object.entries(data.bySport || {})
    .filter(([, s]) => s.roi > 0 && s.total >= 10)
    .sort((a, b) => b[1].roi - a[1].roi)
    .slice(0, 3)

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Left: headline ROI + record + social proof */}
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
        {/* ROI number — the hero */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "text-xl font-bold tabular-nums tracking-tight font-mono",
              positive ? "text-neutral-900 dark:text-neutral-100" : "text-red-600 dark:text-red-400"
            )}
          >
            {positive ? "+" : ""}{overall.roi}%
          </span>
          <Tooltip
            content={
              <div className="max-w-[280px] p-1 space-y-2">
                <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">How we calculate these numbers</p>
                <p className="text-neutral-600 dark:text-neutral-300 text-xs leading-relaxed">
                  These stats reflect consensus picks only — markets where 60%+ of tracked insider money flows one direction. Split markets (no clear signal) are excluded.
                </p>
                <div className="space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                  <p><span className="text-neutral-800 dark:text-neutral-200 font-medium">ROI</span> — Return on $100 flat bets per consensus pick</p>
                  <p><span className="text-neutral-800 dark:text-neutral-200 font-medium">Record</span> — Wins and losses based on market resolution</p>
                </div>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 pt-1 border-t border-neutral-200 dark:border-neutral-700">
                  Insiders tracked: anonymous wallets from prediction market leaderboards, ranked by profitability, volume, and consistency.
                </p>
              </div>
            }
            side="bottom"
            align="start"
          >
            <button className="text-neutral-300 dark:text-neutral-700 hover:text-neutral-500 dark:hover:text-neutral-500 transition-colors cursor-help">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
            </button>
          </Tooltip>
        </div>

        {/* Divider */}
        <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-800/60 shrink-0" />

        {/* Record */}
        <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums font-mono shrink-0">
          {overall.wins}<span className="text-neutral-300 dark:text-neutral-600">–</span>{overall.losses}
          <span className="text-neutral-400 dark:text-neutral-600 ml-1">({overall.winRate}%)</span>
        </span>

        {/* Divider */}
        <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-800/60 shrink-0" />

        {/* Top sports — just the winners, builds confidence */}
        {topSports.length > 0 && (
          <div className="flex items-center gap-3 text-[11px] tabular-nums shrink-0">
            {topSports.map(([sport, stats]) => (
              <span key={sport} className="text-neutral-400 dark:text-neutral-500">
                {SPORT_LABELS[sport] || sport.toUpperCase()}{" "}
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  +{stats.roi}%
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right: timeframe toggle */}
      <div className="flex gap-0.5 bg-neutral-100 dark:bg-neutral-900/60 rounded-md p-0.5 border border-neutral-200 dark:border-neutral-800/30 shrink-0">
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
  )
}
