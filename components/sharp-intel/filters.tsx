"use client"

import { cn } from "@/lib/utils"
import useSWR from "swr"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { WalletScore } from "@/lib/polymarket/types"

interface FiltersProps {
  selectedSport: string
  onSportChange: (sport: string) => void
  selectedTier: string
  onTierChange: (tier: string) => void
  availableSports?: string[]
  showMySharps?: boolean
  onToggleMySharps?: () => void
  followedCount?: number
  followedWallets?: string[]
  onUnfollow?: (walletAddress: string) => void
}

// Known sport labels — any sport not here will auto-display uppercased
const SPORT_LABELS: Record<string, string> = {
  nba: "NBA",
  nhl: "NHL",
  soccer: "Soccer",
  mlb: "MLB",
  nfl: "NFL",
  tennis: "Tennis",
  ufc: "UFC",
  ncaab: "NCAAB",
  "march-madness": "NCAAB",
  ncaaf: "NCAAF",
  wnba: "WNBA",
  esports: "Esports",
}

// Preferred display order
const SPORT_ORDER = ["nba", "nhl", "ncaab", "march-madness", "mlb", "nfl", "soccer", "tennis", "ufc", "wnba", "ncaaf"]

// Always show these sports even if no data yet
const BASE_SPORTS = ["nba", "nhl", "ncaab", "mlb", "nfl", "soccer", "tennis", "ufc"]

function buildSportsList(available?: string[]) {
  // Normalize march-madness → ncaab, then merge and deduplicate
  const normalized = (available || []).map(s => s === "march-madness" ? "ncaab" : s)
  const merged = [...new Set([...BASE_SPORTS, ...normalized])]

  const sorted = merged.sort((a, b) => {
    const ai = SPORT_ORDER.indexOf(a)
    const bi = SPORT_ORDER.indexOf(b)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  return [
    { id: "all", label: "All" },
    ...sorted.map((s) => ({ id: s, label: SPORT_LABELS[s] || s.toUpperCase() })),
  ]
}

const TIERS = [
  { id: "all", label: "All", color: "default", dot: null },
  { id: "sharp", label: "Sharps", color: "emerald", dot: "bg-emerald-500 dark:bg-emerald-400" },
  { id: "whale", label: "Insiders", color: "purple", dot: "bg-purple-500 dark:bg-purple-400" },
  { id: "burner", label: "New", color: "neutral", dot: "bg-neutral-400 dark:bg-neutral-500" },
]

const TIER_INFO = [
  {
    label: "Sharp",
    color: "bg-emerald-500 dark:bg-emerald-400",
    desc: "A trader ranked in the top 50 on Polymarket's sports leaderboard with a proven track record of profitability. These are the sharpest bettors in the market.",
  },
  {
    label: "Insider",
    color: "bg-purple-500 dark:bg-purple-400",
    desc: "A high-volume trader placing large individual bets ($5K+) who isn't on the leaderboard. Big money, but less track record to evaluate.",
  },
  {
    label: "New Account",
    color: "bg-neutral-400 dark:bg-neutral-500",
    desc: "A fresh wallet with fewer than 20 trades. Could be a sharp using a new address, or just noise. Proceed with caution.",
  },
]

const walletFetcher = (url: string) => fetch(url).then(r => r.json())

function FollowedWalletRow({ address, onUnfollow }: { address: string; onUnfollow: () => void }) {
  const anonId = `#${address.slice(0, 4).toUpperCase()}`
  const { data } = useSWR<{ wallets: WalletScore[] }>(
    `/api/polymarket/leaderboard?wallet=${address}`,
    walletFetcher
  )
  const wallet = data?.wallets?.[0]
  const roiPositive = (wallet?.roi ?? 0) >= 0

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-200 tabular-nums">
          {anonId}
        </span>
        <button
          onClick={onUnfollow}
          className="text-[11px] text-neutral-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400 transition-colors"
        >
          Unfollow
        </button>
      </div>
      {wallet ? (
        <div className="flex items-center gap-2 text-[11px] text-neutral-500 tabular-nums">
          <span className="font-mono">
            {wallet.wins}-{wallet.losses}
          </span>
          <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
          <span className={cn("font-mono font-semibold", roiPositive ? "text-emerald-500 dark:text-emerald-400" : "text-red-400")}>
            {roiPositive ? "+" : ""}{wallet.roi?.toFixed(1) ?? "0"}%
          </span>
          {wallet.primary_sport && (
            <>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span className="uppercase">{wallet.primary_sport}</span>
            </>
          )}
          {wallet.current_streak !== 0 && (
            <>
              <span className="text-neutral-300 dark:text-neutral-700">&middot;</span>
              <span className={cn("font-medium", wallet.current_streak > 0 ? "text-emerald-400" : "text-red-400")}>
                {wallet.current_streak > 0 ? `${wallet.current_streak}W` : `${Math.abs(wallet.current_streak)}L`}
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="h-3 w-32 bg-neutral-200 dark:bg-neutral-800/30 rounded animate-pulse" />
      )}
    </div>
  )
}

export function Filters({
  selectedSport,
  onSportChange,
  selectedTier,
  onTierChange,
  availableSports,
  showMySharps,
  onToggleMySharps,
  followedCount = 0,
  followedWallets = [],
  onUnfollow,
}: FiltersProps) {
  const sports = buildSportsList(availableSports)

  const activeSportLabel = sports.find(s => s.id === selectedSport || (selectedSport === "" && s.id === "all"))?.label || "All"
  const activeTier = TIERS.find(t => t.id === selectedTier || (selectedTier === "" && t.id === "all"))
  const activeTierLabel = activeTier?.label || "All"

  return (
    <div className="px-3 sm:px-4 py-2">
      {/* ── Mobile: compact dropdowns ── */}
      <div className="flex sm:hidden items-center gap-2">
        {/* Sport dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 bg-white dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/30 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 outline-none">
            {activeSportLabel}
            <svg className="h-3 w-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[140px] p-1">
            {sports.map((sport) => {
              const isActive = (selectedSport === sport.id) || (selectedSport === "" && sport.id === "all")
              return (
                <button
                  key={sport.id}
                  onClick={() => onSportChange(sport.id === "all" ? "" : sport.id)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-colors",
                    isActive
                      ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  {sport.label}
                </button>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tier dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 bg-white dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/30 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 outline-none">
            {activeTier?.dot && <span className={cn("h-1.5 w-1.5 rounded-full", activeTier.dot)} />}
            {activeTierLabel}
            <svg className="h-3 w-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[160px] p-1">
            {TIERS.map((tier) => {
              const isActive = (selectedTier === tier.id) || (selectedTier === "" && tier.id === "all")
              return (
                <button
                  key={tier.id}
                  onClick={() => onTierChange(tier.id === "all" ? "" : tier.id)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-2",
                    isActive
                      ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                      : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  {tier.dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", tier.dot)} />}
                  {tier.label}
                </button>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        {/* My Sharps — mobile */}
        {followedCount > 0 && onToggleMySharps && (
          <button
            onClick={onToggleMySharps}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all border",
              showMySharps
                ? "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20"
                : "bg-white dark:bg-neutral-800/60 text-neutral-500 border-neutral-200 dark:border-neutral-700/30 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
          >
            <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill={showMySharps ? "currentColor" : "none"} stroke="currentColor" strokeWidth={showMySharps ? 0 : 1.5}>
              <path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 0 1 8 4a3.5 3.5 0 0 1 5.5 3c0 3.5-5.5 7-5.5 7Z" />
            </svg>
            My Sharps
          </button>
        )}
      </div>

      {/* ── Desktop: pill bar ── */}
      <div className="hidden sm:flex items-center gap-1 overflow-x-auto scrollbar-none">
        {/* Sports */}
        {sports.map((sport) => {
          const isActive = (selectedSport === sport.id) || (selectedSport === "" && sport.id === "all")
          return (
            <button
              key={sport.id}
              onClick={() => {
                if (sport.id === "all") {
                  onSportChange("")
                } else {
                  onSportChange(selectedSport === sport.id ? "" : sport.id)
                }
              }}
              className={cn(
                "px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 whitespace-nowrap",
                isActive
                  ? "bg-neutral-200/80 text-neutral-900 dark:text-neutral-100 dark:bg-neutral-800/60"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {sport.label}
            </button>
          )
        })}

        <span className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-800/60 mx-1 shrink-0" />

        {/* Tiers */}
        {TIERS.map((tier) => {
          const isActive = (selectedTier === tier.id) || (selectedTier === "" && tier.id === "all")
          return (
            <button
              key={tier.id}
              onClick={() => onTierChange(tier.id === "all" ? "" : tier.id)}
              className={cn(
                "px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-150 flex items-center gap-1 whitespace-nowrap",
                isActive
                  ? tier.color === "emerald" ? "bg-emerald-50 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/10"
                    : tier.color === "purple" ? "bg-purple-50 text-purple-600 dark:text-purple-400 dark:bg-purple-500/10"
                    : tier.color === "neutral" ? "bg-neutral-200/60 text-neutral-500 dark:text-neutral-400 dark:bg-neutral-500/10"
                    : "bg-neutral-200/80 text-neutral-900 dark:text-neutral-100 dark:bg-neutral-800/60"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              {tier.dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", tier.dot)} />}
              {tier.label}
            </button>
          )
        })}

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-0.5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-400 transition-colors shrink-0 outline-none">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 p-3 space-y-3">
            <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-200">Insider tiers</p>
            {TIER_INFO.map((tier) => (
              <div key={tier.label} className="flex gap-2.5">
                <div className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", tier.color)} />
                <div>
                  <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">{tier.label}</p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">{tier.desc}</p>
                </div>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* My Sharps — desktop */}
        {followedCount > 0 && onToggleMySharps && (
          <>
            <span className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-800/60 mx-1 shrink-0" />
            <button
              onClick={onToggleMySharps}
              className={cn(
                "pl-2 pr-1 py-1 rounded-l-md text-[11px] font-medium transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap",
                showMySharps
                  ? "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              )}
            >
              <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill={showMySharps ? "currentColor" : "none"} stroke="currentColor" strokeWidth={showMySharps ? 0 : 1.5}>
                <path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 0 1 8 4a3.5 3.5 0 0 1 5.5 3c0 3.5-5.5 7-5.5 7Z" />
              </svg>
              My Sharps
            </button>
            <Sheet>
              <SheetTrigger className={cn(
                "pr-2 pl-0.5 py-1 rounded-r-md text-[11px] transition-all duration-150 outline-none",
                showMySharps
                  ? "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
                  : "text-neutral-400 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-400"
              )}>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </SheetTrigger>
              <SheetContent side="right" className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800/40 w-[320px] flex flex-col p-0">
                <SheetHeader className="px-5 pt-5 pb-0">
                  <SheetTitle className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
                    My Sharps ({followedWallets.length})
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
                  {followedWallets.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-xs text-neutral-500 leading-relaxed">
                        Follow insiders from the Leaderboard tab or by clicking their ID on any pick card.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-200 dark:divide-neutral-800/30">
                      {followedWallets.map((addr) => (
                        <FollowedWalletRow
                          key={addr}
                          address={addr}
                          onUnfollow={() => onUnfollow?.(addr)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>
    </div>
  )
}
