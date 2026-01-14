"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import { formatMarketLabel, SPORT_MARKETS } from "@/lib/data/markets";
import { Filter, Building2, Target, TrendingUp, Lock, Percent } from "lucide-react";
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
  minEv: number;
  maxEv: number | undefined;
  mode: "pregame" | "live" | "all";
  minBooksPerSide: number;
  
  // Callbacks
  onFiltersChange: (filters: {
    selectedBooks?: string[];
    selectedSports?: string[];
    selectedMarkets?: string[];
    sharpPreset?: SharpPreset;
    devigMethods?: DevigMethod[];
    minEv?: number;
    maxEv?: number | undefined;
    mode?: "pregame" | "live" | "all";
    minBooksPerSide?: number;
  }) => void;
  
  // Available options
  availableSports: string[];
  availableMarkets: string[];
  
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
  wnba: "WNBA",
  soccer_epl: "EPL",
};

export function PositiveEVFilters({
  selectedBooks,
  selectedSports,
  selectedMarkets,
  sharpPreset,
  devigMethods,
  minEv,
  maxEv,
  mode,
  minBooksPerSide,
  onFiltersChange,
  availableSports,
  availableMarkets,
  locked = false,
  isLoggedIn = false,
  isPro = false,
  opportunities = [],
}: PositiveEVFiltersProps) {
  const allSportsbooks = useMemo(() => getAllActiveSportsbooks(), []);
  const [open, setOpen] = useState(false);
  
  // Local state for uncommitted changes
  const [localBooks, setLocalBooks] = useState<string[]>(selectedBooks);
  const [localSports, setLocalSports] = useState<string[]>(selectedSports);
  const [localMarkets, setLocalMarkets] = useState<string[]>(selectedMarkets);
  const [localSharpPreset, setLocalSharpPreset] = useState<SharpPreset>(sharpPreset);
  const [localDevigMethods, setLocalDevigMethods] = useState<DevigMethod[]>(devigMethods);
  const [localMinEv, setLocalMinEv] = useState(minEv);
  const [localMaxEv, setLocalMaxEv] = useState<number | undefined>(maxEv);
  const [localMode, setLocalMode] = useState(mode);
  const [localMinBooksPerSide, setLocalMinBooksPerSide] = useState(minBooksPerSide);
  
  // Sync local state with props
  useEffect(() => {
    setLocalBooks(selectedBooks);
    setLocalSports(selectedSports);
    setLocalMarkets(selectedMarkets);
    setLocalSharpPreset(sharpPreset);
    setLocalDevigMethods(devigMethods);
    setLocalMinEv(minEv);
    setLocalMaxEv(maxEv);
    setLocalMode(mode);
    setLocalMinBooksPerSide(minBooksPerSide);
  }, [selectedBooks, selectedSports, selectedMarkets, sharpPreset, devigMethods, minEv, maxEv, mode, minBooksPerSide]);
  
  // Calculate sportsbook counts from opportunities
  const sportsbookCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    opportunities.forEach((opp) => {
      const bookId = opp.book.bookId;
      counts[bookId] = (counts[bookId] || 0) + 1;
    });
    return counts;
  }, [opportunities]);
  
  // Group markets by sport
  const groupedMarkets = useMemo(() => {
    const groups: Record<string, string[]> = {
      Basketball: [],
      Football: [],
      Hockey: [],
      Baseball: [],
      Soccer: [],
    };
    
    // Build lookup from SPORT_MARKETS
    const basketballMarkets = new Set<string>();
    const footballMarkets = new Set<string>();
    const hockeyMarkets = new Set<string>();
    const baseballMarkets = new Set<string>();
    const soccerMarkets = new Set<string>();
    
    ["basketball_nba", "basketball_ncaab", "basketball_wnba"].forEach((key) => {
      (SPORT_MARKETS[key] || []).forEach((m) => basketballMarkets.add(m.apiKey));
    });
    ["football_nfl", "football_ncaaf"].forEach((key) => {
      (SPORT_MARKETS[key] || []).forEach((m) => footballMarkets.add(m.apiKey));
    });
    (SPORT_MARKETS["icehockey_nhl"] || []).forEach((m) => hockeyMarkets.add(m.apiKey));
    (SPORT_MARKETS["baseball_mlb"] || []).forEach((m) => baseballMarkets.add(m.apiKey));
    (SPORT_MARKETS["soccer_epl"] || []).forEach((m) => soccerMarkets.add(m.apiKey));
    
    availableMarkets.forEach((market) => {
      const m = market.toLowerCase();
      if (basketballMarkets.has(m)) groups.Basketball.push(market);
      else if (footballMarkets.has(m)) groups.Football.push(market);
      else if (hockeyMarkets.has(m)) groups.Hockey.push(market);
      else if (baseballMarkets.has(m)) groups.Baseball.push(market);
      else if (soccerMarkets.has(m)) groups.Soccer.push(market);
      // Fallback by keyword
      else if (m.includes("point") || m.includes("rebound") || m.includes("assist") || m.includes("pra")) {
        groups.Basketball.push(market);
      } else if (m.includes("passing") || m.includes("rushing") || m.includes("receiving") || m.includes("touchdown")) {
        groups.Football.push(market);
      } else if (m.includes("shot") || m.includes("goal") || m.includes("save")) {
        groups.Hockey.push(market);
      }
    });
    
    return groups;
  }, [availableMarkets]);
  
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
      if (prev.length === 0) {
        // Empty = all selected
        return availableMarkets.filter((m) => m !== id);
      }
      return prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
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
    onFiltersChange({
      selectedBooks: localBooks,
      selectedSports: localSports,
      selectedMarkets: localMarkets,
      sharpPreset: localSharpPreset,
      devigMethods: localDevigMethods,
      minEv: localMinEv,
      maxEv: localMaxEv,
      mode: localMode,
      minBooksPerSide: localMinBooksPerSide,
    });
    setOpen(false);
  };
  
  const reset = () => {
    if (locked) return;
    setLocalBooks([]);
    setLocalSports(["nba", "nfl"]);
    setLocalMarkets([]);
    setLocalSharpPreset("pinnacle");
    setLocalDevigMethods(["power", "multiplicative"]);
    setLocalMinEv(2);
    setLocalMaxEv(undefined);
    setLocalMode("pregame");
    setLocalMinBooksPerSide(2);
    
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
    });
  };
  
  // Count active filters
  const allBooksSelected = localBooks.length === 0;
  const allMarketsSelected = localMarkets.length === 0;
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
            activeFiltersCount > 0 && "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
          )}
          title="Filters"
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-neutral-950 p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-neutral-200 px-4 sm:px-6 py-3 sm:py-4 dark:border-neutral-800">
            <SheetTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              EV Finder Filters
            </SheetTitle>
          </SheetHeader>
          
          {locked && (
            <div className="mx-6 mt-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 dark:from-emerald-950/30 via-transparent to-transparent p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">Filters are a Pro Feature</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {isLoggedIn ? "Upgrade to unlock full filtering capabilities" : "Try free to unlock full filtering capabilities"}
                    </p>
                  </div>
                </div>
                <ButtonLink href="/pricing" variant="pro" className="justify-center text-xs">
                  {isLoggedIn ? "Upgrade to Pro" : "Try Free"}
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
                  <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                    Select books to show opportunities from
                  </p>
                  <div className="flex gap-1.5 sm:gap-2">
                    <button
                      onClick={() => !locked && setLocalBooks([])}
                      disabled={locked}
                      className="h-7 sm:h-8 rounded-lg border border-transparent px-2 sm:px-3 text-[10px] sm:text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      All
                    </button>
                    <button
                      onClick={() => !locked && setLocalBooks(allSportsbooks.map((sb) => sb.id))}
                      disabled={locked}
                      className="h-7 sm:h-8 rounded-lg border border-transparent px-2 sm:px-3 text-[10px] sm:text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      None
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {allSportsbooks
                    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                    .map((sb) => {
                      const checked = allBooksSelected || localBooks.includes(sb.id);
                      const count = sportsbookCounts[sb.id] || 0;
                      return (
                        <label
                          key={sb.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                            locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:shadow-sm",
                            checked
                              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                              : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600"
                          )}
                        >
                          <Checkbox 
                            checked={checked} 
                            onCheckedChange={() => toggleBook(sb.id)} 
                            disabled={locked} 
                          />
                          {sb.image?.light && (
                            <img src={sb.image.light} alt={sb.name} className="h-6 w-6 object-contain" />
                          )}
                          <span className="text-sm leading-none">
                            {sb.name}
                            {count > 0 && (
                              <span className="text-neutral-400 dark:text-neutral-500 ml-1">({count})</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </TabsContent>
              
              {/* Sports & Markets Tab */}
              <TabsContent value="sports" className="mt-4 space-y-6">
                {/* Sports Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Sports</Label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => !locked && setLocalSports(availableSports)}
                        disabled={locked}
                        className="text-xs text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                      >
                        All
                      </button>
                      <button
                        onClick={() => !locked && setLocalSports([])}
                        disabled={locked}
                        className="text-xs text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableSports.map((sport) => {
                      const checked = localSports.includes(sport);
                      return (
                        <button
                          key={sport}
                          onClick={() => toggleSport(sport)}
                          disabled={locked}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                            locked && "cursor-not-allowed opacity-60",
                            checked
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-600"
                          )}
                        >
                          <SportIcon sport={sport} className="w-4 h-4" />
                          <span className="text-sm font-medium">{SPORT_LABELS[sport] || sport.toUpperCase()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Markets Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Markets</Label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => !locked && setLocalMarkets([])}
                        disabled={locked}
                        className="text-xs text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                      >
                        All
                      </button>
                      <button
                        onClick={() => !locked && setLocalMarkets(availableMarkets)}
                        disabled={locked}
                        className="text-xs text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {allMarketsSelected ? "All markets selected" : `${localMarkets.length} markets selected`}
                  </p>
                  
                  {/* Grouped markets */}
                  {Object.entries(groupedMarkets).map(([group, markets]) => {
                    if (markets.length === 0) return null;
                    return (
                      <div key={group} className="space-y-2">
                        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                          {group}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {markets.slice(0, 20).map((market) => {
                            const selected = allMarketsSelected || localMarkets.includes(market);
                            return (
                              <button
                                key={market}
                                onClick={() => toggleMarket(market)}
                                disabled={locked}
                                className={cn(
                                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                                  locked && "cursor-not-allowed opacity-60",
                                  selected
                                    ? "bg-emerald-500 text-white"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                                )}
                              >
                                {formatMarketLabel(market) || market.replace(/_/g, " ")}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
              
              {/* Settings Tab */}
              <TabsContent value="settings" className="mt-4 space-y-6">
                {/* Sharp Preset */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Sharp Reference</Label>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Which books to use as the "true" probability reference
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(SHARP_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => !locked && setLocalSharpPreset(key as SharpPreset)}
                        disabled={locked}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all",
                          locked && "cursor-not-allowed opacity-60",
                          localSharpPreset === key
                            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/30"
                            : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600"
                        )}
                      >
                        <p className="font-medium text-sm">{preset.label}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {preset.books.join(", ")}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* De-Vig Methods */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">De-Vig Methods</Label>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Methods used to calculate fair probabilities. Worst-case EV is shown.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(DEVIG_METHODS).map(([key, method]) => {
                      const isSelected = localDevigMethods.includes(key as DevigMethod);
                      return (
                        <div
                          key={key}
                          role="button"
                          tabIndex={locked ? -1 : 0}
                          onClick={() => !locked && toggleDevigMethod(key as DevigMethod)}
                          onKeyDown={(e) => {
                            if (!locked && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              toggleDevigMethod(key as DevigMethod);
                            }
                          }}
                          className={cn(
                            "p-3 rounded-lg border text-left transition-all cursor-pointer",
                            locked && "cursor-not-allowed opacity-60",
                            isSelected
                              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/30"
                              : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              checked={isSelected} 
                              disabled={locked}
                              onCheckedChange={() => toggleDevigMethod(key as DevigMethod)}
                            />
                            <p className="font-medium text-sm">{method.label}</p>
                          </div>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 ml-6">
                            {method.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* EV Thresholds */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Min EV %</Label>
                    <select
                      value={localMinEv}
                      onChange={(e) => !locked && setLocalMinEv(Number(e.target.value))}
                      disabled={locked}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
                    >
                      {MIN_EV_OPTIONS.map((val) => (
                        <option key={val} value={val}>
                          {val}%
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Max EV %</Label>
                    <select
                      value={localMaxEv || ""}
                      onChange={(e) => !locked && setLocalMaxEv(e.target.value ? Number(e.target.value) : undefined)}
                      disabled={locked}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
                    >
                      <option value="">No limit</option>
                      {MAX_EV_OPTIONS.map((val) => (
                        <option key={val} value={val}>
                          {val}%
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-neutral-500">Filter out high EV outliers</p>
                  </div>
                </div>
                
                {/* Min Books Per Side (Width Filter) */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Min Books Per Side</Label>
                  <div className="space-y-2">
                    <select
                      value={localMinBooksPerSide}
                      onChange={(e) => !locked && setLocalMinBooksPerSide(Number(e.target.value))}
                      disabled={locked}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700"
                    >
                      {[1, 2, 3, 4, 5].map((val) => (
                        <option key={val} value={val}>
                          {val} book{val > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-neutral-500">
                      Requires at least this many books on BOTH over and under sides. 
                      Higher values ensure better market liquidity.
                    </p>
                  </div>
                </div>
                
                {/* Mode */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Mode</Label>
                  <div className="flex gap-2">
                    {(["pregame", "live", "all"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => !locked && setLocalMode(m)}
                        disabled={locked}
                        className={cn(
                          "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all border",
                          locked && "cursor-not-allowed opacity-60",
                          localMode === m
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-600"
                        )}
                      >
                        {m === "pregame" ? "Pregame" : m === "live" ? "Live" : "All"}
                      </button>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Footer */}
          <div className="flex items-center gap-3 border-t border-neutral-200 dark:border-neutral-800 px-4 sm:px-6 py-3 sm:py-4">
            <button
              onClick={reset}
              disabled={locked}
              className="h-10 flex-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>
            <button
              onClick={apply}
              disabled={locked}
              className="h-10 flex-1 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
