"use client";

import React, { useState, useMemo, useCallback } from "react";
import { 
  Loader2, 
  Search, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronUp,
  RefreshCw,
  X,
  Filter,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileEdgeCard } from "./mobile-edge-card";
import { MobileModelsBar } from "./mobile-models-bar";
import { Opportunity } from "@/lib/types/opportunities";
import { motion, AnimatePresence } from "framer-motion";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import type { FilterPreset } from "@/lib/types/filter-presets";

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

interface MobileEdgeFinderProps {
  opportunities: Opportunity[];
  isLoading?: boolean;
  isFetching?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  onPlayerClick?: (opp: Opportunity) => void;
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
}

export function MobileEdgeFinder({
  opportunities,
  isLoading = false,
  isFetching = false,
  error,
  onRefresh,
  onPlayerClick,
  bankroll = 0,
  kellyPercent = 25,
  isPro = false,
  activePresets = [],
  isCustomMode = false,
  dataUpdatedAt,
  onPresetHover,
}: MobileEdgeFinderProps) {
  // Filter/search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState("all");
  const [sortOption, setSortOption] = useState("edge_desc");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  
  // Get current sort config
  const currentSort = SORT_OPTIONS.find(s => s.value === sortOption) || SORT_OPTIONS[0];
  
  // Filter and sort opportunities
  const filteredOpportunities = useMemo(() => {
    let filtered = [...opportunities];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(opp => 
        opp.selection?.toLowerCase().includes(query) ||
        opp.homeTeam?.toLowerCase().includes(query) ||
        opp.awayTeam?.toLowerCase().includes(query) ||
        opp.market?.toLowerCase().includes(query)
      );
    }
    
    // Sport filter
    if (selectedSport !== "all") {
      filtered = filtered.filter(opp => 
        opp.sport?.toLowerCase() === selectedSport.toLowerCase() ||
        opp.league?.toLowerCase() === selectedSport.toLowerCase()
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
    const link = opp.bestMobileLink || opp.bestLink;
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
        {/* Title Row */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
              Edge Finder
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Last Updated */}
            {dataUpdatedAt && (
              <span className="text-xs text-neutral-400">
                {formatTimeAgo(dataUpdatedAt)}
              </span>
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
        
        {/* Custom Models Bar */}
        <MobileModelsBar 
          onPresetsChange={onRefresh} 
          onPresetHover={onPresetHover}
        />
        
        {/* Search Row */}
        <div className="px-4 py-3 flex items-center gap-2 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players, teams..."
              className={cn(
                "w-full pl-9 pr-4 py-2.5 rounded-xl text-sm",
                "bg-neutral-100 dark:bg-neutral-800",
                "border border-transparent",
                "focus:border-brand focus:ring-0 focus:outline-none",
                "placeholder:text-neutral-400"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            )}
          </div>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2.5 rounded-xl transition-colors",
              showFilters 
                ? "bg-brand text-white" 
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            )}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>
        
        {/* Expandable Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-neutral-200 dark:border-neutral-800"
            >
              <div className="px-4 py-3 space-y-3">
                {/* Sport Pills */}
                <div>
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 block">
                    Sport
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {SPORT_OPTIONS.map(sport => (
                      <button
                        key={sport.value}
                        onClick={() => setSelectedSport(sport.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                          selectedSport === sport.value
                            ? "bg-brand text-white"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                        )}
                      >
                        {sport.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Sort */}
                <div>
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 block">
                    Sort By
                  </span>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-xl text-sm font-medium",
                      "bg-neutral-100 dark:bg-neutral-800",
                      "border-0 focus:ring-0 focus:outline-none",
                      "text-neutral-900 dark:text-white"
                    )}
                  >
                    {SORT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Results Count */}
        <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-200/50 dark:border-neutral-800/50">
          <span className="text-xs font-medium text-neutral-500">
            {filteredOpportunities.length} edges found
          </span>
        </div>
      </div>
      
      {/* Spacer for fixed header - accounts for title + models bar + search + optional filters */}
      <div style={{ height: showFilters ? "350px" : "240px" }} className="transition-all duration-200" />
      
      {/* Edge Cards */}
      <div className="pb-20">
        {visibleOpportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
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
                isExpanded={expandedCardId === opp.id}
                onToggleExpand={() => handleCardExpand(opp.id)}
                bankroll={bankroll}
                kellyPercent={kellyPercent}
              />
            ))}
            
            {/* Load More */}
            {hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                className={cn(
                  "w-full py-4 text-sm font-medium",
                  "text-brand",
                  "bg-white dark:bg-neutral-900",
                  "border-t border-neutral-200 dark:border-neutral-800",
                  "active:bg-neutral-50 dark:active:bg-neutral-800"
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
    </div>
  );
}

