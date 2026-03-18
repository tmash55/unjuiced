"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

export default function SharpSignalsPage() {
  const { hasAccess, isLoading } = useHasEliteAccess();
  const { prefs, loaded: prefsLoaded, updatePrefs, toggleFollowWallet, followedWallets } = useSignalPreferences();
  const [tab, setTab] = useState<Tab>("picks");
  const [selectedSport, setSelectedSport] = useState("");
  const [selectedTier, setSelectedTier] = useState("");
  const [selectedPick, setSelectedPick] = useState<WhaleSignal | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<GameData | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<WalletScore | null>(null);
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>("american");
  const [showMySharps, setShowMySharps] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // Fetch picks data with infinite scroll
  const PAGE_SIZE = 50;
  const [pickPages, setPickPages] = useState<WhaleSignal[][]>([]);
  const [picksLoading, setPicksLoading] = useState(true);
  const [picksLoadingMore, setPicksLoadingMore] = useState(false);
  const [picksError, setPicksError] = useState<Error | null>(null);
  const [picksTotal, setPicksTotal] = useState(0);
  const [picksHasMore, setPicksHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildFeedUrl = useCallback((offset: number) => {
    const feedParams = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      sort: prefs.signal_sort_by || "score",
      resolved: prefs.signal_show_resolved ? "all" : "false",
    });
    if (selectedSport) feedParams.set("sport", selectedSport);
    if (selectedTier) feedParams.set("tier", selectedTier);
    if (showMySharps && followedWallets.length > 0) {
      feedParams.set("wallet", followedWallets.join(","));
    }
    return `/api/polymarket/feed?${feedParams}`;
  }, [prefs.signal_sort_by, prefs.signal_show_resolved, selectedSport, selectedTier, showMySharps, followedWallets]);

  // Initial fetch + refetch when filters change
  useEffect(() => {
    if (!hasAccess) return;
    let cancelled = false;
    setPicksLoading(true);
    setPickPages([]);
    setPicksHasMore(true);

    fetch(buildFeedUrl(0))
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const signals = data.signals || [];
        setPickPages([signals]);
        setPicksTotal(data.total || 0);
        setPicksHasMore(signals.length >= PAGE_SIZE);
        setPicksError(null);
      })
      .catch(err => { if (!cancelled) setPicksError(err); })
      .finally(() => { if (!cancelled) setPicksLoading(false); });

    return () => { cancelled = true; };
  }, [hasAccess, buildFeedUrl]);

  // Auto-refresh first page every 30s
  useEffect(() => {
    if (!hasAccess) return;
    const interval = setInterval(() => {
      fetch(buildFeedUrl(0))
        .then(r => r.json())
        .then(data => {
          const signals = data.signals || [];
          setPickPages(prev => {
            const updated = [...prev];
            updated[0] = signals;
            return updated;
          });
          setPicksTotal(data.total || 0);
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [hasAccess, buildFeedUrl]);

  // Load more when sentinel enters viewport
  const loadMorePicks = useCallback(() => {
    if (picksLoadingMore || !picksHasMore) return;
    const currentCount = pickPages.reduce((sum, page) => sum + page.length, 0);
    setPicksLoadingMore(true);

    fetch(buildFeedUrl(currentCount))
      .then(r => r.json())
      .then(data => {
        const signals = data.signals || [];
        setPickPages(prev => [...prev, signals]);
        setPicksHasMore(signals.length >= PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setPicksLoadingMore(false));
  }, [picksLoadingMore, picksHasMore, pickPages, buildFeedUrl]);

  // IntersectionObserver for infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current || tab !== "picks") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMorePicks();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMorePicks, tab]);

  // Flatten all pages into single array
  const allPicksRaw = pickPages.flat();
  const picksData = { signals: allPicksRaw, total: picksTotal };

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
              <div key={i} className="rounded-xl border border-neutral-800/40 bg-neutral-900/40 p-4 animate-pulse">
                <div className="flex items-start gap-3.5">
                  <div className="h-11 w-11 rounded-full bg-neutral-800/50" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-neutral-800/50 rounded" />
                    <div className="h-3.5 w-3/4 bg-neutral-800/40 rounded" />
                    <div className="h-3 w-1/2 bg-neutral-800/30 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block w-2/5 border-l border-neutral-800/40 pl-6 space-y-4">
            <div className="h-8 w-48 bg-neutral-800/30 rounded animate-pulse" />
            <div className="h-20 bg-neutral-800/20 rounded-xl animate-pulse" />
            <div className="h-32 bg-neutral-800/15 rounded-xl animate-pulse" />
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

  // Apply excluded sports + tier filter client-side
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

  // Auto-select first item when data loads or tab changes
  if (tab === "picks" && picks.length > 0 && !selectedPick) {
    setSelectedPick(picks[0]);
  }
  if (tab === "markets" && markets.length > 0 && !selectedMarket) {
    setSelectedMarket(markets[0]);
  }

  // Convert markets data to MarketCard format
  const convertToMarketCard = (game: GameData) => {
    const mainOutcome = game.outcomes[0]
    const secondOutcome = game.outcomes[1]
    if (!mainOutcome || !secondOutcome) return null

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
        percentOfMoney: game.flow_pct
      },
      sideB: {
        name: secondOutcome.outcome,
        price: secondOutcome.avg_entry_price * 100,
        insiderCount: secondOutcome.total_bets,
        totalWagered: secondOutcome.total_dollars,
        percentOfMoney: 100 - game.flow_pct
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
              counts={{
                total: tab === "picks" ? picks.length : markets.length,
                nba: tab === "picks"
                  ? picks.filter((p: WhaleSignal) => p.sport === "nba").length
                  : markets.filter((m: GameData) => m.sport === "nba").length,
                nhl: tab === "picks"
                  ? picks.filter((p: WhaleSignal) => p.sport === "nhl").length
                  : markets.filter((m: GameData) => m.sport === "nhl").length,
                nfl: tab === "picks"
                  ? picks.filter((p: WhaleSignal) => p.sport === "nfl").length
                  : markets.filter((m: GameData) => m.sport === "nfl").length,
                soccer: tab === "picks"
                  ? picks.filter((p: WhaleSignal) => p.sport === "soccer").length
                  : markets.filter((m: GameData) => m.sport === "soccer").length,
                mlb: tab === "picks"
                  ? picks.filter((p: WhaleSignal) => p.sport === "mlb").length
                  : markets.filter((m: GameData) => m.sport === "mlb").length,
                tennis: tab === "picks"
                  ? picks.filter((p: WhaleSignal) => p.sport === "tennis").length
                  : markets.filter((m: GameData) => m.sport === "tennis").length,
                ufc: tab === "picks"
                  ? picks.filter((p: WhaleSignal) => p.sport === "ufc").length
                  : markets.filter((m: GameData) => m.sport === "ufc").length,
              }}
              tierCounts={{
                total: tab === "picks" ? allPicks.length : allMarkets.length,
                sharp: tab === "picks"
                  ? allPicks.filter((p: WhaleSignal) => p.tier === "sharp").length
                  : allMarkets.filter((m: GameData) => m.outcomes?.some((o: any) => o.bets?.some((b: any) => b.tier === "sharp"))).length,
                whale: tab === "picks"
                  ? allPicks.filter((p: WhaleSignal) => p.tier === "whale").length
                  : allMarkets.filter((m: GameData) => m.outcomes?.some((o: any) => o.bets?.some((b: any) => b.tier === "whale"))).length,
              }}
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
                    <div key={i} className="rounded-xl border border-neutral-800/40 bg-neutral-900/40 p-4 animate-pulse">
                      <div className="flex items-start gap-3.5">
                        <div className="h-11 w-11 rounded-full bg-neutral-800/50" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-24 bg-neutral-800/50 rounded" />
                          <div className="h-3.5 w-3/4 bg-neutral-800/40 rounded" />
                        </div>
                      </div>
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
                />
              ))}
              {/* Infinite scroll sentinel */}
              {picksHasMore && picks.length > 0 && (
                <div ref={sentinelRef} className="py-4 flex justify-center">
                  {picksLoadingMore && (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <div className="h-3.5 w-3.5 border-2 border-neutral-600 border-t-transparent rounded-full animate-spin" />
                      Loading more...
                    </div>
                  )}
                </div>
              )}
              {!picksHasMore && picks.length > 0 && (
                <div className="py-4 text-center text-xs text-neutral-600">
                  All {picks.length} picks loaded
                </div>
              )}
            </>
          )}

          {/* Markets Tab */}
          {tab === "markets" && (
            <>
              {marketsLoading && (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-neutral-800/40 bg-neutral-900/40 p-4 animate-pulse">
                      <div className="space-y-3">
                        <div className="h-3 w-32 bg-neutral-800/50 rounded" />
                        <div className="h-3.5 w-3/4 bg-neutral-800/40 rounded" />
                        <div className="h-1.5 w-full bg-neutral-800/30 rounded-full" />
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
            <PickDetailPanel pick={selectedPick} oddsFormat={oddsFormat} />
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
            <PickDetailPanel pick={selectedPick} oddsFormat={oddsFormat} />
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
    </AppPageLayout>
  );
}
