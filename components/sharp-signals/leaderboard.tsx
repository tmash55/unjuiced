"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { TierBadge } from "./tier-badge"
import { FollowButton } from "./follow-button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import type { WalletScore, LeaderboardResponse } from "@/lib/polymarket/types"
import useSWR from "swr"

const SORT_OPTIONS = [
  { value: "rank", label: "Rank" },
  { value: "roi", label: "ROI" },
  { value: "win_rate", label: "Win %" },
  { value: "total_wagered", label: "Volume" },
] as const

const SPORT_FILTERS = [
  { value: "", label: "All" },
  { value: "nba", label: "NBA" },
  { value: "nhl", label: "NHL" },
  { value: "tennis", label: "Tennis" },
  { value: "soccer", label: "Soccer" },
  { value: "mlb", label: "MLB" },
] as const

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

interface LeaderboardProps {
  selectedWallet: WalletScore | null
  onSelectWallet: (wallet: WalletScore) => void
  followedWallets: string[]
  onToggleFollow: (walletAddress: string) => void
}

export function Leaderboard({ selectedWallet, onSelectWallet, followedWallets, onToggleFollow }: LeaderboardProps) {
  const [sortBy, setSortBy] = useState("rank")
  const [sportFilter, setSportFilter] = useState("")
  const [minBets, setMinBets] = useState(10)

  const params = new URLSearchParams({ limit: "50", sortBy, minBets: String(minBets) })
  if (sportFilter) params.set("sport", sportFilter)

  const { data, isLoading } = useSWR<LeaderboardResponse>(
    `/api/polymarket/leaderboard?${params}`,
    fetcher
  )

  const wallets = data?.wallets ?? []

  // Auto-select first wallet when data loads and nothing is selected
  useEffect(() => {
    if (wallets.length > 0 && !selectedWallet) {
      onSelectWallet(wallets[0])
    }
  }, [wallets, selectedWallet, onSelectWallet])

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap text-xs">
        {/* Sort */}
        <div className="flex gap-0.5 bg-neutral-100 dark:bg-neutral-900/60 rounded-md p-0.5 border border-neutral-200 dark:border-neutral-800/30">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={cn(
                "px-2 py-0.5 text-[11px] font-medium rounded transition-all duration-150",
                sortBy === opt.value
                  ? "bg-white shadow-sm dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-200"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sport Filter */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {SPORT_FILTERS.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setSportFilter(sf.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
                sportFilter === sf.value
                  ? "text-neutral-900 dark:text-neutral-100 bg-neutral-200/60 dark:bg-neutral-800/60"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {sf.label}
            </button>
          ))}
        </div>

        {/* Min bets */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-neutral-400 dark:text-neutral-600 text-[11px]">Min bets</span>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/30 rounded-md px-2 py-0.5 text-neutral-700 dark:text-neutral-300 text-[11px] font-medium cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors outline-none">
              {minBets === 0 ? "Any" : `${minBets}+`}
              <svg className="h-3 w-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[80px]">
              <DropdownMenuRadioGroup value={String(minBets)} onValueChange={(v) => setMinBets(Number(v))}>
                {[
                  { value: "0", label: "Any" },
                  { value: "5", label: "5+" },
                  { value: "10", label: "10+" },
                  { value: "25", label: "25+" },
                  { value: "50", label: "50+" },
                ].map((opt) => (
                  <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs focus:bg-neutral-100 dark:focus:bg-neutral-800 focus:text-neutral-900 dark:focus:text-neutral-200">
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Wallet List */}
      {isLoading ? (
        <div className="space-y-0 divide-y divide-neutral-200 dark:divide-neutral-800/20">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="py-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-3 w-5 bg-neutral-200/50 dark:bg-neutral-800/40 rounded" />
                <div className="h-4 w-14 bg-neutral-200/50 dark:bg-neutral-800/40 rounded" />
                <div className="h-3 w-24 bg-neutral-200/50 dark:bg-neutral-800/30 rounded" />
                <div className="flex-1" />
                <div className="h-6 w-16 bg-neutral-200/50 dark:bg-neutral-800/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : wallets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-neutral-400">No wallets found</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800/20">
          {wallets.map((wallet, index) => {
            const anonId = `#${wallet.wallet_address.slice(0, 4).toUpperCase()}`
            const isSelected = selectedWallet?.wallet_address === wallet.wallet_address
            const isFollowed = followedWallets.includes(wallet.wallet_address)
            const displayTier = walletTierToSignalTier(wallet.tier)
            const roiPositive = (wallet.roi ?? 0) >= 0

            return (
              <div
                key={wallet.wallet_address}
                onClick={() => onSelectWallet(wallet)}
                className={cn(
                  "cursor-pointer py-3 px-2 -mx-2 rounded-lg transition-all duration-150",
                  isSelected
                    ? "bg-sky-50 dark:bg-sky-500/[0.04] border-l-2 border-l-sky-500 dark:border-l-sky-500/60 pl-3"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800/15 border-l-2 border-l-transparent",
                  "active:scale-[0.997]"
                )}
              >
                {/* Row 1: Rank + Identity + Follow */}
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-neutral-400 dark:text-neutral-600 font-mono text-xs tabular-nums w-5 text-right shrink-0">
                    {index + 1}
                  </span>
                  <TierBadge tier={displayTier} size="xs" />
                  <span className="font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-200 tabular-nums">
                    {anonId}
                  </span>
                  {isFollowed && (
                    <span className="text-[9px] text-sky-600 dark:text-sky-400/80 font-medium">Following</span>
                  )}
                  <div className="ml-auto">
                    <FollowButton
                      isFollowing={isFollowed}
                      onToggle={() => onToggleFollow(wallet.wallet_address)}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Row 2: Stats */}
                <div className="flex items-center gap-1.5 pl-[30px] text-[11px] text-neutral-500 tabular-nums">
                  <span>
                    {wallet.wins}-{wallet.losses}
                    <span className="text-neutral-400 dark:text-neutral-600 ml-1">
                      ({wallet.win_rate != null ? wallet.win_rate.toFixed(0) : "—"}%)
                    </span>
                  </span>
                  <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                  <span className={cn("font-mono font-semibold", roiPositive ? "text-emerald-400" : "text-red-400")}>
                    {roiPositive ? "+" : ""}{wallet.roi != null ? wallet.roi.toFixed(1) : "0"}%
                  </span>
                  {wallet.current_streak !== 0 && (
                    <>
                      <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                      <span className={cn(
                        "font-medium",
                        wallet.current_streak > 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {wallet.current_streak > 0 ? `${wallet.current_streak}W` : `${Math.abs(wallet.current_streak)}L`}
                      </span>
                    </>
                  )}
                  <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                  {wallet.primary_sport && (
                    <span className="uppercase">{wallet.primary_sport}</span>
                  )}
                  <span className="text-neutral-400 dark:text-neutral-600">{formatMoney(wallet.avg_stake)} avg</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
