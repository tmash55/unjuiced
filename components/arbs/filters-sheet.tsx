"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/seperator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import { getAllSports, getAllLeagues, getLeaguesBySport } from "@/lib/data/sports";
import { useArbitragePreferences } from "@/context/preferences-context";
import { Filter, Building2, Percent, Trophy, User, Gamepad2 } from "lucide-react";
import { SportIcon } from "@/components/icons/sport-icons";
import Lock from "@/icons/lock";
import { ButtonLink } from "@/components/button-link";
import type { MarketType } from "@/lib/arb-filters";

export function FiltersSheet({ children, pro = false, isLoggedIn = false }: { children?: React.ReactNode; pro?: boolean; isLoggedIn?: boolean }) {
  const { filters, updateFilters } = useArbitragePreferences();
  const allBooks = useMemo(() => getAllActiveSportsbooks(), []);
  const allSports = useMemo(() => getAllSports(), []);
  const allLeagues = useMemo(() => getAllLeagues(), []);
  const [open, setOpen] = useState(false);

  const [localBooks, setLocalBooks] = useState<string[]>(filters.selectedBooks || []);
  const [localSports, setLocalSports] = useState<string[]>(filters.selectedSports || []);
  const [localLeagues, setLocalLeagues] = useState<string[]>(filters.selectedLeagues || []);
  const [localMarketTypes, setLocalMarketTypes] = useState<MarketType[]>(filters.selectedMarketTypes || ['player', 'game']);
  const [minArb, setMinArb] = useState<number>(filters.minArb ?? 0);
  const [maxArb, setMaxArb] = useState<number>(filters.maxArb ?? 20);
  const [totalBetAmount, setTotalBetAmount] = useState<number>(filters.totalBetAmount ?? 200);
  const [minLiquidity, setMinLiquidity] = useState<number>(filters.minLiquidity ?? 50);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Keep local UI state in sync when preferences load or change
  useEffect(() => {
    setLocalBooks(filters.selectedBooks || []);
    setLocalSports(filters.selectedSports || []);
    setLocalLeagues(filters.selectedLeagues || []);
    setLocalMarketTypes(filters.selectedMarketTypes || ['player', 'game']);
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
      minArb !== (filters.minArb ?? 0) ||
      maxArb !== (filters.maxArb ?? 20) ||
      totalBetAmount !== (filters.totalBetAmount ?? 200) ||
      minLiquidity !== (filters.minLiquidity ?? 50);
    
    setHasUnsavedChanges(changed);
  }, [localBooks, localSports, localLeagues, localMarketTypes, minArb, maxArb, totalBetAmount, minLiquidity, filters]);

  const toggleBook = (id: string) => {
    setLocalBooks(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
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

  const apply = async () => {
    await updateFilters({ 
      selectedBooks: localBooks, 
      selectedSports: localSports,
      selectedLeagues: localLeagues,
      selectedMarketTypes: localMarketTypes,
      minArb, 
      maxArb, 
      totalBetAmount,
      minLiquidity
    });
    setOpen(false);
  };

  const reset = async () => {
    const defaultBooks = allBooks.map(b => b.id);
    const defaultSports = allSports.map(s => s.id);
    const defaultLeagues = allLeagues.map(l => l.id);
    const defaultMarketTypes: MarketType[] = ['player', 'game'];
    setLocalBooks(defaultBooks);
    setLocalSports(defaultSports);
    setLocalLeagues(defaultLeagues);
    setLocalMarketTypes(defaultMarketTypes);
    setMinArb(0);
    setMaxArb(20);
    setTotalBetAmount(200);
    setMinLiquidity(50);
    await updateFilters({ 
      selectedBooks: defaultBooks, 
      selectedSports: defaultSports,
      selectedLeagues: defaultLeagues,
      selectedMarketTypes: defaultMarketTypes,
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
                      onClick={() => pro && setLocalBooks(allBooks.map(b => b.id))} 
                      disabled={!pro}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-brand transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={!pro ? "Pro only" : ""}
                    >
                      Select All
                    </button>
                    <button 
                      onClick={() => pro && setLocalBooks([])} 
                      disabled={!pro}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={!pro ? "Pro only" : ""}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="filter-grid">
                  {allBooks
                    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                    .map((sb) => {
                      const checked = localBooks.includes(sb.id);
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
                          title={!pro ? "Pro only" : ""}
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
                      title={!pro ? "Pro only" : ""}
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
                      title={!pro ? "Pro only" : ""}
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
                          title={!pro ? "Pro only" : ""}
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
                          title={!pro ? "Pro only" : !sportSelected ? "Select sport first" : ""}
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
                <div className="filter-section-header flex items-center justify-between">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">Filter by market type</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => pro && setLocalMarketTypes(['player', 'game'])} 
                      disabled={!pro}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-brand transition-colors hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={!pro ? "Pro only" : ""}
                    >
                      Select All
                    </button>
                    <button 
                      onClick={() => pro && setLocalMarketTypes([])} 
                      disabled={!pro}
                      className="h-8 rounded-md border border-transparent px-3 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      title={!pro ? "Pro only" : ""}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Player Props */}
                  <label
                    className={`filter-card flex items-center gap-4 rounded-lg border p-4 ${
                      !pro ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-sm'
                    } ${
                      localMarketTypes.includes('player')
                        ? 'active' 
                        : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                    }`}
                    title={!pro ? "Pro only" : ""}
                  >
                    <Checkbox 
                      checked={localMarketTypes.includes('player')} 
                      onCheckedChange={() => toggleMarketType('player')} 
                      disabled={!pro} 
                    />
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <span className="text-sm font-medium leading-none">Player Props</span>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          Points, assists, rebounds, touchdowns, etc.
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Game Props */}
                  <label
                    className={`filter-card flex items-center gap-4 rounded-lg border p-4 ${
                      !pro ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-sm'
                    } ${
                      localMarketTypes.includes('game')
                        ? 'active' 
                        : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600'
                    }`}
                    title={!pro ? "Pro only" : ""}
                  >
                    <Checkbox 
                      checked={localMarketTypes.includes('game')} 
                      onCheckedChange={() => toggleMarketType('game')} 
                      disabled={!pro} 
                    />
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                        <Gamepad2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <span className="text-sm font-medium leading-none">Game Props</span>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          Moneyline, spreads, totals, team props
                        </p>
                      </div>
                    </div>
                  </label>
                </div>

                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                  <p className="text-xs text-blue-900 dark:text-blue-100">
                    <strong>Tip:</strong> Filter to only see player prop or game prop arbitrage opportunities.
                  </p>
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
                      title={!pro ? "Pro only" : ""}
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
                      title={!pro ? "Pro only" : ""}
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
                      title={!pro ? "Pro only" : ""}
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
                      title={!pro ? "Pro only" : ""}
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
                title={!pro ? "Pro only" : ""}
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
                  title={!pro ? "Pro only" : ""}
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