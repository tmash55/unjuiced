"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/seperator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import { getAllSports, getAllLeagues } from "@/lib/data/sports";
import { formatMarketLabel } from "@/lib/data/markets";
import { normalizeSportsbookName } from "@/lib/best-odds-filters";
import type { BestOddsPrefs } from "@/lib/best-odds-schema";
import { Filter, Building2, Target, TrendingUp, ChevronDown, Lock, RefreshCw, Trash2 } from "lucide-react";
import { SportIcon } from "@/components/icons/sport-icons";
import { ButtonLink } from "@/components/button-link";
import { Tooltip } from "@/components/tooltip";
import { cn } from "@/lib/utils";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { toast } from "sonner";

interface BestOddsFiltersProps {
  prefs: BestOddsPrefs;
  onPrefsChange: (prefs: BestOddsPrefs) => void;
  availableLeagues: string[];
  availableMarkets: string[];
  availableSportsbooks: string[];
  deals?: Array<{ 
    bestBook: string;
    bestPrice: number;
    allBooks: Array<{ book: string; price: number; link: string }>;
  }>;  // For counting deals per sportsbook (including ties)
  locked?: boolean;
  isLoggedIn?: boolean;
  isPro?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
  hiddenCount?: number;
  showHidden?: boolean;
  onToggleShowHidden?: () => void;
  onClearAllHidden?: () => void;
  customPresetActive?: boolean;  // When true, custom filter preset overrides comparison mode
  activePresetName?: string;     // Name of the active preset for display
}

export function BestOddsFilters({
  prefs,
  onPrefsChange,
  availableLeagues,
  availableMarkets,
  availableSportsbooks,
  deals = [],
  locked = false,
  isLoggedIn = false,
  hiddenCount = 0,
  showHidden = false,
  onToggleShowHidden,
  onClearAllHidden,
  isPro = false,
  refreshing = false,
  onRefresh,
  customPresetActive = false,
  activePresetName,
}: BestOddsFiltersProps) {
  const allSportsbooks = useMemo(() => getAllActiveSportsbooks(), []);
  const allSports = useMemo(() => getAllSports(), []);
  const allLeagues = useMemo(() => getAllLeagues(), []);
  
  // Calculate count of deals per sportsbook (where it has the best price, including ties)
  const sportsbookCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    deals.forEach(deal => {
      // Find all books that have the best price (handles ties)
      const bestPrice = deal.bestPrice;
      const booksWithBestPrice = deal.allBooks?.filter(book => book.price === bestPrice) || [];
      
      // Count each book that has the best price
      booksWithBestPrice.forEach(book => {
        const bookId = normalizeSportsbookName(book.book);
        counts[bookId] = (counts[bookId] || 0) + 1;
      });
    });
    return counts;
  }, [deals]);
  const [open, setOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  // Derive initial sports from leagues
  const getInitialSports = () => {
    if (prefs.selectedLeagues.length === 0) {
      // Empty array from backend means "all selected" - populate UI with all IDs
      return allSports.map(sport => sport.id);
    }
    // Otherwise, derive sports from selected leagues
    return allSports
      .filter(sport => sport.leagues.some(league => prefs.selectedLeagues.includes(league.id)))
      .map(sport => sport.id);
  };

  // Local state for uncommitted changes
  const [localBooks, setLocalBooks] = useState<string[]>(prefs.selectedBooks);
  const [localSports, setLocalSports] = useState<string[]>(getInitialSports());
  const [localLeagues, setLocalLeagues] = useState<string[]>(
    prefs.selectedLeagues.length === 0 ? availableLeagues : prefs.selectedLeagues
  );
  const [localMarkets, setLocalMarkets] = useState<string[]>(prefs.selectedMarkets);
  const [localMarketLines, setLocalMarketLines] = useState<Record<string, number[]>>(prefs.marketLines);
  const [localMinImprovement, setLocalMinImprovement] = useState<number>(prefs.minImprovement);
  const [localMaxOdds, setLocalMaxOdds] = useState<number | undefined>(prefs.maxOdds);
  const [localMinOdds, setLocalMinOdds] = useState<number | undefined>(prefs.minOdds);
  const [localHideCollegePlayerProps, setLocalHideCollegePlayerProps] = useState<boolean>(prefs.hideCollegePlayerProps ?? false);
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localComparisonMode, setLocalComparisonMode] = useState<BestOddsPrefs['comparisonMode']>(prefs.comparisonMode ?? 'average');
  const [localComparisonBook, setLocalComparisonBook] = useState<string | null>(prefs.comparisonBook ?? null);
  const [localSearchQuery, setLocalSearchQuery] = useState<string>(prefs.searchQuery || '');

  const comparisonOptions: ComboboxOption[] = useMemo(() => {
    const baseOptions = [
      { value: 'average', label: 'Market average' },
      { value: 'next_best', label: 'Next-best price' },
    ];
    
    // Add all sportsbooks as individual options
    const bookOptions = allSportsbooks.map((sb) => ({
      value: `book:${sb.id}`,
      label: sb.name,
      icon: sb.image?.light ? (
        <img
          src={sb.image.light}
          alt={sb.name}
          className="h-4 w-4 flex-shrink-0 rounded-sm object-contain"
        />
      ) : null,
    }));
    
    return [...baseOptions, ...bookOptions];
  }, [allSportsbooks]);

  const selectedComparisonOption = useMemo(() => {
    if (localComparisonMode === 'book' && localComparisonBook) {
      // Find the specific book option
      return comparisonOptions.find((opt) => opt.value === `book:${localComparisonBook}`) ?? comparisonOptions[0];
    }
    return comparisonOptions.find((opt) => opt.value === localComparisonMode) ?? comparisonOptions[0];
  }, [comparisonOptions, localComparisonMode, localComparisonBook]);

  const handleComparisonSelect = (opt: ComboboxOption | null) => {
    if (locked || !opt) return;
    
    // Check if it's a book option
    if (opt.value.startsWith('book:')) {
      const bookId = opt.value.replace('book:', '');
      setLocalComparisonMode('book');
      setLocalComparisonBook(bookId);
      emitComparisonChange('book', bookId);
    } else {
      const mode = opt.value as BestOddsPrefs['comparisonMode'];
      setLocalComparisonMode(mode);
      setLocalComparisonBook(null);
      emitComparisonChange(mode, null);
    }
  };

  // Show toast when comparison changes (only in preset mode)
  useEffect(() => {
    if (customPresetActive) return; // Avoid stale messaging when custom filters control results
    if (!deals || deals.length === 0) return;

    const suffix = deals.length !== 1 ? "s" : "";

    if (prefs.comparisonMode === "book" && prefs.comparisonBook) {
      const bookOption = comparisonOptions.find(opt => opt.value === `book:${prefs.comparisonBook}`);
      const bookName = bookOption && typeof bookOption.label === "string" ? bookOption.label : prefs.comparisonBook;
      toast.success(`Showing ${deals.length} edge${suffix} vs ${bookName}`, { duration: 3000 });
    } else if (prefs.comparisonMode === "next_best") {
      toast.success(`Showing ${deals.length} edge${suffix} vs Next Best`, { duration: 3000 });
    } else if (prefs.comparisonMode === "average") {
      toast.success(`Showing ${deals.length} edge${suffix} vs Market Average`, { duration: 3000 });
    }
  }, [prefs.comparisonMode, prefs.comparisonBook, deals?.length, comparisonOptions, customPresetActive]);

  // Debounce search query updates (400ms like desktop search)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchQuery !== prefs.searchQuery) {
        onPrefsChange({ ...prefs, searchQuery: localSearchQuery });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearchQuery, prefs, onPrefsChange]);

  // Keep local UI state in sync when preferences load or change
  useEffect(() => {
    setLocalBooks(prefs.selectedBooks);
    setLocalLeagues(prefs.selectedLeagues.length === 0 ? availableLeagues : prefs.selectedLeagues);
    setLocalMarkets(prefs.selectedMarkets);
    setLocalMarketLines(prefs.marketLines);
    setLocalMinImprovement(prefs.minImprovement);
    setLocalMaxOdds(prefs.maxOdds);
    setLocalMinOdds(prefs.minOdds);
    setLocalHideCollegePlayerProps(prefs.hideCollegePlayerProps ?? false);
    setLocalComparisonMode(prefs.comparisonMode ?? 'average');
    setLocalComparisonBook(prefs.comparisonBook ?? null);
    setLocalSearchQuery(prefs.searchQuery || '');
    
    // Derive sports from leagues
    let selectedSports: string[];
    if (prefs.selectedLeagues.length === 0) {
      // Empty array means "all selected" - populate UI with all IDs
      selectedSports = allSports.map(sport => sport.id);
    } else {
      selectedSports = allSports
        .filter(sport => sport.leagues.some(league => prefs.selectedLeagues.includes(league.id)))
        .map(sport => sport.id);
    }
    setLocalSports(selectedSports);
    
    setHasUnsavedChanges(false);
  }, [prefs, allSports]);

  // Track changes to mark as unsaved
  useEffect(() => {
    const marketLinesChanged = JSON.stringify(localMarketLines) !== JSON.stringify(prefs.marketLines);
    const changed =
      localBooks.length !== prefs.selectedBooks.length ||
      localBooks.some(id => !prefs.selectedBooks.includes(id)) ||
      localLeagues.length !== prefs.selectedLeagues.length ||
      localLeagues.some(id => !prefs.selectedLeagues.includes(id)) ||
      localMarkets.length !== prefs.selectedMarkets.length ||
      localMarkets.some(id => !prefs.selectedMarkets.includes(id)) ||
      marketLinesChanged ||
      localMinImprovement !== prefs.minImprovement ||
      localMaxOdds !== prefs.maxOdds ||
      localMinOdds !== prefs.minOdds ||
      localHideCollegePlayerProps !== (prefs.hideCollegePlayerProps ?? false) ||
      localComparisonMode !== (prefs.comparisonMode ?? 'average') ||
      localComparisonBook !== (prefs.comparisonBook ?? null);

    setHasUnsavedChanges(changed);
  }, [localBooks, localLeagues, localMarkets, localMarketLines, localMinImprovement, localMaxOdds, localMinOdds, localHideCollegePlayerProps, prefs]);

  // League display names
  const leagueLabels: Record<string, string> = {
    nba: 'NBA',
    nfl: 'NFL',
    nhl: 'NHL',
    ncaaf: 'NCAAF',
    ncaab: 'NCAAB',
    mlb: 'MLB',
    wnba: 'WNBA',
    soccer_epl: 'EPL',
  };

  // Define which markets have line options and what those options are
  const marketLineOptions: Record<string, { lines: number[]; labels: string[] }> = {
    player_touchdowns: {
      lines: [0.5, 1.5, 2.5, 3.5],
      labels: ['Anytime', '2+', '3+', '4+'],
    },
    player_goals: {
      lines: [0.5, 1.5, 2.5],
      labels: ['Anytime', '2+', '3+'],
    },
    // Add more markets as needed
  };

  // Helper to check if a market has line options
  const hasLineOptions = (market: string): boolean => {
    const normalized = market.toLowerCase();
    return normalized === 'player_touchdowns' || normalized === 'player_goals';
  };

  // Helper to get line options for a market
  const getLineOptions = (market: string): { lines: number[]; labels: string[] } | null => {
    const normalized = market.toLowerCase();
    return marketLineOptions[normalized] || null;
  };

  // Group markets by sport type
  const groupedMarkets = useMemo(() => {
    const groups: Record<string, string[]> = {
      Basketball: [],
      Football: [],
      Soccer: [],
      Hockey: [],
      Baseball: [],
    };

    const leagueSelected = (leagueId: string) => {
      // In this UI, an empty selection array means "all selected"
      if (localLeagues.length === 0) return availableLeagues.includes(leagueId);
      return localLeagues.includes(leagueId);
    };

    const soccerInScope = leagueSelected('soccer_epl');

    availableMarkets.forEach(market => {
      const m = market.toLowerCase();
      const isHockeyPeriodMarket = m.startsWith('p1_') || m.startsWith('p2_') || m.startsWith('p3_');

      // Soccer markets (place before Hockey so shared "goals" markets don't get bucketed as Hockey)
      if (
        soccerInScope &&
        !isHockeyPeriodMarket &&
        (m === 'player_goals' ||
          m === 'total_goals' ||
          m === 'total_goals_odd_even' ||
          m === 'moneyline_3way' ||
          m === 'draw_no_bet' ||
          m === 'both_teams_to_score' ||
          m.includes('corner') ||
          m.includes('card'))
      ) {
        groups.Soccer.push(market);
      }
      // Check for explicit sport markers first (highest priority)
      else if (m.includes('hockey')) {
        groups.Hockey.push(market);
      }
      // Hockey-specific markets (check before basketball to avoid "block" overlap)
      // "shot" catches "Blocked Shots" before basketball's "block" check
      else if (m.includes('goal') || m.includes('save') || m.includes('shot') ||
               m.includes('power_play') || m.includes('puck')) {
        groups.Hockey.push(market);
      }
      // Baseball markets (check before football to catch pitcher/batter stats)
      else if (m.includes('hit') || m.includes('rbi') || m.includes('strikeout') ||
               m.includes('base') || m.includes('home_run') || m.includes('walk') ||
               m.includes('out') || m.includes('pitch') || m.includes('batter') ||
               m.includes('pitcher') || m.includes('earned')) {
        groups.Baseball.push(market);
      }
      // Basketball markets
      else if (m.includes('point') || m.includes('rebound') || m.includes('assist') ||
               m.includes('three') || m.includes('block') || m.includes('steal') ||
               m.includes('pra') || m.includes('double') || m.includes('turnover')) {
        groups.Basketball.push(market);
      }
      // Football markets
      else if (m.includes('pass') || m.includes('rush') || m.includes('reception') ||
               m.includes('receiving') || m.includes('touchdown') || m.includes('yard') ||
               m.includes('sack') || m.includes('interception')) {
        groups.Football.push(market);
      }
      // Default to Football
      else {
        groups.Football.push(market);
      }
    });

    // Remove empty groups
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) {
        delete groups[key];
      }
    });

    return groups;
  }, [availableMarkets, localLeagues, availableLeagues]);

  const toggleBook = (id: string) => {
    if (locked) return;
    // Toggle deselection: if in array, remove it (select it); if not in array, add it (deselect it)
    setLocalBooks(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const toggleSport = (id: string) => {
    if (locked) return;
    setLocalSports(prev => {
      const newSports = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
      
      // When deselecting a sport, also deselect its leagues
      if (prev.includes(id)) {
        // Sport is being deselected - remove its leagues
        const leaguesToRemove = allLeagues
          .filter(league => league.sportId === id)
          .map(league => league.id);
        
        setLocalLeagues(currentLeagues => 
          currentLeagues.filter(leagueId => !leaguesToRemove.includes(leagueId))
        );
      } else {
        // Sport is being selected - add its leagues if they're in availableLeagues
        const leaguesToAdd = allLeagues
          .filter(league => league.sportId === id && availableLeagues.includes(league.id))
          .map(league => league.id);
        
        setLocalLeagues(currentLeagues => {
          const uniqueLeagues = new Set([...currentLeagues, ...leaguesToAdd]);
          return Array.from(uniqueLeagues);
        });
      }
      
      return newSports;
    });
  };

  const toggleLeague = (id: string) => {
    if (locked) return;
    setLocalLeagues(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const toggleMarket = (id: string) => {
    if (locked) return;
    setLocalMarkets(prev => {
      const isCurrentlySelected = prev.length === 0 || prev.includes(id);
      const willBeDeselected = isCurrentlySelected && prev.length !== 0;
      
      // If deselecting a market, also clear its line selections
      if (willBeDeselected) {
        const marketKey = id.toLowerCase().replace(/_/g, '');
        const newMarketLines = { ...localMarketLines };
        delete newMarketLines[marketKey];
        setLocalMarketLines(newMarketLines);
      }
      
      // If empty (all selected), clicking one means "deselect this one, keep all others"
      if (prev.length === 0) {
        return availableMarkets.filter(m => m !== id);
      }
      // Otherwise, normal toggle
      return prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id];
    });
  };

  const emitComparisonChange = useCallback((mode: BestOddsPrefs['comparisonMode'], book: string | null) => {
    const nextPrefs = {
      ...prefs,
      comparisonMode: mode,
      comparisonBook: mode === 'book' ? (book || null) : null,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[BestOddsFilters] Comparison change', {
        comparisonMode: nextPrefs.comparisonMode,
        comparisonBook: nextPrefs.comparisonBook,
      });
    }

    onPrefsChange(nextPrefs);
  }, [prefs, onPrefsChange]);

  const apply = () => {
    if (locked) return;
    // Convert UI state to backend format:
    // If all items are selected in UI, send empty array to backend (meaning "show all")
    const allLeaguesInUI = localLeagues.length === availableLeagues.length;
    const allMarketsInUI = localMarkets.length === availableMarkets.length;
    
    // Filter leagues based on selected sports
    // If specific sports are selected, only include leagues from those sports
    let finalLeagues = localLeagues;
    if (localSports.length > 0 && localSports.length < allSports.length) {
      // User has selected specific sports - filter leagues to only those sports
      finalLeagues = localLeagues.filter(leagueId => {
        const league = allLeagues.find(l => l.id === leagueId);
        return league && localSports.includes(league.sportId);
      });
    }
    
    const nextPrefs = {
      ...prefs,
      selectedBooks: localBooks, // Empty = all selected (deselection logic)
      selectedSports: [], // Not used by backend, only for UI state
      selectedLeagues: allLeaguesInUI ? [] : finalLeagues, // Empty = all selected
      selectedMarkets: allMarketsInUI ? [] : localMarkets, // Empty = all selected
      marketLines: localMarketLines, // Market-specific line selections
      minImprovement: localMinImprovement,
      maxOdds: localMaxOdds,
      minOdds: localMinOdds,
      hideCollegePlayerProps: localHideCollegePlayerProps,
      comparisonMode: localComparisonMode,
      comparisonBook: localComparisonMode === 'book' ? (localComparisonBook || null) : null,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[BestOddsFilters] Apply clicked with comparison prefs:', {
        comparisonMode: nextPrefs.comparisonMode,
        comparisonBook: nextPrefs.comparisonBook,
      });
    }

    onPrefsChange(nextPrefs);
    setOpen(false);
  };

  const reset = () => {
    if (locked) return;
    // Reset to all selected (populate UI with all IDs, backend will receive empty arrays)
    setLocalBooks([]);
    setLocalSports(allSports.map(s => s.id));
    setLocalLeagues(availableLeagues);
    setLocalMarkets(availableMarkets);
    setLocalMarketLines({});
    setLocalMinImprovement(0);
    setLocalMaxOdds(undefined);
    setLocalMinOdds(undefined);
    setLocalHideCollegePlayerProps(false);
    setLocalComparisonMode('average');
    setLocalComparisonBook(null);
    
    onPrefsChange({
      ...prefs,
      selectedBooks: [],
      selectedSports: [],
      selectedLeagues: [],
      selectedMarkets: [],
      marketLines: {},
      minImprovement: 0,
      maxOdds: undefined,
      minOdds: undefined,
      hideCollegePlayerProps: false,
      comparisonMode: 'average',
      comparisonBook: null,
    });
  };

  // Count active filters
  // For books: empty array = all selected (deselection logic - empty means none deselected)
  // Check if filters are actually applied (not just "all selected")
  const allBooksSelected = localBooks.length === 0;
  const allLeaguesSelected = localLeagues.length === availableLeagues.length || localLeagues.length === 0;
  const allMarketsSelected = localMarkets.length === availableMarkets.length || localMarkets.length === 0;

  const activeFiltersCount =
    (!allLeaguesSelected ? 1 : 0) +
    (!allMarketsSelected ? 1 : 0) +
    (!allBooksSelected ? 1 : 0) +
    (localMinImprovement > 0 ? 1 : 0) +
    (localMaxOdds !== undefined ? 1 : 0) +
    (localMinOdds !== undefined ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      {/* Comparison dropdown - only show when NOT in custom mode */}
      {!customPresetActive && (
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Compare vs</span>
          <Combobox
            selected={selectedComparisonOption}
            setSelected={handleComparisonSelect}
            options={comparisonOptions}
            caret={<ChevronDown className="h-3.5 w-3.5 opacity-50" />}
            buttonProps={{
              className: cn(
                "h-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors",
                locked && "opacity-50 cursor-not-allowed"
              ),
              textWrapperClassName: "text-xs font-medium",
            }}
          />
        </div>
      )}

      {/* Refresh Button */}
      {onRefresh && (
        <Tooltip content={isPro ? "Refresh" : "Pro only"}>
          <button
            onClick={onRefresh}
            disabled={refreshing || !isPro}
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors",
              !isPro && "opacity-50 cursor-not-allowed",
              refreshing && "animate-pulse"
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
        </Tooltip>
      )}

    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium transition-colors border",
            "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800",
            "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700",
            activeFiltersCount > 0 && "border-neutral-400 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
          )}
          title="Filters"
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-neutral-700 dark:bg-neutral-500 px-1 text-[10px] font-semibold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-neutral-900 p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
            <SheetTitle className="text-lg font-semibold">Filters & Settings</SheetTitle>
          </SheetHeader>

          {/* Mobile-only: View Options Section */}
          <div className="sm:hidden border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 space-y-4">
            {!customPresetActive && (
              <div>
                <Label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">
                  Compare vs
                </Label>
                <Combobox
                  selected={selectedComparisonOption}
                  setSelected={handleComparisonSelect}
                  options={comparisonOptions}
                  caret={<ChevronDown className="h-4 w-4 opacity-50" />}
                  buttonProps={{
                    className: cn(
                      "h-10 w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 text-neutral-700 dark:text-neutral-200",
                      locked && "opacity-50 cursor-not-allowed"
                    ),
                    textWrapperClassName: "text-sm font-medium",
                  }}
                  matchTriggerWidth
                />
              </div>
            )}

            {customPresetActive && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-700 dark:bg-neutral-600">
                  <Filter className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">Custom Mode</p>
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    {activePresetName || "Custom Filter"}
                  </p>
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 block">
                Search
              </Label>
              <Input
                type="text"
                placeholder="Search player or team..."
                value={localSearchQuery}
                onChange={(e) => {
                  if (locked) return;
                  setLocalSearchQuery(e.target.value);
                }}
                disabled={locked}
                className="w-full h-10 text-sm"
              />
              {locked && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Pro only
                </p>
              )}
            </div>
          </div>

          {locked && (
            <div className="mx-6 mt-4 rounded-lg border border-[var(--tertiary)]/20 bg-gradient-to-br from-[var(--tertiary)]/5 via-transparent to-transparent p-4 dark:border-[var(--tertiary)]/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[var(--tertiary)]" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">Filters are a Pro Feature</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {isLoggedIn ? 'Upgrade to unlock full filtering capabilities' : 'Try free to unlock full filtering capabilities'}
                    </p>
                  </div>
                </div>
                <ButtonLink href="/pricing" variant="pro" className="justify-center text-xs">
                  {isLoggedIn ? 'Upgrade to Pro' : 'Try Free'}
                </ButtonLink>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <Tabs defaultValue="books" className="w-full">
              <TabsList className="filter-tabs grid w-full grid-cols-3">
                <TabsTrigger value="books" className="flex items-center justify-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Sportsbooks</span>
                </TabsTrigger>
                <TabsTrigger value="leagues" className="flex items-center justify-center gap-2">
                  <Target className="h-4 w-4" />
                  <span className="hidden sm:inline">Leagues & Markets</span>
                </TabsTrigger>
                <TabsTrigger value="odds" className="flex items-center justify-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Edge & Odds</span>
                </TabsTrigger>
              </TabsList>

              {/* Sportsbooks Tab */}
              <TabsContent value="books" className="filter-section">
                <div className="filter-section-header flex items-center justify-between">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Choose sportsbooks to include in results</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => !locked && setLocalBooks([])}
                      disabled={locked}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-brand transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={locked ? "Pro only" : ""}
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => !locked && setLocalBooks(allSportsbooks.map(sb => sb.id))}
                      disabled={locked}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={locked ? "Pro only" : ""}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="filter-grid">
                  {allSportsbooks
                    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                    .map((sb) => {
                      // If all selected (empty array), check all; otherwise check if NOT in deselected list
                      const checked = allBooksSelected || !localBooks.includes(sb.id);
                      const count = sportsbookCounts[sb.id] || 0;
                      return (
                        <label
                          key={sb.id}
                          className={`filter-card flex items-center gap-3 rounded-lg border p-3 ${
                            locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-sm'
                          } ${
                            checked
                              ? 'active'
                              : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                          }`}
                          title={locked ? "Pro only" : ""}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleBook(sb.id)} disabled={locked} />
                          {sb.image?.light && (
                            <img src={sb.image.light} alt={sb.name} className="h-6 w-6 object-contain" />
                          )}
                          <span className="text-sm leading-none">
                            {sb.name} {count > 0 && <span className="text-neutral-500 dark:text-neutral-400">({count})</span>}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </TabsContent>

              {/* Leagues & Markets Tab */}
              <TabsContent value="leagues" className="filter-section">
                <div className="filter-section-header flex items-center justify-between">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Filter by sports, leagues, and markets</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (locked) return;
                        // Add all IDs to show all as checked (backend: empty = show all, but UI shows all checked)
                        setLocalSports(allSports.map(s => s.id));
                        setLocalLeagues(allLeagues.map(l => l.id));
                      }}
                      disabled={locked}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-brand transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={locked ? "Pro only" : ""}
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => {
                        if (locked) return;
                        // Empty arrays = no filter (backend shows all, but UI shows none checked)
                        setLocalSports([]);
                        setLocalLeagues([]);
                      }}
                      disabled={locked}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={locked ? "Pro only" : ""}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Sports Selection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Sports</Label>
                  </div>
                  <div className="filter-grid">
                    {allSports.map((sport) => {
                      // Match arb filters: only checked if explicitly in array
                      const checked = localSports.includes(sport.id);
                      return (
                        <label
                          key={sport.id}
                          className={`filter-card flex items-center gap-3 rounded-lg border p-3 ${
                            locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-sm'
                          } ${
                            checked
                              ? 'active'
                              : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                          }`}
                          title={locked ? "Pro only" : ""}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleSport(sport.id)} disabled={locked} />
                          <SportIcon sport={sport.name.toLowerCase()} className="h-5 w-5" />
                          <span className="text-sm leading-none">{sport.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Leagues Selection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Leagues</Label>
                  </div>
                  <div className="filter-grid">
                    {allLeagues.map((league) => {
                      // Match arb filters: only checked if explicitly in array
                      const checked = localLeagues.includes(league.id);
                      const sportSelected = localSports.length === 0 || localSports.includes(league.sportId);
                      const isDisabled = locked || !sportSelected;
                      return (
                        <label
                          key={league.id}
                          className={`filter-card flex items-center gap-3 rounded-lg border p-3 ${
                            isDisabled
                              ? 'opacity-50 cursor-not-allowed'
                              : 'cursor-pointer hover:shadow-sm'
                          } ${
                            checked && !isDisabled
                                ? 'active'
                                : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                          }`}
                          onClick={(e) => {
                            if (isDisabled) e.preventDefault();
                          }}
                          title={locked ? "Pro only" : !sportSelected ? "Select sport first" : ""}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => !isDisabled && toggleLeague(league.id)}
                            disabled={isDisabled}
                          />
                          <SportIcon sport={league.sportId.toLowerCase()} className="h-4 w-4" />
                          <span className="text-sm leading-none">{league.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Markets Selection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Markets</Label>
                  </div>
                  <div className="space-y-4">
                    {Object.entries(groupedMarkets).map(([sportType, markets]) => (
                      <div key={sportType}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 capitalize">
                            {sportType}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (locked) return;
                                // If localMarkets is empty, select all means add all these markets
                                // Otherwise, add these markets to the existing selection
                                setLocalMarkets(prev => {
                                  if (prev.length === 0) {
                                    // Currently showing all, so select just these markets
                                    return [...markets];
                                  } else {
                                    // Add these markets to existing selection
                                    const newSelected = new Set(prev);
                                    markets.forEach(m => newSelected.add(m));
                                    return Array.from(newSelected);
                                  }
                                });
                              }}
                              disabled={locked}
                              className="h-6 rounded-md border border-transparent px-2 text-[10px] font-medium text-brand transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                              title={locked ? "Pro only" : ""}
                            >
                              Select All
                            </button>
                            <button
                              onClick={() => {
                                if (locked) return;
                                // Remove these markets from selection (deselect them)
                                setLocalMarkets(prev => prev.filter(m => !markets.includes(m)));
                              }}
                              disabled={locked}
                              className="h-6 rounded-md border border-transparent px-2 text-[10px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                              title={locked ? "Pro only" : ""}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div className="filter-grid">
                          {markets.map(market => {
                            const checked = allMarketsSelected || localMarkets.includes(market);
                            const hasLines = hasLineOptions(market);
                            const isExpanded = expandedMarkets.has(market);
                            const lineOptions = hasLines ? getLineOptions(market) : null;
                            const marketKey = market.toLowerCase().replace(/_/g, '');
                            const selectedLinesForMarket = localMarketLines[marketKey] || [];
                            
                            return (
                              <div key={market} className="space-y-2">
                                <div className="flex items-center gap-2">
                              <label
                                    className={`filter-card flex-1 flex items-center gap-3 rounded-lg border p-3 ${
                                      locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-sm'
                                    } ${
                                  checked
                                    ? 'active'
                                    : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                                }`}
                                    title={locked ? "Pro only" : ""}
                              >
                                <Checkbox checked={checked} onCheckedChange={() => toggleMarket(market)} disabled={locked} />
                                <span className="text-sm leading-none">{formatMarketLabel(market)}</span>
                              </label>
                                  {hasLines && (
                                    <button
                                      onClick={() => {
                                        if (locked) return;
                                        const newExpanded = new Set(expandedMarkets);
                                        if (isExpanded) {
                                          newExpanded.delete(market);
                                        } else {
                                          newExpanded.add(market);
                                        }
                                        setExpandedMarkets(newExpanded);
                                      }}
                                      disabled={locked}
                                      className="flex h-[52px] w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                                      title={locked ? "Pro only" : "Filter by line"}
                                    >
                                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                  )}
                                </div>
                                
                                {hasLines && isExpanded && lineOptions && (
                                  <div className="space-y-3 rounded-lg border border-neutral-200/60 bg-gradient-to-br from-neutral-50 to-neutral-50/30 p-4 shadow-sm dark:border-neutral-700/60 dark:from-neutral-800/50 dark:to-neutral-800/30">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
                                        Filter by Line
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          if (locked) return;
                                          e.stopPropagation();
                                          const newMarketLines = { ...localMarketLines };
                                          delete newMarketLines[marketKey];
                                          setLocalMarketLines(newMarketLines);
                                        }}
                                        disabled={locked}
                                        className="text-xs font-medium text-neutral-500 transition-colors hover:text-brand dark:text-neutral-400 dark:hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                                        title={locked ? "Pro only" : ""}
                                      >
                                        Reset
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                      {lineOptions.lines.map((line, idx) => {
                                        // If market is not selected, disable all line buttons
                                        const isMarketSelected = checked;
                                        const lineChecked = isMarketSelected && (selectedLinesForMarket.length === 0 || selectedLinesForMarket.includes(line));
                                        const isLineDisabled = locked || !isMarketSelected;
                                        
                                        return (
                                          <button
                                            key={line}
                                            disabled={isLineDisabled}
                                            onClick={() => {
                                              if (locked) return;
                                              // If market is not selected, select it first
                                              if (!isMarketSelected) {
                                                toggleMarket(market);
                                              }
                                              
                                              const newMarketLines = { ...localMarketLines };
                                              const currentLines = newMarketLines[marketKey] || [];
                                              
                                              if (currentLines.length === 0) {
                                                // If all were selected (empty array), start with all lines except this one
                                                newMarketLines[marketKey] = lineOptions.lines.filter(l => l !== line);
                                              } else if (currentLines.includes(line)) {
                                                // Remove this line
                                                newMarketLines[marketKey] = currentLines.filter(l => l !== line);
                                                
                                                // If no lines are selected, deselect the entire market
                                                if (newMarketLines[marketKey].length === 0) {
                                                  delete newMarketLines[marketKey];
                                                  // Deselect the market itself
                                                  toggleMarket(market);
                                                }
                                              } else {
                                                // Add this line
                                                newMarketLines[marketKey] = [...currentLines, line];
                                                // If all lines are now selected, set to empty array
                                                if (newMarketLines[marketKey].length === lineOptions.lines.length) {
                                                  delete newMarketLines[marketKey];
                                                }
                                              }
                                              
                                              setLocalMarketLines(newMarketLines);
                                            }}
                                            className={`group relative flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 transition-all ${
                                              isLineDisabled
                                                ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 opacity-50 dark:border-neutral-700 dark:bg-neutral-900'
                                                : lineChecked
                                                ? 'border-brand bg-brand shadow-sm shadow-brand/20'
                                                : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm dark:border-neutral-600 dark:bg-neutral-800 dark:hover:border-neutral-500'
                                            }`}
                                            title={locked ? "Pro only" : ""}
                                          >
                                            <div className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${
                                              lineChecked 
                                                ? 'border-white bg-white' 
                                                : 'border-neutral-300 dark:border-neutral-500'
                                            }`}>
                                              {lineChecked && (
                                                <svg className="h-3 w-3 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                              )}
                                            </div>
                                            <span className={`text-xs font-semibold transition-colors ${
                                              lineChecked 
                                                ? 'text-white' 
                                                : 'text-neutral-700 dark:text-neutral-300'
                                            }`}>
                                              {lineOptions.labels[idx]}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                                      All lines selected by default. Deselecting all lines will remove this market from results.
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                  <p className="text-xs text-blue-900 dark:text-blue-100">
                    <strong>Tip:</strong> All leagues and markets are selected by default. Uncheck specific ones to narrow your results. Some markets have line filters you can expand.
                  </p>
                </div>
              </TabsContent>

              {/* Edge & Odds Tab */}
              <TabsContent value="odds" className="mt-6 space-y-6">
                {/* College Player Props Toggle */}
                <div className={`flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50 ${locked ? 'opacity-60' : ''}`}>
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Hide College Player Props</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Hide NCAAF and NCAAB player prop markets (for restricted states)
                    </div>
                  </div>
                  <Switch 
                    checked={localHideCollegePlayerProps} 
                    fn={(v: boolean) => !locked && setLocalHideCollegePlayerProps(!!v)} 
                    disabled={locked}
                  />
                </div>

                {/* Hidden Edges Controls */}
                {hiddenCount > 0 && (
                  <>
                    <Separator />
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">Show Hidden Edges</div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            Display {hiddenCount} hidden edge{hiddenCount !== 1 ? 's' : ''} with dimmed styling
                          </div>
                        </div>
                        <Switch 
                          checked={showHidden} 
                          fn={(v: boolean) => onToggleShowHidden?.()} 
                        />
                      </div>

                      <button
                        onClick={() => setIsClearDialogOpen(true)}
                        className="w-full h-10 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        Clear All Hidden Edges ({hiddenCount})
                      </button>

                      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                        <DialogContent className="sm:max-w-md border-neutral-200 bg-white p-0 dark:border-neutral-800 dark:bg-neutral-900">
                          <div className="p-8 text-center">
                            {/* Icon with gradient glow */}
                            <div className="relative mx-auto mb-6 w-fit">
                              <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-red-500/20 via-red-500/30 to-red-600/30 blur-2xl" />
                              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-white shadow-sm dark:border-red-500/30 dark:bg-neutral-900">
                                <Trash2 className="h-8 w-8 text-red-600 dark:text-red-400" />
                              </div>
                            </div>

                            {/* Headline */}
                            <DialogTitle className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white text-center">
                              Clear Hidden Edges
                            </DialogTitle>
                            <p className="mb-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                              Are you sure you want to clear all {hiddenCount} hidden edge{hiddenCount !== 1 ? 's' : ''}? They will reappear in your results immediately.
                            </p>

                            {/* CTA Buttons */}
                            <div className="flex flex-col gap-3">
                              <button
                                onClick={() => {
                                  if (onClearAllHidden) {
                                    onClearAllHidden();
                                    toast.success('All hidden edges cleared');
                                  }
                                  setIsClearDialogOpen(false);
                                }}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md dark:border-red-500 dark:bg-red-500 dark:hover:bg-red-400"
                              >
                                Clear All Edges
                              </button>
                              <button
                                onClick={() => setIsClearDialogOpen(false)}
                                className="w-full rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </>
                )}

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Edge %</Label>
                  <Input
                    type="number"
                    value={localMinImprovement}
                    onChange={(e) => !locked && setLocalMinImprovement(Number(e.target.value))}
                    className="h-10"
                    min="0"
                    step="0.1"
                    disabled={locked}
                    title={locked ? "Pro only" : ""}
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Only show deals with at least this % edge</p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Min Odds</Label>
                    <Input
                      type="number"
                      value={localMinOdds ?? ''}
                      onChange={(e) => {
                        if (locked) return;
                        const val = e.target.value.trim();
                        setLocalMinOdds(val === '' ? undefined : Number(val));
                      }}
                      placeholder="No minimum"
                      className="h-10"
                      min="-1000"
                      step="5"
                      disabled={locked}
                      title={locked ? "Pro only" : ""}
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Filter out odds below this value</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Max Odds</Label>
                    <Input
                      type="number"
                      value={localMaxOdds ?? ''}
                      onChange={(e) => {
                        if (locked) return;
                        const val = e.target.value.trim();
                        setLocalMaxOdds(val === '' ? undefined : Number(val));
                      }}
                      placeholder="No maximum"
                      className="h-10"
                      min="-1000"
                      step="5"
                      disabled={locked}
                      title={locked ? "Pro only" : ""}
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Filter out odds above this value</p>
                  </div>
                </div>

              </TabsContent>
            </Tabs>
          </div>

          {/* Footer with Reset, Cancel, Apply */}
          <div className="filter-footer">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={reset}
                disabled={locked}
                className="h-10 rounded-lg border border-transparent px-4 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                title={locked ? "Pro only" : ""}
              >
                Reset All
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="h-10 rounded-lg border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                >
                  {locked ? 'Close' : 'Cancel'}
                </button>
                <button
                  onClick={apply}
                  disabled={locked}
                  className={`apply-btn h-10 rounded-lg border border-brand bg-brand px-5 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand ${hasUnsavedChanges ? 'active' : ''}`}
                  title={locked ? "Pro only" : ""}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
    </div>
  );
}
