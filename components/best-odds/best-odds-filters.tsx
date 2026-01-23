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
import { formatMarketLabel, SPORT_MARKETS } from "@/lib/data/markets";
import { normalizeSportsbookName } from "@/lib/best-odds-filters";
import type { BestOddsPrefs } from "@/lib/best-odds-schema";
import { Filter, Building2, Target, TrendingUp, ChevronDown, ChevronRight, Lock, RefreshCw, Trash2, Info, Search, Check } from "lucide-react";
import { SportIcon } from "@/components/icons/sport-icons";
import { ButtonLink } from "@/components/button-link";
import { Tooltip } from "@/components/tooltip";
import { cn } from "@/lib/utils";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

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
  // Kelly Criterion settings
  bankroll?: number;
  kellyPercent?: number;
  onBankrollChange?: (value: number) => void;
  onKellyPercentChange?: (value: number) => void;
}

export function BestOddsFilters({
  prefs,
  onPrefsChange,
  availableLeagues = [],
  availableMarkets = [],
  availableSportsbooks = [],
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
  bankroll = 1000,
  kellyPercent = 25,
  onBankrollChange,
  onKellyPercentChange,
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
    prefs.selectedLeagues.length === 0 ? (availableLeagues ?? []) : prefs.selectedLeagues
  );
  const [localMarkets, setLocalMarkets] = useState<string[]>(prefs.selectedMarkets);
  const [localMarketLines, setLocalMarketLines] = useState<Record<string, number[]>>(prefs.marketLines);
  const [localMinImprovement, setLocalMinImprovement] = useState<number>(prefs.minImprovement);
  const [localMaxOdds, setLocalMaxOdds] = useState<number | undefined>(prefs.maxOdds);
  const [localMinOdds, setLocalMinOdds] = useState<number | undefined>(prefs.minOdds);
  const [localHideCollegePlayerProps, setLocalHideCollegePlayerProps] = useState<boolean>(prefs.hideCollegePlayerProps ?? false);
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set());
  const [expandedSportSections, setExpandedSportSections] = useState<Set<string>>(new Set(['Basketball', 'Football'])); // Default open
  const [marketSearchQuery, setMarketSearchQuery] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localComparisonMode, setLocalComparisonMode] = useState<BestOddsPrefs['comparisonMode']>(prefs.comparisonMode ?? 'average');
  const [localComparisonBook, setLocalComparisonBook] = useState<string | null>(prefs.comparisonBook ?? null);
  const [localSearchQuery, setLocalSearchQuery] = useState<string>(prefs.searchQuery || '');
  
  // Kelly Criterion local state - use strings for free typing, convert on blur/apply
  const [localBankrollStr, setLocalBankrollStr] = useState<string>(String(bankroll));
  const [localKellyPercentStr, setLocalKellyPercentStr] = useState<string>(String(kellyPercent));
  
  // Min liquidity local state
  const [localMinLiquidity, setLocalMinLiquidity] = useState<number>(prefs.minLiquidity ?? 0);

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
    setLocalLeagues(prefs.selectedLeagues.length === 0 ? (availableLeagues ?? []) : prefs.selectedLeagues);
    setLocalMarkets(prefs.selectedMarkets);
    setLocalMarketLines(prefs.marketLines);
    setLocalMinImprovement(prefs.minImprovement);
    setLocalMaxOdds(prefs.maxOdds);
    setLocalMinOdds(prefs.minOdds);
    setLocalHideCollegePlayerProps(prefs.hideCollegePlayerProps ?? false);
    setLocalComparisonMode(prefs.comparisonMode ?? 'average');
    setLocalComparisonBook(prefs.comparisonBook ?? null);
    setLocalSearchQuery(prefs.searchQuery || '');
    setLocalMinLiquidity(prefs.minLiquidity ?? 0);
    
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

  // Keep Kelly settings in sync with props
  useEffect(() => {
    setLocalBankrollStr(String(bankroll));
    setLocalKellyPercentStr(String(kellyPercent));
  }, [bankroll, kellyPercent]);

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

  // Group markets by sport type using SPORT_MARKETS data for accurate categorization
  const groupedMarkets = useMemo(() => {
    const groups: Record<string, string[]> = {
      Basketball: [],
      Football: [],
      Soccer: [],
      Hockey: [],
      Baseball: [],
    };

    // Build lookup maps from SPORT_MARKETS for accurate categorization
    const basketballMarkets = new Set<string>();
    const footballMarkets = new Set<string>();
    const hockeyMarkets = new Set<string>();
    const baseballMarkets = new Set<string>();
    const soccerMarkets = new Set<string>();

    // Basketball markets (NBA, NCAAB, WNBA)
    ['basketball_nba', 'basketball_ncaab', 'basketball_wnba'].forEach(key => {
      (SPORT_MARKETS[key] || []).forEach(m => basketballMarkets.add(m.apiKey));
    });
    
    // Football markets (NFL, NCAAF)
    ['football_nfl', 'football_ncaaf'].forEach(key => {
      (SPORT_MARKETS[key] || []).forEach(m => footballMarkets.add(m.apiKey));
    });
    
    // Hockey markets (NHL)
    (SPORT_MARKETS['icehockey_nhl'] || []).forEach(m => hockeyMarkets.add(m.apiKey));
    
    // Baseball markets (MLB)
    (SPORT_MARKETS['baseball_mlb'] || []).forEach(m => baseballMarkets.add(m.apiKey));
    
    // Soccer markets (EPL)
    (SPORT_MARKETS['soccer_epl'] || []).forEach(m => soccerMarkets.add(m.apiKey));

    const leagueSelected = (leagueId: string) => {
      if (localLeagues.length === 0) return availableLeagues?.includes(leagueId) ?? false;
      return localLeagues.includes(leagueId);
    };

    const soccerInScope = leagueSelected('soccer_epl');
    const hockeyInScope = leagueSelected('nhl');

    (availableMarkets || []).forEach(market => {
      const m = market.toLowerCase();
      
      // Check SPORT_MARKETS first for accurate categorization
      if (soccerMarkets.has(m) && soccerInScope) {
        groups.Soccer.push(market);
      } else if (hockeyMarkets.has(m)) {
        groups.Hockey.push(market);
      } else if (baseballMarkets.has(m)) {
        groups.Baseball.push(market);
      } else if (basketballMarkets.has(m)) {
        groups.Basketball.push(market);
      } else if (footballMarkets.has(m)) {
        groups.Football.push(market);
      }
      // Fallback: Use keyword matching for markets not in SPORT_MARKETS
      else {
        const isHockeyPeriodMarket = m.startsWith('p1_') || m.startsWith('p2_') || m.startsWith('p3_') || 
                                      m.startsWith('1st_period') || m.startsWith('2nd_period') || m.startsWith('3rd_period');
        
        // Hockey-specific keywords (period markets, puck, saves)
        if (isHockeyPeriodMarket || m.includes('puck') || m.includes('power_play')) {
        groups.Hockey.push(market);
      }
        // Baseball-specific keywords
        else if (m.includes('batter') || m.includes('pitcher') || m.includes('rbi') || 
                 m.includes('strikeout') || m.includes('home_run') || m.includes('earned_run')) {
        groups.Baseball.push(market);
      }
        // Basketball-specific keywords
        else if (m.includes('basket') || m.includes('pra') || m.includes('player_pr') || 
                 m.includes('player_pa') || m.includes('player_ra') || m.includes('player_bs') ||
                 m.includes('double_double') || m.includes('triple_double') || m.includes('fgm')) {
        groups.Basketball.push(market);
      }
        // Football-specific keywords
        else if (m.includes('touchdown') || m.includes('passing') || m.includes('rushing') || 
                 m.includes('receiving') || m.includes('sack') || m.includes('field_goal')) {
        groups.Football.push(market);
      }
        // Shared keywords - use context
        else if (m.includes('goal') || m.includes('save') || m.includes('shot')) {
          // These are typically hockey unless soccer is in scope and no hockey period prefix
          if (soccerInScope && !hockeyInScope) {
            groups.Soccer.push(market);
          } else {
            groups.Hockey.push(market);
          }
        }
        else if (m.includes('point') || m.includes('rebound') || m.includes('assist') || 
                 m.includes('block') || m.includes('steal') || m.includes('turnover')) {
          groups.Basketball.push(market);
        }
        // Default to the first available group
      else {
          if (groups.Basketball.length >= 0) groups.Basketball.push(market);
          else if (groups.Football.length >= 0) groups.Football.push(market);
          else groups.Hockey.push(market);
        }
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
          .filter(league => league.sportId === id && availableLeagues?.includes(league.id))
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
        return (availableMarkets ?? []).filter(m => m !== id);
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
    const allLeaguesInUI = localLeagues.length === (availableLeagues?.length ?? 0);
    const allMarketsInUI = localMarkets.length === (availableMarkets?.length ?? 0);
    
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
      minLiquidity: localMinLiquidity,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[BestOddsFilters] Apply clicked with comparison prefs:', {
        comparisonMode: nextPrefs.comparisonMode,
        comparisonBook: nextPrefs.comparisonBook,
      });
    }

    onPrefsChange(nextPrefs);
    
    // Save Kelly Criterion settings separately (they're EV-specific prefs)
    const parsedBankroll = Math.max(0, Number(localBankrollStr) || 0);
    const parsedKellyPercent = Math.max(1, Math.min(100, Number(localKellyPercentStr) || 25));
    
    if (onBankrollChange && parsedBankroll !== bankroll) {
      onBankrollChange(parsedBankroll);
    }
    if (onKellyPercentChange && parsedKellyPercent !== kellyPercent) {
      onKellyPercentChange(parsedKellyPercent);
    }
    
    setOpen(false);
  };

  const reset = () => {
    if (locked) return;
    // Reset to all selected (populate UI with all IDs, backend will receive empty arrays)
    setLocalBooks([]);
    setLocalSports(allSports.map(s => s.id));
    setLocalLeagues(availableLeagues ?? []);
    setLocalMarkets(availableMarkets ?? []);
    setLocalMarketLines({});
    setLocalMinImprovement(0);
    setLocalMaxOdds(undefined);
    setLocalMinOdds(undefined);
    setLocalHideCollegePlayerProps(false);
    setLocalComparisonMode('average');
    setLocalComparisonBook(null);
    // Reset Kelly settings to defaults
    setLocalBankrollStr("1000");
    setLocalKellyPercentStr("25");
    setLocalMinLiquidity(0);
    
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
      minLiquidity: 0,
    });
  };

  // Count active filters
  // For books: empty array = all selected (deselection logic - empty means none deselected)
  // Check if filters are actually applied (not just "all selected")
  const allBooksSelected = localBooks.length === 0;
  const allLeaguesSelected = localLeagues.length === (availableLeagues?.length ?? 0) || localLeagues.length === 0;
  const allMarketsSelected = localMarkets.length === (availableMarkets?.length ?? 0) || localMarkets.length === 0;

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
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-neutral-950 p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-neutral-200 px-4 sm:px-6 py-3 sm:py-4 dark:border-neutral-800">
            <SheetTitle className="text-base sm:text-lg font-semibold">Filters</SheetTitle>
          </SheetHeader>

          {/* Mobile-only: View Options Section */}
          <div className="sm:hidden border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 space-y-3">
            {!customPresetActive && (
              <div>
                <Label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 block uppercase tracking-wider">
                  Compare vs
                </Label>
                <Combobox
                  selected={selectedComparisonOption}
                  setSelected={handleComparisonSelect}
                  options={comparisonOptions}
                  caret={<ChevronDown className="h-3.5 w-3.5 opacity-50" />}
                  buttonProps={{
                    className: cn(
                      "h-9 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-3 text-neutral-700 dark:text-neutral-200",
                      locked && "opacity-50 cursor-not-allowed"
                    ),
                    textWrapperClassName: "text-sm font-medium",
                  }}
                  matchTriggerWidth
                />
              </div>
            )}

            {customPresetActive && (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-neutral-700 dark:bg-neutral-700">
                  <Filter className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Custom Mode</p>
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                    {activePresetName || "Custom Filter"}
                  </p>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 block uppercase tracking-wider">
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
                className="w-full h-9 text-sm bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
              />
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

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            <Tabs defaultValue="books" className="w-full">
              <TabsList className="filter-tabs grid w-full grid-cols-3 h-10 sm:h-11 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl">
                <TabsTrigger value="books" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm">
                  <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Sportsbooks</span>
                </TabsTrigger>
                <TabsTrigger value="leagues" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm">
                  <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Leagues</span>
                </TabsTrigger>
                <TabsTrigger value="odds" className="flex items-center justify-center gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </TabsTrigger>
              </TabsList>

              {/* Sportsbooks Tab */}
              <TabsContent value="books" className="filter-section">
                <div className="filter-section-header flex items-center justify-between py-3 sm:py-4">
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">Select books to include</p>
                  <div className="flex gap-1.5 sm:gap-2">
                    <button
                      onClick={() => !locked && setLocalBooks([])}
                      disabled={locked}
                      className="h-7 sm:h-8 rounded-lg border border-transparent px-2 sm:px-3 text-[10px] sm:text-xs font-semibold text-brand transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={locked ? "Pro only" : ""}
                    >
                      All
                    </button>
                    <button
                      onClick={() => !locked && setLocalBooks(allSportsbooks.map(sb => sb.id))}
                      disabled={locked}
                      className="h-7 sm:h-8 rounded-lg border border-transparent px-2 sm:px-3 text-[10px] sm:text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={locked ? "Pro only" : ""}
                    >
                      None
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

                {/* Markets Selection - Modern Accordion Design */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Markets</Label>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {allMarketsSelected ? 'All' : localMarkets.length} selected
                    </span>
                  </div>
                  
                  {/* Market Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search markets..."
                      value={marketSearchQuery}
                      onChange={(e) => setMarketSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-neutral-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-brand"
                    />
                    {marketSearchQuery && (
                      <button
                        onClick={() => setMarketSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  {/* Custom Mode Warning */}
                  {customPresetActive && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/60">
                      <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                          Custom Mode Active
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          Market filters are controlled by your active custom model.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Sport Accordions */}
                  <div className={cn("space-y-2", customPresetActive && "opacity-50 pointer-events-none")}>
                    {Object.entries(groupedMarkets).map(([sportType, markets]) => {
                      // Filter markets by search query
                      const filteredMarkets = marketSearchQuery 
                        ? markets.filter(m => formatMarketLabel(m).toLowerCase().includes(marketSearchQuery.toLowerCase()))
                        : markets;
                      
                      if (filteredMarkets.length === 0) return null;
                      
                      const isExpanded = expandedSportSections.has(sportType);
                      const selectedCount = filteredMarkets.filter(m => allMarketsSelected || localMarkets.includes(m)).length;
                      const allSelected = selectedCount === filteredMarkets.length;
                      
                      // Sport icon mapping
                      const sportIconMap: Record<string, string> = {
                        'Basketball': 'basketball',
                        'Football': 'football',
                        'Hockey': 'icehockey',
                        'Baseball': 'baseball',
                        'Soccer': 'soccer',
                      };
                      
                      return (
                        <div 
                          key={sportType}
                          className="rounded-xl border border-neutral-200 bg-white overflow-hidden dark:border-neutral-800 dark:bg-neutral-900/50"
                        >
                          {/* Accordion Header */}
                          <button
                            type="button"
                            onClick={() => {
                              const newExpanded = new Set(expandedSportSections);
                              if (isExpanded) {
                                newExpanded.delete(sportType);
                              } else {
                                newExpanded.add(sportType);
                              }
                              setExpandedSportSections(newExpanded);
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                                <SportIcon sport={sportIconMap[sportType] || 'football'} className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                              </div>
                              <div className="text-left">
                                <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                            {sportType}
                          </div>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {filteredMarkets.length} market{filteredMarkets.length !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {/* Selection Badge */}
                              <div className={cn(
                                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                                allSelected 
                                  ? "bg-brand/10 text-brand dark:bg-brand/20" 
                                  : selectedCount > 0 
                                    ? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                                    : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
                              )}>
                                {allSelected ? (
                                  <>
                                    <Check className="h-3 w-3" />
                                    All
                                  </>
                                ) : (
                                  `${selectedCount}/${filteredMarkets.length}`
                                )}
                              </div>
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDown className="h-4 w-4 text-neutral-400" />
                              </motion.div>
                            </div>
                          </button>
                          
                          {/* Accordion Content */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                <div className="border-t border-neutral-100 dark:border-neutral-800">
                                  {/* Quick Actions */}
                                  <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50/50 dark:bg-neutral-800/30">
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                      Quick actions
                                    </span>
                          <div className="flex gap-2">
                            <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                if (locked) return;
                                setLocalMarkets(prev => {
                                  if (prev.length === 0) {
                                              return [...filteredMarkets];
                                  } else {
                                    const newSelected = new Set(prev);
                                              filteredMarkets.forEach(m => newSelected.add(m));
                                    return Array.from(newSelected);
                                  }
                                });
                              }}
                              disabled={locked}
                                        className="rounded-md px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Select All
                            </button>
                            <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                if (locked) return;
                                          setLocalMarkets(prev => prev.filter(m => !filteredMarkets.includes(m)));
                              }}
                              disabled={locked}
                                        className="rounded-md px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                                  
                                  {/* Markets Grid */}
                                  <div className="p-3 max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-200 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {filteredMarkets.map(market => {
                            const checked = allMarketsSelected || localMarkets.includes(market);
                            const hasLines = hasLineOptions(market);
                                        const isMarketExpanded = expandedMarkets.has(market);
                            const lineOptions = hasLines ? getLineOptions(market) : null;
                            const marketKey = market.toLowerCase().replace(/_/g, '');
                            const selectedLinesForMarket = localMarketLines[marketKey] || [];
                            
                            return (
                              <div key={market} className="space-y-2">
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => toggleMarket(market)}
                                                disabled={locked}
                                                className={cn(
                                                  "flex-1 flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                                                  locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                                  checked
                                                    ? "border-brand/30 bg-brand/5 dark:border-brand/40 dark:bg-brand/10"
                                                    : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600"
                                                )}
                                              >
                                                <div className={cn(
                                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                                                  checked 
                                                    ? "border-brand bg-brand" 
                                                    : "border-neutral-300 dark:border-neutral-600"
                                                )}>
                                                  {checked && (
                                                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                                                  )}
                                                </div>
                                                <span className={cn(
                                                  "text-sm font-medium truncate",
                                                  checked 
                                                    ? "text-neutral-900 dark:text-white" 
                                                    : "text-neutral-600 dark:text-neutral-400"
                                                )}>
                                                  {formatMarketLabel(market)}
                                                </span>
                                              </button>
                                  {hasLines && (
                                    <button
                                                  type="button"
                                      onClick={() => {
                                        if (locked) return;
                                        const newExpanded = new Set(expandedMarkets);
                                                    if (isMarketExpanded) {
                                          newExpanded.delete(market);
                                        } else {
                                          newExpanded.add(market);
                                        }
                                        setExpandedMarkets(newExpanded);
                                      }}
                                      disabled={locked}
                                                  className={cn(
                                                    "flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                                                    isMarketExpanded
                                                      ? "border-brand/30 bg-brand/5 text-brand dark:border-brand/40 dark:bg-brand/10"
                                                      : "border-neutral-200 bg-white text-neutral-400 hover:text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:text-neutral-300",
                                                    locked && "cursor-not-allowed opacity-50"
                                                  )}
                                                  title="Filter by line"
                                    >
                                                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isMarketExpanded && "rotate-180")} />
                                    </button>
                                  )}
                                </div>
                                
                                            {/* Line Options */}
                                            <AnimatePresence>
                                              {hasLines && isMarketExpanded && lineOptions && (
                                                <motion.div
                                                  initial={{ height: 0, opacity: 0 }}
                                                  animate={{ height: "auto", opacity: 1 }}
                                                  exit={{ height: 0, opacity: 0 }}
                                                  transition={{ duration: 0.15 }}
                                                  className="overflow-hidden"
                                                >
                                                  <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/30">
                                                    <div className="flex items-center justify-between mb-2">
                                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                                                        Lines
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newMarketLines = { ...localMarketLines };
                                          delete newMarketLines[marketKey];
                                          setLocalMarketLines(newMarketLines);
                                        }}
                                        disabled={locked}
                                                        className="text-[10px] font-medium text-neutral-400 hover:text-brand transition-colors"
                                      >
                                        Reset
                                      </button>
                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                      {lineOptions.lines.map((line, idx) => {
                                        const isMarketSelected = checked;
                                        const lineChecked = isMarketSelected && (selectedLinesForMarket.length === 0 || selectedLinesForMarket.includes(line));
                                        const isLineDisabled = locked || !isMarketSelected;
                                        
                                        return (
                                          <button
                                            key={line}
                                            disabled={isLineDisabled}
                                            onClick={() => {
                                              if (locked) return;
                                              if (!isMarketSelected) {
                                                toggleMarket(market);
                                              }
                                              const newMarketLines = { ...localMarketLines };
                                              const currentLines = newMarketLines[marketKey] || [];
                                              if (currentLines.length === 0) {
                                                newMarketLines[marketKey] = lineOptions.lines.filter(l => l !== line);
                                              } else if (currentLines.includes(line)) {
                                                newMarketLines[marketKey] = currentLines.filter(l => l !== line);
                                                if (newMarketLines[marketKey].length === 0) {
                                                  delete newMarketLines[marketKey];
                                                  toggleMarket(market);
                                                }
                                              } else {
                                                newMarketLines[marketKey] = [...currentLines, line];
                                                if (newMarketLines[marketKey].length === lineOptions.lines.length) {
                                                  delete newMarketLines[marketKey];
                                                }
                                              }
                                              setLocalMarketLines(newMarketLines);
                                            }}
                                                            className={cn(
                                                              "rounded-md px-2 py-1 text-xs font-medium transition-all",
                                                              isLineDisabled && "cursor-not-allowed opacity-40",
                                              lineChecked 
                                                                ? "bg-brand text-white shadow-sm"
                                                                : "bg-white text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                                                            )}
                                                          >
                                              {lineOptions.labels[idx]}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                                </motion.div>
                                )}
                                            </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                  </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              {/* Edge & Odds Tab */}
              <TabsContent value="odds" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
                {/* College Player Props Toggle */}
                <div className={`flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4 dark:border-neutral-800 dark:bg-neutral-900 ${locked ? 'opacity-60' : ''}`}>
                  <div className="space-y-0.5 flex-1 mr-3">
                    <div className="text-sm font-semibold">Hide College Props</div>
                    <div className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">
                      For restricted states
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
                    
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4 dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="space-y-0.5 flex-1 mr-3">
                          <div className="text-sm font-semibold">Show Hidden ({hiddenCount})</div>
                          <div className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">
                            Display with dimmed styling
                          </div>
                        </div>
                        <Switch 
                          checked={showHidden} 
                          fn={(v: boolean) => onToggleShowHidden?.()} 
                        />
                      </div>

                      <button
                        onClick={() => setIsClearDialogOpen(true)}
                        className="w-full h-9 sm:h-10 rounded-xl border border-red-200 bg-red-50 px-3 text-xs sm:text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40"
                      >
                        Clear Hidden Edges
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

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Min Edge %</Label>
                  <Input
                    type="number"
                    value={localMinImprovement}
                    onChange={(e) => !locked && setLocalMinImprovement(Number(e.target.value))}
                    className="h-9 sm:h-10 text-sm bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                    min="0"
                    step="0.1"
                    disabled={locked}
                    title={locked ? "Pro only" : ""}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Min Odds</Label>
                    <Input
                      type="number"
                      value={localMinOdds ?? ''}
                      onChange={(e) => {
                        if (locked) return;
                        const val = e.target.value.trim();
                        setLocalMinOdds(val === '' ? undefined : Number(val));
                      }}
                      placeholder="-∞"
                      className="h-9 sm:h-10 text-sm bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                      min="-1000"
                      step="5"
                      disabled={locked}
                      title={locked ? "Pro only" : ""}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Max Odds</Label>
                    <Input
                      type="number"
                      value={localMaxOdds ?? ''}
                      onChange={(e) => {
                        if (locked) return;
                        const val = e.target.value.trim();
                        setLocalMaxOdds(val === '' ? undefined : Number(val));
                      }}
                      placeholder="+∞"
                      className="h-9 sm:h-10 text-sm bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                      min="-1000"
                      step="5"
                      disabled={locked}
                      title={locked ? "Pro only" : ""}
                    />
                  </div>
                </div>

                <Separator />

                {/* Kelly Criterion Settings */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">Kelly Criterion</h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Configure bet sizing recommendations</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Bankroll ($)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={localBankrollStr}
                        onChange={(e) => {
                          if (locked) return;
                          // Allow only numbers and empty string
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setLocalBankrollStr(val);
                          setHasUnsavedChanges(true);
                        }}
                        onBlur={() => {
                          // Normalize on blur - ensure valid value
                          const num = Math.max(0, Number(localBankrollStr) || 0);
                          setLocalBankrollStr(String(num));
                        }}
                        placeholder="1000"
                        className="h-10"
                        disabled={locked}
                        title={locked ? "Pro only" : ""}
                      />
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Your total betting bankroll</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Kelly Fraction (%)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={localKellyPercentStr}
                        onChange={(e) => {
                          if (locked) return;
                          // Allow only numbers and empty string
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setLocalKellyPercentStr(val);
                          setHasUnsavedChanges(true);
                        }}
                        onBlur={() => {
                          // Normalize on blur - clamp to 1-100
                          const num = Number(localKellyPercentStr) || 25;
                          const clamped = Math.max(1, Math.min(100, num));
                          setLocalKellyPercentStr(String(clamped));
                        }}
                        placeholder="25"
                        className="h-10"
                        disabled={locked}
                        title={locked ? "Pro only" : ""}
                      />
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {(() => {
                          const val = Number(localKellyPercentStr) || 25;
                          return val <= 25 ? 'Quarter Kelly (conservative)' : 
                                 val <= 50 ? 'Half Kelly (moderate)' : 
                                 val <= 75 ? 'Three-quarter Kelly' : 'Full Kelly (aggressive)';
                        })()}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      <strong>Tip:</strong> Quarter Kelly (25%) is recommended for most bettors. It reduces volatility while still capturing most of the long-term growth.
                    </p>
                  </div>
                </div>

                {/* Min Liquidity Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                    <h4 className="text-sm font-semibold">Minimum Liquidity</h4>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Filter out opportunities where the best book&apos;s max stake is below your minimum threshold.
                    This setting syncs across all tools (Edge Finder, Positive EV, Arbitrage).
                  </p>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Min Max Stake</Label>
                    <select
                      value={localMinLiquidity}
                      onChange={(e) => {
                        if (locked) return;
                        setLocalMinLiquidity(Number(e.target.value));
                        setHasUnsavedChanges(true);
                      }}
                      disabled={locked}
                      className="w-full px-3 py-2.5 rounded-xl text-sm font-medium bg-neutral-50 dark:bg-neutral-800/50 border-0 ring-1 ring-neutral-200 dark:ring-neutral-700 focus:ring-2 focus:ring-brand transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                      title={locked ? "Pro only" : ""}
                    >
                      <option value={0}>No minimum</option>
                      <option value={25}>$25 minimum</option>
                      <option value={50}>$50 minimum</option>
                      <option value={100}>$100 minimum</option>
                      <option value={250}>$250 minimum</option>
                      <option value={500}>$500 minimum</option>
                      <option value={1000}>$1,000 minimum</option>
                      <option value={2500}>$2,500 minimum</option>
                      <option value={5000}>$5,000 minimum</option>
                    </select>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Only shows opportunities where the best book offers at least this max stake
                    </p>
                  </div>
                </div>

              </TabsContent>
            </Tabs>
          </div>

          {/* Footer with Reset, Cancel, Apply */}
          <div className="filter-footer px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <button
                onClick={reset}
                disabled={locked}
                className="h-9 sm:h-10 rounded-xl border border-transparent px-3 sm:px-4 text-xs sm:text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                title={locked ? "Pro only" : ""}
              >
                Reset
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="h-9 sm:h-10 rounded-xl border border-neutral-200 bg-white px-4 sm:px-5 text-xs sm:text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={apply}
                  disabled={locked}
                  className={`apply-btn h-9 sm:h-10 rounded-xl border border-brand bg-brand px-4 sm:px-5 text-xs sm:text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand ${hasUnsavedChanges ? 'active' : ''}`}
                  title={locked ? "Pro only" : ""}
                >
                  Apply
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
