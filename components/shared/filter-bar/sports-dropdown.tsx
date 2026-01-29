"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, Check, X, Info } from "lucide-react";
import { SportIcon } from "@/components/icons/sport-icons";
import { Tooltip } from "@/components/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FilterTool } from "./unified-filter-bar";

// League/Sport labels
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

const PROP_MARKET_HINTS = [
  "player_",
  "batter_",
  "pitcher_",
  "goalscorer",
  "shots_on_goal",
  "shots_on_target",
  "player_shots",
  "yellow_cards",
  "to_be_carded",
  "fouls_committed",
];

// Period detection patterns and their sort order
const PERIOD_PATTERNS: { pattern: RegExp; label: string; order: number }[] = [
  { pattern: /^1st_quarter|^1q_|_1q_|_1q$|game_1q/, label: "1st Quarter", order: 2 },
  { pattern: /^2nd_quarter|^2q_|_2q_|_2q$/, label: "2nd Quarter", order: 3 },
  { pattern: /^3rd_quarter|^3q_|_3q_|_3q$/, label: "3rd Quarter", order: 4 },
  { pattern: /^4th_quarter|^4q_|_4q_|_4q$/, label: "4th Quarter", order: 5 },
  { pattern: /^1st_half|^1h_|_1h_|_1h$|game_1h/, label: "1st Half", order: 6 },
  { pattern: /^2nd_half|^2h_|_2h_|_2h$/, label: "2nd Half", order: 7 },
  { pattern: /^1st_period|^1p_|_1p_|_1p$|game_1p/, label: "1st Period", order: 2 },
  { pattern: /^2nd_period|^2p_|_2p_|_2p$/, label: "2nd Period", order: 3 },
  { pattern: /^3rd_period|^3p_|_3p_|_3p$/, label: "3rd Period", order: 4 },
  { pattern: /^1st_drive|^1d_/, label: "1st Drive", order: 8 },
  { pattern: /^1st_3_minutes/, label: "1st 3 Minutes", order: 9 },
  { pattern: /^1st_5_minutes/, label: "1st 5 Minutes", order: 9 },
  { pattern: /^1st_10_minutes/, label: "1st 10 Minutes", order: 9 },
];

function getMarketPeriod(marketKey: string): { label: string; order: number } {
  const lower = marketKey.toLowerCase();
  for (const { pattern, label, order } of PERIOD_PATTERNS) {
    if (pattern.test(lower)) {
      return { label, order };
    }
  }
  return { label: "Full Game", order: 1 };
}

interface MarketOption {
  key: string;
  label: string;
  sports?: string[];
}

interface MarketWithPeriod extends MarketOption {
  period: string;
  periodOrder: number;
}

interface SportsDropdownProps {
  tool: FilterTool;
  
  // For Positive EV (sports)
  selectedSports?: string[];
  onSportsChange?: (sports: string[]) => void;
  availableSports?: string[];
  
  // For Edge Finder (leagues)
  selectedLeagues?: string[];
  onLeaguesChange?: (leagues: string[]) => void;
  availableLeagues?: string[];
  
  // Markets (shared)
  selectedMarkets: string[];
  onMarketsChange: (markets: string[]) => void;
  availableMarkets: MarketOption[];
  
  disabled?: boolean;
}

export function SportsDropdown({
  tool,
  selectedSports = [],
  onSportsChange,
  availableSports = ["nba", "nfl", "ncaaf", "ncaab", "nhl", "mlb"],
  selectedLeagues = [],
  onLeaguesChange,
  availableLeagues = ["nba", "nfl", "ncaaf", "ncaab", "nhl", "mlb", "wnba", "soccer_epl"],
  selectedMarkets,
  onMarketsChange,
  availableMarkets,
  disabled = false,
}: SportsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [marketSearch, setMarketSearch] = useState("");

  // Determine if using sports or leagues based on tool
  const isPositiveEV = tool === "positive-ev";
  const propSelected = isPositiveEV ? selectedSports : selectedLeagues;
  const available = isPositiveEV ? availableSports : availableLeagues;
  const propOnChange = isPositiveEV ? onSportsChange : onLeaguesChange;

  // Local state for pending changes - only apply when dropdown closes
  const [localSelected, setLocalSelected] = useState<string[]>(propSelected);
  const [localMarkets, setLocalMarkets] = useState<string[]>(selectedMarkets);
  const [wasOpen, setWasOpen] = useState(false);

  // Sync local state with props ONLY when dropdown transitions from closed to open
  useEffect(() => {
    if (open && !wasOpen) {
      // Dropdown just opened - sync local state with props
      console.log('[SportsDropdown] Dropdown opened - syncing state:', { propSelected, selectedMarkets });
      setLocalSelected(propSelected);
      setLocalMarkets(selectedMarkets);
    }
    setWasOpen(open);
  }, [open, wasOpen, propSelected, selectedMarkets]);

  // Handle dropdown close - apply pending changes only when closing
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && open) {
      // Dropdown is closing - apply pending changes if different
      const sportsChanged = JSON.stringify([...localSelected].sort()) !== JSON.stringify([...propSelected].sort());
      const marketsChanged = JSON.stringify([...localMarkets].sort()) !== JSON.stringify([...selectedMarkets].sort());
      
      console.log('[SportsDropdown] Closing - checking changes:', {
        tool,
        localSelected,
        propSelected,
        sportsChanged,
        marketsChanged
      });
      
      if (sportsChanged && propOnChange) {
        console.log('[SportsDropdown] Calling propOnChange with:', localSelected);
        propOnChange(localSelected);
      }
      if (marketsChanged) {
        onMarketsChange(localMarkets);
      }
    }
    setOpen(newOpen);
  }, [open, localSelected, propSelected, localMarkets, selectedMarkets, propOnChange, onMarketsChange, tool]);

  // Use local state for display
  const selected = localSelected;

  // Get the first selected sport for the icon
  const primarySport = selected.length > 0 ? selected[0] : available[0];

  // Check if all sports/leagues are selected
  const allSportsSelected = selected.length === 0 || selected.length === available.length;
  
  // Check if all markets are selected (empty = all)
  const allMarketsSelected = localMarkets.length === 0;

  // Toggle sport/league selection - update LOCAL state only
  const toggleSportLeague = (id: string) => {
    // Check if this item is currently "selected" (showing as checked)
    const isCurrentlySelected = selected.length === 0 || selected.includes(id);
    
    console.log('[SportsDropdown] Toggling:', id, 'Current selected:', selected, 'Is selected?', isCurrentlySelected);

    if (isCurrentlySelected) {
      // We're deselecting this item
      if (selected.length === 0) {
        // All were selected (empty array), now select all EXCEPT this one
        const newState = available.filter((s) => s !== id);
        console.log('[SportsDropdown] Deselecting from ALL -> New state:', newState);
        setLocalSelected(newState);
      } else if (selected.length === 1 && selected[0] === id) {
        // Only one was selected and we're deselecting it - reset to all
        console.log('[SportsDropdown] Deselecting last one -> Reset to ALL');
        setLocalSelected([]);
      } else {
        // Multiple were selected, just remove this one
        const newState = selected.filter((s) => s !== id);
        console.log('[SportsDropdown] Deselecting one -> New state:', newState);
        setLocalSelected(newState);
      }
    } else {
      // We're selecting this item (adding it to the list)
      const newState = [...selected, id];
      console.log('[SportsDropdown] Selecting -> New state:', newState);
      setLocalSelected(newState);
    }
  };

  // Select all sports/leagues - update LOCAL state only
  const selectAllSports = () => {
    setLocalSelected([]);
  };

  // Clear all sports/leagues - update LOCAL state only
  const clearAllSports = () => {
    // Select just the first one (can't have none)
    setLocalSelected([available[0]]);
  };

  const allMarketKeys = useMemo(() => availableMarkets.map(m => m.key), [availableMarkets]);

  const isPropMarket = useCallback((marketKey: string) => {
    const lower = marketKey.toLowerCase();
    return PROP_MARKET_HINTS.some((hint) => lower.includes(hint));
  }, []);

  const marketsBySport = useMemo(() => {
    const grouped: Record<string, { game: MarketWithPeriod[]; props: MarketWithPeriod[] }> = {};
    const searchLower = marketSearch.trim().toLowerCase();

    const matchesSearch = (market: MarketOption) => {
      if (!searchLower) return true;
      return (
        market.label.toLowerCase().includes(searchLower) ||
        market.key.toLowerCase().includes(searchLower)
      );
    };

    availableMarkets.forEach((market) => {
      if (!matchesSearch(market)) return;

      const marketSports = market.sports && market.sports.length > 0 ? market.sports : ["other"];
      const target = isPropMarket(market.key) ? "props" : "game";
      const { label: period, order: periodOrder } = getMarketPeriod(market.key);

      const marketWithPeriod: MarketWithPeriod = {
        ...market,
        period,
        periodOrder,
      };

      marketSports.forEach((sport) => {
        if (!grouped[sport]) {
          grouped[sport] = { game: [], props: [] };
        }
        grouped[sport][target].push(marketWithPeriod);
      });
    });

    // Sort markets within each category by period order, then alphabetically
    Object.values(grouped).forEach((sportGroup) => {
      sportGroup.game.sort((a, b) => a.periodOrder - b.periodOrder || a.label.localeCompare(b.label));
      sportGroup.props.sort((a, b) => a.periodOrder - b.periodOrder || a.label.localeCompare(b.label));
    });

    return grouped;
  }, [availableMarkets, marketSearch, isPropMarket]);

  const sportsWithMarkets = useMemo(() => {
    const marketSports = new Set<string>();
    availableMarkets.forEach((market) => {
      (market.sports && market.sports.length > 0 ? market.sports : ["other"]).forEach((sport) => {
        marketSports.add(sport);
      });
    });
    const ordered = [...available, ...Array.from(marketSports)];
    return Array.from(new Set(ordered));
  }, [available, availableMarkets]);

  // Helper to create composite key for sport-specific market selection
  const makeCompositeKey = useCallback((sport: string, marketKey: string) => {
    return `${sport}:${marketKey}`;
  }, []);

  // Helper to check if a market is selected for a specific sport
  // Checks both sport-specific key (nba:player_points) and global key (player_points)
  const isMarketSelectedForSport = useCallback((sport: string, marketKey: string) => {
    if (localMarkets.length === 0) return true; // All selected
    const compositeKey = makeCompositeKey(sport, marketKey);
    // Selected if: composite key is in list, OR plain key is in list (backwards compat)
    return localMarkets.includes(compositeKey) || localMarkets.includes(marketKey);
  }, [localMarkets, makeCompositeKey]);

  // Get selected count for a sport's markets
  const getSelectedCount = useCallback((sport: string, marketKeys: string[]) => {
    if (marketKeys.length === 0) return 0;
    if (localMarkets.length === 0) return marketKeys.length;
    return marketKeys.filter((key) => isMarketSelectedForSport(sport, key)).length;
  }, [localMarkets, isMarketSelectedForSport]);

  // Toggle individual market for a specific sport - update LOCAL state only
  const toggleMarket = useCallback((sport: string, marketKey: string) => {
    const compositeKey = makeCompositeKey(sport, marketKey);
    
    if (localMarkets.length === 0) {
      // Currently all selected - user wants to deselect this sport:market combo
      // Build list of all composite keys EXCEPT this one
      const allCompositeKeys: string[] = [];
      availableMarkets.forEach((m) => {
        const sports = m.sports && m.sports.length > 0 ? m.sports : ["other"];
        sports.forEach((s) => {
          const key = makeCompositeKey(s, m.key);
          if (key !== compositeKey) {
            allCompositeKeys.push(key);
          }
        });
      });
      setLocalMarkets(allCompositeKeys);
    } else if (localMarkets.includes(compositeKey)) {
      // Deselect this composite key
      const newSelected = localMarkets.filter(m => m !== compositeKey);
      setLocalMarkets(newSelected);
    } else if (localMarkets.includes(marketKey)) {
      // Has global key, need to convert to sport-specific
      // Remove global key, add composite keys for all OTHER sports
      const otherSports = (availableMarkets.find(m => m.key === marketKey)?.sports || [])
        .filter(s => s !== sport);
      const newSelected = localMarkets
        .filter(m => m !== marketKey)
        .concat(otherSports.map(s => makeCompositeKey(s, marketKey)));
      setLocalMarkets(newSelected);
    } else {
      // Add this composite key
      setLocalMarkets([...localMarkets, compositeKey]);
    }
  }, [localMarkets, makeCompositeKey, availableMarkets]);

  // Select all markets - update LOCAL state only
  const selectAllMarkets = () => {
    setLocalMarkets([]);
  };

  // Clear all markets (select none - but we'll just select the first category) - update LOCAL state only
  const clearAllMarkets = () => {
    if (allMarketKeys.length > 0) {
      setLocalMarkets([allMarketKeys[0]]);
    }
  };

  // Summary text for button - use PROP state (not local) for the button display
  // since we only want to show committed state in the trigger
  const propAllSportsSelected = propSelected.length === 0 || propSelected.length === available.length;
  const propAllMarketsSelected = selectedMarkets.length === 0;
  const propPrimarySport = propSelected.length > 0 ? propSelected[0] : available[0];
  
  const getSummaryText = () => {
    // For arbitrage, use "Leagues" label, for positive-ev use "Sports", for edge-finder use "Leagues"
    const entityLabel = tool === "positive-ev" ? "Sport" : "League";
    const entityLabelPlural = tool === "positive-ev" ? "Sports" : "Leagues";
    const sportsText = propAllSportsSelected 
      ? `All ${entityLabelPlural}` 
      : `${propSelected.length} ${propSelected.length !== 1 ? entityLabelPlural : entityLabel}`;
    const marketsText = propAllMarketsSelected 
      ? "All Markets" 
      : `${selectedMarkets.length} Market${selectedMarkets.length !== 1 ? "s" : ""}`;
    return { sportsText, marketsText };
  };

  const { sportsText, marketsText } = getSummaryText();

  const formatSportLabel = useCallback((sportId: string) => {
    if (sportId === "other") return "Other / Multi-Sport";
    return SPORT_LABELS[sportId] || sportId.toUpperCase();
  }, []);

  const formatSportsList = useCallback((sports?: string[]) => {
    if (!sports || sports.length === 0) return "All supported sports";
    return sports.map((sport) => formatSportLabel(sport)).join(", ");
  }, [formatSportLabel]);

  const getMarketTooltip = useCallback((market: MarketOption, currentSport: string) => {
    const sportLabel = formatSportLabel(currentSport);
    const otherSports = (market.sports || []).filter(s => s !== currentSport);
    if (otherSports.length > 0) {
      const otherSportsText = otherSports.map(s => formatSportLabel(s)).join(", ");
      return `${market.label} for ${sportLabel} • Also available in: ${otherSportsText}`;
    }
    return `${market.label} for ${sportLabel}`;
  }, [formatSportLabel]);

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          className={cn(
            "flex items-center gap-2 h-8 px-3 rounded-lg text-sm font-medium transition-all",
            "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
            "border border-neutral-200/80 dark:border-neutral-700/80",
            "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <SportIcon sport={propPrimarySport} className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">
            {tool === "arbitrage" ? (
              // Arbitrage: only show leagues, no markets
              !propAllSportsSelected ? (
                <span className="text-neutral-500 dark:text-neutral-400">{sportsText}</span>
              ) : (
                "Leagues"
              )
            ) : (
              // Positive EV / Edge Finder: show both sports/leagues and markets
              !propAllSportsSelected || !propAllMarketsSelected ? (
                <span className="text-neutral-500 dark:text-neutral-400">
                  {!propAllSportsSelected && sportsText}
                  {!propAllSportsSelected && !propAllMarketsSelected && " · "}
                  {!propAllMarketsSelected && marketsText}
                </span>
              ) : (
                "Filters"
              )
            )}
          </span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="start" 
        className={cn(
          "p-0 overflow-hidden",
          tool === "arbitrage" ? "w-[220px]" : "w-[800px]"
        )}
        sideOffset={4}
      >
        <div className={cn("flex", tool === "arbitrage" ? "h-[300px]" : "h-[600px]")}>
          {/* Left Column - Sports/Leagues */}
          <div className={cn(
            "border-r border-neutral-200 dark:border-neutral-700 flex flex-col",
            tool === "arbitrage" ? "w-full border-r-0" : "w-[200px]"
          )}>
            <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  {isPositiveEV ? "Sports" : "Leagues"}
                </span>
              </div>
              <div className="flex gap-1 mt-2">
                <button
                  onClick={selectAllSports}
                  className={cn(
                    "flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                    allSportsSelected
                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                      : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                  )}
                >
                  All
                </button>
                <button
                  onClick={clearAllSports}
                  className="flex-1 px-2 py-1 rounded text-[10px] font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {available.map((id) => {
                const isSelected = selected.length === 0 || selected.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleSportLeague(id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all",
                      isSelected
                        ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                        : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                      isSelected
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-neutral-300 dark:border-neutral-600"
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <SportIcon sport={id} className="w-4 h-4" />
                    <span>{SPORT_LABELS[id] || id.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
            
            {/* Footer for arbitrage (when no markets column) */}
            {tool === "arbitrage" && (
              <div className="px-3 py-2 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex justify-end">
                <button
                  onClick={() => handleOpenChange(false)}
                  className="px-4 py-1.5 rounded-md text-xs font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>

          {/* Right Column - Markets (hidden for arbitrage) */}
          {tool !== "arbitrage" && (
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    Markets
                  </span>
                  <Tooltip content="Game Lines are team markets (spread, total, moneyline). Player Props are individual player stats.">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 bg-white dark:bg-neutral-900">
                      <Info className="w-3 h-3" />
                    </span>
                  </Tooltip>
                </div>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                  {allMarketsSelected ? "All" : localMarkets.length} selected
                </span>
              </div>
              
              <div className="flex gap-1 mb-2">
                <button
                  onClick={selectAllMarkets}
                  className={cn(
                    "flex-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                    allMarketsSelected
                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                      : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                  )}
                >
                  All
                </button>
                <button
                  onClick={clearAllMarkets}
                  className="flex-1 px-2 py-1 rounded text-[10px] font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search markets..."
                  value={marketSearch}
                  onChange={(e) => setMarketSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                />
                {marketSearch && (
                  <button
                    onClick={() => setMarketSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {sportsWithMarkets.map((sportId) => {
                const sportMarkets = marketsBySport[sportId];
                if (!sportMarkets || (sportMarkets.game.length === 0 && sportMarkets.props.length === 0)) {
                  return null;
                }

                const isSportSelected = sportId === "other" || selected.length === 0 || selected.includes(sportId);
                const sportLabel = formatSportLabel(sportId);

                const gameKeys = sportMarkets.game.map((m) => m.key);
                const propKeys = sportMarkets.props.map((m) => m.key);

                const gameSelectedCount = getSelectedCount(sportId, gameKeys);
                const propSelectedCount = getSelectedCount(sportId, propKeys);

                const renderMarketGroup = (title: string, markets: MarketWithPeriod[], selectedCount: number) => {
                  if (markets.length === 0) return null;
                  
                  // Group markets by period
                  const periodGroups: Record<string, MarketWithPeriod[]> = {};
                  markets.forEach((market) => {
                    if (!periodGroups[market.period]) {
                      periodGroups[market.period] = [];
                    }
                    periodGroups[market.period].push(market);
                  });
                  
                  // Sort periods by order
                  const sortedPeriods = Object.entries(periodGroups).sort(
                    ([, a], [, b]) => (a[0]?.periodOrder ?? 99) - (b[0]?.periodOrder ?? 99)
                  );
                  
                  return (
                    <div className="px-3 pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                          {title}
                        </span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                          {selectedCount}/{markets.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {sortedPeriods.map(([periodLabel, periodMarkets]) => (
                          <div key={periodLabel}>
                            {sortedPeriods.length > 1 && (
                              <div className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 mb-1 pl-0.5">
                                {periodLabel}
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-1.5">
                              {periodMarkets.map((market) => {
                                const isSelected = isMarketSelectedForSport(sportId, market.key);
                                return (
                                  <Tooltip key={market.key} content={getMarketTooltip(market, sportId)}>
                                    <button
                                      onClick={() => toggleMarket(sportId, market.key)}
                                      className={cn(
                                        "flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left",
                                        isSelected
                                          ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                                          : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                                      )}
                                      disabled={!isSportSelected}
                                    >
                                      <div className={cn(
                                        "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
                                        isSelected
                                          ? "bg-emerald-500 border-emerald-500"
                                          : "border-neutral-300 dark:border-neutral-600"
                                      )}>
                                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                      </div>
                                      <span className="truncate">{market.label}</span>
                                    </button>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                };

                return (
                  <div key={sportId} className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0">
                    <Tooltip content={isSportSelected ? `${sportLabel} markets` : "Select this sport on the left to enable its markets"}>
                      <div className={cn(
                        "flex items-center justify-between px-3 py-2",
                        isSportSelected ? "bg-white dark:bg-neutral-900" : "bg-neutral-50/60 dark:bg-neutral-900/40"
                      )}>
                        <div className="flex items-center gap-2.5">
                          {sportId === "other" ? (
                            <span className={cn("inline-flex h-4 w-4 rounded-full bg-neutral-300 dark:bg-neutral-700", !isSportSelected && "opacity-40")} />
                          ) : (
                            <SportIcon sport={sportId} className={cn("w-4 h-4", !isSportSelected && "opacity-40")} />
                          )}
                          <span className={cn(
                            "text-sm font-semibold",
                            isSportSelected ? "text-neutral-700 dark:text-neutral-200" : "text-neutral-400 dark:text-neutral-500"
                          )}>
                            {sportLabel}
                          </span>
                        </div>
                        {!isSportSelected && (
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                            Disabled
                          </span>
                        )}
                      </div>
                    </Tooltip>

                    <div className={cn(!isSportSelected && "opacity-40 pointer-events-none")}>
                      {renderMarketGroup("Game Lines", sportMarkets.game, gameSelectedCount)}
                      {renderMarketGroup("Player Props", sportMarkets.props, propSelectedCount)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex justify-end">
              <button
                onClick={() => handleOpenChange(false)}
                className="px-4 py-1.5 rounded-md text-xs font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
