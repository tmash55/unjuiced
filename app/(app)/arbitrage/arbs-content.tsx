"use client";

import { useEffect, useMemo, useState } from "react";
import { AutoToggle } from "@/components/arbs/auto-toggle";
import { GatedArbTable } from "@/components/arbs/gated-arb-table";
import { useArbsView } from "@/hooks/use-arbs-view";
import { Button } from "@/components/button";
import { AlertCircle } from "lucide-react";
import { useArbitragePreferences } from "@/context/preferences-context";
import { cn } from "@/lib/utils";
import { LoadingState } from "@/components/common/loading-state";
import { ConnectionErrorDialog } from "@/components/common/connection-error-dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { useIsPro, useHasEliteAccess } from "@/hooks/use-entitlements";
import { useIsMobileOrTablet } from "@/hooks/use-media-query";
import { MobileArbsView } from "@/components/arbs/mobile";
import { AppPageLayout } from "@/components/layout/app-page-layout";
import { UnifiedFilterBar } from "@/components/shared/filter-bar";
import { getAllLeagues } from "@/lib/data/sports";
import type { MarketType } from "@/lib/arb-filters";

// Available leagues for arbitrage
const AVAILABLE_LEAGUES = ["nba", "nfl", "ncaaf", "ncaab", "nhl", "mlb", "wnba", "soccer_epl"];

export default function ArbsPage() {
  // VC-Grade: Use centralized, cached Pro status
  const { user } = useAuth();
  const { isPro: pro, isLoading: planLoading } = useIsPro();
  const { hasAccess: hasLiveArb } = useHasEliteAccess();
  
  const [auto, setAuto] = useState(false);
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<"prematch" | "live">("prematch");
  const [previewCounts, setPreviewCounts] = useState<{ pregame: number; live: number } | null>(null);

  // Derive logged in status from auth
  const loggedIn = !!user;
  
  // Disable auto-refresh if not Elite
  useEffect(() => {
    if (!hasLiveArb) {
      setAuto(false);
    }
  }, [hasLiveArb]);

  // Reset to pregame if user loses live arb access (e.g. downgrade)
  useEffect(() => {
    if (!hasLiveArb && mode === "live") {
      setMode("prematch");
    }
  }, [hasLiveArb, mode]);

  // State for premium teaser arbs (for free users)
  const [premiumTeaserArbs, setPremiumTeaserArbs] = useState<any[]>([]);

  // Fetch preview counts, best ROI, and premium teaser arbs for non-pro users
  useEffect(() => {
    if (!pro && !planLoading) {
      const fetchPreviewData = async () => {
        try {
          // Fetch counts
          const countsResponse = await fetch("/api/arbs/counts", { cache: "no-store" });
          const countsData = await countsResponse.json();
          setPreviewCounts({ pregame: countsData.pregame || 0, live: countsData.live || 0 });
          
          // Fetch premium arbs for teasers (bypasses free user filtering)
          const premiumResponse = await fetch("/api/arbs/premium-teasers", { cache: "no-store" });
          const premiumData = await premiumResponse.json();
          
          if (premiumData.rows && premiumData.rows.length > 0) {
            setPremiumTeaserArbs(premiumData.rows);
            
            // Calculate best ROI from premium rows
            const maxRoi = Math.max(...premiumData.rows.map((r: any) => (r.roi_bps || 0) / 100));
            setPreviewBestRoi(maxRoi.toFixed(2));
          }
        } catch (error) {
          console.error("Failed to fetch preview data:", error);
          setPreviewCounts({ pregame: 0, live: 0 });
          setPreviewBestRoi("0.00");
          setPremiumTeaserArbs([]);
        }
      };
      fetchPreviewData();
    }
  }, [pro, planLoading]);

  // Fetch all results at once (no pagination)
  const limit = pro ? 1000 : 100;
  
  const { rows, ids, changes, added, version, loading, connected, cursor, hasMore, nextPage, prevPage, refresh, prefs, prefsLoading, updateFilters, counts, authExpired, reconnectNow, hasActiveFilters, hasFailed, filteredCount, filteredReason } = useArbsView({ pro: pro, live: auto, eventId, limit, mode });
  const [refreshing, setRefreshing] = useState(false);
  const [searchLocal, setSearchLocal] = useState("");
  const [showConnectionError, setShowConnectionError] = useState(false);
  
  // Show dialog when SSE fails (only for Sharp users with auto refresh enabled)
  useEffect(() => {
    if (hasFailed && pro && auto) {
      setShowConnectionError(true);
    }
  }, [hasFailed, pro, auto]);
  useEffect(() => { setSearchLocal(prefs.searchQuery || ""); }, [prefs.searchQuery]);
  useEffect(() => {
    const v = searchLocal;
    const t = setTimeout(() => {
      if (v !== prefs.searchQuery) {
        void updateFilters({ searchQuery: v });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchLocal]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  
  // Mobile/tablet detection - show card view on screens < 1280px
  const isMobile = useIsMobileOrTablet();
  const bestRoi = useMemo(() => rows.length ? Math.max(...rows.map(r => (r.roi_bps || 0) / 100)).toFixed(2) : "0.00", [rows]);
  const [previewBestRoi, setPreviewBestRoi] = useState<string>("0.00");
  const [freshFound, setFreshFound] = useState(false);
  const [freshBest, setFreshBest] = useState(false);
  const prevFoundRef = useState<number>(rows.length)[0];
  useEffect(() => {
    setFreshFound(true);
    const t = setTimeout(() => setFreshFound(false), 600);
    return () => clearTimeout(t);
  }, [rows.length]);
  useEffect(() => {
    setFreshBest(true);
    const t = setTimeout(() => setFreshBest(false), 600);
    return () => clearTimeout(t);
  }, [bestRoi]);

  // Get preferences for roundBets setting (filtering now handled by useArbsView via matchesArbRow)
  const { filters: arbFilters } = useArbitragePreferences();
  const roundBets = (arbFilters as any)?.roundBets ?? false;
  
  // Debug: Log prefs on each render
  console.log('[ArbitrageContent] Current prefs:', {
    selectedLeagues: prefs.selectedLeagues,
    selectedBooks: prefs.selectedBooks?.length,
  });
  
  // Rows are already filtered by useArbsView (sportsbooks, ROI, liquidity, etc.)
  const fRows = rows;
  const fIds = ids;

  // Current count based on mode
  const currentCount = pro 
    ? (counts ? (mode === 'live' ? counts.live : counts.pregame) : rows.length)
    : (previewCounts ? (mode === 'live' ? previewCounts.live : previewCounts.pregame) : 0);

  // Show loading state while checking plan
  if (planLoading) {
    return (
      <AppPageLayout
        title="Arbitrage Opportunities"
        subtitle="Discover risk-free profit opportunities across sportsbooks with guaranteed returns."
      >
        <LoadingState type="account" />
      </AppPageLayout>
    );
  }

  // Mobile View
  if (isMobile) {
    return (
      <MobileArbsView
        rows={fRows}
        changes={changes}
        added={added}
        totalBetAmount={prefs.totalBetAmount}
        roundBets={roundBets}
        isPro={pro}
        hasLiveArb={hasLiveArb}
        isLoggedIn={loggedIn}
        counts={pro ? counts : previewCounts}
        mode={mode}
        onModeChange={setMode}
        loading={loading || prefsLoading}
        onRefresh={async () => {
          try { setRefreshing(true); await refresh(); } finally { setRefreshing(false); }
        }}
        refreshing={refreshing}
        connected={connected}
        autoEnabled={auto}
        onToggleAuto={setAuto}
      />
    );
  }

  // Stats Bar Component
  const statsBar = mounted ? (
    <div className="flex items-center gap-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-400">
          Opportunities
          {hasActiveFilters && (
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#0EA5E9]" title="Filters active" />
          )}
        </div>
        <div className={cn(
          "mt-1 text-2xl font-bold text-neutral-900 transition-all duration-300 dark:text-white",
          freshFound && "scale-110"
        )}>
          {currentCount}
        </div>
      </div>
      <div className="h-12 w-px bg-neutral-200 dark:bg-neutral-800" />
      <div className="text-center">
        <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          Best ROI
        </div>
        <div className={cn(
          "mt-1 text-2xl font-bold text-emerald-600 transition-all duration-300 dark:text-emerald-400",
          freshBest && "scale-110"
        )}>
          +{pro ? bestRoi : previewBestRoi}%
        </div>
      </div>
    </div>
  ) : null;

  // Context Bar - Using Unified Filter Bar
  const contextBar = (
    <UnifiedFilterBar
      tool="arbitrage"
      // Mode
      mode={mode === "live" ? "live" : "pregame"}
      onModeChange={(m) => setMode(m === "live" ? "live" : "prematch")}
      // Search
      searchQuery={searchLocal}
      onSearchChange={setSearchLocal}
      // Boost (not used for arbitrage, but required)
      boostPercent={0}
      onBoostChange={() => {}}
      // Leagues
      selectedLeagues={prefs.selectedLeagues || []}
      onLeaguesChange={(leagues) => {
        console.log('[ArbitrageContent] onLeaguesChange called with:', leagues);
        console.log('[ArbitrageContent] Current prefs.selectedLeagues:', prefs.selectedLeagues);
        updateFilters({ selectedLeagues: leagues });
      }}
      availableLeagues={AVAILABLE_LEAGUES}
      // Markets (arbitrage uses market types instead, pass empty)
      selectedMarkets={[]}
      onMarketsChange={() => {}}
      availableMarkets={[]}
      // Sportsbooks
      selectedBooks={prefs.selectedBooks || []}
      onBooksChange={(books) => updateFilters({ selectedBooks: books })}
      // Min liquidity
      minLiquidity={prefs.minLiquidity ?? 50}
      onMinLiquidityChange={(minLiquidity) => updateFilters({ minLiquidity })}
      // Arbitrage-specific
      minArb={prefs.minArb ?? 0}
      onMinArbChange={(minArb) => updateFilters({ minArb })}
      maxArb={prefs.maxArb ?? 20}
      onMaxArbChange={(maxArb) => updateFilters({ maxArb })}
      totalBetAmount={prefs.totalBetAmount ?? 200}
      onTotalBetAmountChange={(totalBetAmount) => updateFilters({ totalBetAmount })}
      selectedMarketTypes={(prefs.selectedMarketTypes || ['player', 'game']) as ("player" | "game")[]}
      onMarketTypesChange={(types) => updateFilters({ selectedMarketTypes: types as MarketType[] })}
      // Hidden (arbitrage doesn't have hidden feature, but required)
      showHidden={false}
      hiddenCount={0}
      onToggleShowHidden={() => {}}
      // Auto Refresh
      autoRefresh={auto}
      onAutoRefreshChange={setAuto}
      isConnected={connected}
      hasFailed={hasFailed}
      // Refresh
      onRefresh={async () => {
        try { setRefreshing(true); await refresh(); } finally { setRefreshing(false); }
      }}
      isRefreshing={refreshing}
      // Reset
      onReset={() => {
        updateFilters({
          selectedLeagues: AVAILABLE_LEAGUES,
          selectedBooks: [],
          selectedMarketTypes: ['player', 'game'],
          minArb: 0,
          maxArb: 20,
          totalBetAmount: 200,
          minLiquidity: 50,
        });
        setSearchLocal("");
      }}
      // UI State
      locked={!pro}
      isPro={hasLiveArb}
      hasLiveArb={hasLiveArb}
    />
  );

  return (
    <AppPageLayout
      title="Arbitrage Opportunities"
      subtitle="Discover risk-free profit opportunities across sportsbooks with guaranteed returns."
      statsBar={statsBar}
      contextBar={contextBar}
      stickyContextBar={true}
    >
      {/* Alerts */}
      {authExpired && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Session expired. Please reconnect to resume live updates.
            </span>
          </div>
          <Button 
            variant="outline" 
            text="Reconnect"
            onClick={reconnectNow}
            className="shrink-0"
          />
        </div>
      )}

      {/* Content */}
      {loading || prefsLoading ? (
        <LoadingState />
      ) : (
        <GatedArbTable
          rows={fRows}
          ids={fIds}
          changes={changes}
          added={added}
          totalBetAmount={prefs.totalBetAmount}
          roundBets={roundBets}
          isLoggedIn={loggedIn}
          isPro={pro}
          filteredCount={filteredCount}
          filteredReason={filteredReason}
          premiumTeaserArbs={premiumTeaserArbs}
        />
      )}

      {/* Connection Error Dialog */}
      <ConnectionErrorDialog
        isOpen={showConnectionError}
        onClose={() => setShowConnectionError(false)}
        onRefresh={() => window.location.reload()}
      />
    </AppPageLayout>
  );
}
