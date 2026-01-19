"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  ChevronDown, 
  ChevronUp,
  SlidersHorizontal, 
  Search, 
  X, 
  Check, 
  ArrowUp, 
  ArrowDown,
  Target,
  TrendingUp,
  Trophy,
  Zap,
  BarChart3,
  User,
  Hash,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

const MARKET_OPTIONS = [
  { value: "all", label: "All" },
  { value: "player_points", label: "PTS" },
  { value: "player_rebounds", label: "REB" },
  { value: "player_assists", label: "AST" },
  { value: "player_threes_made", label: "3PM" },
  { value: "player_points_rebounds_assists", label: "PRA" },
  { value: "player_points_rebounds", label: "P+R" },
  { value: "player_points_assists", label: "P+A" },
  { value: "player_rebounds_assists", label: "R+A" },
  { value: "player_steals", label: "STL" },
  { value: "player_blocks", label: "BLK" },
  { value: "player_blocks_steals", label: "B+S" },
  { value: "player_turnovers", label: "TO" },
];

const SPORT_OPTIONS = [
  { value: "nba", label: "NBA", enabled: true },
  { value: "nfl", label: "NFL", enabled: false },
  { value: "nhl", label: "NHL", enabled: false },
  { value: "wnba", label: "WNBA", enabled: false },
  { value: "mlb", label: "MLB", enabled: false },
];

interface GameOption {
  id: string;
  label: string;
  time: string;
  awayTeam?: string;
  homeTeam?: string;
  date?: string;
}

interface SortOption {
  value: string;
  label: string;
  field?: string;
  dir?: "asc" | "desc";
}

interface MarketOption {
  value: string;
  label: string;
}

interface MobileHeaderProps {
  sport: string;
  selectedGameIds: string[];
  games: GameOption[];
  onGamesChange: (ids: string[]) => void;
  selectedMarkets: string[];
  marketOptions: MarketOption[];
  onMarketsChange: (markets: string[]) => void;
  sortField: string;
  sortOptions: SortOption[];
  onSortChange: (field: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showSecondaryFilters?: boolean;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  // Optional upgrade banner to show under sport tabs
  upgradeBanner?: React.ReactNode;
  // Glossary callback
  onGlossaryClick?: () => void;
  // Hide players without odds
  hideNoOdds?: boolean;
  onHideNoOddsChange?: (hide: boolean) => void;
}

// Helper to get team logo URL
const getTeamLogoUrl = (tricode: string): string => {
  if (!tricode) return '';
  return `/team-logos/nba/${tricode.toUpperCase()}.svg`;
};

// Helper to get today and tomorrow dates in ET
const getDateLabels = () => {
  const now = new Date();
  const etOptions: Intl.DateTimeFormatOptions = { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' };
  const etDateStr = now.toLocaleDateString('en-CA', etOptions);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA', etOptions);
  return { today: etDateStr, tomorrow: tomorrowStr };
};

// Market categories for grouping
const MARKET_CATEGORIES = {
  main: {
    label: "Main Stats",
    icon: Target,
    markets: ["player_points", "player_rebounds", "player_assists"]
  },
  combos: {
    label: "Combo Stats", 
    icon: Zap,
    markets: ["player_points_rebounds_assists", "player_points_rebounds", "player_points_assists", "player_rebounds_assists"]
  },
  shooting: {
    label: "Shooting",
    icon: Trophy,
    markets: ["player_threes_made"]
  },
  defense: {
    label: "Defense & Other",
    icon: BarChart3,
    markets: ["player_steals", "player_blocks", "player_blocks_steals", "player_turnovers"]
  }
};

// Sort categories for grouping
const SORT_CATEGORIES = {
  hitRate: {
    label: "Hit Rate %",
    icon: TrendingUp,
    fields: ["l5Pct", "l10Pct", "l20Pct", "seasonPct"]
  },
  matchup: {
    label: "Matchup (DvP)",
    icon: Target,
    fields: ["matchupRank"]
  },
  prop: {
    label: "Prop Line",
    icon: Hash,
    fields: ["line"]
  },
  player: {
    label: "Player",
    icon: User,
    fields: ["name"]
  }
};

// Dropdown button component - Smaller version - Premium
function DropdownButton({ 
  label, 
  value, 
  isOpen,
  onClick,
  icon,
}: { 
  label: string; 
  value?: string; 
  isOpen?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl",
        "bg-white dark:bg-neutral-800/90",
        "border transition-all duration-200",
        "shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.02]",
        isOpen 
          ? "border-brand/50 shadow-brand/10 shadow-md" 
          : "border-neutral-200/80 dark:border-neutral-700/80",
        "text-xs font-semibold text-neutral-900 dark:text-neutral-100",
        "active:scale-[0.97] transition-all",
        "shrink-0"
      )}
    >
      <span className="flex items-center gap-1.5 truncate">
        {icon}
        {value || label}
      </span>
      <ChevronDown className={cn(
        "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
        isOpen ? "rotate-180 text-brand" : "text-neutral-400"
      )} />
    </button>
  );
}

// Modern bottom sheet dropdown panel - Premium
function DropdownPanel({
  isOpen,
  children,
  onClose,
  title,
}: {
  isOpen: boolean;
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-900 rounded-t-[2rem] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl ring-1 ring-black/5 dark:ring-white/5">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 -mr-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-200"
          >
            <X className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-10">
          {children}
        </div>
      </div>
    </>
  );
}

// Category header with icon - Premium
function CategoryHeader({ 
  label, 
  icon: Icon,
  action,
}: { 
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 mt-5 first:mt-3">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-brand/20 to-brand/10 flex items-center justify-center shadow-sm">
          <Icon className="h-4 w-4 text-brand" />
        </div>
        <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      {action}
    </div>
  );
}

// Date section header
function DateHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3 mt-2 first:mt-0">
      <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
      <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
        {label}
      </span>
      <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}

// Game option item with logos - Premium
function GameOptionItem({
  game,
  selected,
  onClick,
}: {
  game: GameOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-4 rounded-2xl",
        "transition-all duration-200",
        selected 
          ? "bg-gradient-to-br from-brand/15 to-brand/5 ring-2 ring-brand/40 shadow-md shadow-brand/10" 
          : "bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-[0.99] border border-neutral-200/60 dark:border-neutral-700/60"
      )}
    >
      <div className={cn(
        "w-6 h-6 rounded-lg shrink-0 flex items-center justify-center border-2 transition-all",
        selected 
          ? "bg-gradient-to-br from-brand to-brand/80 border-brand shadow-sm" 
          : "border-neutral-300 dark:border-neutral-600"
      )}>
        {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      </div>
      
      <div className="flex-1 flex items-center gap-3">
        <div className="flex items-center gap-2">
          {game.awayTeam && (
            <img
              src={getTeamLogoUrl(game.awayTeam)}
              alt={game.awayTeam}
              className="h-8 w-8 object-contain drop-shadow-sm"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <span className={cn(
            "text-sm font-bold",
            selected ? "text-brand" : "text-neutral-900 dark:text-neutral-100"
          )}>
            {game.awayTeam}
          </span>
        </div>
        
        <span className="text-xs text-neutral-400 font-semibold">@</span>
        
        <div className="flex items-center gap-2">
          {game.homeTeam && (
            <img
              src={getTeamLogoUrl(game.homeTeam)}
              alt={game.homeTeam}
              className="h-8 w-8 object-contain drop-shadow-sm"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <span className={cn(
            "text-sm font-bold",
            selected ? "text-brand" : "text-neutral-900 dark:text-neutral-100"
          )}>
            {game.homeTeam}
          </span>
        </div>
      </div>
      
      <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0 font-semibold">
        {game.time}
      </span>
    </button>
  );
}

// Market chip - compact selectable item - Premium
function MarketChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 px-4 py-2.5 rounded-xl",
        "text-sm font-semibold transition-all duration-200",
        "border",
        selected 
          ? "bg-gradient-to-br from-brand/15 to-brand/5 border-brand/40 text-brand shadow-md shadow-brand/10" 
          : "bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200/80 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-[0.98]"
      )}
    >
      <div className={cn(
        "w-5 h-5 rounded-lg shrink-0 flex items-center justify-center border-2 transition-all",
        selected 
          ? "bg-gradient-to-br from-brand to-brand/80 border-brand shadow-sm" 
          : "border-neutral-300 dark:border-neutral-600"
      )}>
        {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>
      {label}
    </button>
  );
}

// Sort option item with direction arrow - Premium
function SortOptionItem({
  option,
  selected,
  onClick,
}: {
  option: SortOption;
  selected: boolean;
  onClick: () => void;
}) {
  const isAsc = option.dir === "asc";
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3.5 px-4 py-3 rounded-xl",
        "text-left transition-all duration-200",
        selected 
          ? "bg-gradient-to-br from-brand/15 to-brand/5 ring-2 ring-brand/40 shadow-md shadow-brand/10" 
          : "bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-[0.99] border border-neutral-200/60 dark:border-neutral-700/60"
      )}
    >
      <div className={cn(
        "w-5 h-5 rounded-full shrink-0 flex items-center justify-center border-2 transition-all",
        selected 
          ? "bg-gradient-to-br from-brand to-brand/80 border-brand shadow-sm" 
          : "border-neutral-300 dark:border-neutral-600"
      )}>
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
      
      <div className={cn(
        "w-7 h-7 rounded-lg flex items-center justify-center",
        isAsc 
          ? "bg-gradient-to-br from-emerald-500/20 to-emerald-500/10" 
          : "bg-gradient-to-br from-blue-500/20 to-blue-500/10"
      )}>
        {isAsc ? (
          <ArrowUp className={cn("h-4 w-4", isAsc ? "text-emerald-500" : "text-blue-500")} />
        ) : (
          <ArrowDown className="h-4 w-4 text-blue-500" />
        )}
      </div>
      
      <span className={cn(
        "text-sm font-semibold flex-1",
        selected ? "text-brand" : "text-neutral-900 dark:text-neutral-100"
      )}>
        {option.label}
      </span>
    </button>
  );
}

// Standard option item
function OptionItem({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
        "text-left transition-all duration-150",
        selected 
          ? "bg-brand/10 dark:bg-brand/15 ring-1 ring-brand/30" 
          : "hover:bg-neutral-100 dark:hover:bg-neutral-800/70"
      )}
    >
      <div className={cn(
        "w-5 h-5 rounded-full shrink-0 flex items-center justify-center border-2 transition-all",
        selected 
          ? "bg-brand border-brand" 
          : "border-neutral-300 dark:border-neutral-600"
      )}>
        {selected && <Check className="h-3 w-3 text-neutral-900" strokeWidth={3} />}
      </div>
      
      <span className={cn(
        "text-sm font-medium flex-1",
        selected ? "text-brand" : "text-neutral-900 dark:text-neutral-100"
      )}>
        {label}
      </span>
    </button>
  );
}

// Horizontal scrollable pill strip
function PillStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2 px-4">
      {children}
    </div>
  );
}

// Filter pill - Premium
function FilterPill({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-2xl",
        "text-xs font-bold whitespace-nowrap",
        "border transition-all duration-200 active:scale-[0.95]",
        active
          ? "bg-gradient-to-r from-brand to-brand/90 text-white border-brand shadow-lg shadow-brand/30"
          : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-700/80 shadow-sm"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function MobileHeader({
  sport,
  selectedGameIds,
  games,
  onGamesChange,
  selectedMarkets,
  marketOptions,
  onMarketsChange,
  sortField,
  sortOptions,
  onSortChange,
  searchQuery,
  onSearchChange,
  showSecondaryFilters = true,
  isCollapsed: isCollapsedProp = false,
  onCollapsedChange,
  upgradeBanner,
  onGlossaryClick,
  hideNoOdds = false, // Default OFF - show all players while odds load
  onHideNoOddsChange,
}: MobileHeaderProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isCollapsedInternal, setIsCollapsedInternal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Use prop if provided, otherwise use internal state
  const isCollapsed = onCollapsedChange ? isCollapsedProp : isCollapsedInternal;
  const setIsCollapsed = onCollapsedChange || setIsCollapsedInternal;
  
  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  const { today, tomorrow } = useMemo(() => getDateLabels(), []);
  
  const gamesByDate = useMemo(() => {
    const todayGames: GameOption[] = [];
    const tomorrowGames: GameOption[] = [];
    const otherGames: GameOption[] = [];
    
    games.forEach(game => {
      if (game.date === today) {
        todayGames.push(game);
      } else if (game.date === tomorrow) {
        tomorrowGames.push(game);
      } else {
        otherGames.push(game);
      }
    });
    
    return { todayGames, tomorrowGames, otherGames };
  }, [games, today, tomorrow]);

  // Group sort options by category
  const sortOptionsByCategory = useMemo(() => {
    const grouped: Record<string, SortOption[]> = {};
    
    Object.entries(SORT_CATEGORIES).forEach(([key, category]) => {
      grouped[key] = sortOptions.filter(opt => 
        category.fields.some(field => opt.field === field)
      );
    });
    
    return grouped;
  }, [sortOptions]);

  const closeDropdown = () => setOpenDropdown(null);
  
  const toggleGame = (gameId: string) => {
    if (selectedGameIds.includes(gameId)) {
      onGamesChange(selectedGameIds.filter(id => id !== gameId));
    } else {
      onGamesChange([...selectedGameIds, gameId]);
    }
  };

  const toggleMarket = (market: string) => {
    if (selectedMarkets.includes(market)) {
      if (selectedMarkets.length > 1) {
        onMarketsChange(selectedMarkets.filter(m => m !== market));
      }
    } else {
      onMarketsChange([...selectedMarkets, market]);
    }
  };

  const selectAllGames = () => onGamesChange([]);
  const selectAllMarkets = () => onMarketsChange(marketOptions.map(m => m.value));
  const deselectAllMarkets = () => {
    // Default back to points when deselecting all
    onMarketsChange(["player_points"]);
  };
  
  const gamesLabel = selectedGameIds.length === 0 
    ? "All Games" 
    : selectedGameIds.length === 1 
      ? games.find(g => g.id === selectedGameIds[0])?.label ?? "1 Game"
      : `${selectedGameIds.length} Games`;
      
  const marketsLabel = selectedMarkets.length === marketOptions.length
    ? "All Markets"
    : selectedMarkets.length === 1
      ? marketOptions.find(m => m.value === selectedMarkets[0])?.label ?? "1 Market"
      : `${selectedMarkets.length} Markets`;
  
  const currentSort = sortOptions.find(s => s.value === sortField);
  const sortLabel = currentSort?.label?.split(" ")[0] ?? "Sort";
  const sortDir = currentSort?.dir;

  const allMarketsSelected = selectedMarkets.length === marketOptions.length;

  return (
    <>
      <div className="bg-white dark:bg-neutral-950 border-b border-neutral-200/60 dark:border-neutral-800/60 overflow-hidden">
        {/* Filter Section */}
        {true && (
          <>
            <div className="px-3 pt-2 pb-1.5 space-y-2">
              {/* Row 1: Sport Selection - Tab Style with Glossary */}
              <div className="flex items-center border-b border-neutral-200 dark:border-neutral-800">
                <div className="flex gap-0 overflow-x-auto scrollbar-hide flex-1">
                  {SPORT_OPTIONS.map((sportOption) => {
                    const isSelected = sport === sportOption.value;
                    const isEnabled = sportOption.enabled;
                    return (
                      <div
                        key={sportOption.value}
                        className={cn(
                          "px-4 py-2 text-sm font-semibold transition-all duration-150 shrink-0 relative",
                          isEnabled
                            ? isSelected
                              ? "text-brand"
                              : "text-neutral-500 dark:text-neutral-400"
                            : "text-neutral-400 dark:text-neutral-600 cursor-not-allowed opacity-50"
                        )}
                      >
                        {sportOption.label}
                        {isSelected && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Glossary Button - Right aligned */}
                {onGlossaryClick && (
                  <button
                    type="button"
                    onClick={onGlossaryClick}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 mr-2 rounded-md shrink-0",
                      "text-xs font-medium transition-all duration-150 active:scale-[0.96]",
                      "text-neutral-500 dark:text-neutral-400",
                      "hover:text-neutral-700 dark:hover:text-neutral-300",
                      "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    )}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Help</span>
                  </button>
                )}
              </div>

              {/* Upgrade Banner - shown for free users */}
              {upgradeBanner}

              {/* Row 2: Market Selection - Single select (tap to select only that market) */}
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                {MARKET_OPTIONS.map((market) => {
                  // Handle "All" selection
                  const isAll = market.value === "all";
                  const allMarketsCount = MARKET_OPTIONS.length - 1; // Exclude "all" itself
                  const isAllSelected = selectedMarkets.length === allMarketsCount;
                  const isOnlyThisSelected = selectedMarkets.length === 1 && selectedMarkets[0] === market.value;
                  
                  // "All" is selected when all markets are selected
                  // Individual market is selected when it's the only one selected
                  const isSelected = isAll ? isAllSelected : isOnlyThisSelected;
                  
                  return (
                    <button
                      key={market.value}
                      type="button"
                      onClick={() => {
                        if (isAll) {
                          // Toggle all markets
                          if (isAllSelected) {
                            onMarketsChange(["player_points"]);
                          } else {
                            const allMarketValues = MARKET_OPTIONS.filter(m => m.value !== "all").map(m => m.value);
                            onMarketsChange(allMarketValues);
                          }
                        } else {
                          // Single-select: clicking a market selects only that market
                          onMarketsChange([market.value]);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-full shrink-0",
                        "text-xs font-medium transition-all duration-150 active:scale-[0.96]",
                        "border",
                        isSelected
                          ? "bg-brand text-neutral-900 border-brand shadow-sm shadow-brand/25"
                          : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                      )}
                    >
                      {market.label}
                    </button>
                  );
                })}
              </div>

              {/* Row 3: Search, Games, Sort Toggles */}
              <div className="flex items-center gap-2 pb-1">
                {/* Search Button */}
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                  className={cn(
                    "flex items-center justify-center px-2.5 py-1.5 rounded-lg shrink-0",
                    "border transition-all duration-150 active:scale-[0.96]",
                    searchQuery || isSearchExpanded
                      ? "bg-brand text-neutral-900 border-brand shadow-sm shadow-brand/25"
                      : "bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700"
                  )}
                >
                  <Search className="h-3.5 w-3.5" />
                </button>

                {/* Games Dropdown */}
                <DropdownButton
                  label="Games"
                  value={gamesLabel}
                  isOpen={openDropdown === "games"}
                  onClick={() => setOpenDropdown(openDropdown === "games" ? null : "games")}
                />

                {/* Sort Toggles - Toggle Group Style */}
                <div className="flex items-center gap-0.5 ml-auto shrink-0 bg-neutral-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-neutral-200/60 dark:border-neutral-700/60">
                  <button
                    type="button"
                    onClick={() => onSortChange("l5Pct_desc")}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] font-semibold transition-all",
                      sortField.startsWith("l5Pct")
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500 dark:text-neutral-400"
                    )}
                  >
                    L5
                  </button>
                  <button
                    type="button"
                    onClick={() => onSortChange("l10Pct_desc")}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] font-semibold transition-all",
                      sortField.startsWith("l10Pct")
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500 dark:text-neutral-400"
                    )}
                  >
                    L10
                  </button>
                  <button
                    type="button"
                    onClick={() => onSortChange("seasonPct_desc")}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] font-semibold transition-all",
                      sortField.startsWith("seasonPct")
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500 dark:text-neutral-400"
                    )}
                  >
                    SZN
                  </button>
                  <button
                    type="button"
                    onClick={() => onSortChange("dvp_desc")}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] font-semibold transition-all",
                      sortField.startsWith("dvp")
                        ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
                        : "text-neutral-500 dark:text-neutral-400"
                    )}
                  >
                    DvP
                  </button>
                </div>

                {/* Advanced Filters Button */}
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === "sort" ? null : "sort")}
                  className={cn(
                    "flex items-center justify-center px-2 py-1.5 rounded-lg shrink-0",
                    "border transition-all duration-150 active:scale-[0.96]",
                    openDropdown === "sort"
                      ? "bg-brand text-neutral-900 border-brand shadow-sm shadow-brand/25"
                      : "bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700"
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Search Input - Expanded State */}
              {isSearchExpanded && (
                <div className="pb-2">
                  <div 
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg",
                      "bg-neutral-100 dark:bg-neutral-800 border border-brand"
                    )}
                  >
                    <Search className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      placeholder="Search players..."
                      autoFocus
                      className={cn(
                        "flex-1 bg-transparent border-none outline-none",
                        "text-base text-neutral-900 dark:text-neutral-100",
                        "placeholder:text-neutral-500",
                        "min-w-0"
                      )}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          onSearchChange("");
                        }}
                        className="shrink-0"
                      >
                        <X className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            
          </>
        )}
      </div>

      {/* Sport Dropdown Panel */}
      <DropdownPanel
        isOpen={openDropdown === "sport"}
        onClose={closeDropdown}
        title="Select Sport"
      >
        <div className="space-y-2 mt-2">
          <OptionItem
            label="NBA Basketball"
            selected={sport === "nba"}
            onClick={closeDropdown}
          />
          <OptionItem
            label="NFL Football"
            selected={false}
            onClick={() => {}}
          />
          <OptionItem
            label="MLB Baseball"
            selected={false}
            onClick={() => {}}
          />
        </div>
      </DropdownPanel>

      {/* Games Dropdown Panel */}
      <DropdownPanel
        isOpen={openDropdown === "games"}
        onClose={closeDropdown}
        title="Select Games"
      >
        <button
          type="button"
          onClick={selectAllGames}
          className={cn(
            "w-full py-3 px-4 rounded-xl text-sm font-semibold mb-2 transition-all mt-2",
            selectedGameIds.length === 0
              ? "bg-brand text-neutral-900 shadow-sm shadow-brand/25"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          )}
        >
          All Games
        </button>
        
        {games.length === 0 ? (
          <div className="text-center py-12 text-sm text-neutral-500">
            No games available
          </div>
        ) : (
          <>
            {gamesByDate.todayGames.length > 0 && (
              <>
                <DateHeader label="Today" />
                <div className="space-y-2">
                  {gamesByDate.todayGames.map((game) => (
                    <GameOptionItem
                      key={game.id}
                      game={game}
                      selected={selectedGameIds.includes(game.id)}
                      onClick={() => toggleGame(game.id)}
                    />
                  ))}
                </div>
              </>
            )}
            
            {gamesByDate.tomorrowGames.length > 0 && (
              <>
                <DateHeader label="Tomorrow" />
                <div className="space-y-2">
                  {gamesByDate.tomorrowGames.map((game) => (
                    <GameOptionItem
                      key={game.id}
                      game={game}
                      selected={selectedGameIds.includes(game.id)}
                      onClick={() => toggleGame(game.id)}
                    />
                  ))}
                </div>
              </>
            )}
            
            {gamesByDate.otherGames.length > 0 && (
              <>
                <DateHeader label="Upcoming" />
                <div className="space-y-2">
                  {gamesByDate.otherGames.map((game) => (
                    <GameOptionItem
                      key={game.id}
                      game={game}
                      selected={selectedGameIds.includes(game.id)}
                      onClick={() => toggleGame(game.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </DropdownPanel>

      {/* Markets Dropdown Panel - Premium Design */}
      <DropdownPanel
        isOpen={openDropdown === "markets"}
        onClose={closeDropdown}
        title="Select Markets"
      >
        {/* Quick action buttons */}
        <div className="flex gap-2 mt-2 mb-4">
          <button
            type="button"
            onClick={selectAllMarkets}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all",
              allMarketsSelected
                ? "bg-brand text-neutral-900 shadow-sm shadow-brand/25"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            )}
          >
            Select All
          </button>
          <button
            type="button"
            onClick={deselectAllMarkets}
            className={cn(
              "flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all",
              "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300",
              "hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400",
              "hover:border-red-200 dark:hover:border-red-800 border border-transparent"
            )}
          >
            Clear
          </button>
        </div>

        {/* Selected count indicator */}
        <div className="flex items-center justify-between px-1 mb-3">
          <span className="text-xs text-neutral-500">
            {selectedMarkets.length} of {marketOptions.length} selected
          </span>
          <div className="h-1 flex-1 mx-3 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand rounded-full transition-all duration-300"
              style={{ width: `${(selectedMarkets.length / marketOptions.length) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Markets grouped by category */}
        {Object.entries(MARKET_CATEGORIES).map(([key, category]) => {
          const categoryMarkets = marketOptions.filter(m => 
            category.markets.includes(m.value)
          );
          
          if (categoryMarkets.length === 0) return null;
          
          const selectedInCategory = categoryMarkets.filter(m => 
            selectedMarkets.includes(m.value)
          ).length;
          const allCategorySelected = selectedInCategory === categoryMarkets.length;
          const noneSelected = selectedInCategory === 0;
          
          // Determine badge text and style
          let badgeText = "";
          let badgeStyle = "";
          if (allCategorySelected) {
            badgeText = "All";
            badgeStyle = "bg-brand/10 text-brand";
          } else if (noneSelected) {
            badgeText = "None";
            badgeStyle = "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700";
          } else {
            badgeText = `${selectedInCategory}/${categoryMarkets.length}`;
            badgeStyle = "bg-blue-500/10 text-blue-500";
          }
          
          return (
            <div key={key}>
              <CategoryHeader 
                label={category.label} 
                icon={category.icon}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      if (allCategorySelected) {
                        // Deselect category (but keep at least one overall)
                        const remaining = selectedMarkets.filter(
                          m => !category.markets.includes(m)
                        );
                        if (remaining.length > 0) {
                          onMarketsChange(remaining);
                        }
                      } else {
                        // Select all in category
                        const newMarkets = [...new Set([
                          ...selectedMarkets,
                          ...categoryMarkets.map(m => m.value)
                        ])];
                        onMarketsChange(newMarkets);
                      }
                    }}
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all",
                      badgeStyle
                    )}
                  >
                    {badgeText}
                  </button>
                }
              />
              <div className="flex flex-wrap gap-2">
                {categoryMarkets.map((market) => (
                  <MarketChip
                    key={market.value}
                    label={market.label}
                    selected={selectedMarkets.includes(market.value)}
                    onClick={() => toggleMarket(market.value)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </DropdownPanel>

      {/* Sort Dropdown Panel - Premium Design */}
      <DropdownPanel
        isOpen={openDropdown === "sort"}
        onClose={closeDropdown}
        title="Sort & Filters"
      >
        {/* Hide Players Without Odds Toggle */}
        {onHideNoOddsChange && (
          <div className="mb-4 mt-2">
            <CategoryHeader 
              label="Filters" 
              icon={Target}
            />
            <label className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl cursor-pointer">
              <div>
                <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Hide Players Without Odds
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Only show props with betting lines
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hideNoOdds}
                onClick={() => onHideNoOddsChange(!hideNoOdds)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                  hideNoOdds ? "bg-brand" : "bg-neutral-200 dark:bg-neutral-700"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform",
                    hideNoOdds ? "translate-x-[22px]" : "translate-x-0.5"
                  )}
                />
              </button>
            </label>
          </div>
        )}

        {Object.entries(SORT_CATEGORIES).map(([key, category]) => {
          const categoryOptions = sortOptionsByCategory[key] || [];
          
          if (categoryOptions.length === 0) return null;
          
          return (
            <div key={key}>
              <CategoryHeader 
                label={category.label} 
                icon={category.icon}
              />
              <div className="space-y-1 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-1">
                {categoryOptions.map((option) => (
                  <SortOptionItem
                    key={option.value}
                    option={option}
                    selected={sortField === option.value}
                    onClick={() => {
                      onSortChange(option.value);
                      closeDropdown();
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </DropdownPanel>
    </>
  );
}
