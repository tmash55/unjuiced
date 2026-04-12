"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import useSWRInfinite from "swr/infinite"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { FollowButton } from "./follow-button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import type { WalletScore, LeaderboardResponse } from "@/lib/polymarket/types"

const PAGE_SIZE = 50

const SPORT_FILTERS = [
  { value: "", label: "All" },
  { value: "nba", label: "NBA" },
  { value: "nhl", label: "NHL" },
  { value: "ncaab", label: "NCAAB" },
  { value: "mlb", label: "MLB" },
  { value: "tennis", label: "Tennis" },
  { value: "soccer", label: "Soccer" },
] as const

const TIER_FILTERS = [
  { value: "", label: "All" },
  { value: "S", label: "S" },
  { value: "A", label: "A" },
  { value: "B", label: "B" },
] as const

type Period = "7d" | "30d" | "all"

const PERIOD_SORT: Record<Period, string> = {
  "7d": "poly_week_pnl",
  "30d": "poly_month_pnl",
  "all": "rank",
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—"
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

function formatPnl(n: number | null | undefined): string {
  if (n == null) return "—"
  const abs = Math.abs(n)
  const sign = n >= 0 ? "+" : "−"
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  return `${sign}$${abs.toFixed(0)}`
}

function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return ""
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ""
  }
}

// ── Wallet tier badge — distinct S / A / B / C styling ───────────────────────

function WalletTierBadge({ tier }: { tier: string }) {
  const t = tier?.toUpperCase()
  let cls: string

  if (t === "S") {
    cls = "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25"
  } else if (t === "A") {
    cls = "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25"
  } else if (t === "B") {
    cls = "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/25"
  } else {
    cls = "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700/40"
  }

  return (
    <span className={cn(
      "inline-flex items-center font-bold rounded border tracking-widest px-1.5 py-px text-[9px]",
      cls
    )}>
      {t === "FADE" ? "FADE" : t === "NEW" ? "NEW" : (t || "?")}
    </span>
  )
}

// ── Top-3 rank treatment ──────────────────────────────────────────────────────

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center shrink-0">
        <span className="absolute inset-0 rounded-full bg-amber-400/20 dark:bg-amber-400/15 ring-1 ring-amber-400/40 dark:ring-amber-400/30" />
        <span className="font-black text-[10px] text-amber-600 dark:text-amber-400 tabular-nums">1</span>
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center shrink-0">
        <span className="absolute inset-0 rounded-full bg-neutral-200/50 dark:bg-neutral-500/15 ring-1 ring-neutral-300/60 dark:ring-neutral-500/30" />
        <span className="font-black text-[10px] text-neutral-500 dark:text-neutral-400 tabular-nums">2</span>
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center shrink-0">
        <span className="absolute inset-0 rounded-full bg-orange-400/15 dark:bg-orange-400/10 ring-1 ring-orange-400/40 dark:ring-orange-400/25" />
        <span className="font-black text-[10px] text-orange-600 dark:text-orange-400 tabular-nums">3</span>
      </span>
    )
  }
  return (
    <span className="w-5 flex justify-end shrink-0">
      <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-600 tabular-nums">{rank}</span>
    </span>
  )
}

// ── Summary stat card ─────────────────────────────────────────────────────────

function StatCard({ icon, label, value }: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200/60 dark:border-neutral-800/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[9px] font-medium text-neutral-400 uppercase tracking-wider leading-none">{label}</span>
      </div>
      <span className="font-mono text-sm font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{value}</span>
    </div>
  )
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Component ─────────────────────────────────────────────────────────────────

interface LeaderboardProps {
  selectedWallet: WalletScore | null
  onSelectWallet: (wallet: WalletScore) => void
  followedWallets: string[]
  onToggleFollow: (walletAddress: string) => void
}

export function Leaderboard({
  selectedWallet,
  onSelectWallet,
  followedWallets,
  onToggleFollow,
}: LeaderboardProps) {
  const [period, setPeriod] = useState<Period>("30d")
  const [tierFilter, setTierFilter] = useState("")
  const [sportFilter, setSportFilter] = useState("")
  const [minBets, setMinBets] = useState(10)
  const [searchDraft, setSearchDraft] = useState("")
  const [search, setSearch] = useState("")
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDraft.trim()), 400)
    return () => clearTimeout(t)
  }, [searchDraft])

  const getKey = useCallback(
    (pageIndex: number, previousPageData: LeaderboardResponse | null) => {
      if (previousPageData && (previousPageData.wallets?.length ?? 0) < PAGE_SIZE) return null

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageIndex * PAGE_SIZE),
        sortBy: PERIOD_SORT[period],
        minBets: String(minBets),
      })
      if (sportFilter) params.set("sport", sportFilter)
      if (tierFilter) params.set("tier", tierFilter)
      if (search) params.set("wallet", search)
      return `/api/polymarket/leaderboard?${params}`
    },
    [period, sportFilter, minBets, tierFilter, search]
  )

  const { data: pages, size, setSize, isLoading, isValidating } =
    useSWRInfinite<LeaderboardResponse>(getKey, fetcher, {
      revalidateFirstPage: true,
      parallel: false,
    })

  const wallets = pages?.flatMap((p) => p.wallets || []) ?? []
  const total = pages?.[0]?.total ?? 0
  const hasMore = pages ? (pages[pages.length - 1]?.wallets?.length ?? 0) >= PAGE_SIZE : false
  const loadingMore = size > 1 && pages && typeof pages[size - 1] === "undefined"

  // Summary stats computed from loaded wallets
  const sTierWallets = wallets.filter((w) => w.tier === "S")
  const sTierAvgWinRate =
    sTierWallets.length > 0
      ? sTierWallets.reduce((acc, w) => acc + (w.win_rate ?? 0), 0) / sTierWallets.length
      : null
  const totalVolume = wallets.reduce((acc, w) => acc + (w.total_wagered ?? 0), 0)

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isValidating) setSize((s) => s + 1)
      },
      { rootMargin: "300px" }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, isValidating, setSize])

  // Auto-select first wallet on desktop
  useEffect(() => {
    if (wallets.length > 0 && !selectedWallet && typeof window !== "undefined" && window.innerWidth >= 768) {
      onSelectWallet(wallets[0])
    }
  }, [wallets, selectedWallet, onSelectWallet])

  const getPeriodPnl = (w: WalletScore) => {
    if (period === "7d") return w.poly_week_pnl
    if (period === "30d") return w.poly_month_pnl
    return w.poly_pnl
  }

  return (
    <div className="space-y-3">

      {/* ── Summary stats bar ── */}
      {!isLoading && wallets.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="Tracked wallets"
            value={total > 0 ? total.toLocaleString() : wallets.length.toLocaleString()}
            icon={
              <svg className="h-3.5 w-3.5 text-neutral-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            }
          />
          <StatCard
            label="S-tier win rate"
            value={sTierAvgWinRate != null ? `${sTierAvgWinRate.toFixed(0)}%` : "—"}
            icon={
              <svg className="h-3.5 w-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
              </svg>
            }
          />
          <StatCard
            label="Volume tracked"
            value={formatMoney(totalVolume)}
            icon={
              <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
            }
          />
        </div>
      )}

      {/* ── Controls row 1: period + search ── */}
      <div className="flex items-center gap-2">
        {/* Period segmented control */}
        <div className="flex gap-0.5 bg-neutral-100 dark:bg-neutral-900/60 rounded-md p-0.5 border border-neutral-200 dark:border-neutral-800/30 shrink-0">
          {(["7d", "30d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-2.5 py-0.5 text-[11px] font-semibold rounded transition-all duration-150",
                period === p
                  ? "bg-white shadow-sm dark:bg-neutral-800/80 text-neutral-900 dark:text-neutral-200"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {p === "all" ? "All" : p.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative flex-1">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search 0x address..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="w-full pl-7 pr-2.5 py-1 text-[11px] bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/30 rounded-md text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 outline-none focus:border-sky-400 dark:focus:border-sky-500/50 transition-colors"
          />
        </div>
      </div>

      {/* ── Controls row 2: tier + sport + min bets ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Tier filter */}
        <div className="flex gap-0.5">
          {TIER_FILTERS.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTierFilter(tf.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap",
                tierFilter === tf.value
                  ? tf.value === "S"
                    ? "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : tf.value === "A"
                    ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : tf.value === "B"
                    ? "bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400"
                    : "bg-neutral-200/60 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <span className="w-px h-3.5 bg-neutral-200 dark:bg-neutral-700/40 shrink-0" />

        {/* Sport pills */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {SPORT_FILTERS.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setSportFilter(sf.value)}
              className={cn(
                "px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
                sportFilter === sf.value
                  ? "text-neutral-900 dark:text-neutral-100 bg-neutral-200/60 dark:bg-neutral-800/60"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {sf.label}
            </button>
          ))}
        </div>

        {/* Min bets — pushed right */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="hidden sm:block text-neutral-400 dark:text-neutral-600 text-[11px]">Min bets</span>
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
                  <DropdownMenuRadioItem
                    key={opt.value}
                    value={opt.value}
                    className="text-xs focus:bg-neutral-100 dark:focus:bg-neutral-800 focus:text-neutral-900 dark:focus:text-neutral-200"
                  >
                    {opt.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Period PnL label ── */}
      <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 dark:text-neutral-600">
        <span>Sorted by</span>
        <span className="font-medium text-neutral-500 dark:text-neutral-500">
          {period === "7d" ? "7-day P&L" : period === "30d" ? "30-day P&L" : "all-time rank"}
        </span>
        <span className="text-neutral-300 dark:text-neutral-700">·</span>
        <span>P&L shown per row</span>
      </div>

      {/* ── Wallet List ── */}
      {isLoading ? (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/20">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="py-3 animate-pulse">
              <div className="flex items-center gap-2.5">
                <div className="h-5 w-5 bg-neutral-200/50 dark:bg-neutral-800/40 rounded-full shrink-0" />
                <div className="h-4 w-10 bg-neutral-200/50 dark:bg-neutral-800/40 rounded" />
                <div className="h-3.5 w-20 bg-neutral-200/50 dark:bg-neutral-800/30 rounded" />
                <div className="flex-1" />
                <div className="h-3.5 w-12 bg-neutral-200/40 dark:bg-neutral-800/25 rounded" />
                <div className="h-5 w-14 bg-neutral-200/40 dark:bg-neutral-800/25 rounded-md" />
              </div>
              <div className="mt-1.5 ml-[30px] flex gap-2">
                <div className="h-3 w-16 bg-neutral-100 dark:bg-neutral-800/20 rounded" />
                <div className="h-3 w-10 bg-neutral-100 dark:bg-neutral-800/15 rounded" />
                <div className="h-3 w-8 bg-neutral-100 dark:bg-neutral-800/15 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : wallets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg className="h-8 w-8 text-neutral-300 dark:text-neutral-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">No wallets found</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/20">
          {wallets.map((wallet, index) => {
            const rank = wallet.rank || (index + 1)
            const anonId = wallet.display_name || `#${wallet.wallet_address.slice(2, 6).toUpperCase()}`
            const isSelected = selectedWallet?.wallet_address === wallet.wallet_address
            const isFollowed = followedWallets.includes(wallet.wallet_address)
            const roiPositive = (wallet.roi ?? 0) >= 0
            const periodPnl = getPeriodPnl(wallet)
            const pnlPositive = (periodPnl ?? 0) >= 0
            const isTopThree = rank <= 3

            return (
              <div
                key={wallet.wallet_address}
                onClick={() => onSelectWallet(wallet)}
                className={cn(
                  "cursor-pointer py-2.5 px-2 -mx-2 rounded-lg transition-all duration-150",
                  isSelected
                    ? "bg-sky-50 dark:bg-sky-500/[0.04] border-l-2 border-l-sky-500 dark:border-l-sky-500/60 pl-3"
                    : isTopThree
                    ? "hover:bg-neutral-50 dark:hover:bg-neutral-800/15 border-l-2 border-l-transparent hover:border-l-neutral-200 dark:hover:border-l-neutral-700/40"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-800/15 border-l-2 border-l-transparent",
                  "active:scale-[0.997]"
                )}
              >
                {/* Row 1: Rank · Tier · ID · hot/cold · PnL · Follow */}
                <div className="flex items-center gap-2 mb-1">
                  <RankDisplay rank={rank} />
                  <WalletTierBadge tier={wallet.tier} />
                  <span className="font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-200 tabular-nums">
                    {anonId}
                  </span>

                  {/* Hot/cold signal */}
                  {wallet.hot_cold === "hot" && (
                    <span className="text-[10px] leading-none" title="Hot streak">🔥</span>
                  )}
                  {wallet.hot_cold === "cold" && (
                    <span className="text-[10px] leading-none" title="Cold streak">❄️</span>
                  )}

                  {isFollowed && (
                    <span className="text-[9px] font-semibold text-sky-600 dark:text-sky-400/80 tracking-wide">
                      FOLLOWING
                    </span>
                  )}

                  {/* Period P&L — right side */}
                  {periodPnl != null && (
                    <span className={cn(
                      "ml-auto font-mono text-[11px] font-semibold tabular-nums shrink-0",
                      pnlPositive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-500 dark:text-red-400"
                    )}>
                      {formatPnl(periodPnl)}
                    </span>
                  )}

                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <FollowButton
                      isFollowing={isFollowed}
                      onToggle={() => onToggleFollow(wallet.wallet_address)}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Row 2: Stats — W-L · win% · ROI · streak · avg stake · sport · last active */}
                <div className="flex items-center gap-1.5 pl-[28px] text-[10px] text-neutral-500 dark:text-neutral-500 tabular-nums flex-wrap">
                  {/* Record + win rate */}
                  <span>
                    <span className="font-medium text-neutral-600 dark:text-neutral-400">
                      {wallet.wins ?? 0}–{wallet.losses ?? 0}
                    </span>
                    <span className="text-neutral-400 dark:text-neutral-600 ml-0.5">
                      {" "}({wallet.win_rate != null ? wallet.win_rate.toFixed(0) : "—"}%)
                    </span>
                  </span>

                  <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>

                  {/* ROI */}
                  <span className={cn(
                    "font-mono font-semibold",
                    roiPositive ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                  )}>
                    {roiPositive ? "+" : ""}{wallet.roi != null ? wallet.roi.toFixed(1) : "0"}%
                  </span>

                  {/* Streak */}
                  {wallet.current_streak !== 0 && (
                    <>
                      <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                      <span className={cn(
                        "font-mono font-semibold px-1 rounded text-[9px]",
                        wallet.current_streak > 0
                          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10"
                          : "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10"
                      )}>
                        {wallet.current_streak > 0
                          ? `${wallet.current_streak}W`
                          : `${Math.abs(wallet.current_streak)}L`}
                      </span>
                    </>
                  )}

                  <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>

                  {/* Avg stake */}
                  <span className="text-neutral-400 dark:text-neutral-600">
                    {formatMoney(wallet.avg_stake)} avg
                  </span>

                  {/* Primary sport */}
                  {wallet.primary_sport && (
                    <>
                      <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
                      <span className="uppercase font-medium text-neutral-500 dark:text-neutral-500">
                        {wallet.primary_sport}
                      </span>
                    </>
                  )}

                  {/* Last active — desktop only */}
                  {wallet.last_bet_at && (
                    <span className="hidden sm:block ml-auto text-neutral-400 dark:text-neutral-600 font-normal">
                      {formatTimeAgo(wallet.last_bet_at)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="py-4 flex justify-center">
            {hasMore && (loadingMore || isValidating) && wallets.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <div className="h-3.5 w-3.5 border-2 border-neutral-400 dark:border-neutral-600 border-t-transparent rounded-full animate-spin" />
                Loading more...
              </div>
            )}
            {!hasMore && wallets.length > 0 && (
              <span className="text-xs text-neutral-400 dark:text-neutral-600">
                {wallets.length} insider{wallets.length !== 1 ? "s" : ""} loaded
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
