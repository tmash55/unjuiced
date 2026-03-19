"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import useSWRInfinite from "swr/infinite";
import { AppPageLayout } from "@/components/layout/app-page-layout";
import { useHasEliteAccess } from "@/hooks/use-entitlements";
import { useSignalPreferences } from "@/hooks/use-signal-preferences";
import { StatsDashboard } from "@/components/sharp-signals/stats-dashboard";
import { Filters } from "@/components/sharp-signals/filters";
import { PickCard } from "@/components/sharp-signals/pick-card";
import { PickDetailPanel } from "@/components/sharp-signals/pick-detail-panel";
import { MarketCard } from "@/components/sharp-signals/market-card";
import { MarketDetailPanel } from "@/components/sharp-signals/market-detail-panel";
import { Leaderboard } from "@/components/sharp-signals/leaderboard";
import { WalletDetailPanel } from "@/components/sharp-signals/wallet-detail-panel";
import { SettingsSheet } from "@/components/sharp-signals/settings-sheet";
import { DetailSheet } from "@/components/sharp-signals/detail-sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { OddsFormat } from "@/lib/odds";
import { WhaleSignal, WalletScore } from "@/lib/polymarket/types";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";

type Tab = "picks" | "markets" | "leaderboard";

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
function MarketModalContent({ marketId, oddsFormat }: { marketId: string; oddsFormat: OddsFormat }) {
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

  return <MarketDetailPanel game={game} oddsFormat={oddsFormat} />
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
  const [tab, setTab] = useState<Tab>("picks");
  const [selectedSport, setSelectedSport] = useState("");
  const [selectedTier, setSelectedTier] = useState("");
  const minScore = prefs.sharp_signals_min_score || 0;
  const [selectedPick, setSelectedPick] = useState<WhaleSignal | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<GameData | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<WalletScore | null>(null);
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>("american");
  const [showMySharps, setShowMySharps] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const leftPanelRef = useRef<HTMLDivElement>(null);

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
      return `/api/polymarket/feed?${params}`;
    },
    [hasAccess, prefs.signal_sort_by, prefs.signal_show_resolved, selectedSport, selectedTier, minScore, showMySharps, followedWallets]
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
    hasAccess ? `/api/polymarket/games?limit=20&resolved=false${selectedSport ? `&sport=${selectedSport}` : ""}` : null,
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
      <AppPageLayout title="Sharp Signals" subtitle="Real-time insider tracking from prediction markets">
        <div className="flex h-full gap-6">
          <div className="flex-1 min-w-0 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-lg border border-neutral-200/80 dark:border-neutral-800/40 bg-white dark:bg-transparent p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-3 w-8 bg-neutral-200 dark:bg-neutral-800/50 rounded" />
                  <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800/50 rounded" />
                </div>
                <div className="h-3.5 w-3/4 bg-neutral-200 dark:bg-neutral-800/40 rounded mb-2" />
                <div className="h-3 w-1/2 bg-neutral-100 dark:bg-neutral-800/30 rounded" />
              </div>
            ))}
          </div>
          <div className="hidden md:block w-2/5 border-l border-neutral-200 dark:border-neutral-800/40 pl-6 space-y-4">
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
      <AppPageLayout title="Sharp Signals" subtitle="Real-time insider tracking from prediction markets">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-800/40 border border-neutral-700/30 mb-5">
            <svg className="h-7 w-7 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-200 mb-2">Elite feature</h2>
          <p className="text-neutral-500 mb-6 max-w-md text-sm leading-relaxed">
            Sharp Signals gives you real-time tracking of prediction market insiders.
            Upgrade to Elite to unlock this feature.
          </p>
          <Link
            href="/pricing"
            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 active:scale-[0.98] text-white font-semibold rounded-lg transition-all"
          >
            Upgrade to Elite
          </Link>
        </div>
      </AppPageLayout>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "picks", label: "Picks" },
    { key: "markets", label: "Markets" },
    { key: "leaderboard", label: "Leaderboard" },
  ];

  const excludedSports = prefs.signal_excluded_sports || [];

  // Apply excluded sports filter client-side
  // Note: past-game filtering is handled by the API (resolved=false + 30min buffer)
  const allPicks = (picksData?.signals || []).filter(
    (p: WhaleSignal) => !p.sport || !excludedSports.includes(p.sport)
  );
  const allMarkets = (marketsData?.games || []).filter(
    (m: GameData) => !m.sport || !excludedSports.includes(m.sport)
  );

  const picks = selectedTier
    ? allPicks.filter((p: WhaleSignal) => p.tier === selectedTier)
    : allPicks;
  const markets = selectedTier
    ? allMarkets.filter((m: GameData) =>
        m.outcomes?.some((o: any) => o.bets?.some((b: any) => b.tier === selectedTier))
      )
    : allMarkets;

  // Derive available sports from loaded data
  const availableSports = [...new Set([
    ...allPicks.map((p: WhaleSignal) => p.sport).filter(Boolean),
    ...allMarkets.map((m: GameData) => m.sport).filter(Boolean),
  ])] as string[]

  // Auto-select first item when data loads or tab changes
  if (tab === "picks" && picks.length > 0 && !selectedPick) {
    setSelectedPick(picks[0]);
  }
  if (tab === "markets" && markets.length > 0 && !selectedMarket) {
    setSelectedMarket(markets[0]);
  }

  // Detect split markets — games where insiders are on opposing sides
  const splitMarketIds = new Set<string>()
  const marketOutcomes = new Map<string, Set<string>>()
  for (const p of picks) {
    const key = p.market_title || ""
    if (!key) continue
    if (!marketOutcomes.has(key)) marketOutcomes.set(key, new Set())
    marketOutcomes.get(key)!.add(p.outcome)
  }
  for (const [key, outcomes] of marketOutcomes) {
    if (outcomes.size > 1) splitMarketIds.add(key)
  }

  // Convert markets data to MarketCard format
  const convertToMarketCard = (game: GameData) => {
    const mainOutcome = game.outcomes[0]
    const secondOutcome = game.outcomes[1]
    if (!mainOutcome || !secondOutcome) return null

    // Compute sharp vs insider dollar breakdown per side
    const computeTierSplit = (bets: typeof mainOutcome.bets) => {
      let sharpDollars = 0, insiderDollars = 0, otherDollars = 0
      for (const b of bets) {
        if (b.tier === "sharp") sharpDollars += b.bet_size
        else if (b.tier === "whale") insiderDollars += b.bet_size
        else otherDollars += b.bet_size
      }
      const total = sharpDollars + insiderDollars + otherDollars
      return {
        sharpPct: total > 0 ? Math.round((sharpDollars / total) * 100) : 0,
        insiderPct: total > 0 ? Math.round((insiderDollars / total) * 100) : 0,
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
        ...computeTierSplit(mainOutcome.bets),
      },
      sideB: {
        name: secondOutcome.outcome,
        price: secondOutcome.avg_entry_price * 100,
        insiderCount: secondOutcome.total_bets,
        totalWagered: secondOutcome.total_dollars,
        percentOfMoney: 100 - game.flow_pct,
        ...computeTierSplit(secondOutcome.bets),
      },
      totalVolume: game.total_dollars,
      wagerCount: game.total_bets
    }
  }

  const marketCards = markets.map(convertToMarketCard).filter(Boolean)
  const showFilters = tab === "picks" || tab === "markets"

  return (
    <AppPageLayout
      title="Sharp Signals"
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
      statsBar={<StatsDashboard />}
      contextBar={
        <div className="space-y-0">
          {/* Row 1: Tabs + Controls (odds toggle, settings) */}
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800/40 px-4">
            <div className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
                    leftPanelRef.current?.scrollTo({ top: 0 });
                    if (t.key === "picks") {
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

            {/* Right side: odds toggle + settings */}
            <div className="flex items-center gap-2 py-1">
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
              <SettingsSheet prefs={prefs} onUpdate={updatePrefs} />
            </div>
          </div>

          {/* Row 2: Filters — only on Picks/Markets tabs */}
          {showFilters && (
            <Filters
              selectedSport={selectedSport}
              onSportChange={setSelectedSport}
              selectedTier={selectedTier}
              onTierChange={setSelectedTier}
              availableSports={availableSports}
            />
          )}

          {/* My Sharps filter — only when user has followed wallets */}
          {tab === "picks" && followedWallets.length > 0 && (
            <div className="px-4 pb-1.5">
              <button
                onClick={() => setShowMySharps(!showMySharps)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                  showMySharps
                    ? "bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/25"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 border border-neutral-200 dark:border-neutral-800/40"
                )}
              >
                My Sharps ({followedWallets.length})
              </button>
            </div>
          )}
        </div>
      }
    >
      <div className="flex gap-6 h-[calc(100vh-4rem)] -mb-5">
        {/* Left Panel — independent scroll */}
        <div ref={leftPanelRef} className="flex-1 min-w-0 space-y-2 overflow-y-auto pr-1">
          {/* Picks Tab */}
          {tab === "picks" && (
            <>
              {picksLoading && (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="rounded-lg border border-neutral-200/80 dark:border-neutral-800/40 bg-white dark:bg-transparent p-4 animate-pulse">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-3 w-8 bg-neutral-200 dark:bg-neutral-800/50 rounded" />
                        <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800/50 rounded" />
                      </div>
                      <div className="h-3.5 w-3/4 bg-neutral-200 dark:bg-neutral-800/40 rounded mb-2" />
                      <div className="h-3 w-1/2 bg-neutral-100 dark:bg-neutral-800/30 rounded" />
                    </div>
                  ))}
                </div>
              )}
              {picksError && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-red-400">Failed to load picks. Please try again.</p>
                </div>
              )}
              {picks.length === 0 && !picksLoading && !picksError && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-neutral-400">No picks found</p>
                  <p className="text-xs text-neutral-600 mt-1">Try adjusting your filters</p>
                </div>
              )}
              {picks.map((pick: WhaleSignal) => (
                <PickCard
                  key={pick.id}
                  pick={pick}
                  isSelected={selectedPick?.id === pick.id}
                  onSelect={(p) => { setSelectedPick(p); if (window.innerWidth < 768) setMobileDetailOpen(true); }}
                  oddsFormat={oddsFormat}
                  isSplitMarket={splitMarketIds.has(pick.market_title || "")}
                  onViewMarket={splitMarketIds.has(pick.market_title || "") ? () => {
                    setModalMarketId((pick as any).condition_id || pick.market_title);
                  } : undefined}
                  onViewInsider={(addr) => {
                    setModalWalletAddress(addr);
                  }}
                />
              ))}
              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="py-4 flex justify-center">
                {picksHasMore && (picksLoadingMore || picksValidating) && picks.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <div className="h-3.5 w-3.5 border-2 border-neutral-600 border-t-transparent rounded-full animate-spin" />
                    Loading more...
                  </div>
                )}
                {!picksHasMore && picks.length > 0 && (
                  <span className="text-xs text-neutral-600">
                    All {picks.length} picks loaded
                  </span>
                )}
              </div>
            </>
          )}

          {/* Markets Tab */}
          {tab === "markets" && (
            <>
              {marketsLoading && (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="rounded-lg border border-neutral-200/80 dark:border-neutral-800/40 bg-white dark:bg-transparent p-4 animate-pulse">
                      <div className="space-y-3">
                        <div className="h-3 w-32 bg-neutral-200 dark:bg-neutral-800/50 rounded" />
                        <div className="h-3.5 w-3/4 bg-neutral-200 dark:bg-neutral-800/40 rounded" />
                        <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800/30 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {marketsError && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-red-400">Failed to load markets. Please try again.</p>
                </div>
              )}
              {marketCards.length === 0 && !marketsLoading && !marketsError && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-neutral-400">No markets found</p>
                  <p className="text-xs text-neutral-600 mt-1">Try adjusting your filters</p>
                </div>
              )}
              {marketCards.map((market: any) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  isSelected={selectedMarket?.condition_id === market.id}
                  onSelect={(market: any) => {
                    const gameData = markets.find((g: GameData) => g.condition_id === market.id)
                    if (gameData) { setSelectedMarket(gameData); if (window.innerWidth < 768) setMobileDetailOpen(true); }
                  }}
                  oddsFormat={oddsFormat}
                />
              ))}
            </>
          )}

          {/* Leaderboard Tab */}
          {tab === "leaderboard" && (
            <Leaderboard
              selectedWallet={selectedWallet}
              onSelectWallet={(w) => { setSelectedWallet(w); if (window.innerWidth < 768) setMobileDetailOpen(true); }}
              followedWallets={followedWallets}
              onToggleFollow={handleToggleFollow}
            />
          )}
        </div>

        {/* Right Panel — independent scroll */}
        <div className="hidden md:block w-2/5 border-l border-neutral-200 dark:border-neutral-800/30 pl-6 overflow-y-auto">
          {tab === "picks" && selectedPick && (
            <PickDetailPanel
              pick={selectedPick}
              oddsFormat={oddsFormat}
              isSplitMarket={splitMarketIds.has(selectedPick.market_title || "")}
              onViewMarket={splitMarketIds.has(selectedPick.market_title || "") ? () => {
                setModalMarketId((selectedPick as any).condition_id || selectedPick.market_title);
              } : undefined}
              onViewInsider={(addr) => {
                setModalWalletAddress(addr);
              }}
            />
          )}

          {tab === "markets" && selectedMarket && (
            <MarketDetailPanel game={selectedMarket} oddsFormat={oddsFormat} />
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
          {((tab === "picks" && !selectedPick) ||
            (tab === "markets" && !selectedMarket) ||
            (tab === "leaderboard" && !selectedWallet)) && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm text-neutral-600">
                Select a {tab === "picks" ? "pick" : tab === "markets" ? "market" : "wallet"} to view details
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
            tab === "picks" && selectedPick
              ? selectedPick.event_title || selectedPick.market_title
              : tab === "markets" && selectedMarket
                ? selectedMarket.market_title
                : tab === "leaderboard" && selectedWallet
                  ? `#${selectedWallet.wallet_address.slice(0, 4).toUpperCase()}`
                  : undefined
          }
        >
          {tab === "picks" && selectedPick && (
            <PickDetailPanel
              pick={selectedPick}
              oddsFormat={oddsFormat}
              isSplitMarket={splitMarketIds.has(selectedPick.market_title || "")}
              onViewMarket={splitMarketIds.has(selectedPick.market_title || "") ? () => {
                setModalMarketId((selectedPick as any).condition_id || selectedPick.market_title);
              } : undefined}
              onViewInsider={(addr) => {
                setModalWalletAddress(addr);
              }}
            />
          )}
          {tab === "markets" && selectedMarket && (
            <MarketDetailPanel game={selectedMarket} oddsFormat={oddsFormat} />
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
        <DialogContent className="max-w-2xl w-[90vw] max-h-[85vh] overflow-y-auto bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 p-6">
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
        <DialogContent className="max-w-3xl w-[90vw] max-h-[85vh] overflow-y-auto bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">
              Market breakdown
            </DialogTitle>
          </DialogHeader>
          {modalMarketId && (
            <MarketModalContent marketId={modalMarketId} oddsFormat={oddsFormat} />
          )}
        </DialogContent>
      </Dialog>
    </AppPageLayout>
  );
}
