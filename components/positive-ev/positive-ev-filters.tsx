"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import { formatMarketLabel, SPORT_MARKETS } from "@/lib/data/markets";
import { Filter, Building2, Target, TrendingUp, Lock, Percent, Eye, EyeOff, ChevronDown, ChevronRight, Search, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SportIcon } from "@/components/icons/sport-icons";
import { ButtonLink } from "@/components/button-link";
import { cn } from "@/lib/utils";
import type { SharpPreset, DevigMethod } from "@/lib/ev/types";
import { SHARP_PRESETS, DEVIG_METHODS } from "@/lib/ev/constants";

interface PositiveEVFiltersProps {
  // Current filter values
  selectedBooks: string[];
  selectedSports: string[];
  selectedMarkets: string[];
  sharpPreset: SharpPreset;
  devigMethods: DevigMethod[];
  evCase: "worst" | "best";
  minEv: number;
  maxEv: number | undefined;
  mode: "pregame" | "live" | "all";
  minBooksPerSide: number;
  minLiquidity: number;
  showHidden: boolean;
  hiddenCount: number;
  bankroll: number;
  kellyPercent: number;
  
  // Callbacks
  onFiltersChange: (filters: {
    selectedBooks?: string[];
    selectedSports?: string[];
    selectedMarkets?: string[];
    sharpPreset?: SharpPreset;
    devigMethods?: DevigMethod[];
    evCase?: "worst" | "best";
    minEv?: number;
    maxEv?: number | undefined;
    mode?: "pregame" | "live" | "all";
    minBooksPerSide?: number;
    minLiquidity?: number;
    showHidden?: boolean;
  }) => void;
  onBankrollChange?: (value: number) => void;
  onKellyPercentChange?: (value: number) => void;
  
  // Available options
  availableSports: string[];
  availableMarkets: string[];
  /** Maps market key -> sport keys from API (e.g. { player_assists: ["nba", "nhl"] }) */
  marketSportsMap?: Record<string, string[]>;
  
  // State
  locked?: boolean;
  isLoggedIn?: boolean;
  isPro?: boolean;
  
  // For counts
  opportunities?: Array<{ book: { bookId: string } }>;
}

const MIN_EV_OPTIONS = [0, 0.5, 1, 2, 3, 5, 10];
const MAX_EV_OPTIONS = [5, 10, 15, 20, 25, 50, 100];

const SPORT_LABELS: Record<string, string> = {
  nba: "NBA",
  nfl: "NFL",
  ncaaf: "NCAAF",
  ncaab: "NCAAB",
  nhl: "NHL",
  mlb: "MLB",
  ncaabaseball: "NCAA Baseball",
  wnba: "WNBA",
  soccer_epl: "EPL",
  soccer_laliga: "LaLiga",
  soccer_mls: "MLS",
  soccer_ucl: "UCL",
  soccer_uel: "UEL",
  tennis_atp: "ATP",
  tennis_challenger: "Challenger",
  tennis_itf_men: "ITF Men",
  tennis_itf_women: "ITF Women",
  tennis_utr_men: "UTR Men",
  tennis_utr_women: "UTR Women",
  tennis_wta: "WTA",
  ufc: "UFC",
};

export function PositiveEVFilters({
  selectedBooks,
  selectedSports,
  selectedMarkets,
  sharpPreset,
  devigMethods,
  evCase,
  minEv,
  maxEv,
  mode,
  minBooksPerSide,
  minLiquidity,
  showHidden,
  hiddenCount,
  bankroll,
  kellyPercent,
  onFiltersChange,
  onBankrollChange,
  onKellyPercentChange,
  availableSports,
  availableMarkets,
  marketSportsMap,
  locked = false,
  isLoggedIn = false,
  isPro = false,
  opportunities = [],
}: PositiveEVFiltersProps) {
  const allSportsbooks = useMemo(() => getAllActiveSportsbooks(), []);
  const [open, setOpen] = useState(false);
  const [expandedSportSections, setExpandedSportSections] = useState<Set<string>>(new Set(['Basketball', 'Football']));
  const [marketSearchQuery, setMarketSearchQuery] = useState<string>('');
  
  // Local state for uncommitted changes
  const [localBooks, setLocalBooks] = useState<string[]>(selectedBooks);
  const [localSports, setLocalSports] = useState<string[]>(selectedSports);
  const [localMarkets, setLocalMarkets] = useState<string[]>(selectedMarkets);
  const [localSharpPreset, setLocalSharpPreset] = useState<SharpPreset>(sharpPreset);
  const [localDevigMethods, setLocalDevigMethods] = useState<DevigMethod[]>(devigMethods);
  const [localEvCase, setLocalEvCase] = useState<"worst" | "best">(evCase);
  const [localMinEv, setLocalMinEv] = useState(minEv);
  const [localMaxEv, setLocalMaxEv] = useState<number | undefined>(maxEv);
  const [localMode, setLocalMode] = useState(mode);
  const [localMinBooksPerSide, setLocalMinBooksPerSide] = useState(minBooksPerSide);
  const [localMinLiquidity, setLocalMinLiquidity] = useState(minLiquidity);
  const [localBankroll, setLocalBankroll] = useState(bankroll);
  const [localKellyPercent, setLocalKellyPercent] = useState(kellyPercent);

  // Normalize composite market keys (e.g., "ncaab:total_points") for mobile display/toggles
  const flattenMarkets = useCallback((markets: string[]) => {
    if (markets.length === 0) return [];
    const unique = new Set<string>();
    markets.forEach((market) => {
      const parts = market.split(":");
      unique.add(parts.length > 1 ? parts[1] : market);
    });
    return Array.from(unique);
  }, []);

  const displaySelectedMarkets = useMemo(
    () => flattenMarkets(localMarkets),
    [localMarkets, flattenMarkets]
  );
  
  // Sync local state with props
  useEffect(() => {
    setLocalBooks(selectedBooks);
    setLocalSports(selectedSports);
    setLocalMarkets(selectedMarkets);
    setLocalSharpPreset(sharpPreset);
    setLocalDevigMethods(devigMethods);
    setLocalEvCase(evCase);
    setLocalMinEv(minEv);
    setLocalMaxEv(maxEv);
    setLocalMode(mode);
    setLocalMinBooksPerSide(minBooksPerSide);
    setLocalMinLiquidity(minLiquidity);
  }, [selectedBooks, selectedSports, selectedMarkets, sharpPreset, devigMethods, evCase, minEv, maxEv, mode, minBooksPerSide, minLiquidity]);

  useEffect(() => {
    setLocalBankroll(bankroll);
    setLocalKellyPercent(kellyPercent);
  }, [bankroll, kellyPercent]);
  
  // Calculate sportsbook counts from opportunities
  const sportsbookCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    opportunities.forEach((opp) => {
      const bookId = opp.book.bookId;
      counts[bookId] = (counts[bookId] || 0) + 1;
    });
    return counts;
  }, [opportunities]);
  
  // Map API sport keys to display group names
  const SPORT_KEY_TO_GROUP: Record<string, string> = {
    nba: 'Basketball',
    ncaab: 'Basketball',
    ncaaf: 'Football',
    nfl: 'Football',
    nhl: 'Hockey',
    mlb: 'Baseball',
    ncaabaseball: 'Baseball',
    wnba: 'Basketball',
    soccer_epl: 'Soccer',
    soccer_laliga: 'Soccer',
    soccer_mls: 'Soccer',
    soccer_ucl: 'Soccer',
    soccer_uel: 'Soccer',
    tennis_atp: 'Tennis',
    tennis_challenger: 'Tennis',
    tennis_itf_men: 'Tennis',
    tennis_itf_women: 'Tennis',
    tennis_utr_men: 'Tennis',
    tennis_utr_women: 'Tennis',
    tennis_wta: 'Tennis',
    ufc: 'MMA',
  };

  // Group markets by sport - use API-provided sport data when available for exact parity with desktop
  const groupedMarkets = useMemo(() => {
    const groups: Record<string, string[]> = {
      Basketball: [],
      Football: [],
      Hockey: [],
      Baseball: [],
      Soccer: [],
      Tennis: [],
      MMA: [],
    };
    const added = new Set<string>(); // Track group:market to prevent duplicates
    
    if (marketSportsMap && Object.keys(marketSportsMap).length > 0) {
      // Use API-provided sport associations (matches desktop behavior exactly)
      availableMarkets.forEach((market) => {
        const sports = marketSportsMap[market] || marketSportsMap[market.toLowerCase()];
        if (sports && sports.length > 0) {
          sports.forEach((sport) => {
            const group = SPORT_KEY_TO_GROUP[sport];
            if (group && groups[group]) {
              const key = `${group}:${market}`;
              if (!added.has(key)) {
                groups[group].push(market);
                added.add(key);
              }
            }
          });
        } else {
          // Market has no sport mapping - use keyword fallback
          const m = market.toLowerCase();
          if (m.includes("point") || m.includes("rebound") || m.includes("assist") || m.includes("pra") || m.includes("block") || m.includes("steal") || m.includes("turnover") || m.includes("basket") || m.includes("double")) {
            groups.Basketball.push(market);
          } else if (m.includes("passing") || m.includes("rushing") || m.includes("receiving") || m.includes("touchdown") || m.includes("sack") || m.includes("field_goal")) {
            groups.Football.push(market);
          } else if (m.includes("goal") || m.includes("shot") || m.includes("save") || m.includes("puck")) {
            groups.Hockey.push(market);
          } else if (m.includes("batter") || m.includes("pitcher") || m.includes("rbi") || m.includes("strikeout") || m.includes("home_run")) {
            groups.Baseball.push(market);
          } else {
            // Default: add to first non-empty group or Basketball
            groups.Basketball.push(market);
          }
        }
      });
    } else {
      // Fallback: use SPORT_MARKETS static data for categorization
      const basketballMarkets = new Set<string>();
      const footballMarkets = new Set<string>();
      const hockeyMarkets = new Set<string>();
      const baseballMarkets = new Set<string>();
      const soccerMarkets = new Set<string>();
      const tennisMarkets = new Set<string>();
      const mmaMarkets = new Set<string>();
      
      ["basketball_nba", "basketball_ncaab", "basketball_wnba"].forEach((key) => {
        (SPORT_MARKETS[key] || []).forEach((m) => basketballMarkets.add(m.apiKey));
      });
      ["football_nfl", "football_ncaaf"].forEach((key) => {
        (SPORT_MARKETS[key] || []).forEach((m) => footballMarkets.add(m.apiKey));
      });
      (SPORT_MARKETS["icehockey_nhl"] || []).forEach((m) => hockeyMarkets.add(m.apiKey));
      (SPORT_MARKETS["baseball_mlb"] || []).forEach((m) => baseballMarkets.add(m.apiKey));
      (SPORT_MARKETS["baseball_ncaabaseball"] || []).forEach((m) => baseballMarkets.add(m.apiKey));
      ["soccer_epl", "soccer_laliga", "soccer_mls", "soccer_ucl", "soccer_uel"].forEach((key) => {
        (SPORT_MARKETS[key] || []).forEach((m) => soccerMarkets.add(m.apiKey));
      });
      ["tennis_atp", "tennis_challenger", "tennis_itf_men", "tennis_itf_women", "tennis_utr_men", "tennis_utr_women", "tennis_wta"].forEach((key) => {
        (SPORT_MARKETS[key] || []).forEach((m) => tennisMarkets.add(m.apiKey));
      });
      (SPORT_MARKETS["ufc"] || []).forEach((m) => mmaMarkets.add(m.apiKey));
      
      availableMarkets.forEach((market) => {
        const m = market.toLowerCase();
        // Allow markets in multiple groups using separate if blocks
        let matched = false;
        if (basketballMarkets.has(m)) { groups.Basketball.push(market); matched = true; }
        if (footballMarkets.has(m)) { groups.Football.push(market); matched = true; }
        if (hockeyMarkets.has(m)) { groups.Hockey.push(market); matched = true; }
        if (baseballMarkets.has(m)) { groups.Baseball.push(market); matched = true; }
        if (soccerMarkets.has(m)) { groups.Soccer.push(market); matched = true; }
        if (tennisMarkets.has(m)) { groups.Tennis.push(market); matched = true; }
        if (mmaMarkets.has(m)) { groups.MMA.push(market); matched = true; }
        
        if (!matched) {
          // Fallback by keyword
          if (m.includes("point") || m.includes("rebound") || m.includes("assist") || m.includes("pra") || m.includes("block") || m.includes("steal") || m.includes("turnover") || m.includes("basket") || m.includes("double")) {
            groups.Basketball.push(market);
          } else if (m.includes("passing") || m.includes("rushing") || m.includes("receiving") || m.includes("touchdown") || m.includes("sack") || m.includes("field_goal")) {
            groups.Football.push(market);
          } else if (m.includes("goal") || m.includes("shot") || m.includes("save") || m.includes("puck")) {
            groups.Hockey.push(market);
          } else if (m.includes("batter") || m.includes("pitcher") || m.includes("rbi") || m.includes("strikeout") || m.includes("home_run")) {
            groups.Baseball.push(market);
          } else if (m.includes("set") || m.includes("tiebreak") || m.includes("breaks")) {
            groups.Tennis.push(market);
          } else if (m.includes("fight") || m.includes("round") || m.includes("decision") || m.includes("finish")) {
            groups.MMA.push(market);
          } else {
            groups.Basketball.push(market);
          }
        }
      });
    }
    
    return groups;
  }, [availableMarkets, marketSportsMap]);
  
  // Toggle functions
  const toggleBook = (id: string) => {
    if (locked) return;
    setLocalBooks((prev) => {
      if (prev.length === 0) {
        // Empty = all selected, clicking one deselects it
        return allSportsbooks.filter((sb) => sb.id !== id).map((sb) => sb.id);
      }
      return prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id];
    });
  };
  
  const toggleSport = (id: string) => {
    if (locked) return;
    setLocalSports((prev) => 
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };
  
  const toggleMarket = (id: string) => {
    if (locked) return;
    setLocalMarkets((prev) => {
      const flat = flattenMarkets(prev);
      const totalMarkets = availableMarkets.length;
      const isAllSelected = flat.length === 0 || (totalMarkets > 0 && flat.length === totalMarkets);
      if (isAllSelected) {
        // All selected -> deselect this one
        return availableMarkets.filter((m) => m !== id);
      }
      return flat.includes(id) ? flat.filter((m) => m !== id) : [...flat, id];
    });
  };
  
  const toggleDevigMethod = (method: DevigMethod) => {
    if (locked) return;
    setLocalDevigMethods((prev) => {
      if (prev.includes(method)) {
        // Don't allow deselecting all methods
        if (prev.length <= 1) return prev;
        return prev.filter((m) => m !== method);
      }
      return [...prev, method];
    });
  };
  
  const apply = () => {
    if (locked) return;
    const flatMarkets = flattenMarkets(localMarkets);
    const allMarketsInUI = localMarkets.length === 0 || (availableMarkets.length > 0 && flatMarkets.length === availableMarkets.length);
    onFiltersChange({
      selectedBooks: localBooks,
      selectedSports: localSports,
      selectedMarkets: allMarketsInUI ? [] : localMarkets,
      sharpPreset: localSharpPreset,
      devigMethods: localDevigMethods,
      evCase: localEvCase,
      minEv: localMinEv,
      maxEv: localMaxEv,
      mode: localMode,
      minBooksPerSide: localMinBooksPerSide,
      minLiquidity: localMinLiquidity,
    });
    if (onBankrollChange) {
      onBankrollChange(localBankroll);
    }
    if (onKellyPercentChange) {
      onKellyPercentChange(localKellyPercent);
    }
    setOpen(false);
  };
  
  const reset = () => {
    if (locked) return;
    setLocalBooks([]);
    setLocalSports(["nba", "nfl"]);
    setLocalMarkets([]);
    setLocalSharpPreset("pinnacle");
    setLocalDevigMethods(["power", "multiplicative"]);
    setLocalEvCase("worst");
    setLocalMinEv(2);
    setLocalMaxEv(undefined);
    setLocalMode("pregame");
    setLocalMinBooksPerSide(2);
    setLocalMinLiquidity(0);
    setLocalBankroll(0);
    setLocalKellyPercent(25);
    
    onFiltersChange({
      selectedBooks: [],
      selectedSports: ["nba", "nfl"],
      selectedMarkets: [],
      sharpPreset: "pinnacle",
      devigMethods: ["power", "multiplicative"],
      minEv: 2,
      maxEv: undefined,
      mode: "pregame",
      minBooksPerSide: 2,
      minLiquidity: 0,
    });
  };
  
  // Count active filters
  const allBooksSelected = localBooks.length === 0;
  const totalMarkets = availableMarkets.length;
  const allMarketsSelected = localMarkets.length === 0 || (totalMarkets > 0 && displaySelectedMarkets.length === totalMarkets);
  const activeFiltersCount =
    (!allBooksSelected ? 1 : 0) +
    (!allMarketsSelected ? 1 : 0) +
    (localMaxEv !== undefined ? 1 : 0) +
    (localSharpPreset !== "pinnacle" ? 1 : 0);
  
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium transition-colors border",
            "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800",
            "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700",
            activeFiltersCount > 0 && "border-brand/40 dark:border-brand/60 bg-brand/5 dark:bg-brand/10 text-brand dark:text-brand"
          )}
          title="Filters"
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-neutral-950 p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-neutral-200 px-4 sm:px-6 py-3 sm:py-4 dark:border-neutral-800">
            <SheetTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand" />
              EV Finder Filters
            </SheetTitle>
          </SheetHeader>
          
          {locked && (
            <div className="mx-6 mt-4 rounded-lg border border-brand/20 dark:border-brand/60 bg-gradient-to-br from-brand/5 dark:from-brand/10 via-transparent to-transparent p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-brand" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">Filters are a Sharp Feature</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {isLoggedIn ? "Upgrade to unlock full filtering capabilities" : "Try free to unlock full filtering capabilities"}
                    </p>
                  </div>
                </div>
                <ButtonLink href="/pricing" variant="pro" className="justify-center text-xs">
                  {isLoggedIn ? "Upgrade to Sharp" : "Try Free"}
                </ButtonLink>
              </div>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            <Tabs defaultValue="books" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-10 sm:h-11 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl">
                <TabsTrigger 
                  value="books" 
                  className="flex items-center justify-center gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm"
                >
                  <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Sportsbooks</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="sports" 
                  className="flex items-center justify-center gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm"
                >
                  <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Sports</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="settings" 
                  className="flex items-center justify-center gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:shadow-sm"
                >
                  <Percent className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </TabsTrigger>
              </TabsList>
              
              {/* Sportsbooks Tab */}
              <TabsContent value="books" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Select books to show opportunities from
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => !locked && setLocalBooks([])}
                      disabled={locked}
                      className="h-8 rounded-lg px-3 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => !locked && setLocalBooks(allSportsbooks.map((sb) => sb.id))}
                      disabled={locked}
                      className="h-8 rounded-lg px-3 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {allSportsbooks
                    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                    .map((sb) => {
                      const checked = allBooksSelected || localBooks.includes(sb.id);
                      const count = sportsbookCounts[sb.id] || 0;
                      return (
                        <button
                          key={sb.id}
                          type="button"
                          onClick={() => !locked && toggleBook(sb.id)}
                          disabled={locked}
                          className={cn(
                            "relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 text-left",
                            locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                            checked
                              ? "bg-white dark:bg-neutral-800/60 ring-2 ring-brand shadow-sm shadow-brand/20"
                              : "bg-white dark:bg-neutral-800/60 ring-1 ring-neutral-200 dark:ring-neutral-700/80 hover:ring-neutral-300 dark:hover:ring-neutral-600"
                          )}
                        >
                          {/* Checkmark */}
                          <div className={cn(
                            "absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full transition-all",
                            checked
                              ? "bg-brand"
                              : "ring-1 ring-neutral-300 dark:ring-neutral-600 bg-white dark:bg-neutral-800"
                          )}>
                            {checked && (
                              <Check className="h-3 w-3 text-white" strokeWidth={3} />
                            )}
                          </div>
                          
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg overflow-hidden transition-colors bg-neutral-100 dark:bg-neutral-700/50">
                            {sb.image?.light ? (
                              <img src={sb.image.light} alt={sb.name} className="h-6 w-6 object-contain" />
                            ) : (
                              <Building2 className="h-4 w-4 text-neutral-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pr-6">
                            <span className="text-sm font-semibold leading-none block truncate text-neutral-900 dark:text-neutral-100">
                              {sb.name}
                            </span>
                            {count > 0 && (
                              <span className="text-xs mt-1 block text-neutral-500 dark:text-neutral-400">
                                {count} opportunities
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </TabsContent>
              
              {/* Sports & Markets Tab */}
              <TabsContent value="sports" className="mt-4 space-y-6">
                {/* Header with global actions */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Filter by sports and markets
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (locked) return;
                        setLocalSports(availableSports);
                        setLocalMarkets([]);
                      }}
                      disabled={locked}
                      className="h-8 rounded-lg px-3 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => {
                        if (locked) return;
                        setLocalSports([]);
                        setLocalMarkets(availableMarkets);
                      }}
                      disabled={locked}
                      className="h-8 rounded-lg px-3 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Sports Selection - Premium Grid */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Sports</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {availableSports.map((sport) => {
                      const checked = localSports.includes(sport);
                      return (
                        <button
                          key={sport}
                          type="button"
                          onClick={() => !locked && toggleSport(sport)}
                          disabled={locked}
                          className={cn(
                            "relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 text-left",
                            locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                            checked
                              ? "bg-white dark:bg-neutral-800/60 ring-2 ring-brand shadow-sm shadow-brand/20"
                              : "bg-white dark:bg-neutral-800/60 ring-1 ring-neutral-200 dark:ring-neutral-700/80 hover:ring-neutral-300 dark:hover:ring-neutral-600"
                          )}
                        >
                          {/* Checkmark */}
                          <div className={cn(
                            "absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full transition-all",
                            checked
                              ? "bg-brand"
                              : "ring-1 ring-neutral-300 dark:ring-neutral-600 bg-white dark:bg-neutral-800"
                          )}>
                            {checked && (
                              <Check className="h-3 w-3 text-white" strokeWidth={3} />
                            )}
                          </div>
                          
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700/50">
                            <SportIcon sport={sport} className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                          </div>
                          <span className="text-sm font-semibold leading-none pr-6 text-neutral-900 dark:text-neutral-100">
                            {SPORT_LABELS[sport] || sport.toUpperCase()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Markets Selection - Premium Accordion Design */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Markets</Label>
                    <span className="text-xs font-medium text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
                      {allMarketsSelected ? "All" : displaySelectedMarkets.length} selected
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
                      className="w-full rounded-xl border-0 ring-1 ring-neutral-200 dark:ring-neutral-700/80 bg-white dark:bg-neutral-800/60 py-2.5 pl-10 pr-4 text-sm placeholder:text-neutral-400 focus:ring-2 focus:ring-brand focus:outline-none dark:text-white dark:placeholder:text-neutral-500 transition-shadow"
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
                  
                  {/* Sport Accordions */}
                  <div className="space-y-3">
                    {Object.entries(groupedMarkets).map(([sportType, markets]) => {
                      // Filter markets by search query
                      const filteredMarkets = marketSearchQuery 
                        ? markets.filter(m => (formatMarketLabel(m) || m).toLowerCase().includes(marketSearchQuery.toLowerCase()))
                        : markets;
                      
                      if (filteredMarkets.length === 0) return null;
                      
                      const isExpanded = expandedSportSections.has(sportType);
                      const selectedCount = filteredMarkets.filter(m => allMarketsSelected || displaySelectedMarkets.includes(m)).length;
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
                          className="rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-800 bg-neutral-50 dark:bg-neutral-800/30 overflow-hidden"
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
                            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-neutral-800 ring-1 ring-neutral-200 dark:ring-neutral-700">
                                <SportIcon sport={sportIconMap[sportType] || 'football'} className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
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
                                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                                allSelected 
                                  ? "bg-brand text-white" 
                                  : selectedCount > 0 
                                    ? "bg-white dark:bg-neutral-800 text-brand ring-1 ring-brand/30 dark:ring-brand/70"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500"
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
                                <div className="border-t border-neutral-200/50 dark:border-neutral-700/50">
                                  {/* Quick Actions */}
                                  <div className="flex items-center justify-between px-4 py-2.5 bg-white/50 dark:bg-neutral-900/30">
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                      Quick actions
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (locked) return;
                                          setLocalMarkets(prev => {
                                            const flat = flattenMarkets(prev);
                                            if (flat.length === 0) {
                                              return [...filteredMarkets];
                                            }
                                            const newSelected = new Set(flat);
                                            filteredMarkets.forEach(m => newSelected.add(m));
                                            return Array.from(newSelected);
                                          });
                                        }}
                                        disabled={locked}
                                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Select All
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (locked) return;
                                          setLocalMarkets(prev => {
                                            const flat = flattenMarkets(prev);
                                            return flat.filter(m => !filteredMarkets.includes(m));
                                          });
                                        }}
                                        disabled={locked}
                                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {/* Markets Grid */}
                                  <div className="p-3 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600 scrollbar-track-transparent">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {filteredMarkets.map(market => {
                                        const checked = allMarketsSelected || displaySelectedMarkets.includes(market);
                                        
                                        return (
                                          <button
                                            key={market}
                                            type="button"
                                            onClick={() => toggleMarket(market)}
                                            disabled={locked}
                                            className={cn(
                                              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                                              locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                                              checked
                                                ? "bg-white dark:bg-neutral-800 ring-2 ring-brand shadow-sm shadow-brand/10"
                                                : "bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 ring-1 ring-neutral-200 dark:ring-neutral-700"
                                            )}
                                          >
                                            <div className={cn(
                                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors",
                                              checked 
                                                ? "bg-brand" 
                                                : "ring-1 ring-neutral-300 dark:ring-neutral-600 bg-white dark:bg-neutral-700"
                                            )}>
                                              {checked && (
                                                <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                                              )}
                                            </div>
                                            <span className="text-xs font-medium leading-tight text-neutral-700 dark:text-neutral-300">
                                              {formatMarketLabel(market) || market.replace(/_/g, " ")}
                                            </span>
                                          </button>
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
              
              {/* Settings Tab */}
              <TabsContent value="settings" className="mt-4 space-y-6">
                {/* De-Vig Methods */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">De-Vig Methods</Label>
                    <span className="text-xs font-medium text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
                      {localDevigMethods.length} selected
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {Object.entries(DEVIG_METHODS).map(([key, method]) => {
                      const isSelected = localDevigMethods.includes(key as DevigMethod);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => !locked && toggleDevigMethod(key as DevigMethod)}
                          disabled={locked}
                          className={cn(
                            "group relative flex items-center gap-2.5 p-3 rounded-xl text-left transition-all duration-200",
                            locked && "cursor-not-allowed opacity-60",
                            isSelected
                              ? "bg-white dark:bg-neutral-800/60 ring-2 ring-brand shadow-sm shadow-brand/20"
                              : "bg-white dark:bg-neutral-800/60 ring-1 ring-neutral-200 dark:ring-neutral-700/80 hover:ring-neutral-300 dark:hover:ring-neutral-600"
                          )}
                        >
                          {/* Checkmark indicator */}
                          <div className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all",
                            isSelected
                              ? "bg-brand"
                              : "ring-1 ring-neutral-300 dark:ring-neutral-600 bg-white dark:bg-neutral-800"
                          )}>
                            {isSelected && (
                              <Check className="h-3 w-3 text-white" strokeWidth={3} />
                            )}
                          </div>
                          
                          <span className="flex-1 font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                            {method.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Formula Case */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Formula Case</Label>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    When using multiple de-vig methods, which result to display
                  </p>
                  <div className="flex gap-2">
                    {(["worst", "best"] as const).map((caseType) => (
                      <button
                        key={caseType}
                        onClick={() => !locked && setLocalEvCase(caseType)}
                        disabled={locked}
                        className={cn(
                          "flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                          locked && "cursor-not-allowed opacity-60",
                          localEvCase === caseType
                            ? "bg-white dark:bg-neutral-800/60 text-neutral-900 dark:text-white ring-2 ring-brand shadow-sm shadow-brand/20"
                            : "bg-white dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 ring-1 ring-neutral-200 dark:ring-neutral-700/80 hover:ring-neutral-300 dark:hover:ring-neutral-600"
                        )}
                      >
                        {caseType === "worst" ? "Worst Case (Conservative)" : "Best Case (Optimistic)"}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* EV Thresholds */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">EV Thresholds</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs text-neutral-500 dark:text-neutral-400">Minimum EV %</label>
                      <select
                        value={localMinEv}
                        onChange={(e) => !locked && setLocalMinEv(Number(e.target.value))}
                        disabled={locked}
                        className="w-full h-11 px-3 rounded-xl text-[14px] font-medium bg-white dark:bg-neutral-800/60 border-0 ring-1 ring-neutral-200 dark:ring-neutral-700/80 focus:ring-2 focus:ring-brand transition-shadow"
                      >
                        {MIN_EV_OPTIONS.map((val) => (
                          <option key={val} value={val}>
                            {val}%
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-neutral-500 dark:text-neutral-400">Maximum EV %</label>
                      <select
                        value={localMaxEv || ""}
                        onChange={(e) => !locked && setLocalMaxEv(e.target.value ? Number(e.target.value) : undefined)}
                        disabled={locked}
                        className="w-full h-11 px-3 rounded-xl text-[14px] font-medium bg-white dark:bg-neutral-800/60 border-0 ring-1 ring-neutral-200 dark:ring-neutral-700/80 focus:ring-2 focus:ring-brand transition-shadow"
                      >
                        <option value="">No limit</option>
                        {MAX_EV_OPTIONS.map((val) => (
                          <option key={val} value={val}>
                            {val}%
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Filter opportunities by expected value percentage range
                  </p>
                </div>

                {/* Bankroll & Kelly */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Bankroll & Kelly</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs text-neutral-500 dark:text-neutral-400">Bankroll ($)</label>
                      <Input
                        type="number"
                        min={0}
                        value={localBankroll}
                        onChange={(e) => !locked && setLocalBankroll(Number(e.target.value || 0))}
                        disabled={locked}
                        className="h-11 text-[14px] font-medium bg-white dark:bg-neutral-800/60 border-0 ring-1 ring-neutral-200 dark:ring-neutral-700/80 focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-neutral-500 dark:text-neutral-400">Kelly %</label>
                      <select
                        value={localKellyPercent}
                        onChange={(e) => !locked && setLocalKellyPercent(Number(e.target.value))}
                        disabled={locked}
                        className="w-full h-11 px-3 rounded-xl text-[14px] font-medium bg-white dark:bg-neutral-800/60 border-0 ring-1 ring-neutral-200 dark:ring-neutral-700/80 focus:ring-2 focus:ring-brand transition-shadow"
                      >
                        {[5, 10, 25, 50, 100].map((val) => (
                          <option key={val} value={val}>
                            {val}% Kelly
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Stake size uses fractional Kelly based on your bankroll
                  </p>
                </div>
                
                {/* Min Books Per Side (Width Filter) */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Market Width</Label>
                  <select
                    value={localMinBooksPerSide}
                    onChange={(e) => !locked && setLocalMinBooksPerSide(Number(e.target.value))}
                    disabled={locked}
                    className="w-full h-11 px-3 rounded-xl text-[14px] font-medium bg-neutral-50 dark:bg-neutral-800/50 border-0 ring-1 ring-neutral-200 dark:ring-neutral-700 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition-shadow"
                  >
                    {[1, 2, 3, 4, 5].map((val) => (
                      <option key={val} value={val}>
                        {val} book{val > 1 ? "s" : ""} minimum per side
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Higher values ensure better market consensus and liquidity
                  </p>
                </div>

                {/* Min Liquidity Filter */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Minimum Liquidity</Label>
                  <select
                    value={localMinLiquidity}
                    onChange={(e) => !locked && setLocalMinLiquidity(Number(e.target.value))}
                    disabled={locked}
                    className="w-full h-11 px-3 rounded-xl text-[14px] font-medium bg-neutral-50 dark:bg-neutral-800/50 border-0 ring-1 ring-neutral-200 dark:ring-neutral-700 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition-shadow"
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
                    Filter out opportunities with max stake below this threshold
                  </p>
                </div>

                {/* Show Hidden Opportunities */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Hidden Opportunities</Label>
                  <button
                    onClick={() => onFiltersChange({ showHidden: !showHidden })}
                    className={cn(
                      "w-full p-4 rounded-xl text-left transition-all duration-200 flex items-center justify-between",
                      showHidden
                        ? "bg-white dark:bg-neutral-800/60 ring-2 ring-amber-500 shadow-sm shadow-amber-500/20"
                        : "bg-white dark:bg-neutral-800/60 ring-1 ring-neutral-200 dark:ring-neutral-700/80 hover:ring-neutral-300 dark:hover:ring-neutral-600"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700/50">
                        {showHidden ? (
                          <Eye className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <EyeOff className="h-4.5 w-4.5 text-neutral-400 dark:text-neutral-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                          {showHidden ? "Showing Hidden" : "Hidden Opportunities"}
                        </p>
                        <p className="text-xs mt-0.5 text-neutral-500 dark:text-neutral-400">
                          {hiddenCount > 0 
                            ? `${hiddenCount} hidden (greyed out when visible)`
                            : "No hidden opportunities"}
                        </p>
                      </div>
                    </div>
                    <div className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide transition-colors",
                      showHidden
                        ? "bg-amber-500 text-white"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
                    )}>
                      {showHidden ? "ON" : "OFF"}
                    </div>
                  </button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Footer */}
          <div className="flex items-center gap-3 border-t border-neutral-200 dark:border-neutral-800 px-4 sm:px-6 py-4">
            <button
              onClick={reset}
              disabled={locked}
              className="h-11 flex-1 rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700 bg-white dark:bg-neutral-800/60 px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>
            <button
              onClick={apply}
              disabled={locked}
              className="h-11 flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
