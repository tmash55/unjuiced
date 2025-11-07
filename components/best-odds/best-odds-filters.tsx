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
import { formatMarketLabel } from "@/lib/data/markets";
import { normalizeSportsbookName } from "@/lib/best-odds-filters";
import type { BestOddsPrefs } from "@/lib/best-odds-schema";
import { Filter, Building2, Target, TrendingUp } from "lucide-react";
import { SportIcon } from "@/components/icons/sport-icons";

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
}

export function BestOddsFilters({
  prefs,
  onPrefsChange,
  availableLeagues,
  availableMarkets,
  availableSportsbooks,
  deals = [],
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
  const [localMinImprovement, setLocalMinImprovement] = useState<number>(prefs.minImprovement);
  const [localMaxOdds, setLocalMaxOdds] = useState<number | undefined>(prefs.maxOdds);
  const [localMinOdds, setLocalMinOdds] = useState<number | undefined>(prefs.minOdds);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Keep local UI state in sync when preferences load or change
  useEffect(() => {
    setLocalBooks(prefs.selectedBooks);
    setLocalLeagues(prefs.selectedLeagues.length === 0 ? availableLeagues : prefs.selectedLeagues);
    setLocalMarkets(prefs.selectedMarkets);
    setLocalMinImprovement(prefs.minImprovement);
    setLocalMaxOdds(prefs.maxOdds);
    setLocalMinOdds(prefs.minOdds);
    
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
    const changed =
      localBooks.length !== prefs.selectedBooks.length ||
      localBooks.some(id => !prefs.selectedBooks.includes(id)) ||
      localLeagues.length !== prefs.selectedLeagues.length ||
      localLeagues.some(id => !prefs.selectedLeagues.includes(id)) ||
      localMarkets.length !== prefs.selectedMarkets.length ||
      localMarkets.some(id => !prefs.selectedMarkets.includes(id)) ||
      localMinImprovement !== prefs.minImprovement ||
      localMaxOdds !== prefs.maxOdds ||
      localMinOdds !== prefs.minOdds;

    setHasUnsavedChanges(changed);
  }, [localBooks, localLeagues, localMarkets, localMinImprovement, localMaxOdds, localMinOdds, prefs]);

  // League display names
  const leagueLabels: Record<string, string> = {
    nba: 'NBA',
    nfl: 'NFL',
    nhl: 'NHL',
    ncaaf: 'NCAAF',
    ncaab: 'NCAAB',
    mlb: 'MLB',
    wnba: 'WNBA',
  };

  // Group markets by sport type
  const groupedMarkets = useMemo(() => {
    const groups: Record<string, string[]> = {
      Basketball: [],
      Football: [],
      Hockey: [],
      Baseball: [],
    };

    availableMarkets.forEach(market => {
      const m = market.toLowerCase();

      if (m.includes('point') || m.includes('rebound') || m.includes('assist') ||
          m.includes('three') || m.includes('block') || m.includes('steal') ||
          m.includes('pra') || m.includes('double')) {
        groups.Basketball.push(market);
      } else if (m.includes('pass') || m.includes('rush') || m.includes('reception') ||
                 m.includes('receiving') || m.includes('touchdown') || m.includes('yard') ||
                 m.includes('sack') || m.includes('interception')) {
        groups.Football.push(market);
      } else if (m.includes('goal') || m.includes('save') || m.includes('shot') ||
                 m.includes('power_play')) {
        groups.Hockey.push(market);
      } else if (m.includes('hit') || m.includes('run') || m.includes('rbi') ||
                 m.includes('strikeout') || m.includes('base') || m.includes('home_run')) {
        groups.Baseball.push(market);
      } else {
        groups.Football.push(market); // Default
      }
    });

    // Remove empty groups
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) {
        delete groups[key];
      }
    });

    return groups;
  }, [availableMarkets]);

  const toggleBook = (id: string) => {
    // Toggle deselection: if in array, remove it (select it); if not in array, add it (deselect it)
    setLocalBooks(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };

  const toggleSport = (id: string) => {
    setLocalSports(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleLeague = (id: string) => {
    setLocalLeagues(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const toggleMarket = (id: string) => {
    setLocalMarkets(prev => {
      // If empty (all selected), clicking one means "deselect this one, keep all others"
      if (prev.length === 0) {
        return availableMarkets.filter(m => m !== id);
      }
      // Otherwise, normal toggle
      return prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id];
    });
  };

  const apply = () => {
    // Convert UI state to backend format:
    // If all items are selected in UI, send empty array to backend (meaning "show all")
    const allLeaguesInUI = localLeagues.length === availableLeagues.length;
    const allMarketsInUI = localMarkets.length === availableMarkets.length;
    
    onPrefsChange({
      ...prefs,
      selectedBooks: localBooks, // Empty = all selected (deselection logic)
      selectedSports: [], // Not used by backend, only for UI state
      selectedLeagues: allLeaguesInUI ? [] : localLeagues, // Empty = all selected
      selectedMarkets: allMarketsInUI ? [] : localMarkets, // Empty = all selected
      minImprovement: localMinImprovement,
      maxOdds: localMaxOdds,
      minOdds: localMinOdds,
    });
    setOpen(false);
  };

  const reset = () => {
    // Reset to all selected (populate UI with all IDs, backend will receive empty arrays)
    setLocalBooks([]);
    setLocalSports(allSports.map(s => s.id));
    setLocalLeagues(availableLeagues);
    setLocalMarkets(availableMarkets);
    setLocalMinImprovement(0);
    setLocalMaxOdds(undefined);
    setLocalMinOdds(undefined);
    
    onPrefsChange({
      ...prefs,
      selectedBooks: [],
      selectedSports: [],
      selectedLeagues: [],
      selectedMarkets: [],
      minImprovement: 0,
      maxOdds: undefined,
      minOdds: undefined,
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="filters-btn flex items-center gap-2 h-9 px-3 sm:px-4 rounded-lg text-sm font-medium transition-all"
          title="Filters"
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 dark:bg-blue-500 px-1.5 text-xs font-semibold text-white">
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
                      onClick={() => setLocalBooks([])}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-brand transition-colors hover:bg-brand/10"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setLocalBooks(allSportsbooks.map(sb => sb.id))}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
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
                          className={`filter-card flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:shadow-sm ${
                            checked
                              ? 'active'
                              : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                          }`}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleBook(sb.id)} />
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
                        // Add all IDs to show all as checked (backend: empty = show all, but UI shows all checked)
                        setLocalSports(allSports.map(s => s.id));
                        setLocalLeagues(allLeagues.map(l => l.id));
                      }}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-brand transition-colors hover:bg-brand/10"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => {
                        // Empty arrays = no filter (backend shows all, but UI shows none checked)
                        setLocalSports([]);
                        setLocalLeagues([]);
                      }}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
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
                          className={`filter-card flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:shadow-sm ${
                            checked
                              ? 'active'
                              : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                          }`}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleSport(sport.id)} />
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
                      return (
                        <label
                          key={league.id}
                          className={`filter-card flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:shadow-sm ${
                            !sportSelected
                              ? 'opacity-50 cursor-not-allowed'
                              : checked
                                ? 'active'
                                : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                          }`}
                          onClick={(e) => {
                            if (!sportSelected) e.preventDefault();
                          }}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => sportSelected && toggleLeague(league.id)}
                            disabled={!sportSelected}
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
                              className="h-6 rounded-md border border-transparent px-2 text-[10px] font-medium text-brand transition-colors hover:bg-brand/10"
                            >
                              Select All
                            </button>
                            <button
                              onClick={() => {
                                // Remove these markets from selection (deselect them)
                                setLocalMarkets(prev => prev.filter(m => !markets.includes(m)));
                              }}
                              className="h-6 rounded-md border border-transparent px-2 text-[10px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        <div className="filter-grid">
                          {markets.map(market => {
                            const checked = allMarketsSelected || localMarkets.includes(market);
                            return (
                              <label
                                key={market}
                                className={`filter-card flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:shadow-sm ${
                                  checked
                                    ? 'active'
                                    : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                                }`}
                              >
                                <Checkbox checked={checked} onCheckedChange={() => toggleMarket(market)} />
                                <span className="text-sm leading-none">{formatMarketLabel(market)}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                  <p className="text-xs text-blue-900 dark:text-blue-100">
                    <strong>Tip:</strong> All leagues and markets are selected by default. Uncheck specific ones to narrow your results.
                  </p>
                </div>
              </TabsContent>

              {/* Edge & Odds Tab */}
              <TabsContent value="odds" className="mt-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Edge %</Label>
                  <Input
                    type="number"
                    value={localMinImprovement}
                    onChange={(e) => setLocalMinImprovement(Number(e.target.value))}
                    className="h-10"
                    min="0"
                    step="0.1"
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
                        const val = e.target.value.trim();
                        setLocalMinOdds(val === '' ? undefined : Number(val));
                      }}
                      placeholder="No minimum"
                      className="h-10"
                      min="-1000"
                      step="5"
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Filter out odds below this value</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Max Odds</Label>
                    <Input
                      type="number"
                      value={localMaxOdds ?? ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setLocalMaxOdds(val === '' ? undefined : Number(val));
                      }}
                      placeholder="No maximum"
                      className="h-10"
                      min="-1000"
                      step="5"
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
                className="h-10 rounded-lg border border-transparent px-4 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              >
                Reset All
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="h-10 rounded-lg border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={apply}
                  className={`apply-btn h-10 rounded-lg border border-brand bg-brand px-5 text-sm font-medium text-white hover:bg-brand/90 ${hasUnsavedChanges ? 'active' : ''}`}
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
