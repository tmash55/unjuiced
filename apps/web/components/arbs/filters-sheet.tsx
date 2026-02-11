"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/seperator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import { getAllSports, getAllLeagues } from "@/lib/data/sports";
import { useArbitragePreferences } from "@/context/preferences-context";
import { Filter, Building2, Percent, Trophy, User, Gamepad2, Search, Check, ChevronDown, X } from "lucide-react";
import { SportIcon } from "@/components/icons/sport-icons";
import { cn } from "@/lib/utils";
import Lock from "@/icons/lock";
import { ButtonLink } from "@/components/button-link";
import type { ArbMarketOption, MarketType } from "@/lib/arb-filters";

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

export function FiltersSheet({
  children,
  pro = false,
  isLoggedIn = false,
  availableMarkets = [],
}: {
  children?: React.ReactNode;
  pro?: boolean;
  isLoggedIn?: boolean;
  availableMarkets?: ArbMarketOption[];
}) {
  const { filters, updateFilters } = useArbitragePreferences();
  const allBooks = useMemo(() => getAllActiveSportsbooks(), []);
  const allSports = useMemo(() => getAllSports(), []);
  const allLeagues = useMemo(() => getAllLeagues(), []);
  const [open, setOpen] = useState(false);

  const [localBooks, setLocalBooks] = useState<string[]>(filters.selectedBooks || []);
  const [localSports, setLocalSports] = useState<string[]>(filters.selectedSports || []);
  const [localLeagues, setLocalLeagues] = useState<string[]>(filters.selectedLeagues || []);
  const [localMarketTypes, setLocalMarketTypes] = useState<MarketType[]>(filters.selectedMarketTypes || ['player', 'game']);
  const [localMarkets, setLocalMarkets] = useState<string[]>(filters.selectedMarkets || []);
  const [minArb, setMinArb] = useState<number>(filters.minArb ?? 0);
  const [maxArb, setMaxArb] = useState<number>(filters.maxArb ?? 20);
  const [totalBetAmount, setTotalBetAmount] = useState<number>(filters.totalBetAmount ?? 200);
  const [minLiquidity, setMinLiquidity] = useState<number>(filters.minLiquidity ?? 50);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [marketSearchQuery, setMarketSearchQuery] = useState("");
  const [expandedSportSections, setExpandedSportSections] = useState<Set<string>>(new Set());

  const flattenMarkets = useMemo(() => {
    if (localMarkets.length === 0) return [];
    const unique = new Set<string>();
    localMarkets.forEach((market) => {
      const parts = market.split(":");
      unique.add(parts.length > 1 ? parts[1] : market);
    });
    return Array.from(unique);
  }, [localMarkets]);

  const allMarketKeys = useMemo(() => availableMarkets.map((market) => market.key), [availableMarkets]);
  const allMarketsSelected = localMarkets.length === 0 || (availableMarkets.length > 0 && flattenMarkets.length === allMarketKeys.length);
  const marketsBySport = useMemo(() => {
    const grouped: Record<string, ArbMarketOption[]> = {};
    availableMarkets.forEach((market) => {
      const sports = market.sports && market.sports.length > 0 ? market.sports : ["other"];
      sports.forEach((sport) => {
        if (!grouped[sport]) grouped[sport] = [];
        grouped[sport].push(market);
      });
    });
    Object.values(grouped).forEach((markets) => {
      markets.sort((a, b) => a.label.localeCompare(b.label));
    });
    return grouped;
  }, [availableMarkets]);

  // Keep local UI state in sync when preferences load or change
  useEffect(() => {
    setLocalBooks(filters.selectedBooks || []);
    setLocalSports(filters.selectedSports || []);
    setLocalLeagues(filters.selectedLeagues || []);
    setLocalMarketTypes(filters.selectedMarketTypes || ['player', 'game']);
    setLocalMarkets(filters.selectedMarkets || []);
    setMinArb(filters.minArb ?? 0);
    setMaxArb(filters.maxArb ?? 20);
    setTotalBetAmount(filters.totalBetAmount ?? 200);
    setMinLiquidity(filters.minLiquidity ?? 50);
    setHasUnsavedChanges(false);
  }, [filters]);

  // Track changes to mark as unsaved
  useEffect(() => {
    const changed = 
      localBooks.length !== (filters.selectedBooks || []).length ||
      localBooks.some(id => !(filters.selectedBooks || []).includes(id)) ||
      localSports.length !== (filters.selectedSports || []).length ||
      localSports.some(id => !(filters.selectedSports || []).includes(id)) ||
      localLeagues.length !== (filters.selectedLeagues || []).length ||
      localLeagues.some(id => !(filters.selectedLeagues || []).includes(id)) ||
      localMarketTypes.length !== (filters.selectedMarketTypes || ['player', 'game']).length ||
      localMarketTypes.some(id => !(filters.selectedMarketTypes || ['player', 'game']).includes(id)) ||
      localMarkets.length !== (filters.selectedMarkets || []).length ||
      localMarkets.some(id => !(filters.selectedMarkets || []).includes(id)) ||
      minArb !== (filters.minArb ?? 0) ||
      maxArb !== (filters.maxArb ?? 20) ||
      totalBetAmount !== (filters.totalBetAmount ?? 200) ||
      minLiquidity !== (filters.minLiquidity ?? 50);
    
    setHasUnsavedChanges(changed);
  }, [localBooks, localSports, localLeagues, localMarketTypes, localMarkets, minArb, maxArb, totalBetAmount, minLiquidity, filters]);

  // Sportsbooks use "empty = all" convention (same as desktop)
  const allBookIds = useMemo(() => allBooks.map(b => b.id), [allBooks]);
  const isBookIncluded = (id: string) => localBooks.length === 0 || localBooks.includes(id);
  const allBooksIncluded = localBooks.length === 0 || localBooks.length === allBookIds.length;

  const toggleBook = (id: string) => {
    // Materialize the full list if currently "all selected" (empty array)
    const currentlyIncluded = localBooks.length === 0 ? allBookIds : localBooks;
    const isCurrentlyIncluded = currentlyIncluded.includes(id);

    if (isCurrentlyIncluded) {
      // Deselect this book
      const newIncluded = currentlyIncluded.filter(b => b !== id);
      // Don't allow zero books - need at least one
      if (newIncluded.length === 0) return;
      setLocalBooks(newIncluded);
    } else {
      // Select this book
      const newIncluded = [...currentlyIncluded, id];
      // If all books are now selected, collapse back to empty array
      if (newIncluded.length === allBookIds.length) {
        setLocalBooks([]);
      } else {
        setLocalBooks(newIncluded);
      }
    }
  };

  const toggleSport = (id: string) => {
    setLocalSports(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleLeague = (id: string) => {
    setLocalLeagues(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);
  };

  const toggleMarketType = (type: MarketType) => {
    setLocalMarketTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const makeCompositeKey = (sport: string, marketKey: string) => `${sport}:${marketKey}`;

  const isMarketSelectedForSport = (sport: string, marketKey: string) => {
    if (localMarkets.length === 0) return true;
    const compositeKey = makeCompositeKey(sport, marketKey);
    return localMarkets.includes(compositeKey) || localMarkets.includes(marketKey);
  };

  const toggleMarket = (sport: string, marketKey: string) => {
    const compositeKey = makeCompositeKey(sport, marketKey);

    if (localMarkets.length === 0) {
      // Convert implicit "all selected" to explicit list minus the deselected item.
      const allCompositeKeys: string[] = [];
      availableMarkets.forEach((market) => {
        const sports = market.sports && market.sports.length > 0 ? market.sports : ["other"];
        sports.forEach((s) => {
          const key = makeCompositeKey(s, market.key);
          if (key !== compositeKey) {
            allCompositeKeys.push(key);
          }
        });
      });
      setLocalMarkets(allCompositeKeys);
      return;
    }

    if (localMarkets.includes(compositeKey)) {
      setLocalMarkets(localMarkets.filter((market) => market !== compositeKey));
      return;
    }

    if (localMarkets.includes(marketKey)) {
      const otherSports = (availableMarkets.find((market) => market.key === marketKey)?.sports || []).filter((s) => s !== sport);
      const next = localMarkets
        .filter((market) => market !== marketKey)
        .concat(otherSports.map((s) => makeCompositeKey(s, marketKey)));
      setLocalMarkets(next);
      return;
    }

    setLocalMarkets([...localMarkets, compositeKey]);
  };

  const selectAllMarkets = () => {
    setLocalMarkets([]);
  };

  const clearAllMarkets = () => {
    if (allMarketKeys.length > 0) {
      setLocalMarkets([allMarketKeys[0]]);
      return;
    }
    setLocalMarkets([]);
  };

  // Select all markets for a specific sport
  const selectAllSportMarkets = (sportId: string, sportMarkets: ArbMarketOption[]) => {
    if (localMarkets.length === 0) return; // Already all selected
    const newMarkets = new Set(localMarkets);
    sportMarkets.forEach((m) => newMarkets.add(makeCompositeKey(sportId, m.key)));
    setLocalMarkets(Array.from(newMarkets));
  };

  // Clear all markets for a specific sport
  const clearSportMarkets = (sportId: string, sportMarkets: ArbMarketOption[]) => {
    const keysToRemove = new Set(sportMarkets.map((m) => makeCompositeKey(sportId, m.key)));
    if (localMarkets.length === 0) {
      // Convert implicit "all selected" to explicit list minus this sport's markets
      const allCompositeKeys: string[] = [];
      availableMarkets.forEach((market) => {
        const sports = market.sports && market.sports.length > 0 ? market.sports : ["other"];
        sports.forEach((s) => {
          const key = makeCompositeKey(s, market.key);
          if (!keysToRemove.has(key)) allCompositeKeys.push(key);
        });
      });
      setLocalMarkets(allCompositeKeys);
    } else {
      setLocalMarkets(localMarkets.filter((m) => !keysToRemove.has(m)));
    }
  };

  // Toggle accordion section
  const toggleSportSection = (sportId: string) => {
    const newExpanded = new Set(expandedSportSections);
    if (newExpanded.has(sportId)) {
      newExpanded.delete(sportId);
    } else {
      newExpanded.add(sportId);
    }
    setExpandedSportSections(newExpanded);
  };

  // Prop market detection hints
  const PROP_MARKET_HINTS = [
    "player_", "batter_", "pitcher_", "goalscorer", "shots_on_goal",
    "shots_on_target", "player_shots", "yellow_cards", "to_be_carded", "fouls_committed",
  ];
  const isPropMarket = (marketKey: string) => {
    const lower = marketKey.toLowerCase();
    return PROP_MARKET_HINTS.some((hint) => lower.includes(hint));
  };

  const apply = async () => {
    await updateFilters({ 
      selectedBooks: localBooks, 
      selectedSports: localSports,
      selectedLeagues: localLeagues,
      selectedMarketTypes: localMarketTypes,
      selectedMarkets: localMarkets,
      minArb, 
      maxArb, 
      totalBetAmount,
      minLiquidity
    });
    setOpen(false);
  };

  const reset = async () => {
    const defaultBooks: string[] = []; // empty = all books included
    const defaultSports = allSports.map(s => s.id);
    const defaultLeagues = allLeagues.map(l => l.id);
    const defaultMarketTypes: MarketType[] = ['player', 'game'];
    const defaultMarkets: string[] = [];
    setLocalBooks(defaultBooks);
    setLocalSports(defaultSports);
    setLocalLeagues(defaultLeagues);
    setLocalMarketTypes(defaultMarketTypes);
    setLocalMarkets(defaultMarkets);
    setMinArb(0);
    setMaxArb(20);
    setTotalBetAmount(200);
    setMinLiquidity(50);
    await updateFilters({ 
      selectedBooks: defaultBooks, 
      selectedSports: defaultSports,
      selectedLeagues: defaultLeagues,
      selectedMarketTypes: defaultMarketTypes,
      selectedMarkets: defaultMarkets,
      minArb: 0, 
      maxArb: 20, 
      totalBetAmount: 200,
      minLiquidity: 50
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children ?? (
          <button
            className="filters-btn flex items-center gap-2 h-9 px-3 sm:px-4 rounded-lg text-sm font-medium transition-all"
            title="Filters & Settings"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-neutral-900 p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
            <SheetTitle className="text-lg font-semibold">Filters & Settings</SheetTitle>
          </SheetHeader>

          {!pro && (
            <div className="mx-6 mt-4 rounded-lg border border-[var(--tertiary)]/20 bg-gradient-to-br from-[var(--tertiary)]/5 via-transparent to-transparent p-4 dark:border-[var(--tertiary)]/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[var(--tertiary)]" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">Filters are a Sharp Feature</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {isLoggedIn ? 'Upgrade to unlock full filtering capabilities' : 'Try free to unlock full filtering capabilities'}
                    </p>
                  </div>
                </div>
                <ButtonLink href="/pricing" variant="pro" className="justify-center text-xs">
                  {isLoggedIn ? 'Upgrade to Sharp' : 'Try Free'}
                </ButtonLink>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <Tabs defaultValue="books" className="w-full">
              <TabsList className="filter-tabs grid w-full grid-cols-4">
                <TabsTrigger value="books" className="flex items-center justify-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Books</span>
                </TabsTrigger>
                <TabsTrigger value="sports" className="flex items-center justify-center gap-2">
                  <Trophy className="h-4 w-4" />
                  <span className="hidden sm:inline">Sports</span>
                </TabsTrigger>
                <TabsTrigger value="markets" className="flex items-center justify-center gap-2">
                  <Gamepad2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Markets</span>
                </TabsTrigger>
                <TabsTrigger value="roi" className="flex items-center justify-center gap-2">
                  <Percent className="h-4 w-4" />
                  <span className="hidden sm:inline">ROI</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="books" className="filter-section">
                <div className="filter-section-header flex items-center justify-between">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Choose sportsbooks to include in results</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => pro && setLocalBooks([])} 
                      disabled={!pro}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-brand transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={!pro ? "Sharp only" : ""}
                    >
                      Select All
                    </button>
                    <button 
                      onClick={() => pro && setLocalBooks([allBookIds[0]])} 
                      disabled={!pro}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={!pro ? "Sharp only" : ""}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="filter-grid">
                  {allBooks
                    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                    .map((sb) => {
                      const checked = isBookIncluded(sb.id);
                      return (
                        <label
                          key={sb.id}
                          className={`filter-card flex items-center gap-3 rounded-lg border p-3 ${
                            !pro ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-sm'
                          } ${
                            checked 
                              ? 'active' 
                              : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                          }`}
                          title={!pro ? "Sharp only" : ""}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleBook(sb.id)} disabled={!pro} />
                          {sb.image?.light && (
                            <img src={sb.image.light} alt={sb.name} className="h-6 w-6 object-contain" />
                          )}
                          <span className="text-sm leading-none">{sb.name}</span>
                        </label>
                      );
                    })}
                </div>
              </TabsContent>

              <TabsContent value="sports" className="filter-section">
                <div className="filter-section-header flex items-center justify-between">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Filter by sports and leagues</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        if (!pro) return;
                        const allSportsIds = allSports.map(s => s.id);
                        const allLeaguesIds = allLeagues.map(l => l.id);
                        setLocalSports(allSportsIds);
                        setLocalLeagues(allLeaguesIds);
                      }} 
                      disabled={!pro}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-brand transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={!pro ? "Sharp only" : ""}
                    >
                      Select All
                    </button>
                    <button 
                      onClick={() => {
                        if (!pro) return;
                        setLocalSports([]);
                        setLocalLeagues([]);
                      }} 
                      disabled={!pro}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={!pro ? "Sharp only" : ""}
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
                      const checked = localSports.includes(sport.id);
                      return (
                        <label
                          key={sport.id}
                          className={`filter-card flex items-center gap-3 rounded-lg border p-3 ${
                            !pro ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-sm'
                          } ${
                            checked 
                              ? 'active' 
                              : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                          }`}
                          title={!pro ? "Sharp only" : ""}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleSport(sport.id)} disabled={!pro} />
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
                      const checked = localLeagues.includes(league.id);
                      const sportSelected = localSports.length === 0 || localSports.includes(league.sportId);
                      const isDisabled = !pro || !sportSelected;
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
                          title={!pro ? "Sharp only" : !sportSelected ? "Select sport first" : ""}
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
                
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                  <p className="text-xs text-blue-900 dark:text-blue-100">
                    <strong>Tip:</strong> All sports and leagues are selected by default. Uncheck specific ones to narrow your results.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="markets" className="filter-section">
                {/* Market Type Toggle */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">Filter by market type</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={cn(
                        "filter-card flex items-center gap-3 rounded-xl border p-3.5 transition-all",
                        !pro ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:shadow-sm",
                        localMarketTypes.includes("player")
                          ? "border-brand/40 bg-brand/5 dark:border-brand/50 dark:bg-brand/10"
                          : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600"
                      )}
                      title={!pro ? "Sharp only" : ""}
                    >
                      <Checkbox
                        checked={localMarketTypes.includes("player")}
                        onCheckedChange={() => toggleMarketType("player")}
                        disabled={!pro}
                      />
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <span className="text-sm font-medium leading-none">Player Props</span>
                          <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">Individual stats</p>
                        </div>
                      </div>
                    </label>
                    <label
                      className={cn(
                        "filter-card flex items-center gap-3 rounded-xl border p-3.5 transition-all",
                        !pro ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:shadow-sm",
                        localMarketTypes.includes("game")
                          ? "border-brand/40 bg-brand/5 dark:border-brand/50 dark:bg-brand/10"
                          : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600"
                      )}
                      title={!pro ? "Sharp only" : ""}
                    >
                      <Checkbox
                        checked={localMarketTypes.includes("game")}
                        onCheckedChange={() => toggleMarketType("game")}
                        disabled={!pro}
                      />
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <Gamepad2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <span className="text-sm font-medium leading-none">Game Lines</span>
                          <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">Spreads, totals, ML</p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <Separator className="my-5" />

                {/* Specific Markets Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Markets</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
                        {allMarketsSelected ? "All" : flattenMarkets.length} selected
                      </span>
                      <button
                        onClick={() => pro && selectAllMarkets()}
                        disabled={!pro}
                        className="text-xs font-medium text-brand hover:text-brand/80 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                      >
                        All
                      </button>
                      <span className="text-neutral-300 dark:text-neutral-600">|</span>
                      <button
                        onClick={() => pro && clearAllMarkets()}
                        disabled={!pro}
                        className="text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Market Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search markets..."
                      value={marketSearchQuery}
                      onChange={(e) => setMarketSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 py-2.5 pl-10 pr-10 text-sm placeholder:text-neutral-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:text-white dark:placeholder:text-neutral-500 transition-shadow"
                    />
                    {marketSearchQuery && (
                      <button
                        onClick={() => setMarketSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Sport Accordion Sections */}
                  <div className="space-y-2.5">
                    {availableMarkets.length === 0 && (
                      <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                        No market options loaded yet. Refresh arbitrage data and reopen filters.
                      </div>
                    )}
                    {Object.entries(marketsBySport)
                      .sort(([a], [b]) => {
                        // Custom sort order for sports
                        const order = ["nba", "ncaab", "wnba", "nfl", "ncaaf", "nhl", "mlb", "soccer_epl", "other"];
                        return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
                      })
                      .map(([sportId, markets]) => {
                        // Filter markets by search query
                        const filteredMarkets = marketSearchQuery
                          ? markets.filter(
                              (m) =>
                                m.label.toLowerCase().includes(marketSearchQuery.toLowerCase()) ||
                                m.key.toLowerCase().includes(marketSearchQuery.toLowerCase())
                            )
                          : markets;

                        if (filteredMarkets.length === 0) return null;

                        // Split into game lines vs player props
                        const gameMarkets = filteredMarkets.filter((m) => !isPropMarket(m.key));
                        const propMarkets = filteredMarkets.filter((m) => isPropMarket(m.key));

                        const isExpanded = expandedSportSections.has(sportId) || !!marketSearchQuery;
                        const selectedCount =
                          localMarkets.length === 0
                            ? filteredMarkets.length
                            : filteredMarkets.filter((m) => isMarketSelectedForSport(sportId, m.key)).length;
                        const allSelected = selectedCount === filteredMarkets.length;
                        const sportLabel = SPORT_LABELS[sportId] || sportId.toUpperCase();

                        return (
                          <div
                            key={sportId}
                            className="rounded-xl border border-neutral-200 bg-white overflow-hidden dark:border-neutral-800 dark:bg-neutral-900/50"
                          >
                            {/* Accordion Header */}
                            <button
                              type="button"
                              onClick={() => toggleSportSection(sportId)}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                                  <SportIcon sport={sportId} className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                                </div>
                                <div className="text-left">
                                  <div className="text-sm font-semibold text-neutral-900 dark:text-white">{sportLabel}</div>
                                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                    {filteredMarkets.length} market{filteredMarkets.length !== 1 ? "s" : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                                    allSelected
                                      ? "bg-brand/10 text-brand dark:bg-brand/20"
                                      : selectedCount > 0
                                      ? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                                      : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
                                  )}
                                >
                                  {allSelected ? (
                                    <>
                                      <Check className="h-3 w-3" />
                                      All
                                    </>
                                  ) : (
                                    `${selectedCount}/${filteredMarkets.length}`
                                  )}
                                </div>
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 text-neutral-400 transition-transform duration-200",
                                    isExpanded && "rotate-180"
                                  )}
                                />
                              </div>
                            </button>

                            {/* Accordion Content */}
                            {isExpanded && (
                              <div className="border-t border-neutral-100 dark:border-neutral-800">
                                {/* Quick Actions */}
                                <div className="flex items-center justify-between px-4 py-2 bg-neutral-50/50 dark:bg-neutral-800/30">
                                  <span className="text-xs text-neutral-500 dark:text-neutral-400">Quick actions</span>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!pro) return;
                                        selectAllSportMarkets(sportId, filteredMarkets);
                                      }}
                                      disabled={!pro}
                                      className="rounded-md px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Select All
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!pro) return;
                                        clearSportMarkets(sportId, filteredMarkets);
                                      }}
                                      disabled={!pro}
                                      className="rounded-md px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>

                                {/* Markets Grid */}
                                <div className="p-3 max-h-[320px] overflow-y-auto">
                                  {/* Game Lines */}
                                  {gameMarkets.length > 0 && (
                                    <div className="mb-3">
                                      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2 px-1">
                                        Game Lines
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {gameMarkets.map((market) => {
                                          const checked = isMarketSelectedForSport(sportId, market.key);
                                          return (
                                            <button
                                              key={`${sportId}:${market.key}`}
                                              type="button"
                                              onClick={() => pro && toggleMarket(sportId, market.key)}
                                              disabled={!pro}
                                              className={cn(
                                                "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                                                !pro ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                                                checked
                                                  ? "border-brand/30 bg-brand/5 dark:border-brand/40 dark:bg-brand/10"
                                                  : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600"
                                              )}
                                            >
                                              <div
                                                className={cn(
                                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                                                  checked ? "border-brand bg-brand" : "border-neutral-300 dark:border-neutral-600"
                                                )}
                                              >
                                                {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                                              </div>
                                              <span
                                                className={cn(
                                                  "text-xs font-medium truncate",
                                                  checked ? "text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-400"
                                                )}
                                              >
                                                {market.label}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Player Props */}
                                  {propMarkets.length > 0 && (
                                    <div>
                                      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2 px-1">
                                        Player Props
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {propMarkets.map((market) => {
                                          const checked = isMarketSelectedForSport(sportId, market.key);
                                          return (
                                            <button
                                              key={`${sportId}:${market.key}`}
                                              type="button"
                                              onClick={() => pro && toggleMarket(sportId, market.key)}
                                              disabled={!pro}
                                              className={cn(
                                                "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                                                !pro ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                                                checked
                                                  ? "border-brand/30 bg-brand/5 dark:border-brand/40 dark:bg-brand/10"
                                                  : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600"
                                              )}
                                            >
                                              <div
                                                className={cn(
                                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                                                  checked ? "border-brand bg-brand" : "border-neutral-300 dark:border-neutral-600"
                                                )}
                                              >
                                                {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                                              </div>
                                              <span
                                                className={cn(
                                                  "text-xs font-medium truncate",
                                                  checked ? "text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-400"
                                                )}
                                              >
                                                {market.label}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="roi" className="mt-6 space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Min ROI %</Label>
                    <Input 
                      type="number" 
                      value={minArb} 
                      onChange={(e) => pro && setMinArb(Number(e.target.value))}
                      disabled={!pro}
                      className="h-10"
                      title={!pro ? "Sharp only" : ""}
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Only show opportunities at or above this percent</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Max ROI %</Label>
                    <Input
                      type="number"
                      value={pro ? maxArb : Math.min(maxArb, 1)}
                      onChange={(e) => pro && setMaxArb(Number(e.target.value))}
                      disabled={!pro}
                      className="h-10"
                      title={!pro ? "Sharp only" : ""}
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Hide outliers above this percent</p>
                    {!pro && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-500">
                        <Lock className="h-3 w-3" /> Locked on Free plan (max 1%)
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Total Bet Amount ($)</Label>
                    <Input 
                      type="number" 
                      value={totalBetAmount} 
                      onChange={(e) => pro && setTotalBetAmount(Number(e.target.value))}
                      disabled={!pro}
                      className="h-10"
                      title={!pro ? "Sharp only" : ""}
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Default total stake for equal-profit splits</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Min Liquidity ($)</Label>
                    <Input 
                      type="number" 
                      value={minLiquidity} 
                      onChange={(e) => pro && setMinLiquidity(Number(e.target.value))}
                      disabled={!pro}
                      className="h-10"
                      title={!pro ? "Sharp only" : ""}
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Hide arbs where max bet is below this amount</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="filter-footer">
            <div className="flex items-center justify-between gap-3">
              <button 
                onClick={reset}
                disabled={!pro}
                className="h-10 rounded-lg border border-transparent px-4 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                title={!pro ? "Sharp only" : ""}
              >
                Reset All
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => setOpen(false)}
                  className="h-10 rounded-lg border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                >
                  {pro ? 'Cancel' : 'Close'}
                </button>
                <button 
                  onClick={apply}
                  disabled={!pro}
                  className={`apply-btn h-10 rounded-lg border border-brand bg-brand px-5 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand ${hasUnsavedChanges ? 'active' : ''}`}
                  title={!pro ? "Sharp only" : ""}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
