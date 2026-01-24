"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { SportIcon } from "@/components/icons/sport-icons";
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

// Market category mapping
const MARKET_CATEGORIES: Record<string, { label: string; keywords: string[] }> = {
  game: {
    label: "Game Lines",
    keywords: ["game_", "moneyline", "spread", "total", "team_"],
  },
  basketball: {
    label: "Basketball Props",
    keywords: ["points", "rebounds", "assists", "threes", "blocks", "steals", "double", "triple"],
  },
  football: {
    label: "Football Props",
    keywords: ["pass", "rush", "receiving", "receptions", "touchdown", "_td", "yards"],
  },
  hockey: {
    label: "Hockey Props",
    keywords: ["goal", "shots", "saves", "hockey", "anytime_goal"],
  },
  baseball: {
    label: "Baseball Props",
    keywords: ["hits", "home_run", "strikeout", "bases", "rbi", "batter", "pitcher", "runs"],
  },
};

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
  availableMarkets: { key: string; label: string }[];
  
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
  const selected = isPositiveEV ? selectedSports : selectedLeagues;
  const available = isPositiveEV ? availableSports : availableLeagues;
  const onChange = isPositiveEV ? onSportsChange : onLeaguesChange;

  // Get the first selected sport for the icon
  const primarySport = selected.length > 0 ? selected[0] : available[0];

  // Check if all sports/leagues are selected
  const allSportsSelected = selected.length === 0 || selected.length === available.length;
  
  // Check if all markets are selected (empty = all)
  const allMarketsSelected = selectedMarkets.length === 0;

  // Toggle sport/league selection
  const toggleSportLeague = (id: string) => {
    if (!onChange) return;
    if (selected.includes(id)) {
      // If deselecting and only one left, clear all (which means all selected)
      if (selected.length === 1) {
        onChange([]);
      } else {
        onChange(selected.filter((s) => s !== id));
      }
    } else {
      // If currently all selected (empty array), start fresh with just this one
      if (selected.length === 0) {
        onChange([id]);
      } else {
        onChange([...selected, id]);
      }
    }
  };

  // Select all sports/leagues
  const selectAllSports = () => {
    if (!onChange) return;
    onChange([]);
  };

  // Clear all sports/leagues
  const clearAllSports = () => {
    if (!onChange) return;
    // Select just the first one (can't have none)
    onChange([available[0]]);
  };

  // Group markets by category
  const groupedMarkets = useMemo(() => {
    const groups: Record<string, { key: string; label: string }[]> = {};
    
    Object.keys(MARKET_CATEGORIES).forEach(cat => {
      groups[cat] = [];
    });
    groups.other = [];

    const searchLower = marketSearch.toLowerCase();
    
    availableMarkets.forEach((market) => {
      // Apply search filter
      if (marketSearch && !market.label.toLowerCase().includes(searchLower)) {
        return;
      }
      
      const key = market.key.toLowerCase();
      let matched = false;
      
      for (const [catKey, cat] of Object.entries(MARKET_CATEGORIES)) {
        if (cat.keywords.some(kw => key.includes(kw))) {
          groups[catKey].push(market);
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        groups.other.push(market);
      }
    });

    return groups;
  }, [availableMarkets, marketSearch]);

  // Get markets for a category
  const getMarketsForCategory = (category: string) => groupedMarkets[category] || [];

  // Check if all markets in category are selected
  const isCategoryAllSelected = (category: string) => {
    const markets = getMarketsForCategory(category);
    if (markets.length === 0) return false;
    if (selectedMarkets.length === 0) return true; // All selected
    return markets.every(m => selectedMarkets.includes(m.key));
  };

  // Check if some markets in category are selected
  const isCategorySomeSelected = (category: string) => {
    const markets = getMarketsForCategory(category);
    if (markets.length === 0) return false;
    if (selectedMarkets.length === 0) return true;
    return markets.some(m => selectedMarkets.includes(m.key));
  };

  // Toggle all markets in a category
  const toggleCategoryMarkets = (category: string) => {
    const categoryMarkets = getMarketsForCategory(category);
    const categoryKeys = categoryMarkets.map(m => m.key);
    
    if (isCategoryAllSelected(category)) {
      // Deselect all in category
      if (selectedMarkets.length === 0) {
        // Currently all markets selected, so select all EXCEPT this category
        const allOtherMarkets = availableMarkets
          .filter(m => !categoryKeys.includes(m.key))
          .map(m => m.key);
        onMarketsChange(allOtherMarkets);
      } else {
        // Remove this category's markets
        onMarketsChange(selectedMarkets.filter(m => !categoryKeys.includes(m)));
      }
    } else {
      // Select all in category
      if (selectedMarkets.length === 0) {
        // Currently showing all, just select this category
        onMarketsChange(categoryKeys);
      } else {
        // Add this category's markets
        const newSelected = [...new Set([...selectedMarkets, ...categoryKeys])];
        onMarketsChange(newSelected);
      }
    }
  };

  // Toggle individual market
  const toggleMarket = (marketKey: string) => {
    if (selectedMarkets.length === 0) {
      // Currently all selected, select all EXCEPT this one
      const allOther = availableMarkets.filter(m => m.key !== marketKey).map(m => m.key);
      onMarketsChange(allOther);
    } else if (selectedMarkets.includes(marketKey)) {
      const newSelected = selectedMarkets.filter(m => m !== marketKey);
      // If removing leaves empty, that means all selected
      onMarketsChange(newSelected);
    } else {
      onMarketsChange([...selectedMarkets, marketKey]);
    }
  };

  // Select all markets
  const selectAllMarkets = () => {
    onMarketsChange([]);
  };

  // Clear all markets (select none - but we'll just select the first category)
  const clearAllMarkets = () => {
    const firstCategoryWithMarkets = Object.entries(groupedMarkets).find(([_, markets]) => markets.length > 0);
    if (firstCategoryWithMarkets) {
      onMarketsChange(firstCategoryWithMarkets[1].map(m => m.key));
    }
  };

  // Count selected in category
  const getSelectedCount = (category: string) => {
    const markets = getMarketsForCategory(category);
    if (selectedMarkets.length === 0) return markets.length;
    return markets.filter(m => selectedMarkets.includes(m.key)).length;
  };

  // Summary text for button
  const getSummaryText = () => {
    const sportsText = allSportsSelected 
      ? "All Sports" 
      : `${selected.length} Sport${selected.length !== 1 ? "s" : ""}`;
    const marketsText = allMarketsSelected 
      ? "All Markets" 
      : `${selectedMarkets.length} Market${selectedMarkets.length !== 1 ? "s" : ""}`;
    return { sportsText, marketsText };
  };

  const { sportsText, marketsText } = getSummaryText();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
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
          <SportIcon sport={primarySport} className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">
            {!allSportsSelected || !allMarketsSelected ? (
              <span className="text-neutral-500 dark:text-neutral-400">
                {!allSportsSelected && sportsText}
                {!allSportsSelected && !allMarketsSelected && " · "}
                {!allMarketsSelected && marketsText}
              </span>
            ) : (
              "Filters"
            )}
          </span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="start" 
        className="w-[520px] p-0 overflow-hidden"
        sideOffset={4}
      >
        <div className="flex h-[400px]">
          {/* Left Column - Sports/Leagues */}
          <div className="w-[180px] border-r border-neutral-200 dark:border-neutral-700 flex flex-col">
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
          </div>

          {/* Right Column - Markets */}
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Markets
                </span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                  {allMarketsSelected ? "All" : selectedMarkets.length} selected
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
              {Object.entries(MARKET_CATEGORIES).map(([catKey, cat]) => {
                const markets = getMarketsForCategory(catKey);
                if (markets.length === 0) return null;

                const allSelected = isCategoryAllSelected(catKey);
                const someSelected = isCategorySomeSelected(catKey);
                const selectedCount = getSelectedCount(catKey);

                return (
                  <div key={catKey} className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategoryMarkets(catKey)}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                          allSelected
                            ? "bg-emerald-500 border-emerald-500"
                            : someSelected
                              ? "bg-emerald-500/30 border-emerald-500"
                              : "border-neutral-300 dark:border-neutral-600"
                        )}>
                          {allSelected && <Check className="w-3 h-3 text-white" />}
                          {someSelected && !allSelected && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-sm" />}
                        </div>
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          {cat.label}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
                        {selectedCount}/{markets.length}
                      </span>
                    </button>

                    {/* Markets in category */}
                    <div className="px-3 pb-2 grid grid-cols-2 gap-1">
                      {markets.map((market) => {
                        const isSelected = selectedMarkets.length === 0 || selectedMarkets.includes(market.key);
                        return (
                          <button
                            key={market.key}
                            onClick={() => toggleMarket(market.key)}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left",
                              isSelected
                                ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                                : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                            )}
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
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Other markets */}
              {groupedMarkets.other.length > 0 && (
                <div className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0">
                  <button
                    onClick={() => toggleCategoryMarkets("other")}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                        isCategoryAllSelected("other")
                          ? "bg-emerald-500 border-emerald-500"
                          : isCategorySomeSelected("other")
                            ? "bg-emerald-500/30 border-emerald-500"
                            : "border-neutral-300 dark:border-neutral-600"
                      )}>
                        {isCategoryAllSelected("other") && <Check className="w-3 h-3 text-white" />}
                        {isCategorySomeSelected("other") && !isCategoryAllSelected("other") && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-sm" />}
                      </div>
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Other
                      </span>
                    </div>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
                      {getSelectedCount("other")}/{groupedMarkets.other.length}
                    </span>
                  </button>

                  <div className="px-3 pb-2 grid grid-cols-2 gap-1">
                    {groupedMarkets.other.map((market) => {
                      const isSelected = selectedMarkets.length === 0 || selectedMarkets.includes(market.key);
                      return (
                        <button
                          key={market.key}
                          onClick={() => toggleMarket(market.key)}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left",
                            isSelected
                              ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                              : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                          )}
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
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-1.5 rounded-md text-xs font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
