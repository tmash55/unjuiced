"use client";

import React, { useState, useMemo, useCallback } from "react";
import { 
  Loader2, 
  Search, 
  RefreshCw,
  X,
  Zap,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileEVCard } from "./mobile-ev-card";
import { MobileEvModelsBar } from "./mobile-ev-models-bar";
import type { PositiveEVOpportunity, DevigMethod, SharpPreset, EVMode } from "@/lib/ev/types";
import { motion, AnimatePresence } from "framer-motion";
import { PositiveEVFilters } from "../positive-ev-filters";

// Sort options
const SORT_OPTIONS = [
  { value: "ev_desc", label: "EV % (High → Low)", field: "evWorst", dir: "desc" as const },
  { value: "ev_asc", label: "EV % (Low → High)", field: "evWorst", dir: "asc" as const },
  { value: "time_asc", label: "Game Time (Soonest)", field: "startTime", dir: "asc" as const },
  { value: "time_desc", label: "Game Time (Latest)", field: "startTime", dir: "desc" as const },
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

interface MobilePositiveEVProps {
  opportunities: PositiveEVOpportunity[];
  isLoading?: boolean;
  isFetching?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  onPlayerClick?: (opp: PositiveEVOpportunity) => void;
  onHideEdge?: (opp: PositiveEVOpportunity) => void;
  onUnhideEdge?: (edgeKey: string) => void;
  isHidden?: (edgeKey: string) => boolean;
  bankroll?: number;
  kellyPercent?: number;
  isPro?: boolean;
  // Last updated
  dataUpdatedAt?: number;
  // Filter settings
  sharpPreset?: SharpPreset;
  devigMethods?: DevigMethod[];
  evCase?: "worst" | "best";
  mode?: EVMode;
  // Filter handlers
  onSharpPresetChange?: (preset: SharpPreset) => void;
  onDevigMethodsChange?: (methods: DevigMethod[]) => void;
  onEvCaseChange?: (evCase: "worst" | "best") => void;
  onModeChange?: (mode: EVMode) => void;
  // Profit boost percentage
  boostPercent?: number;
  onBoostChange?: (boost: number) => void;
  // Kelly settings handlers
  onBankrollChange?: (value: number) => void;
  onKellyPercentChange?: (value: number) => void;
  // Hidden count
  hiddenCount?: number;
  showHidden?: boolean;
  onShowHiddenChange?: (show: boolean) => void;
  // Auto refresh
  autoRefresh?: boolean;
  onAutoRefreshChange?: (auto: boolean) => void;
  streamConnected?: boolean;
  // Selected books filter
  selectedBooks?: string[];
  selectedSports?: string[];
  selectedMarkets?: string[];
  minEv?: number;
  maxEv?: number | undefined;
  minBooksPerSide?: number;
  minLiquidity?: number;
  onFiltersChange?: (filters: {
    selectedBooks?: string[];
    selectedSports?: string[];
    selectedMarkets?: string[];
    sharpPreset?: SharpPreset;
    devigMethods?: DevigMethod[];
    evCase?: "worst" | "best";
    minEv?: number;
    maxEv?: number | undefined;
    mode?: EVMode;
    minBooksPerSide?: number;
    minLiquidity?: number;
    showHidden?: boolean;
  }) => void;
  availableSports?: string[];
  availableMarkets?: string[];
  locked?: boolean;
  isLoggedIn?: boolean;
  /** Whether user has Elite access (for auto-refresh gating) */
  hasEliteAccess?: boolean;
}

export function MobilePositiveEV({
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
  dataUpdatedAt,
  sharpPreset = "pinnacle",
  devigMethods = ["power", "multiplicative"],
  evCase = "worst",
  mode = "pregame",
  onSharpPresetChange,
  boostPercent = 0,
  onBoostChange,
  onBankrollChange,
  onKellyPercentChange,
  hiddenCount = 0,
  showHidden = false,
  onShowHiddenChange,
  autoRefresh = false,
  onAutoRefreshChange,
  streamConnected = false,
  selectedBooks = [],
  selectedSports = [],
  selectedMarkets = [],
  minEv = 0,
  maxEv,
  minBooksPerSide = 2,
  minLiquidity = 0,
  onFiltersChange,
  availableSports = [],
  availableMarkets = [],
  locked = false,
  isLoggedIn = false,
  hasEliteAccess = false,
}: MobilePositiveEVProps) {
  // Filter/search state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("ev_desc");
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
        opp.playerName?.toLowerCase().includes(query) ||
        opp.homeTeam?.toLowerCase().includes(query) ||
        opp.awayTeam?.toLowerCase().includes(query) ||
        opp.market?.toLowerCase().includes(query)
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      const field = currentSort.field;
      const dir = currentSort.dir;
      
      let aVal: number;
      let bVal: number;
      
      if (field === "startTime") {
        aVal = a.startTime ? new Date(a.startTime).getTime() : 0;
        bVal = b.startTime ? new Date(b.startTime).getTime() : 0;
      } else if (field === "evWorst") {
        aVal = a.evCalculations?.evWorst ?? 0;
        bVal = b.evCalculations?.evWorst ?? 0;
      } else {
        aVal = (a as any)[field] ?? 0;
        bVal = (b as any)[field] ?? 0;
      }
      
      return dir === "asc" ? aVal - bVal : bVal - aVal;
    });
    
    return filtered;
  }, [opportunities, searchQuery, currentSort]);
  
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
    if (!isPro) return; // Block expansion for free users
    setExpandedCardId(prev => prev === oppId ? null : oppId);
  }, [isPro]);
  
  const handleBetClick = useCallback((opp: PositiveEVOpportunity) => {
    // On mobile, prefer the deep link (mobileLink) if available
    const link = opp.book.mobileLink || opp.book.link;
    if (link) {
      window.open(link, "_blank");
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
          <span className="text-sm text-neutral-500">Finding +EV opportunities...</span>
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
      {/* Fixed Header - below layout's h-12 mobile header */}
      <div className="fixed top-12 left-0 right-0 z-40 bg-white dark:bg-neutral-950">
        {/* Title Row with Actions */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
                Positive EV
              </h1>
            </div>
            {/* Last Updated - Compact */}
            {dataUpdatedAt && (
              <div className="flex items-center gap-1">
                {autoRefresh && streamConnected && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
                <span className="text-[10px] text-neutral-400">
                  {formatTimeAgo(dataUpdatedAt)}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {/* Auto-Refresh Toggle - Elite only */}
            {hasEliteAccess && onAutoRefreshChange && (
              <button
                onClick={() => onAutoRefreshChange(!autoRefresh)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold uppercase transition-all",
                  autoRefresh 
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500"
                )}
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  autoRefresh && streamConnected ? "bg-emerald-500" : "bg-neutral-400"
                )} />
                Auto
              </button>
            )}

            {/* Filters / Settings */}
            {onFiltersChange && (
              <PositiveEVFilters
                selectedBooks={selectedBooks}
                selectedSports={selectedSports}
                selectedMarkets={selectedMarkets}
                sharpPreset={sharpPreset}
                devigMethods={devigMethods}
                evCase={evCase}
                minEv={minEv}
                maxEv={maxEv}
                mode={mode}
                minBooksPerSide={minBooksPerSide}
                minLiquidity={minLiquidity}
                showHidden={showHidden}
                hiddenCount={hiddenCount}
                bankroll={bankroll}
                kellyPercent={kellyPercent}
                onFiltersChange={onFiltersChange}
                onBankrollChange={onBankrollChange}
                onKellyPercentChange={onKellyPercentChange}
                availableSports={availableSports}
                availableMarkets={availableMarkets}
                locked={locked}
                isLoggedIn={isLoggedIn}
                isPro={isPro}
                opportunities={opportunities.map((opp) => ({ book: { bookId: opp.book.bookId } }))}
              />
            )}
            
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
          </div>
        </div>
        
        {/* Models Bar */}
        <MobileEvModelsBar
          sharpPreset={sharpPreset}
          onSharpPresetChange={onSharpPresetChange}
          onModelsChanged={onRefresh}
        />

        {/* Search + Boost + Sort Row */}
        <div className="px-4 py-2 flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800">
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
          
          {/* Sort Dropdown */}
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
        
        {/* Results Count */}
        <div className="px-4 py-1.5 bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200/50 dark:border-neutral-800/50">
          <span className="text-[10px] font-medium text-neutral-500">
            {filteredOpportunities.length} +EV opportunities found
            {hiddenCount > 0 && !showHidden && (
              <span className="ml-1 text-neutral-400">
                ({hiddenCount} hidden)
              </span>
            )}
          </span>
        </div>
      </div>
      
      {/* Spacer for fixed header - accounts for top-12 (48px) + header content */}
      <div style={{ height: "192px" }} />
      
      {/* EV Cards */}
      <div className="pt-3 pb-24 bg-neutral-100/50 dark:bg-neutral-950">
        {visibleOpportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 mx-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
            <TrendingUp className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mb-4" />
            <p className="text-neutral-500 text-center font-medium">
              No +EV opportunities match your filters
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
              }}
              className="mt-3 text-sm text-brand font-medium"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            {visibleOpportunities.map((opp) => (
              <MobileEVCard
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
                evCase={evCase}
                selectedDevigMethods={devigMethods}
                selectedBooks={selectedBooks}
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
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white dark:from-neutral-950 via-white dark:via-neutral-950 to-transparent z-40">
          <a
            href="/pricing"
            className={cn(
              "block w-full py-3 px-4 rounded-xl text-center",
              "bg-sky-500 hover:bg-sky-600",
              "text-white font-semibold text-sm",
              "shadow-lg shadow-sky-500/20"
            )}
          >
            Upgrade to Sharp for All +EV Bets
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
              {/* Active Boost Indicator */}
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
                EV % and recommended stake will be adjusted based on your boost percentage.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
