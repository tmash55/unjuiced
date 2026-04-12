"use client"

import { useState } from "react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { FollowButton } from "./follow-button"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import type { WalletDetailResponse, WhaleSignal } from "@/lib/polymarket/types"

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  S: {
    label: "S",
    stripe: "bg-amber-500",
    badge: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30",
    headerBg: "from-amber-500/[0.07] dark:from-amber-500/[0.05]",
    rankGlow: "shadow-[0_0_0_1px_theme(colors.amber.200)] dark:shadow-[0_0_0_1px_theme(colors.amber.500/25)]",
  },
  A: {
    label: "A",
    stripe: "bg-emerald-500",
    badge: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30",
    headerBg: "from-emerald-500/[0.06] dark:from-emerald-500/[0.04]",
    rankGlow: "shadow-[0_0_0_1px_theme(colors.emerald.200)] dark:shadow-[0_0_0_1px_theme(colors.emerald.500/25)]",
  },
  B: {
    label: "B",
    stripe: "bg-sky-500",
    badge: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 border-sky-300 dark:border-sky-500/30",
    headerBg: "from-sky-500/[0.06] dark:from-sky-500/[0.04]",
    rankGlow: "shadow-[0_0_0_1px_theme(colors.sky.200)] dark:shadow-[0_0_0_1px_theme(colors.sky.500/25)]",
  },
  C: {
    label: "C",
    stripe: "bg-neutral-400 dark:bg-neutral-600",
    badge: "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/60 border-neutral-300 dark:border-neutral-700/40",
    headerBg: "from-neutral-400/[0.04]",
    rankGlow: "",
  },
  FADE: {
    label: "FADE",
    stripe: "bg-red-400",
    badge: "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/25",
    headerBg: "from-red-500/[0.04]",
    rankGlow: "",
  },
  NEW: {
    label: "NEW",
    stripe: "bg-neutral-400 dark:bg-neutral-600",
    badge: "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/60 border-neutral-300 dark:border-neutral-700/40",
    headerBg: "from-neutral-400/[0.04]",
    rankGlow: "",
  },
} as const

function getTierConfig(tier: string | null | undefined) {
  const key = (tier?.toUpperCase() ?? "C") as keyof typeof TIER_CONFIG
  return TIER_CONFIG[key] ?? TIER_CONFIG.C
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—"
  const abs = Math.abs(n)
  const sign = n < 0 ? "−" : ""
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`
  return `${sign}$${abs.toFixed(0)}`
}

function formatPnl(n: number | null | undefined): string {
  if (n == null) return "—"
  const abs = Math.abs(n)
  const sign = n >= 0 ? "+" : "−"
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`
  return `${sign}$${abs.toFixed(0)}`
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return "—"
  }
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ── Loading skeleton ──────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="px-5 pt-5 pb-5 border-b border-neutral-200/60 dark:border-neutral-800/40">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="h-7 w-10 bg-neutral-200 dark:bg-neutral-800/60 rounded-md mb-3" />
            <div className="h-6 w-20 bg-neutral-200 dark:bg-neutral-800/50 rounded mb-1.5" />
            <div className="h-3.5 w-28 bg-neutral-100 dark:bg-neutral-800/30 rounded" />
          </div>
          <div className="h-8 w-24 bg-neutral-200 dark:bg-neutral-800/40 rounded-md" />
        </div>
        {/* Win/loss bar skeleton */}
        <div className="h-1.5 bg-neutral-200 dark:bg-neutral-800/40 rounded-full" />
      </div>

      {/* Stats grid skeleton */}
      <div className="px-5 py-4 border-b border-neutral-200/50 dark:border-neutral-800/40">
        <div className="grid grid-cols-3 gap-x-4 gap-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="text-center">
              <div className="h-5 w-12 bg-neutral-200 dark:bg-neutral-800/50 rounded mx-auto mb-1" />
              <div className="h-3 w-10 bg-neutral-100 dark:bg-neutral-800/30 rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent calls skeleton */}
      <div className="px-5 py-4 space-y-3.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="h-4 w-8 bg-neutral-200 dark:bg-neutral-800/40 rounded shrink-0" />
            <div className="h-3.5 flex-1 bg-neutral-100 dark:bg-neutral-800/30 rounded" />
            <div className="h-3.5 w-10 bg-neutral-100 dark:bg-neutral-800/25 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stat cell ─────────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  colorClass,
}: {
  label: string
  value: string
  colorClass?: string
}) {
  return (
    <div className="text-center">
      <div
        className={cn(
          "font-mono text-[15px] font-bold tabular-nums leading-none mb-0.5",
          colorClass || "text-neutral-900 dark:text-neutral-100"
        )}
      >
        {value}
      </div>
      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-none">{label}</p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SharpProfileSheetProps {
  walletAddress: string | null
  onClose: () => void
  followedWallets: string[]
  onToggleFollow: (addr: string) => void
}

export function SharpProfileSheet({
  walletAddress,
  onClose,
  followedWallets,
  onToggleFollow,
}: SharpProfileSheetProps) {
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useSWR<WalletDetailResponse>(
    walletAddress ? `/api/polymarket/wallet?address=${walletAddress}&betLimit=20` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  const wallet = data?.wallet
  const recentBets: WhaleSignal[] = data?.recent_bets ?? []

  const tier = wallet?.tier?.toUpperCase() ?? "C"
  const tc = getTierConfig(tier)

  const displayId = walletAddress ? `#${walletAddress.slice(2, 6).toUpperCase()}` : "—"
  const isFollowing = walletAddress ? followedWallets.includes(walletAddress) : false

  // Derive accurate stats from sport_breakdown
  const rawBreakdown = { ...(wallet?.sport_breakdown ?? {}) }
  // Merge march-madness into ncaab
  if (rawBreakdown["march-madness"] && rawBreakdown["ncaab"]) {
    rawBreakdown["ncaab"] = {
      w: (rawBreakdown["ncaab"].w || 0) + (rawBreakdown["march-madness"].w || 0),
      l: (rawBreakdown["ncaab"].l || 0) + (rawBreakdown["march-madness"].l || 0),
      bets: (rawBreakdown["ncaab"].bets || 0) + (rawBreakdown["march-madness"].bets || 0),
      wagered: (rawBreakdown["ncaab"].wagered || 0) + (rawBreakdown["march-madness"].wagered || 0),
      profit: (rawBreakdown["ncaab"].profit || 0) + (rawBreakdown["march-madness"].profit || 0),
      roi: 0,
    }
    delete rawBreakdown["march-madness"]
  } else if (rawBreakdown["march-madness"]) {
    rawBreakdown["ncaab"] = rawBreakdown["march-madness"]
    delete rawBreakdown["march-madness"]
  }
  const sportEntries = Object.entries(rawBreakdown).sort((a, b) => b[1].bets - a[1].bets)

  const derivedWins = sportEntries.reduce((s, [, v]) => s + v.w, 0)
  const derivedLosses = sportEntries.reduce((s, [, v]) => s + v.l, 0)
  const derivedTotal = derivedWins + derivedLosses
  const winRate = derivedTotal > 0 ? (derivedWins / derivedTotal) * 100 : null
  const winPct = derivedTotal > 0 ? (derivedWins / derivedTotal) * 100 : 50

  const roi = wallet?.roi ?? null
  const roiPositive = (roi ?? 0) >= 0
  const streak = wallet?.current_streak ?? 0

  function handleCopy() {
    if (!walletAddress) return
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Sheet open={!!walletAddress} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        hideCloseButton
        className={cn(
          "w-full sm:max-w-[420px]",
          "bg-white dark:bg-neutral-900",
          "border-l border-neutral-200/60 dark:border-neutral-800/60",
          "p-0 flex flex-col gap-0 overflow-hidden"
        )}
      >
        {/* Tier color band — top accent */}
        <div className={cn("h-[3px] w-full shrink-0", tc.stripe)} />

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "px-5 pt-4 pb-5 border-b border-neutral-200/50 dark:border-neutral-800/40",
            "bg-gradient-to-b to-transparent",
            tc.headerBg
          )}
        >
          {/* Close button — top-right */}
          <div className="flex items-center justify-end mb-3">
            <button
              onClick={onClose}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-all duration-150"
              aria-label="Close"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Tier badge + status badges */}
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center font-black rounded-md border px-2.5 py-1 text-sm tracking-wider",
                    tc.badge
                  )}
                >
                  {tc.label}
                </span>

                {wallet?.hot_cold === "hot" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/25 rounded px-1.5 py-0.5">
                    {/* Flame icon */}
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2c-1.5 2.5-2 5-1 7.5C9 8 7.5 6 8 3.5 5.5 5.5 4 9 4 12a8 8 0 0 0 16 0c0-4.5-3-8-8-10Zm0 14a3 3 0 0 1-3-3c0-2 1.5-3.5 3-5 1.5 1.5 3 3 3 5a3 3 0 0 1-3 3Z" />
                    </svg>
                    Hot
                  </span>
                )}
                {wallet?.hot_cold === "cold" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/25 rounded px-1.5 py-0.5">
                    {/* Snowflake icon */}
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M4.22 6.22l15.56 11.56M19.78 6.22 4.22 17.78M3 12h18" />
                    </svg>
                    Cold
                  </span>
                )}

                {streak > 3 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded px-1.5 py-0.5">
                    {streak}W Streak
                  </span>
                )}
              </div>

              {/* Wallet ID + copy */}
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-mono text-2xl font-bold text-neutral-900 dark:text-neutral-50 tabular-nums tracking-tight">
                  {displayId}
                </span>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center justify-center h-6 w-6 rounded text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                  title={copied ? "Copied!" : "Copy full address"}
                >
                  {copied ? (
                    <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* W-L record */}
              {wallet ? (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {derivedWins}–{derivedLosses}
                  </span>
                  <span className="ml-1 text-neutral-400 dark:text-neutral-600">
                    ({winRate != null ? winRate.toFixed(0) : "—"}% win rate)
                  </span>
                </p>
              ) : isLoading ? (
                <div className="h-3.5 w-28 bg-neutral-200 dark:bg-neutral-800/40 rounded animate-pulse" />
              ) : null}
            </div>

            {/* Follow button */}
            {walletAddress && (
              <div className="shrink-0">
                <FollowButton
                  isFollowing={isFollowing}
                  onToggle={() => onToggleFollow(walletAddress)}
                  size="md"
                />
              </div>
            )}
          </div>

          {/* Win / Loss bar */}
          {derivedTotal > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1 text-[10px]">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{derivedWins}W</span>
                <span className="font-medium text-red-500 dark:text-red-400">{derivedLosses}L</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800/50">
                <div
                  className="bg-emerald-500 dark:bg-emerald-400 transition-all duration-700"
                  style={{ width: `${winPct}%` }}
                />
                <div className="bg-red-400 dark:bg-red-500 flex-1" />
              </div>
            </div>
          )}
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <ProfileSkeleton />
          ) : !wallet ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-5">
              <svg className="h-8 w-8 text-neutral-300 dark:text-neutral-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Profile not found</p>
            </div>
          ) : (
            <>
              {/* ── Stats grid ─────────────────────────────────────────────── */}
              <div className="px-5 py-4 border-b border-neutral-200/50 dark:border-neutral-800/40">
                <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                  <StatCell
                    label="Win Rate"
                    value={winRate != null ? `${winRate.toFixed(0)}%` : "—"}
                    colorClass={
                      winRate != null && winRate >= 55
                        ? "text-emerald-600 dark:text-emerald-400"
                        : undefined
                    }
                  />
                  <StatCell
                    label="ROI"
                    value={roi != null ? `${roiPositive ? "+" : ""}${roi.toFixed(1)}%` : "—"}
                    colorClass={
                      roiPositive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-500 dark:text-red-400"
                    }
                  />
                  <StatCell
                    label="Volume"
                    value={formatMoney(wallet.total_wagered)}
                  />
                  <StatCell
                    label="Tracked"
                    value={derivedTotal.toLocaleString()}
                  />
                  <StatCell
                    label="Avg Stake"
                    value={formatMoney(wallet.avg_stake)}
                  />
                  <StatCell
                    label="Streak"
                    value={
                      streak > 0
                        ? `${streak}W`
                        : streak < 0
                        ? `${Math.abs(streak)}L`
                        : "—"
                    }
                    colorClass={
                      streak > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : streak < 0
                        ? "text-red-500 dark:text-red-400"
                        : undefined
                    }
                  />
                </div>
              </div>

              {/* ── Best trade ─────────────────────────────────────────────── */}
              {wallet.biggest_win_title && wallet.biggest_win_pnl != null && (
                <div className="px-5 py-3.5 border-b border-neutral-200/50 dark:border-neutral-800/40">
                  <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">
                    Best Trade
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-neutral-700 dark:text-neutral-300 truncate flex-1 leading-snug">
                      {wallet.biggest_win_title}
                    </p>
                    <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0 tabular-nums">
                      {formatPnl(wallet.biggest_win_pnl)}
                    </span>
                  </div>
                </div>
              )}

              {/* ── Sports focus ────────────────────────────────────────────── */}
              {sportEntries.length > 0 && (
                <div className="px-5 py-3.5 border-b border-neutral-200/50 dark:border-neutral-800/40">
                  <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2.5">
                    Sports Focus
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {sportEntries.slice(0, 6).map(([sport, stats]) => {
                      const sportRoiPos = (stats.roi ?? 0) >= 0
                      return (
                        <div
                          key={sport}
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/30"
                        >
                          <span className="text-neutral-700 dark:text-neutral-200 uppercase font-semibold">
                            {sport === "ncaab" ? "NCAAB" : sport.toUpperCase()}
                          </span>
                          <span className="text-neutral-400 dark:text-neutral-500 tabular-nums">
                            {stats.w}–{stats.l}
                          </span>
                          <span
                            className={cn(
                              "font-mono tabular-nums",
                              sportRoiPos
                                ? "text-emerald-500 dark:text-emerald-400"
                                : "text-red-400"
                            )}
                          >
                            {sportRoiPos ? "+" : ""}
                            {(stats.roi ?? 0).toFixed(1)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Polymarket P&L row ──────────────────────────────────────── */}
              {(wallet.poly_month_pnl != null || wallet.poly_pnl != null) && (
                <div className="px-5 py-3.5 border-b border-neutral-200/50 dark:border-neutral-800/40">
                  <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2.5">
                    Polymarket P&amp;L
                  </p>
                  <div className="flex items-center gap-5">
                    {wallet.poly_month_pnl != null && (
                      <div>
                        <div
                          className={cn(
                            "font-mono text-sm font-bold tabular-nums",
                            wallet.poly_month_pnl >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-500 dark:text-red-400"
                          )}
                        >
                          {formatPnl(wallet.poly_month_pnl)}
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5">30-day</p>
                      </div>
                    )}
                    {wallet.poly_week_pnl != null && (
                      <div>
                        <div
                          className={cn(
                            "font-mono text-sm font-bold tabular-nums",
                            wallet.poly_week_pnl >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-500 dark:text-red-400"
                          )}
                        >
                          {formatPnl(wallet.poly_week_pnl)}
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5">7-day</p>
                      </div>
                    )}
                    {wallet.poly_pnl != null && (
                      <div>
                        <div
                          className={cn(
                            "font-mono text-sm font-bold tabular-nums",
                            wallet.poly_pnl >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-500 dark:text-red-400"
                          )}
                        >
                          {formatPnl(wallet.poly_pnl)}
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5">All-time</p>
                      </div>
                    )}
                    {wallet.poly_rank != null && (
                      <div className="ml-auto">
                        <div className="font-mono text-sm font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">
                          #{wallet.poly_rank}
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5">Poly rank</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Recent Calls ────────────────────────────────────────────── */}
              <div className="px-5 py-4 pb-8">
                <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3">
                  Recent Calls
                </p>
                {recentBets.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-4 text-center">No recent signals</p>
                ) : (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800/30">
                    {recentBets.slice(0, 10).map((bet: WhaleSignal) => {
                      const isBuy = bet.side?.toUpperCase() === "BUY"
                      const pricePct = Math.round(bet.entry_price * 100)
                      const resultW = bet.result === "win"
                      const resultL = bet.result === "loss"

                      return (
                        <div key={bet.id} className="flex items-start gap-2.5 py-2.5 text-xs">
                          {/* BUY/SELL pill */}
                          <span
                            className={cn(
                              "shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 tabular-nums",
                              isBuy
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400"
                            )}
                          >
                            {isBuy ? "BUY" : "SELL"}
                          </span>

                          {/* Market + outcome */}
                          <div className="min-w-0 flex-1">
                            <p className="text-neutral-700 dark:text-neutral-300 truncate leading-snug">
                              {bet.event_title ?? bet.market_title}
                            </p>
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                              {bet.outcome}
                              {bet.sport && (
                                <span className="ml-1.5 uppercase font-medium text-neutral-300 dark:text-neutral-600">
                                  {bet.sport}
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Result + price */}
                          <div className="shrink-0 text-right">
                            <div className="flex items-center gap-1.5 justify-end">
                              {resultW && (
                                <span className="font-mono font-bold text-[10px] text-emerald-500 dark:text-emerald-400">
                                  W
                                </span>
                              )}
                              {resultL && (
                                <span className="font-mono font-bold text-[10px] text-red-500 dark:text-red-400">
                                  L
                                </span>
                              )}
                              {!bet.result && !bet.resolved && (
                                <span className="text-[9px] text-neutral-400 font-medium">—</span>
                              )}
                              <span className="font-mono text-neutral-600 dark:text-neutral-400 tabular-nums">
                                {pricePct}¢
                              </span>
                            </div>
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-600 tabular-nums mt-0.5">
                              {timeAgo(bet.created_at)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
