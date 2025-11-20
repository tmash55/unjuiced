"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { BestOddsPrefs, BestOddsDeal } from "@/lib/best-odds-schema";
import { GatedBestOddsView } from "@/components/best-odds/gated-best-odds-view";
import { BestOddsFilters } from "@/components/best-odds/best-odds-filters";
import { ToolHeading } from "@/components/common/tool-heading";
import { ToolSubheading } from "@/components/common/tool-subheading";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { FiltersBar, FiltersBarSection } from "@/components/common/filters-bar";
import { Input } from "@/components/ui/input";
import { InputSearch } from "@/components/icons/input-search";
import { cn } from "@/lib/utils";
import { TrendingUp, RefreshCw, LayoutGrid, Table as TableIcon } from "lucide-react";
import { LoadingState } from "@/components/common/loading-state";
import { Tooltip } from "@/components/tooltip";

import { useBestOddsView } from "@/hooks/use-best-odds-view";
import { matchesBestOddsDeal, sortDeals, getUniqueLeagues, getUniqueMarkets, getUniqueSportsbooks } from "@/lib/best-odds-filters";
import { getAllActiveSportsbooks, getSportsbookById } from "@/lib/data/sportsbooks";
import { SUPPORTED_SPORTS } from "@/lib/data/markets";
import { Lock } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useIsPro } from "@/hooks/use-entitlements";

export default function BestOddsPage() {
  // VC-Grade: Use centralized, cached Pro status and custom hook for data fetching
  const { user } = useAuth();
  const { isPro, isLoading: planLoading } = useIsPro();
  const isLoggedIn = !!user;
  
  // Custom hook handles all data fetching (Pro vs non-Pro)
  const { deals, premiumCount, loading, error, refresh, prefs, prefsLoading, updateFilters } = useBestOddsView({ 
    isPro, 
    planLoading 
  });
  
  const [refreshing, setRefreshing] = useState(false);
  
  // Local search state for smooth typing (debounced like arbs)
  const [searchLocal, setSearchLocal] = useState("");
  
  // View mode state (default to table, will adjust on mount)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // Set initial view mode based on screen size (client-side only, after mount)
  useEffect(() => {
    const handleResize = () => {
      setViewMode(window.innerWidth < 768 ? 'cards' : 'table');
    };
    
    // Set initial value
    handleResize();
    
    // Optional: Listen for resize events
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle preference changes
  const handlePrefsChange = useCallback((newPrefs: BestOddsPrefs) => {
    updateFilters(newPrefs);
  }, [updateFilters]);

  // Sync local search with preferences (when prefs change externally)
  useEffect(() => {
    setSearchLocal(prefs.searchQuery || "");
  }, [prefs.searchQuery]);

  // Debounce search query updates (400ms like arbs)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchLocal !== prefs.searchQuery) {
        updateFilters({ ...prefs, searchQuery: searchLocal });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchLocal, prefs, updateFilters]);

  // Show ALL possible options in filters (not just what's in current data)
  const availableLeagues = useMemo(() => ['nba', 'nfl', 'ncaaf', 'ncaab', 'nhl', 'mlb', 'wnba'], []);
  
  // Dynamically extract unique markets from actual data (instead of hardcoding)
  const availableMarkets = useMemo(() => {
    const uniqueMarkets = new Set<string>();
    deals.forEach((deal: BestOddsDeal) => {
      if (deal.mkt) {
        uniqueMarkets.add(deal.mkt);
      }
    });
    return Array.from(uniqueMarkets).sort();
  }, [deals]);
  
  const availableSportsbooks = useMemo(() => getAllActiveSportsbooks().map(b => b.id), []);

  // Apply client-side filtering and sorting
  const filteredDeals = useMemo(() => {
    let filtered = deals.filter((deal: BestOddsDeal) => matchesBestOddsDeal(deal, prefs));
    
    // Apply college player props filter if enabled
    if (prefs.hideCollegePlayerProps) {
      filtered = filtered.filter((deal: BestOddsDeal) => {
        // Keep game markets (ent === 'game')
        if (deal.ent === 'game') return true;
        // Hide NCAAF and NCAAB player props
        const isCollegePlayerProp = (deal.sport === 'ncaaf' || deal.sport === 'ncaab') && deal.ent !== 'game';
        return !isCollegePlayerProp;
      });
    }
    
    // If comparing to a specific book, only show deals where that book has odds
    // AND where the best book is NOT the comparison book (otherwise it's 0% improvement)
    if (prefs.comparisonMode === 'book' && prefs.comparisonBook) {
      const targetBook = prefs.comparisonBook.toLowerCase();
      filtered = filtered.filter((deal: BestOddsDeal) => {
        // Check if the comparison book has odds for this deal
        const hasOdds = deal.allBooks?.some(b => b.book.toLowerCase() === targetBook);
        if (!hasOdds) return false;
        
        // Filter out deals where the best book is the same as the comparison book
        const bestBookNormalized = deal.bestBook?.toLowerCase();
        return bestBookNormalized !== targetBook;
      });
    }
    
    filtered = sortDeals(filtered, prefs.sortBy);
    return filtered;
  }, [deals, prefs]);

  // Calculate counts by scope for toggle buttons (using filtered deals)
  const pregameCount = filteredDeals.filter((d: BestOddsDeal) => d.scope === 'pregame').length;
  const liveCount = filteredDeals.filter((d: BestOddsDeal) => d.scope === 'live').length;

  const stats = {
    total: filteredDeals.length,
    pregame: pregameCount,
    live: liveCount,
    avgImprovement: filteredDeals.length > 0
      ? (filteredDeals.reduce((sum: number, d: BestOddsDeal) => sum + Number(d.priceImprovement || 0), 0) / filteredDeals.length).toFixed(1)
      : '0'
  };

  const comparisonBaseline = useMemo(() => {
    const mode = prefs.comparisonMode ?? 'average';
    if (mode === 'book') {
      const name = prefs.comparisonBook
        ? getSportsbookById(prefs.comparisonBook)?.name || prefs.comparisonBook
        : 'the selected book';
      return {
        dialogDescription: `the quote from ${name}`,
        baselineStep: `decimal odds from ${name}`,
        meaning: `${name} (or the book you selected)`,
      };
    }
    if (mode === 'next_best') {
      return {
        dialogDescription: 'the next-best price offered by any other book',
        baselineStep: 'decimal odds from the best price offered by any other book (ties count as zero edge)',
        meaning: 'the next-best sportsbook',
      };
    }
    return {
      dialogDescription: 'the market average across all books',
      baselineStep: 'the average of all decimal odds',
      meaning: 'the rest of the market',
    };
  }, [prefs.comparisonMode, prefs.comparisonBook]);

  // Show loading state while checking plan
  if (planLoading) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <LoadingState type="account" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <ToolHeading>Edge Finder</ToolHeading>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <ToolSubheading>
        Track real-time discrepancies between sportsbooks to uncover edges before the market adjusts.
        </ToolSubheading>
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="text-xs sm:text-sm font-medium text-brand hover:underline underline-offset-2 self-start sm:self-auto"
              >
                How improvement % is calculated
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md border-[var(--tertiary)]/20 bg-white p-0 shadow-xl dark:border-[var(--tertiary)]/30 dark:bg-neutral-900">
              <div className="p-6 sm:p-8 text-center">
                {/* Icon with gradient glow (match ProGate style) */}
                <div className="relative mx-auto mb-6 w-fit">
                  <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-[var(--tertiary)]/20 via-[var(--tertiary)]/30 to-[var(--tertiary-strong)]/30 blur-2xl" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--tertiary)]/20 bg-white shadow-sm dark:border-[var(--tertiary)]/30 dark:bg-neutral-900">
                    <TrendingUp className="h-7 w-7 text-[var(--tertiary-strong)]" />
                  </div>
                </div>

                <DialogHeader>
                  <DialogTitle className="text-xl">Improvement %</DialogTitle>
                  <DialogDescription className="text-sm">
                    Currently comparing the best price vs {comparisonBaseline.dialogDescription}.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 text-left">
                  <p className="text-neutral-600 dark:text-neutral-400">
                    1) Collect all book prices for the same line/side (need ≥ 2).
                  </p>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    2) Convert American → Decimal:
                    <br />o &gt; 0 → 1 + o/100
                    <br />o ≤ 0 → 1 + 100/|o|
                  </p>
                  <p className="text-neutral-600 dark:text-neutral-400">
                    3) baseline_decimal = {comparisonBaseline.baselineStep}
                    <br />4) best_decimal = decimal of the highest American price
                  </p>
                  <p className="font-semibold">
                    Improvement % = ((best_decimal − baseline_decimal) / baseline_decimal) × 100
                  </p>
                  <p className="mt-2">
                    A higher Improvement % means you’re getting a better deal compared to {comparisonBaseline.meaning}.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pregame/Live Toggle - Above Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Pregame/Live Toggle */}
          <div className="mode-toggle">
            <button
              type="button"
              onClick={() => handlePrefsChange({ ...prefs, scope: 'pregame' })}
              className={cn(prefs.scope === 'pregame' && 'active')}
            >
              Pre-Game {stats.pregame > 0 && `(${stats.pregame})`}
            </button>
            <button
              type="button"
              disabled={true}
              className="relative group"
              title="Coming soon"
            >
              <span className="flex items-center gap-1.5">
                Live
                <Lock className="h-3 w-3 opacity-60" />
                <span className="text-xs opacity-60">(Soon)</span>
              </span>
            </button>
          </div>

          {/* Info Text - Hidden on Mobile */}
          <div className="hidden md:block text-sm text-neutral-600 dark:text-neutral-400">
            {prefs.scope === 'pregame' && 'Showing upcoming games'}
            {prefs.scope === 'live' && 'Showing live in-progress games'}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-8">
        <div className="sticky top-14 z-30">
          <FiltersBar useDots={true}>
            <FiltersBarSection align="left">
              {/* View Toggle - Shows on left on mobile only */}
              <Tooltip content="Pro only" disabled={isPro}>
                <div className={cn(
                  "flex md:hidden items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900",
                  !isPro && "opacity-50"
                )}>
                  <button
                    onClick={() => isPro && setViewMode('table')}
                    disabled={!isPro}
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded transition-all",
                      viewMode === 'table'
                        ? "bg-brand text-white"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
                      !isPro && "cursor-not-allowed"
                    )}
                    title={!isPro ? "Pro only" : "Table view"}
                  >
                    <TableIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => isPro && setViewMode('cards')}
                    disabled={!isPro}
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded transition-all",
                      viewMode === 'cards'
                        ? "bg-brand text-white"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
                      !isPro && "cursor-not-allowed"
                    )}
                    title={!isPro ? "Pro only" : "Card view"}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </Tooltip>

              {/* Search Input - Hidden on mobile, disabled for non-pro */}
              <Tooltip content="Pro only" disabled={isPro}>
                <div className="relative hidden md:block">
                  <InputSearch className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-gray-400 dark:text-gray-500" />
                  <Input
                    type="text"
                    placeholder="Search player or team..."
                    value={searchLocal}
                    onChange={(e) => setSearchLocal(e.target.value)}
                    disabled={!isPro}
                    className="w-64 pl-10"
                  />
                </div>
              </Tooltip>
            </FiltersBarSection>

            <FiltersBarSection align="right">
              {/* Filters Button */}
                <BestOddsFilters
                  prefs={prefs}
                  onPrefsChange={handlePrefsChange}
                  availableLeagues={availableLeagues}
                  availableMarkets={availableMarkets}
                  availableSportsbooks={availableSportsbooks}
                  deals={filteredDeals}
                  locked={!isPro}
                  isLoggedIn={isLoggedIn}
                  isPro={isPro}
                  refreshing={refreshing}
                  onRefresh={async () => {
                    if (!isPro) return;
                    try { 
                      setRefreshing(true); 
                      await refresh(); 
                    } finally { 
                      setRefreshing(false); 
                    }
                  }}
                />

              {/* View Toggle - Shows on right on desktop only */}
              <Tooltip content="Pro only" disabled={isPro}>
                <div className={cn(
                  "hidden md:flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900",
                  !isPro && "opacity-50"
                )}>
                  <button
                    onClick={() => isPro && setViewMode('table')}
                    disabled={!isPro}
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded transition-all",
                      viewMode === 'table'
                        ? "bg-brand text-white"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
                      !isPro && "cursor-not-allowed"
                    )}
                    title={!isPro ? "Pro only" : "Table view"}
                  >
                    <TableIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => isPro && setViewMode('cards')}
                    disabled={!isPro}
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded transition-all",
                      viewMode === 'cards'
                        ? "bg-brand text-white"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
                      !isPro && "cursor-not-allowed"
                    )}
                    title={!isPro ? "Pro only" : "Card view"}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </Tooltip>
            </FiltersBarSection>
          </FiltersBar>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-red-200">
          <p className="font-medium">Error loading opportunities</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Content - Gated View */}
      <GatedBestOddsView
        deals={filteredDeals}
        loading={loading || prefsLoading}
        viewMode={viewMode}
        isLoggedIn={isLoggedIn}
        isPro={isPro}
        premiumCount={premiumCount}
        prefs={prefs}
      />
    </div>
  );
}

