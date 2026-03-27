"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { TierBadge } from "./tier-badge"
import { FollowButton } from "./follow-button"
import { Tooltip } from "@/components/tooltip"
import type { WalletScore, WhaleSignal } from "@/lib/polymarket/types"
import { OddsFormat, formatOdds } from "@/lib/odds"
import useSWR from "swr"

interface WalletDetailPanelProps {
  wallet: WalletScore
  oddsFormat: OddsFormat
  isFollowing: boolean
  onToggleFollow: (walletAddress: string) => void
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function walletTierToSignalTier(tier: string): string {
  const t = tier?.toUpperCase()
  if (t === "FADE" || t === "NEW") return "burner"
  return "sharp"
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function WalletDetailPanel({ wallet, oddsFormat, isFollowing, onToggleFollow }: WalletDetailPanelProps) {
  const anonId = `#${wallet.wallet_address.slice(0, 4).toUpperCase()}`
  const displayTier = walletTierToSignalTier(wallet.tier)
  const roiPositive = (wallet.roi ?? 0) >= 0

  // Recent bets filters
  const [betSport, setBetSport] = useState("")
  const [betDays, setBetDays] = useState("")
  const [betMinStake, setBetMinStake] = useState("")

  const betParams = new URLSearchParams({
    wallet: wallet.wallet_address,
    limit: "30",
    sort: "recent",
    resolved: "all",
  })
  if (betSport) betParams.set("sport", betSport)
  if (betMinStake) betParams.set("minStake", betMinStake)

  const { data: recentBets } = useSWR(
    `/api/polymarket/feed?${betParams}`,
    fetcher,
    { keepPreviousData: true }
  )

  // Client-side day filter (API doesn't have this for wallet queries)
  const filteredBets: WhaleSignal[] = (() => {
    const signals = recentBets?.signals || []
    if (!betDays) return signals
    const cutoff = Date.now() - Number(betDays) * 24 * 60 * 60 * 1000
    return signals.filter((b: WhaleSignal) => new Date(b.created_at).getTime() >= cutoff)
  })()

  // Merge march-madness into ncaab, then sort
  const sportEntries = (() => {
    const raw = { ...(wallet.sport_breakdown || {}) }
    if (raw["march-madness"] && raw["ncaab"]) {
      raw["ncaab"] = {
        w: (raw["ncaab"].w || 0) + (raw["march-madness"].w || 0),
        l: (raw["ncaab"].l || 0) + (raw["march-madness"].l || 0),
        bets: (raw["ncaab"].bets || 0) + (raw["march-madness"].bets || 0),
        wagered: ((raw["ncaab"] as any).wagered || 0) + ((raw["march-madness"] as any).wagered || 0),
        profit: ((raw["ncaab"] as any).profit || 0) + ((raw["march-madness"] as any).profit || 0),
        roi: 0, // recalculate below
      }
      const merged = raw["ncaab"]
      const totalBets = merged.w + merged.l
      merged.roi = totalBets > 0 ? ((merged as any).profit / ((merged as any).wagered || 1)) * 100 : 0
      delete raw["march-madness"]
    } else if (raw["march-madness"]) {
      raw["ncaab"] = raw["march-madness"]
      delete raw["march-madness"]
    }
    return Object.entries(raw).sort((a, b) => b[1].bets - a[1].bets)
  })()

  return (
    <div className="flex h-full flex-col overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TierBadge tier={displayTier} size="sm" />
            <span className="font-mono text-base font-bold text-neutral-900 dark:text-neutral-200 tabular-nums">
              {anonId}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs tabular-nums">
            <span className="text-neutral-400">
              {wallet.wins}-{wallet.losses}
              <span className="text-neutral-400 dark:text-neutral-600 ml-1">
                ({wallet.win_rate != null ? wallet.win_rate.toFixed(0) : "—"}%)
              </span>
            </span>
            <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
            <span className={cn("font-mono font-semibold", roiPositive ? "text-emerald-400" : "text-red-400")}>
              {roiPositive ? "+" : ""}{wallet.roi != null ? wallet.roi.toFixed(1) : "0"}%
            </span>
          </div>
        </div>
        <FollowButton
          isFollowing={isFollowing}
          onToggle={() => onToggleFollow(wallet.wallet_address)}
          size="md"
        />
      </div>

      {/* Stats — 3-column grid, 2 rows */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-3 mb-5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
        {[
          { label: "Rank", value: wallet.rank ? `#${wallet.rank}` : "—", color: "text-sky-600 dark:text-sky-400", tip: "Our internal ranking based on ROI, win rate, and sample size since we started tracking." },
          { label: "Avg stake", value: formatMoney(wallet.avg_stake), tip: "Average bet size across all tracked sports bets on Polymarket." },
          { label: "Sport", value: wallet.primary_sport?.toUpperCase() || "Mixed", tip: "The sport this insider bets on most frequently." },
          {
            label: "Streak",
            value: wallet.current_streak > 0
              ? `${wallet.current_streak}W`
              : wallet.current_streak < 0
                ? `${Math.abs(wallet.current_streak)}L`
                : "—",
            color: wallet.current_streak > 0 ? "text-emerald-500 dark:text-emerald-400" : wallet.current_streak < 0 ? "text-red-500 dark:text-red-400" : undefined,
            tip: "Current consecutive win or loss streak on resolved bets.",
          },
          { label: "Best streak", value: wallet.best_win_streak ? `${wallet.best_win_streak}W` : "—", tip: "Longest winning streak since we started tracking this wallet." },
          { label: "Volume", value: formatMoney(wallet.total_wagered), tip: "Total dollars wagered on sports bets that we've tracked." },
        ].map((stat) => (
          <Tooltip key={stat.label} content={stat.tip} side="bottom">
            <div className="text-center cursor-help">
              <div className={cn("font-mono text-sm font-bold tabular-nums", stat.color || "text-neutral-900 dark:text-neutral-200")}>
                {stat.value}
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">{stat.label}</p>
            </div>
          </Tooltip>
        ))}
      </div>

      {/* Data transparency — Polymarket history vs our tracked */}
      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 divide-y divide-neutral-200/60 dark:divide-neutral-700/30 mb-5">
        <Tooltip content="Total trades: historical from Polymarket + sports bets tracked by us in real-time. This number grows daily as we track new bets." side="left">
          <div className="flex items-center justify-between px-3 py-2 text-xs cursor-help">
            <span className="text-neutral-500">Total trades</span>
            <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300 tabular-nums">
              {((wallet.poly_total_trades ?? 0) + wallet.wins + wallet.losses).toLocaleString()}
            </span>
          </div>
        </Tooltip>
        <Tooltip content="Sports bets we've tracked in real-time from this wallet. Win-loss record is verified on-chain." side="left">
          <div className="flex items-center justify-between px-3 py-2 text-xs cursor-help">
            <span className="text-neutral-500">Sports tracked</span>
            <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300 tabular-nums">
              {(wallet.wins + wallet.losses).toLocaleString()}
              <span className="text-neutral-400 dark:text-neutral-500 ml-1.5">({wallet.wins}-{wallet.losses})</span>
            </span>
          </div>
        </Tooltip>
        <Tooltip content="Return on investment calculated from our tracked sports bets only. Based on flat $100 per bet." side="left">
          <div className="flex items-center justify-between px-3 py-2 text-xs cursor-help">
            <span className="text-neutral-500">ROI (tracked)</span>
            <span className={cn(
              "font-mono font-semibold tabular-nums",
              (wallet.roi ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
            )}>
              {(wallet.roi ?? 0) >= 0 ? "+" : ""}{wallet.roi != null ? wallet.roi.toFixed(1) : "0"}%
            </span>
          </div>
        </Tooltip>
        {wallet.hot_cold && (
          <Tooltip content={wallet.hot_cold === "hot" ? "This wallet has been winning more than expected over their last 10 bets." : "This wallet has been losing more than expected over their last 10 bets."} side="left">
            <div className="flex items-center justify-between px-3 py-2 text-xs cursor-help">
              <span className="text-neutral-500">Recent form</span>
              <span className={cn(
                "font-medium",
                wallet.hot_cold === "hot" ? "text-emerald-600 dark:text-emerald-400" : "text-sky-600 dark:text-sky-400"
              )}>
                {wallet.hot_cold === "hot" ? "Hot streak" : "Cold streak"}
              </span>
            </div>
          </Tooltip>
        )}
      </div>

      {/* Sport Breakdown */}
      {sportEntries.length > 0 && (
        <div className="mb-5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
          <p className="text-[11px] text-neutral-500 mb-2">Sport breakdown</p>
          <div className="divide-y divide-neutral-200/60 dark:divide-neutral-700/30">
            {sportEntries.map(([sport, stats]) => {
              const sp = stats.roi >= 0
              return (
                <div key={sport} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-neutral-400 uppercase">{sport === "ncaab" ? "NCAAB" : sport === "march-madness" ? "NCAAB" : sport}</span>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-neutral-500">{stats.w}-{stats.l}</span>
                    <span className={cn("font-mono font-semibold", sp ? "text-emerald-400" : "text-red-400")}>
                      {sp ? "+" : ""}{(stats.roi ?? 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Bets */}
      <div className="flex-1 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] text-neutral-500">Recent bets</p>
          <span className="text-[10px] text-neutral-400 tabular-nums">{filteredBets.length} bets</span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <select
            value={betSport}
            onChange={(e) => setBetSport(e.target.value)}
            className="px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/40 dark:border-neutral-700/20 text-[10px] font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Sports</option>
            {sportEntries.map(([sport]) => (
              <option key={sport} value={sport}>{sport.toUpperCase()}</option>
            ))}
          </select>
          <select
            value={betDays}
            onChange={(e) => setBetDays(e.target.value)}
            className="px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/40 dark:border-neutral-700/20 text-[10px] font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Time</option>
            <option value="1">Last 24h</option>
            <option value="3">Last 3 days</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <select
            value={betMinStake}
            onChange={(e) => setBetMinStake(e.target.value)}
            className="px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/40 dark:border-neutral-700/20 text-[10px] font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none cursor-pointer"
          >
            <option value="">Any Stake</option>
            <option value="1000">$1k+</option>
            <option value="5000">$5k+</option>
            <option value="10000">$10k+</option>
            <option value="25000">$25k+</option>
          </select>
        </div>

        {!recentBets?.signals ? (
          <div className="space-y-0 divide-y divide-neutral-200 dark:divide-neutral-800/15">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="py-2.5 animate-pulse">
                <div className="h-3 w-3/4 bg-neutral-200 dark:bg-neutral-800/30 rounded mb-1" />
                <div className="h-3 w-1/3 bg-neutral-800/20 rounded" />
              </div>
            ))}
          </div>
        ) : filteredBets.length === 0 ? (
          <p className="text-xs text-neutral-600 py-4 text-center">No bets match filters</p>
        ) : (
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800/15">
            {filteredBets.slice(0, 20).map((bet: WhaleSignal) => {
              const priceInCents = Math.round(bet.entry_price * 100)
              return (
                <div key={bet.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="text-neutral-700 dark:text-neutral-300 truncate leading-snug">{bet.market_title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                      {bet.sport && (
                        <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-600 uppercase">{bet.sport}</span>
                      )}
                      <span className="text-neutral-500">
                        {bet.side === "SELL"
                          ? (() => {
                              // SELL = betting against this outcome, show opposing team
                              const opp = bet.outcome === bet.home_team ? bet.away_team
                                : bet.outcome === bet.away_team ? bet.home_team
                                : null
                              return opp ? `Against ${bet.outcome}` : bet.outcome
                            })()
                          : bet.outcome}
                      </span>
                      {bet.result && (
                        <span className={cn(
                          "font-mono font-medium",
                          bet.result === "win" ? "text-emerald-400" : "text-red-400"
                        )}>
                          {bet.result === "win" ? "W" : "L"}
                        </span>
                      )}
                      <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                      <span className="text-neutral-400 dark:text-neutral-600">
                        {new Date(bet.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3 tabular-nums">
                    <span className="font-mono font-medium text-neutral-900 dark:text-neutral-200">
                      {formatOdds(priceInCents, oddsFormat)}
                    </span>
                    <p className="text-neutral-600 text-[11px]">
                      {formatMoney(bet.bet_size)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
