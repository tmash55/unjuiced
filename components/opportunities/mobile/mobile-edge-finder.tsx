"use client";

import React, { useState, useMemo, useCallback } from "react";
import { 
  Loader2, 
  Search, 
  ChevronDown, 
  ChevronUp,
  RefreshCw,
  X,
  Sparkles,
  Filter,
  Zap,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileEdgeCard } from "./mobile-edge-card";
import { MobileModelsBar } from "./mobile-models-bar";
import { Opportunity } from "@/lib/types/opportunities";
import { motion, AnimatePresence } from "framer-motion";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import type { FilterPreset } from "@/lib/types/filter-presets";
import type { BestOddsPrefs } from "@/lib/best-odds-schema";
import { BestOddsFilters } from "@/components/best-odds/best-odds-filters";

// Sport filter options
const SPORT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "nba", label: "NBA" },
  { value: "nfl", label: "NFL" },
  { value: "ncaaf", label: "NCAAF" },
  { value: "ncaab", label: "NCAAB" },
  { value: "nhl", label: "NHL" },
  { value: "mlb", label: "MLB" },
];

// Sort options
const SORT_OPTIONS = [
  { value: "edge_desc", label: "Edge % (High → Low)", field: "edgePct", dir: "desc" as const },
  { value: "edge_asc", label: "Edge % (Low → High)", field: "edgePct", dir: "asc" as const },
  { value: "time_asc", label: "Game Time (Soonest)", field: "gameStart", dir: "asc" as const },
  { value: "time_desc", label: "Game Time (Latest)", field: "gameStart", dir: "desc" as const },
  { value: "stake_desc", label: "Stake (High → Low)", field: "kellyFraction", dir: "desc" as const },
];

// Boost preset options
const BOOST_OPTIONS = [
  { value: 0, label: "No Boost" },
  { value: 10, label: "+10%" },
  { value: 20, label: "+20%" },
  { value: 25, label: "+25%" },
  { value: 30, label: "+30%" },
  { value: 50, label: "+50%" },
  { value: 100, label: "+100%" },
];

interface MobileEdgeFinderProps {
  opportunities: Opportunity[];
  isLoading?: boolean;
  isFetching?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  onPlayerClick?: (opp: Opportunity) => void;
  onHideEdge?: (opp: Opportunity) => void;
  onUnhideEdge?: (edgeKey: string) => void;
  isHidden?: (edgeKey: string) => boolean;
  bankroll?: number;
  kellyPercent?: number;
  isPro?: boolean;
  // Filter presets
  activePresets?: Array<{ id: string; name: string }>;
  isCustomMode?: boolean;
  // Last updated
  dataUpdatedAt?: number;
  // Preset prefetching
  onPresetHover?: (preset: FilterPreset) => void;
  // Filter prefs (columnOrder is optional for mobile since it's only used in desktop table)
  prefs?: Omit<BestOddsPrefs, 'columnOrder'> & { columnOrder?: string[] };
  onPrefsChange?: (prefs: Omit<BestOddsPrefs, 'columnOrder'> & { columnOrder?: string[] }) => void;
  availableLeagues?: string[];
  availableMarkets?: string[];
  availableSportsbooks?: string[];
  // Profit boost percentage
  boostPercent?: number;
  onBoostChange?: (boost: number) => void;
  // Kelly settings handlers
  onBankrollChange?: (value: number) => void;
  onKellyPercentChange?: (value: number) => void;
}

export function MobileEdgeFinder({
  opportunities,
  isLoading = false,
  isFetching = false,
  error,
  onRefresh,
  onPlayerClick,
  onHideEdge,
  onUnhideEdge,
  isHidden,
  bankroll = 0,
  kellyPercent = 25,
  isPro = false,
  activePresets = [],
  isCustomMode = false,
  dataUpdatedAt,
  onPresetHover,
  prefs,
  onPrefsChange,
  availableLeagues = [],
  availableMarkets = [],
  availableSportsbooks = [],
  boostPercent = 0,
  onBoostChange,
  onBankrollChange,
  onKellyPercentChange,
}: MobileEdgeFinderProps) {
  // Filter/search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState("all");
  const [sortOption, setSortOption] = useState("edge_desc");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [customBoostInput, setCustomBoostInput] = useState("");
  const [isBoostSheetOpen, setIsBoostSheetOpen] = useState(false);
  
  // Get current sort config
  const currentSort = SORT_OPTIONS.find(s => s.value === sortOption) || SORT_OPTIONS[0];
  
  // Filter and sort opportunities
  const filteredOpportunities = useMemo(() => {
    let filtered = [...opportunities];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(opp => 
        opp.player?.toLowerCase().includes(query) ||
        opp.homeTeam?.toLowerCase().includes(query) ||
        opp.awayTeam?.toLowerCase().includes(query) ||
        opp.market?.toLowerCase().includes(query)
      );
    }
    
    // Sport filter
    if (selectedSport !== "all") {
      filtered = filtered.filter(opp => 
        opp.sport?.toLowerCase() === selectedSport.toLowerCase()
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      const field = currentSort.field;
      const dir = currentSort.dir;
      
      let aVal: number;
      let bVal: number;
      
      if (field === "gameStart") {
        aVal = a.gameStart ? new Date(a.gameStart).getTime() : 0;
        bVal = b.gameStart ? new Date(b.gameStart).getTime() : 0;
      } else {
        aVal = (a as any)[field] ?? 0;
        bVal = (b as any)[field] ?? 0;
      }
      
      return dir === "asc" ? aVal - bVal : bVal - aVal;
    });
    
    return filtered;
  }, [opportunities, searchQuery, selectedSport, currentSort]);
  
  // Visible opportunities
  const visibleOpportunities = useMemo(() => {
    return filteredOpportunities.slice(0, visibleCount);
  }, [filteredOpportunities, visibleCount]);
  
  const hasMore = filteredOpportunities.length > visibleCount;
  
  // Handlers
  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + 20);
  }, []);
  
  const handleCardExpand = useCallback((oppId: string) => {
    setExpandedCardId(prev => prev === oppId ? null : oppId);
  }, []);
  
  const handleBetClick = useCallback((opp: Opportunity) => {
    if (opp.bestLink) {
      window.open(opp.bestLink, "_blank");
    }
  }, []);
  
  // Format time ago
  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };
  
  // Loading state
  if (isLoading && opportunities.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <span className="text-sm text-neutral-500">Finding edges...</span>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 font-medium">Error loading data</p>
          <p className="text-sm text-neutral-500 mt-1">{error.message}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-4 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 overflow-x-hidden">
      {/* Fixed Header */}
      <div className="fixed top-14 left-0 right-0 z-40 bg-white dark:bg-neutral-950">
        {/* Title Row with Actions */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
              Edge Finder
            </h1>
            {/* Last Updated - Compact */}
            {dataUpdatedAt && (
              <span className="text-[10px] text-neutral-400">
                {formatTimeAgo(dataUpdatedAt)}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {/* Refresh Button */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isFetching}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                  "disabled:opacity-50"
                )}
              >
                <RefreshCw className={cn("w-4 h-4 text-neutral-500", isFetching && "animate-spin")} />
              </button>
            )}
            
            {/* Filter Button - In header */}
            {prefs && onPrefsChange && (
              <BestOddsFilters
                prefs={{ ...prefs, columnOrder: prefs.columnOrder ?? [] }}
                onPrefsChange={(newPrefs) => onPrefsChange({ ...newPrefs, columnOrder: newPrefs.columnOrder ?? [] })}
                availableLeagues={availableLeagues}
                availableMarkets={availableMarkets}
                availableSportsbooks={availableSportsbooks}
                customPresetActive={isCustomMode}
                deals={opportunities.map(opp => ({
                  bestBook: opp.bestBook,
                  bestPrice: opp.bestDecimal,
                  allBooks: opp.allBooks?.map(book => ({
                    book: book.book,
                    price: book.decimal,
                    link: book.link ?? "",
                  })) || [],
                }))}
                bankroll={bankroll}
                kellyPercent={kellyPercent}
                onBankrollChange={onBankrollChange}
                onKellyPercentChange={onKellyPercentChange}
              />
            )}
          </div>
        </div>
        
        {/* Custom Models Bar */}
        <MobileModelsBar 
          onPresetsChange={onRefresh} 
          onPresetHover={onPresetHover}
        />
        
        {/* Search + Boost Row - More compact */}
        <div className="px-4 py-2 flex items-center gap-2 border-t border-neutral-200 dark:border-neutral-800">
          {/* Expandable Search */}
          <AnimatePresence mode="wait">
            {isSearchOpen ? (
              <motion.div 
                key="search-input"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "100%", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="flex-1 relative"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search players, teams..."
                  autoFocus
                  className={cn(
                    "w-full pl-9 pr-8 py-2 rounded-xl text-sm",
                    "bg-neutral-100 dark:bg-neutral-800",
                    "border border-transparent",
                    "focus:border-brand focus:ring-0 focus:outline-none",
                    "placeholder:text-neutral-400"
                  )}
                />
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setIsSearchOpen(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="search-button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSearchOpen(true)}
                className={cn(
                  "p-2 rounded-xl transition-colors",
                  "bg-neutral-100 dark:bg-neutral-800",
                  "hover:bg-neutral-200 dark:hover:bg-neutral-700",
                  searchQuery && "ring-1 ring-brand"
                )}
              >
                <Search className={cn("w-4 h-4", searchQuery ? "text-brand" : "text-neutral-500")} />
              </motion.button>
            )}
          </AnimatePresence>
          
          {/* Boost Button */}
          {!isSearchOpen && onBoostChange && (
            <button
              onClick={() => setIsBoostSheetOpen(true)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all",
                boostPercent > 0 
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30" 
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
              )}
            >
              <Zap className={cn("w-3.5 h-3.5", boostPercent > 0 && "fill-amber-500 text-amber-500")} />
              <span>{boostPercent > 0 ? `+${boostPercent}%` : "Boost"}</span>
            </button>
          )}
          
          {/* Spacer when search is closed */}
          {!isSearchOpen && <div className="flex-1" />}
          
          {/* Sort Dropdown - Inline when search closed */}
          {!isSearchOpen && (
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className={cn(
                "px-2 py-2 rounded-xl text-xs font-medium",
                "bg-neutral-100 dark:bg-neutral-800",
                "border-0 focus:ring-0 focus:outline-none",
                "text-neutral-700 dark:text-neutral-300"
              )}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
        
        {/* Results Count - Minimal */}
        <div className="px-4 py-1.5 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-200/50 dark:border-neutral-800/50">
          <span className="text-[10px] font-medium text-neutral-500">
            {filteredOpportunities.length} edges found
          </span>
        </div>
      </div>
      
      {/* Spacer for fixed header */}
      <div style={{ height: "200px" }} />
      
      {/* Edge Cards */}
      <div className="pt-3 pb-24 bg-neutral-100/50 dark:bg-neutral-950">
        {visibleOpportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 mx-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
            <Filter className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mb-4" />
            <p className="text-neutral-500 text-center font-medium">
              No edges match your filters
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedSport("all");
              }}
              className="mt-3 text-sm text-brand font-medium"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            {visibleOpportunities.map((opp) => (
              <MobileEdgeCard
                key={opp.id}
                opportunity={opp}
                onBetClick={handleBetClick}
                onPlayerClick={onPlayerClick ? () => onPlayerClick(opp) : undefined}
                onHide={onHideEdge ? () => onHideEdge(opp) : undefined}
                onUnhide={onUnhideEdge ? () => onUnhideEdge(opp.id) : undefined}
                isHidden={isHidden?.(opp.id) ?? false}
                isExpanded={expandedCardId === opp.id}
                onToggleExpand={() => handleCardExpand(opp.id)}
                bankroll={bankroll}
                kellyPercent={kellyPercent}
                boostPercent={boostPercent}
              />
            ))}
            
            {/* Load More */}
            {hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                className={cn(
                  "mx-3 w-[calc(100%-1.5rem)] py-3 text-sm font-semibold",
                  "text-brand",
                  "bg-white dark:bg-neutral-900",
                  "border border-neutral-200/80 dark:border-neutral-800",
                  "rounded-xl",
                  "active:bg-neutral-50 dark:active:bg-neutral-800",
                  "transition-colors"
                )}
              >
                Load more ({filteredOpportunities.length - visibleCount} remaining)
              </button>
            )}
          </>
        )}
      </div>
      
      {/* Free User CTA */}
      {!isPro && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white dark:from-neutral-950 via-white dark:via-neutral-950 to-transparent">
          <a
            href="/pricing"
            className={cn(
              "block w-full py-3 px-4 rounded-xl text-center",
              "bg-gradient-to-r from-brand to-emerald-600",
              "text-white font-semibold text-sm",
              "shadow-lg shadow-brand/20"
            )}
          >
            Upgrade to Pro for All Edges
          </a>
        </div>
      )}
      
      {/* Boost Sheet Modal */}
      {isBoostSheetOpen && onBoostChange && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setIsBoostSheetOpen(false)}
          />
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-900 rounded-t-3xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl">
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
            </div>
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Profit Boost
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Apply a sportsbook promo boost
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBoostSheetOpen(false)}
                className="p-2 -mr-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5 text-neutral-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-8">
              {/* Active Boost Indicator - at top when active */}
              {boostPercent > 0 && (
                <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="text-sm text-amber-600 dark:text-amber-400 font-semibold">
                        +{boostPercent}% Active
                      </span>
                    </div>
                    <button 
                      onClick={() => {
                        onBoostChange(0);
                        setIsBoostSheetOpen(false);
                      }}
                      className="text-xs text-amber-600 dark:text-amber-400 font-medium px-2 py-1 rounded-lg hover:bg-amber-500/10"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
              
              {/* Preset Options */}
              <div className="grid grid-cols-4 gap-2">
                {BOOST_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onBoostChange(opt.value);
                      if (opt.value > 0) setIsBoostSheetOpen(false);
                    }}
                    className={cn(
                      "py-3 rounded-xl text-sm font-semibold transition-all",
                      boostPercent === opt.value 
                        ? "bg-amber-500 text-white shadow-md" 
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    )}
                  >
                    {opt.value === 0 ? "None" : `+${opt.value}%`}
                  </button>
                ))}
              </div>
              
              {/* Custom Input */}
              <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3 block">
                  Custom Boost %
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="200"
                      value={customBoostInput}
                      onChange={(e) => setCustomBoostInput(e.target.value)}
                      placeholder="Enter 0-200"
                      className={cn(
                        "w-full h-12 px-4 rounded-xl text-base",
                        "bg-neutral-100 dark:bg-neutral-800",
                        "border border-neutral-200 dark:border-neutral-700",
                        "text-neutral-900 dark:text-white",
                        "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
                        "focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                      )}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const val = parseInt(customBoostInput);
                      if (!isNaN(val) && val >= 0 && val <= 200) {
                        onBoostChange(val);
                        setCustomBoostInput("");
                        setIsBoostSheetOpen(false);
                      }
                    }}
                    className="h-12 px-6 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </div>
              
              {/* Info Text */}
              <p className="mt-4 text-xs text-neutral-400 dark:text-neutral-500">
                Edge % and recommended stake will be adjusted based on your boost percentage.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

