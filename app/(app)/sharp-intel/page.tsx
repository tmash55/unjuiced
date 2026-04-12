"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import useSWRInfinite from "swr/infinite";
import { AppPageLayout } from "@/components/layout/app-page-layout";
import { useHasEliteAccess } from "@/hooks/use-entitlements";
import { useSignalPreferences } from "@/hooks/use-signal-preferences";
import { useHiddenEdges } from "@/hooks/use-hidden-edges";
import { StatsDashboard } from "@/components/sharp-intel/stats-dashboard";
import { PicksScoreboard } from "@/components/sharp-intel/picks-scoreboard";
import { ScoredPlayDetail } from "@/components/sharp-intel/scored-play-detail";
import type { ActivePlay } from "@/app/api/polymarket/active-plays/route";
import { Filters } from "@/components/sharp-intel/filters";
import { PickCard } from "@/components/sharp-intel/pick-card";
import { PickDetailPanel } from "@/components/sharp-intel/pick-detail-panel";
import { MarketDetailPanel } from "@/components/sharp-intel/market-detail-panel";
import { MarketHeatmap } from "@/components/sharp-intel/market-heatmap";
import { FeedTab } from "@/components/sharp-intel/feed-tab";
import { Leaderboard } from "@/components/sharp-intel/leaderboard";
import { WalletDetailPanel } from "@/components/sharp-intel/wallet-detail-panel";
import { SettingsSheet } from "@/components/sharp-intel/settings-sheet";
import { DetailSheet } from "@/components/sharp-intel/detail-sheet";
import { OnboardingTour, TourTrigger, hasOddsForSport } from "@/components/sharp-intel/onboarding-tour";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { EyeOff } from "lucide-react";
import { OddsFormat } from "@/lib/odds";
import { WhaleSignal, WalletScore } from "@/lib/polymarket/types";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";

type Tab = "picks" | "scored" | "markets" | "leaderboard";

type SortOption = { label: string; icon: string }

const PICKS_SORTS: Record<string, SortOption> = {
  score: { label: "Score", icon: "M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" },
  recent: { label: "Recent", icon: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  upcoming: { label: "Upcoming", icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" },
  stake: { label: "Stake", icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  edge: { label: "Edge", icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" },
  roi: { label: "ROI", icon: "M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" },
  conviction: { label: "Conviction", icon: "M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.048 8.287 8.287 0 0 0 9 9.6a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" },
}

const MARKETS_SORTS: Record<string, SortOption> = {
  liquidity: { label: "Liquidity", icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
  bettors: { label: "Bettors", icon: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" },
  conviction: { label: "Conviction", icon: "M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.048 8.287 8.287 0 0 0 9 9.6a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" },
  recent: { label: "Recent", icon: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
}

function SortDropdown({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Record<string, SortOption> }) {
  const current = options[value] || Object.values(options)[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/30 rounded-md px-2 py-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 outline-none hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
        <svg className="h-3 w-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-3L16.5 18m0 0L12 13.5m4.5 4.5V4.5" />
        </svg>
        <span className="hidden sm:inline">{current.label}</span>
        <svg className="h-3 w-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px] p-1">
        {Object.entries(options).map(([key, { label, icon }]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium cursor-pointer",
              value === key && "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            )}
          >
            <svg className="h-3.5 w-3.5 shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
            {label}
            {value === key && (
              <svg className="h-3 w-3 ml-auto text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface GameData {
  condition_id: string
  market_title: string
  sport: string | null
  market_type: string | null
  game_date: string | null
  game_start_time: string | null
  resolved: boolean
  consensus_outcome: string
  consensus_result: "win" | "loss" | "pending"
  flow_pct: number
  confidence: "strong" | "lean" | "split"
  total_dollars: number
  total_bets: number
  total_sharps: number
  total_whales: number
  outcomes: Array<{
    outcome: string
    total_dollars: number
    sharp_count: number
    whale_count: number
    total_bets: number
    avg_entry_price: number
    best_book: string | null
    best_book_price: string | null
    best_book_decimal: number | null
    wins: number
    losses: number
    bets: Array<{
      anon_id: string
      wallet_address?: string
      tier: string
      bet_size: number
      entry_price: number
      american_odds: number | null
      result: string | null
      quality_score: number | null
      created_at: string
    }>
  }>
  first_signal_at: string
  last_signal_at: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

/** Fetches game data by condition_id for the market modal */
function MarketModalContent({ marketId, oddsFormat, onViewInsider }: { marketId: string; oddsFormat: OddsFormat; onViewInsider?: (addr: string) => void }) {
  // Direct lookup by condition_id — fast, precise
  const { data, isLoading } = useSWR(
    `/api/polymarket/games?condition_id=${encodeURIComponent(marketId)}&resolved=false`,
    fetcher
  )

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse py-4">
        <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-800/40 rounded" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-neutral-200 dark:bg-neutral-800/20 rounded" />)}
        </div>
        <div className="h-20 bg-neutral-200 dark:bg-neutral-800/20 rounded" />
      </div>
    )
  }

  const game = data?.games?.[0]
  if (!game) return <p className="text-xs text-neutral-500 py-8 text-center">Market data not available</p>

  return <MarketDetailPanel game={game} oddsFormat={oddsFormat} onViewInsider={onViewInsider} />
}

/** Fetches real wallet data from leaderboard API for the modal */
function WalletModalContent({ walletAddress, oddsFormat, isFollowing, onToggleFollow }: {
  walletAddress: string
  oddsFormat: OddsFormat
  isFollowing: boolean
  onToggleFollow: (addr: string) => void
}) {
  const { data, isLoading } = useSWR(
    `/api/polymarket/leaderboard?limit=1&wallet=${walletAddress}`,
    fetcher
  )

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse py-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-16 bg-neutral-200 dark:bg-neutral-800/40 rounded" />
          <div className="h-5 w-12 bg-neutral-200 dark:bg-neutral-800/40 rounded" />
        </div>
        <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800/30 rounded" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-neutral-200 dark:bg-neutral-800/20 rounded" />)}
        </div>
      </div>
    )
  }

  const wallet = data?.wallets?.[0]
  if (!wallet) return <p className="text-xs text-neutral-500 py-4 text-center">Wallet not found</p>

  return (
    <WalletDetailPanel
      wallet={wallet}
      oddsFormat={oddsFormat}
      isFollowing={isFollowing}
      onToggleFollow={onToggleFollow}
    />
  )
}

export default function SharpSignalsPage() {
  const { hasAccess, isLoading } = useHasEliteAccess();
  const { prefs, loaded: prefsLoaded, updatePrefs, toggleFollowWallet, followedWallets } = useSignalPreferences();
  const { hideEdge, unhideEdge, isHidden, hiddenCount, clearAllHidden } = useHiddenEdges("sharp-intel");
  const showHidden = prefs.signal_show_hidden !== false; // default true
  const [tab, setTab] = useState<Tab>("scored");
  const [selectedSport, setSelectedSport] = useState("");
  const [selectedTier, setSelectedTier] = useState("");
  const minScore = prefs.sharp_signals_min_score || 0;
  const [selectedPick, setSelectedPick] = useState<WhaleSignal | null>(null);
  const [selectedScoredPlay, setSelectedScoredPlay] = useState<ActivePlay | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<GameData | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<WalletScore | null>(null);
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>("american");
  const [showMySharps, setShowMySharps] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [marketSort, setMarketSort] = useState<string>("liquidity");
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const seenSportsRef = useRef<Set<string>>(new Set());

  // Clear selections when filters change
  useEffect(() => {
    setSelectedPick(null);
    setSelectedMarket(null);
  }, [selectedSport, selectedTier, showMySharps, minScore]);

  // Modal state for wallet quick-view and market quick-view
  const [modalWalletAddress, setModalWalletAddress] = useState<string | null>(null);
  const [modalMarketId, setModalMarketId] = useState<string | null>(null); // condition_id

  // ── Infinite scroll picks feed (SWR Infinite) ──────────────
  const PAGE_SIZE = 50;
  const sentinelRef = useRef<HTMLDivElement>(null);

  const getPicksKey = useCallback(
    (pageIndex: number, previousPageData: any) => {
      if (!hasAccess) return null;
      if (previousPageData && previousPageData.signals?.length < PAGE_SIZE) return null;

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageIndex * PAGE_SIZE),
        sort: prefs.signal_sort_by || "score",
        resolved: prefs.signal_show_resolved ? "all" : "false",
      });
      if (selectedSport) params.set("sport", selectedSport);
      if (selectedTier) params.set("tier", selectedTier);
      if (minScore > 0) params.set("minScore", String(minScore));
      if (showMySharps && followedWallets.length > 0) {
        params.set("wallet", followedWallets.join(","));
      }
      // Date range filter
      const dateRange = prefs.signal_date_range;
      if (dateRange && dateRange !== "all") params.set("dateRange", dateRange);
      // Odds range filter
      if (prefs.signal_min_odds != null) params.set("minOdds", String(prefs.signal_min_odds));
      if (prefs.signal_max_odds != null) params.set("maxOdds", String(prefs.signal_max_odds));
      // Min stake filter
      if (prefs.signal_min_stake && prefs.signal_min_stake > 0) params.set("minStake", String(prefs.signal_min_stake));
      // Market type filter
      if (prefs.signal_market_types && prefs.signal_market_types.length > 0) params.set("marketTypes", prefs.signal_market_types.join(","));
      // Hide delay (hours after game start to keep showing picks)
      if (prefs.signal_hide_delay && prefs.signal_hide_delay > 0) params.set("hideDelay", String(prefs.signal_hide_delay));
      return `/api/polymarket/feed?${params}`;
    },
    [hasAccess, prefs.signal_sort_by, prefs.signal_show_resolved, selectedSport, selectedTier, minScore, showMySharps, followedWallets, prefs.signal_date_range, prefs.signal_min_odds, prefs.signal_max_odds, prefs.signal_min_stake, prefs.signal_market_types, prefs.signal_hide_delay]
  );

  const {
    data: picksPages,
    error: picksError,
    size: picksSize,
    setSize: setPicksSize,
    isLoading: picksLoading,
    isValidating: picksValidating,
  } = useSWRInfinite(getPicksKey, fetcher, {
    refreshInterval: 30000,
    revalidateFirstPage: true,
    revalidateOnFocus: true,
    parallel: false,
  });

  const allPicksRaw = picksPages?.flatMap((p) => p.signals || []) ?? [];


  const picksTotal = picksPages?.[0]?.total ?? 0;
  const picksHasMore = picksPages ? picksPages[picksPages.length - 1]?.signals?.length >= PAGE_SIZE : false;
  const picksLoadingMore = picksSize > 1 && picksPages && typeof picksPages[picksSize - 1] === "undefined";
  const picksData = { signals: allPicksRaw, total: picksTotal };

  // IntersectionObserver → trigger next page load
  useEffect(() => {
    if (!sentinelRef.current || tab !== "picks") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && picksHasMore && !picksValidating) {
          setPicksSize((s) => s + 1);
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [picksHasMore, picksValidating, setPicksSize, tab]);

  // Fetch markets/games data
  const { data: marketsData, error: marketsError, isLoading: marketsLoading } = useSWR(
    hasAccess ? `/api/polymarket/games?limit=100&resolved=false${selectedSport ? `&sport=${selectedSport}` : ""}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Follow/unfollow with toast
  const handleToggleFollow = useCallback((walletAddress: string) => {
    const wasFollowing = followedWallets.includes(walletAddress)
    toggleFollowWallet(walletAddress)

    if (!wasFollowing) {
      const anonId = `#${walletAddress.slice(0, 4).toUpperCase()}`
      toast.success(`Following ${anonId}`, {
        description: "Their picks will be highlighted in your feed.",
      })
    }
  }, [followedWallets, toggleFollowWallet])

  if (isLoading) {
    return (
      <AppPageLayout title="Sharp Intel" subtitle="Real-time insider tracking from prediction markets">
        <div className="flex h-full gap-4">
          <div className="flex-1 min-w-0 space-y-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-lg border border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50/50 dark:bg-neutral-800/40 p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-3 w-8 bg-neutral-200 dark:bg-neutral-800/50 rounded" />
                  <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800/50 rounded" />
                </div>
                <div className="h-3.5 w-3/4 bg-neutral-200 dark:bg-neutral-800/40 rounded mb-2" />
                <div className="h-3 w-1/2 bg-neutral-100 dark:bg-neutral-800/30 rounded" />
              </div>
            ))}
          </div>
          <div className="hidden md:block w-2/5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-4 space-y-4">
            <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800/30 rounded animate-pulse" />
            <div className="h-20 bg-neutral-100 dark:bg-neutral-800/20 rounded-xl animate-pulse" />
            <div className="h-32 bg-neutral-100 dark:bg-neutral-800/15 rounded-xl animate-pulse" />
          </div>
        </div>
      </AppPageLayout>
    );
  }

  if (!hasAccess) {
    return (
      <AppPageLayout
        title="Sharp Intel"
        subtitle="Real-time insider tracking from prediction markets"
        headerActions={
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">Live</span>
          </div>
        }
      >
        <div className="relative">
          {/* Blurred fake UI — gives users a preview of what they're missing */}
          <div className="select-none pointer-events-none" aria-hidden="true">
            {/* Stats bar */}
            <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 px-4 py-3 mb-4 blur-[6px] opacity-50">
              <div className="flex items-center gap-4">
                <span className="font-mono text-xl font-bold text-neutral-900 dark:text-neutral-100">+13.5%</span>
                <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
                <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">378-213 (64%)</span>
                <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
                <span className="text-[11px] text-neutral-500">NBA <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+22.5%</span></span>
              </div>
            </div>

            {/* Tab bar */}
            <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden mb-4 blur-[6px] opacity-50">
              <div className="flex border-b border-neutral-200/60 dark:border-neutral-700/30 px-4">
                {["Picks", "Markets", "Leaderboard"].map((t, i) => (
                  <span key={t} className={cn("px-3 py-2 text-xs font-medium border-b-2 -mb-px", i === 0 ? "border-sky-500 text-neutral-900 dark:text-neutral-200" : "border-transparent text-neutral-400 dark:text-neutral-500")}>
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1 px-4 py-2">
                {["All", "NBA", "NHL", "NCAAB", "MLB"].map((s, i) => (
                  <span key={s} className={cn("px-2 py-1 rounded-md text-[11px] font-medium", i === 0 ? "bg-neutral-100 dark:bg-neutral-800/60 text-neutral-900 dark:text-neutral-100" : "text-neutral-500")}>
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Fake pick cards */}
            <div className="flex gap-4">
              <div className="flex-1 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-3 space-y-2 blur-[6px] opacity-40">
                {[
                  { score: "99", team: "Flyers vs. Kings", pick: "Kings", odds: "-163", amount: "$68.0k", mul: "15.9x" },
                  { score: "97", team: "Saint Louis vs. Georgia", pick: "Georgia Bull...", odds: "+108", amount: "$19.8k", mul: "5.9x" },
                  { score: "94", team: "Iowa vs. Clemson Tigers", pick: "Clemson Tigers", odds: "+122", amount: "$200.6k", mul: "8.6x" },
                  { score: "92", team: "76ers vs. Kings", pick: "76ers", odds: "-133", amount: "$92.6k", mul: "9.4x" },
                ].map((card) => (
                  <div key={card.team} className="rounded-lg border border-neutral-200/60 dark:border-neutral-700/30 bg-neutral-50 dark:bg-neutral-800/40 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">{card.score}</span>
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-1.5 py-px rounded">Sharp</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">{card.team}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">Moneyline · {card.amount} · <span className="text-emerald-600 dark:text-emerald-400 font-bold">{card.mul}</span></p>
                      </div>
                      <div className="w-[120px] text-center bg-sky-50 dark:bg-sky-500/[0.06] border border-sky-200/60 dark:border-sky-500/15 rounded-lg px-3 py-2">
                        <p className="text-[11px] font-semibold text-neutral-900 dark:text-neutral-100 truncate">{card.pick}</p>
                        <p className="font-mono text-lg font-bold text-sky-600 dark:text-sky-400">{card.odds}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Fake detail panel — desktop only */}
              <div className="hidden md:block w-2/5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-4 blur-[6px] opacity-40">
                <div className="space-y-3">
                  <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-1.5 py-px rounded">Sharp</span>
                      <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-200">#0X37</span>
                      <span className="font-mono text-[11px] text-neutral-500">249-114</span>
                    </div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">Flyers vs. Kings</p>
                  </div>
                  <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Signal</p>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">Kings</span>
                      <span className="font-mono text-2xl font-bold text-sky-600 dark:text-sky-400">-163</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3 h-32" />
                  <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/30 p-3">
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Where to bet</p>
                    <div className="space-y-2">
                      {["Polymarket", "BetMGM", "FanDuel"].map((b) => (
                        <div key={b} className="flex justify-between text-xs">
                          <span className="text-neutral-700 dark:text-neutral-300">{b}</span>
                          <span className="font-mono font-bold text-neutral-900 dark:text-neutral-200">-163</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating upgrade card — centered over the blurred UI */}
          <div className="absolute inset-0 flex items-start justify-center pt-24 sm:pt-32">
            <div className="w-full max-w-md mx-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 shadow-2xl overflow-hidden">
              {/* Header with gradient */}
              <div className="bg-gradient-to-r from-sky-500/10 to-emerald-500/10 border-b border-neutral-200/50 dark:border-neutral-700/30 px-6 pt-6 pb-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20">
                    <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                      Unlock Sharp Intel
                    </h2>
                    <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                      Elite tier exclusive
                    </p>
                  </div>
                </div>
                {/* Stats */}
                <div className="flex items-center gap-4 mt-3">
                  <div className="text-center">
                    <p className="font-mono text-lg font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">65%</p>
                    <p className="text-[9px] text-neutral-500 uppercase tracking-wider">Win Rate</p>
                  </div>
                  <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700/30" />
                  <div className="text-center">
                    <p className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+14%</p>
                    <p className="text-[9px] text-neutral-500 uppercase tracking-wider">ROI</p>
                  </div>
                  <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-700/30" />
                  <div className="text-center">
                    <p className="font-mono text-lg font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">80+</p>
                    <p className="text-[9px] text-neutral-500 uppercase tracking-wider">Insiders</p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="px-6 py-5 space-y-3">
                {[
                  "Real-time insider detection from 80+ tracked wallets",
                  "Every signal scored 0-100 based on history and conviction",
                  "Best odds from 15+ legal US sportsbooks with deep links",
                  "Follow sharps, build a personalized feed, track their ROI",
                ].map((text) => (
                  <div key={text} className="flex gap-2.5 items-start">
                    <svg className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-[13px] text-neutral-600 dark:text-neutral-300 leading-snug">{text}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="px-6 pb-6">
                <Link
                  href="/pricing"
                  className="flex items-center justify-center w-full px-6 py-3 bg-sky-600 hover:bg-sky-500 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm gap-2"
                >
                  Upgrade to Elite — $70/mo
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <p className="text-[11px] text-neutral-500 text-center mt-2.5">
                  7-day free trial. Cancel anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      </AppPageLayout>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "scored", label: "Picks" },
    { key: "picks", label: "Feed" },
    { key: "markets", label: "Markets" },
    { key: "leaderboard", label: "Leaderboard" },
  ];

  const excludedSports = prefs.signal_excluded_sports || [];

  // Apply excluded sports filter + slippage filter client-side
  // Note: past-game filtering is handled by the API (resolved=false + 30min buffer)
  const maxSlippage = prefs.signal_max_slippage || 0;
  const allPicks = (picksData?.signals || []).filter((p: WhaleSignal) => {
    // Excluded sports
    if (p.sport && excludedSports.includes(p.sport)) return false;
    // Slippage filter: compare Polymarket entry vs sportsbook implied probability
    if (maxSlippage > 0 && p.best_book_decimal && p.best_book_decimal > 1 && p.entry_price > 0) {
      const bookImplied = 1 / p.best_book_decimal; // decimal odds → implied probability
      const slip = Math.abs(p.entry_price - bookImplied) / bookImplied * 100;
      if (slip > maxSlippage) return false;
    }
    return true;
  });
  const allMarkets = (marketsData?.games || []).filter(
    (m: GameData) => !m.sport || !excludedSports.includes(m.sport)
  );

  // Hide key based on event + market type + selection label
  // Uses event_title (game) + market_type + the displayed selection so:
  // - All "Illinois Fighting Illini ML" picks share one key
  // - "Houston Cougars ML" (other side) gets a separate key
  // - Different condition_ids for the same outcome still match
  const getSignalKey = (p: WhaleSignal) => {
    const event = p.event_title || p.market_title || "";
    const mkt = p.market_type || "";
    const outcome = p.outcome || "";
    return `signal:${event}:${mkt}:${outcome}`;
  };

  // Filter hidden picks (unless showHidden is on)
  const visiblePicks = showHidden
    ? allPicks
    : allPicks.filter((p: WhaleSignal) => !isHidden(getSignalKey(p)));

  const picks = selectedTier
    ? visiblePicks.filter((p: WhaleSignal) => p.tier === selectedTier)
    : visiblePicks;
  const markets = selectedTier
    ? allMarkets.filter((m: GameData) =>
        m.outcomes?.some((o: any) => o.bets?.some((b: any) => b.tier === selectedTier))
      )
    : allMarkets;


  // Derive available sports from loaded data — accumulate across filter changes so pills never disappear
  const currentSports = [
    ...allPicks.map((p: WhaleSignal) => p.sport).filter(Boolean),
    ...allMarkets.map((m: GameData) => m.sport).filter(Boolean),
  ];
  currentSports.forEach((s) => seenSportsRef.current.add(s));
  const availableSports = [...seenSportsRef.current] as string[]

  // Auto-select first item when data loads or tab changes
  if (tab === "picks" && picks.length > 0 && !selectedPick) {
    // Prefer a pick from a sport with sportsbook odds (skip soccer, tennis, ufc, esports)
    const withOdds = picks.find((p: WhaleSignal) => hasOddsForSport(p.sport));
    setSelectedPick(withOdds || picks[0]);
  }
  if (tab === "markets" && markets.length > 0 && !selectedMarket) {
    setSelectedMarket(markets[0]);
  }

  // Detect split markets — games where insiders are on opposing sides

  // Convert markets data to MarketCard format
  const convertToMarketCard = (game: GameData) => {
    const mainOutcome = game.outcomes[0]
    const secondOutcome = game.outcomes[1]
    if (!mainOutcome || !secondOutcome) return null

    // Compute sharp vs insider dollar breakdown + unique wallet counts per side
    const computeSideStats = (bets: typeof mainOutcome.bets) => {
      let sharpDollars = 0, insiderDollars = 0, otherDollars = 0
      const wallets = new Set<string>()
      const sharps = new Set<string>()
      const insiders = new Set<string>()
      for (const b of bets) {
        const id = (b as any).wallet_address || b.anon_id
        wallets.add(id)
        if (b.tier === "sharp") { sharpDollars += b.bet_size; sharps.add(id) }
        else if (b.tier === "whale") { insiderDollars += b.bet_size; insiders.add(id) }
        else otherDollars += b.bet_size
      }
      const total = sharpDollars + insiderDollars + otherDollars
      return {
        sharpPct: total > 0 ? Math.round((sharpDollars / total) * 100) : 0,
        insiderPct: total > 0 ? Math.round((insiderDollars / total) * 100) : 0,
        uniqueWallets: wallets.size,
        uniqueSharps: sharps.size,
        uniqueInsiders: insiders.size,
      }
    }

    return {
      id: game.condition_id,
      sport: game.sport || "N/A",
      league: "",
      matchup: game.market_title,
      betType: game.market_type || "Unknown",
      time: game.game_start_time || "TBD",
      gameStartTime: game.game_start_time,
      sideA: {
        name: mainOutcome.outcome,
        price: mainOutcome.avg_entry_price * 100,
        insiderCount: mainOutcome.total_bets,
        totalWagered: mainOutcome.total_dollars,
        percentOfMoney: game.flow_pct,
        ...computeSideStats(mainOutcome.bets),
      },
      sideB: {
        name: secondOutcome.outcome,
        price: secondOutcome.avg_entry_price * 100,
        insiderCount: secondOutcome.total_bets,
        totalWagered: secondOutcome.total_dollars,
        percentOfMoney: 100 - game.flow_pct,
        ...computeSideStats(secondOutcome.bets),
      },
      totalVolume: game.total_dollars,
      wagerCount: game.total_bets,
      lastSignalAt: game.last_signal_at,
    }
  }

  const marketCardsUnsorted = markets.map(convertToMarketCard).filter(Boolean) as NonNullable<ReturnType<typeof convertToMarketCard>>[]

  // Derive flowMode from marketSort for display (liquidity/bettors/conviction are both sort + display)
  const flowMode: "liquidity" | "bettors" | "conviction" =
    marketSort === "bettors" ? "bettors" : marketSort === "conviction" ? "conviction" : "liquidity"

  // Sort markets based on marketSort
  const marketCards = [...marketCardsUnsorted].sort((a, b) => {
    if (marketSort === "bettors") {
      const aBettors = (a.sideA.uniqueWallets ?? 0) + (a.sideB.uniqueWallets ?? 0)
      const bBettors = (b.sideA.uniqueWallets ?? 0) + (b.sideB.uniqueWallets ?? 0)
      return bBettors - aBettors
    }
    if (marketSort === "conviction") {
      const avgBetA = a.wagerCount > 0 ? a.totalVolume / a.wagerCount : 0
      const avgBetB = b.wagerCount > 0 ? b.totalVolume / b.wagerCount : 0
      const aConv = Math.max(
        (a.sideA.uniqueWallets ?? 1) > 0 ? (a.sideA.totalWagered / (a.sideA.uniqueWallets ?? 1)) / (avgBetA || 1) : 0,
        (a.sideB.uniqueWallets ?? 1) > 0 ? (a.sideB.totalWagered / (a.sideB.uniqueWallets ?? 1)) / (avgBetA || 1) : 0
      )
      const bConv = Math.max(
        (b.sideA.uniqueWallets ?? 1) > 0 ? (b.sideA.totalWagered / (b.sideA.uniqueWallets ?? 1)) / (avgBetB || 1) : 0,
        (b.sideB.uniqueWallets ?? 1) > 0 ? (b.sideB.totalWagered / (b.sideB.uniqueWallets ?? 1)) / (avgBetB || 1) : 0
      )
      return bConv - aConv
    }
    if (marketSort === "recent") {
      // Sort by most recent signal placed (not game start time)
      const aTime = a.lastSignalAt ? new Date(a.lastSignalAt).getTime() : 0
      const bTime = b.lastSignalAt ? new Date(b.lastSignalAt).getTime() : 0
      return bTime - aTime
    }
    // Default (liquidity): sort by total volume
    return b.totalVolume - a.totalVolume
  })
  const showFilters = tab === "markets" // feed tab has its own filters; scored tab has its own filters

  return (
    <AppPageLayout
      title="Sharp Intel"
      subtitle="Real-time insider tracking from prediction markets"
      headerActions={
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs text-emerald-500 dark:text-emerald-400 font-medium">Live</span>
        </div>
      }
      statsBar={
        <div data-tour="stats-bar" className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 px-4 py-3">
          <StatsDashboard />
        </div>
      }
      contextBar={
        <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
          {/* Row 1: Tabs + Controls (odds toggle, settings) */}
          <div className="flex items-center justify-between border-b border-neutral-200/60 dark:border-neutral-700/30 px-4">
            <div data-tour="tabs" className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  data-tour-tab={t.key}
                  onClick={() => {
                    setTab(t.key);
                    leftPanelRef.current?.scrollTo({ top: 0 });
                    if (t.key === "scored") {
                      setSelectedPick(null);
                      setSelectedMarket(null);
                      setSelectedWallet(null);
                    } else if (t.key === "picks") {
                      setSelectedMarket(null);
                      setSelectedWallet(null);
                      if (picks.length > 0) setSelectedPick(picks[0]);
                    } else if (t.key === "markets") {
                      setSelectedPick(null);
                      setSelectedWallet(null);
                      if (markets.length > 0) setSelectedMarket(markets[0]);
                    } else {
                      setSelectedPick(null);
                      setSelectedMarket(null);
                    }
                  }}
                  className={cn(
                    "px-3 py-2 text-xs font-medium transition-all duration-150 border-b-2 -mb-px",
                    tab === t.key
                      ? "border-sky-500 text-neutral-900 dark:text-neutral-200"
                      : "border-transparent text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Right side: odds toggle + settings — desktop */}
            <div className="hidden sm:flex items-center gap-2 py-1">
              <div className="flex gap-0.5 bg-neutral-100 dark:bg-neutral-900/60 rounded-md p-0.5 border border-neutral-200 dark:border-neutral-800/30">
                <button
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-medium rounded transition-all duration-150",
                    oddsFormat === "american"
                      ? "bg-white shadow-sm text-neutral-900 dark:bg-neutral-800/80 dark:text-neutral-200"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                  onClick={() => setOddsFormat("american")}
                >
                  American
                </button>
                <button
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-medium rounded transition-all duration-150",
                    oddsFormat === "cents"
                      ? "bg-white shadow-sm text-neutral-900 dark:bg-neutral-800/80 dark:text-neutral-200"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                  onClick={() => setOddsFormat("cents")}
                >
                  Implied %
                </button>
              </div>
              {tab === "scored" ? (
                <SortDropdown value={prefs.signal_sort_by || "score"} onChange={(v) => updatePrefs({ signal_sort_by: v })} options={PICKS_SORTS} />
              ) : null}
              <TourTrigger />
              <SettingsSheet prefs={prefs} onUpdate={updatePrefs} />
            </div>

            {/* Right side: odds toggle only — mobile */}
            <div className="flex sm:hidden items-center py-1">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/30 rounded-md px-2 py-1 text-neutral-700 dark:text-neutral-300 text-[11px] font-medium outline-none">
                  {oddsFormat === "american" ? "US" : "%"}
                  <svg className="h-3 w-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[120px]">
                  <DropdownMenuRadioGroup value={oddsFormat} onValueChange={(v) => setOddsFormat(v as OddsFormat)}>
                    <DropdownMenuRadioItem value="american" className="text-xs">American</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="cents" className="text-xs">Implied %</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Row 2: Filters + sort/settings — only on Picks/Markets tabs */}
          {showFilters && (
            <div className="flex items-center border-t border-neutral-200/60 dark:border-neutral-700/30">
              <div className="flex-1 min-w-0">
                <Filters
                  selectedSport={selectedSport}
                  onSportChange={setSelectedSport}
                  selectedTier={selectedTier}
                  onTierChange={setSelectedTier}
                  availableSports={availableSports}
                  showMySharps={showMySharps}
                  onToggleMySharps={undefined}
                  followedCount={followedWallets.length}
                  followedWallets={followedWallets}
                  onUnfollow={handleToggleFollow}
                />
              </div>
              {/* Sort + settings — mobile */}
              <div className="flex sm:hidden items-center gap-1.5 pr-3 shrink-0">
                {tab !== "markets" && (
                  <SortDropdown value={prefs.signal_sort_by || "score"} onChange={(v) => updatePrefs({ signal_sort_by: v })} options={PICKS_SORTS} />
                )}
                <SettingsSheet prefs={prefs} onUpdate={updatePrefs} />
              </div>
            </div>
          )}


        </div>
      }
    >
      <div className="flex gap-2 sm:gap-4 h-[calc(100vh-4rem)] -mb-5">
        {/* Left Panel — independent scroll */}
        <div ref={leftPanelRef} className="flex-1 min-w-0 overflow-y-auto sm:rounded-xl bg-white dark:bg-neutral-900 sm:border border-neutral-200/60 dark:border-neutral-800/60 p-2 sm:p-3 space-y-3 sm:space-y-2">
          {/* Feed Tab — real-time sharp wallet activity stream */}
          {tab === "picks" && (
            <FeedTab
              followedWallets={followedWallets}
              onToggleFollow={handleToggleFollow}
              onSelectWallet={(addr) => setModalWalletAddress(addr)}
            />
          )}

          {/* Markets Tab — Sharp money heat map, grouped by game */}
          {tab === "markets" && (
            <MarketHeatmap
              selectedSport={selectedSport}
              excludedSports={excludedSports}
            />
          )}

          {/* Scored Picks Tab (v2) */}
          {tab === "scored" && (
            <PicksScoreboard
              onSelectPlay={(play) => {
                setSelectedScoredPlay(play);
                if (window.innerWidth < 768) setMobileDetailOpen(true);
              }}
              selectedPlayId={selectedScoredPlay?.id ?? null}
            />
          )}

          {/* Leaderboard Tab */}
          {tab === "leaderboard" && (
            <div data-tour="leaderboard-list">
              <Leaderboard
                selectedWallet={selectedWallet}
                onSelectWallet={(w) => { setSelectedWallet(w); if (window.innerWidth < 768) setMobileDetailOpen(true); }}
                followedWallets={followedWallets}
                onToggleFollow={handleToggleFollow}
              />
            </div>
          )}
        </div>

        {/* Right Panel — independent scroll */}
        <div className="hidden md:block w-2/5 overflow-y-auto rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 p-4">
          {tab === "picks" && selectedPick && (
            <PickDetailPanel
              pick={selectedPick}
              oddsFormat={oddsFormat}
              isSplitMarket={selectedPick.is_split_market === true}
              onViewMarket={selectedPick.is_split_market === true ? () => {
                setModalMarketId((selectedPick as any).condition_id || selectedPick.market_title);
              } : undefined}
              onViewInsider={(addr) => {
                setModalWalletAddress(addr);
              }}
            />
          )}

          {tab === "scored" && selectedScoredPlay && (
            <ScoredPlayDetail play={selectedScoredPlay} />
          )}

          {tab === "markets" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Heat Map Guide</h3>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Games are ranked by sharp activity. Click any game to expand and see individual plays scored by our model.
                </p>
              </div>
              <div className="space-y-2">
                {[
                  { label: "HOT", color: "bg-red-500", desc: "Max score 85+ — strong consensus" },
                  { label: "ACTIVE", color: "bg-orange-500", desc: "Score 70–84 — multiple signals" },
                  { label: "WARM", color: "bg-amber-500", desc: "Score 55–69 — early positioning" },
                  { label: "WATCH", color: "bg-neutral-400 dark:bg-neutral-600", desc: "Score below 55 — monitoring" },
                ].map(({ label, color, desc }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <div className={cn("w-1 h-10 rounded-full shrink-0 mt-0.5", color)} />
                    <div>
                      <span className="text-[11px] font-black text-neutral-900 dark:text-neutral-200 block">{label}</span>
                      <span className="text-[10px] text-neutral-500">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/40">
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2">Score labels</p>
                <div className="space-y-1.5">
                  {[
                    { label: "NUCLEAR", range: "90+", color: "bg-red-500" },
                    { label: "STRONG", range: "75–89", color: "bg-orange-500" },
                    { label: "LEAN", range: "60–74", color: "bg-amber-500" },
                    { label: "WATCH", range: "45–59", color: "bg-neutral-500" },
                  ].map(({ label, range, color }) => (
                    <div key={label} className="flex items-center gap-2 text-[11px]">
                      <div className={cn("w-5 h-5 rounded flex items-center justify-center text-[9px] font-black text-white shrink-0", color)}>
                        {range.split("–")[0]}
                      </div>
                      <span className="font-bold text-neutral-700 dark:text-neutral-300">{label}</span>
                      <span className="text-neutral-400 ml-auto font-mono">{range}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "leaderboard" && selectedWallet && (
            <WalletDetailPanel
              wallet={selectedWallet}
              oddsFormat={oddsFormat}
              isFollowing={followedWallets.includes(selectedWallet.wallet_address)}
              onToggleFollow={handleToggleFollow}
            />
          )}

          {/* Empty state */}
          {((tab === "scored" && !selectedScoredPlay) ||
            (tab === "picks" && !selectedPick) ||
            (tab === "leaderboard" && !selectedWallet)) && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm text-neutral-600">
                Select a {tab === "scored" ? "play" : tab === "picks" ? "pick" : "wallet"} to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Detail Sheet */}
      <div className="md:hidden">
        <DetailSheet
          open={mobileDetailOpen}
          onClose={() => setMobileDetailOpen(false)}
          title={
            tab === "scored" && selectedScoredPlay
              ? selectedScoredPlay.market_title
              : tab === "picks" && selectedPick
              ? selectedPick.event_title || selectedPick.market_title
              : tab === "leaderboard" && selectedWallet
                ? `#${selectedWallet.wallet_address.slice(0, 4).toUpperCase()}`
                : undefined
          }
        >
          {tab === "scored" && selectedScoredPlay && (
            <ScoredPlayDetail play={selectedScoredPlay} />
          )}
          {tab === "picks" && selectedPick && (
            <PickDetailPanel
              pick={selectedPick}
              oddsFormat={oddsFormat}
              isSplitMarket={selectedPick.is_split_market === true}
              onViewMarket={selectedPick.is_split_market === true ? () => {
                setModalMarketId((selectedPick as any).condition_id || selectedPick.market_title);
              } : undefined}
              onViewInsider={(addr) => {
                setModalWalletAddress(addr);
              }}
            />
          )}
          {tab === "leaderboard" && selectedWallet && (
            <WalletDetailPanel
              wallet={selectedWallet}
              oddsFormat={oddsFormat}
              isFollowing={followedWallets.includes(selectedWallet.wallet_address)}
              onToggleFollow={handleToggleFollow}
            />
          )}
        </DetailSheet>
      </div>
      {/* Wallet Quick-View Modal */}
      <Dialog open={!!modalWalletAddress} onOpenChange={(open) => !open && setModalWalletAddress(null)}>
        <DialogContent className="max-w-2xl w-[90vw] max-h-[85vh] overflow-y-auto bg-white dark:bg-neutral-900 border-neutral-200/60 dark:border-neutral-800/60 p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
              Insider profile
            </DialogTitle>
          </DialogHeader>
          {modalWalletAddress && (
            <WalletModalContent
              walletAddress={modalWalletAddress}
              oddsFormat={oddsFormat}
              isFollowing={followedWallets.includes(modalWalletAddress)}
              onToggleFollow={handleToggleFollow}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Market Quick-View Modal */}
      <Dialog open={!!modalMarketId} onOpenChange={(open) => !open && setModalMarketId(null)}>
        <DialogContent className="max-w-3xl w-[90vw] max-h-[85vh] overflow-y-auto bg-white dark:bg-neutral-900 border-neutral-200/60 dark:border-neutral-800/60 p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
              Market breakdown
            </DialogTitle>
          </DialogHeader>
          {modalMarketId && (
            <MarketModalContent marketId={modalMarketId} oddsFormat={oddsFormat} onViewInsider={(addr) => { setModalMarketId(null); setModalWalletAddress(addr); }} />
          )}
        </DialogContent>
      </Dialog>

      {/* Onboarding tour — auto-shows on first visit */}
      <OnboardingTour />
    </AppPageLayout>
  );
}
