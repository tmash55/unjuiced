"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/seperator";
import { getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import { getAllSports, getAllLeagues } from "@/lib/data/sports";
import { formatMarketLabel, SPORT_MARKETS } from "@/lib/data/markets";
import { 
  Filter, Building2, Target, TrendingUp, Lock, Percent, Eye, EyeOff, 
  ChevronDown, ChevronRight, Search, Check, Info, Trash2 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SportIcon } from "@/components/icons/sport-icons";
import { ButtonLink } from "@/components/button-link";
import { Tooltip } from "@/components/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Import tool-specific types
import type { SharpPreset, DevigMethod } from "@/lib/ev/types";
import { SHARP_PRESETS, DEVIG_METHODS } from "@/lib/ev/constants";

// =============================================================================
// Types
// =============================================================================

export type ToolType = "edge-finder" | "positive-ev";

// Common filter values shared across both tools
export interface CommonFilters {
  selectedBooks: string[];
  selectedMarkets: string[];
  minLiquidity: number;
  showHidden: boolean;
}

// Edge Finder specific settings
export interface EdgeFinderSettings {
  selectedLeagues: string[];
  marketLines: Record<string, number[]>;
  minImprovement: number;
  maxOdds?: number;
  minOdds?: number;
  hideCollegePlayerProps: boolean;
  comparisonMode: "average" | "book" | "next_best";
  comparisonBook: string | null;
  scope: "all" | "pregame" | "live";
}

// Positive EV specific settings
export interface PositiveEVSettings {
  selectedSports: string[];
  sharpPreset: SharpPreset;
  devigMethods: DevigMethod[];
  evCase: "worst" | "best";
  minEv: number;
  maxEv?: number;
  mode: "pregame" | "live" | "all";
  minBooksPerSide: number;
}

// Combined filter change event
export type FilterChangeEvent = Partial<CommonFilters & EdgeFinderSettings & PositiveEVSettings>;

export interface UnifiedFiltersProps {
  tool: ToolType;
  
  // Common filter values
  selectedBooks: string[];
  selectedMarkets: string[];
  minLiquidity: number;
  showHidden: boolean;
  hiddenCount: number;
  
  // Tool-specific settings (passed as union)
  toolSettings: EdgeFinderSettings | PositiveEVSettings;
  
  // Callbacks
  onFiltersChange: (filters: FilterChangeEvent) => void;
  onToggleShowHidden?: () => void;
  onClearAllHidden?: () => void;
  
  // Kelly Criterion (shared)
  bankroll?: number;
  kellyPercent?: number;
  onBankrollChange?: (value: number) => void;
  onKellyPercentChange?: (value: number) => void;
  
  // Available options
  availableSports?: string[];
  availableLeagues?: string[];
  availableMarkets: string[];
  availableSportsbooks?: string[];
  
  // Counts for sportsbook badges
  sportsbookCounts?: Record<string, number>;
  
  // State
  locked?: boolean;
  isLoggedIn?: boolean;
  isPro?: boolean;
  
  // Edge Finder specific
  customPresetActive?: boolean;
  activePresetName?: string;
}

// =============================================================================
// Constants
// =============================================================================

const SPORT_LABELS: Record<string, string> = {
  nba: "NBA",
  nfl: "NFL",
  ncaaf: "NCAAF",
  ncaab: "NCAAB",
  nhl: "NHL",
  mlb: "MLB",
  ncaabaseball: "NCAA Baseball",
  wnba: "WNBA",
  soccer_epl: "EPL",
  soccer_laliga: "LaLiga",
  soccer_mls: "MLS",
  soccer_ucl: "UCL",
  soccer_uel: "UEL",
  tennis_atp: "ATP",
  tennis_challenger: "Challenger",
  tennis_itf_men: "ITF Men",
  tennis_itf_women: "ITF Women",
  tennis_utr_men: "UTR Men",
  tennis_utr_women: "UTR Women",
  tennis_wta: "WTA",
  ufc: "UFC",
};

const MIN_EV_OPTIONS = [0, 0.5, 1, 2, 3, 5, 10];
const MAX_EV_OPTIONS = [5, 10, 15, 20, 25, 50, 100];

const MIN_LIQUIDITY_OPTIONS = [
  { value: 0, label: "No minimum" },
  { value: 25, label: "$25 minimum" },
  { value: 50, label: "$50 minimum" },
  { value: 100, label: "$100 minimum" },
  { value: 250, label: "$250 minimum" },
  { value: 500, label: "$500 minimum" },
  { value: 1000, label: "$1,000 minimum" },
  { value: 2500, label: "$2,500 minimum" },
  { value: 5000, label: "$5,000 minimum" },
];

// =============================================================================
// Helper Functions
// =============================================================================

function isPositiveEVSettings(settings: EdgeFinderSettings | PositiveEVSettings): settings is PositiveEVSettings {
  return "sharpPreset" in settings;
}

function isEdgeFinderSettings(settings: EdgeFinderSettings | PositiveEVSettings): settings is EdgeFinderSettings {
  return "comparisonMode" in settings;
}

// Line options for markets (Edge Finder specific)
function hasLineOptions(market: string): boolean {
  const marketsWithLines = [
    'player_touchdowns', 'player_tds', 'touchdowns',
    'rushing_tds', 'receiving_tds', 'passing_tds',
    'player_threes', 'threes', 'three_pointers',
  ];
  return marketsWithLines.some(m => market.toLowerCase().includes(m));
}

function getLineOptions(market: string): { lines: number[]; labels: string[] } | null {
  const m = market.toLowerCase();
  if (m.includes('touchdown') || m.includes('_td')) {
    return {
      lines: [0.5, 1.5, 2.5],
      labels: ['1+', '2+', '3+'],
    };
  }
  if (m.includes('three') || m.includes('3pt')) {
    return {
      lines: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5],
      labels: ['1+', '2+', '3+', '4+', '5+', '6+'],
    };
  }
  return null;
}

// =============================================================================
// Component
// =============================================================================

export function UnifiedFilters({
  tool,
  selectedBooks,
  selectedMarkets,
  minLiquidity,
  showHidden,
  hiddenCount,
  toolSettings,
  onFiltersChange,
  onToggleShowHidden,
  onClearAllHidden,
  bankroll = 1000,
  kellyPercent = 25,
  onBankrollChange,
  onKellyPercentChange,
  availableSports = [],
  availableLeagues = [],
  availableMarkets,
  availableSportsbooks = [],
  sportsbookCounts = {},
  locked = false,
  isLoggedIn = false,
  isPro = false,
  customPresetActive = false,
  activePresetName,
}: UnifiedFiltersProps) {
  const allSportsbooks = useMemo(() => getAllActiveSportsbooks(), []);
  const allSports = useMemo(() => getAllSports(), []);
  const allLeagues = useMemo(() => getAllLeagues(), []);
  
  const [open, setOpen] = useState(false);
  const [expandedSportSections, setExpandedSportSections] = useState<Set<string>>(new Set(["Basketball", "Football"]));
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set());
  const [marketSearchQuery, setMarketSearchQuery] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  
  // Local state for common fields
  const [localBooks, setLocalBooks] = useState<string[]>(selectedBooks);
  const [localMarkets, setLocalMarkets] = useState<string[]>(selectedMarkets);
  const [localMinLiquidity, setLocalMinLiquidity] = useState<number>(minLiquidity);
  
  // Local state for Kelly Criterion
  const [localBankrollStr, setLocalBankrollStr] = useState<string>(String(bankroll));
  const [localKellyPercentStr, setLocalKellyPercentStr] = useState<string>(String(kellyPercent));
  
  // -------------------------------------------------------------------------
  // Edge Finder specific local state
  // -------------------------------------------------------------------------
  const efSettings = isEdgeFinderSettings(toolSettings) ? toolSettings : null;
  const [localLeagues, setLocalLeagues] = useState<string[]>(efSettings?.selectedLeagues || []);
  const [localSportsEF, setLocalSportsEF] = useState<string[]>(() => {
    if (!efSettings) return [];
    if (efSettings.selectedLeagues.length === 0) {
      return allSports.map(s => s.id);
    }
    return allSports
      .filter(sport => sport.leagues.some(league => efSettings.selectedLeagues.includes(league.id)))
      .map(sport => sport.id);
  });
  const [localMarketLines, setLocalMarketLines] = useState<Record<string, number[]>>(efSettings?.marketLines || {});
  const [localMinImprovement, setLocalMinImprovement] = useState<number>(efSettings?.minImprovement || 0);
  const [localMaxOdds, setLocalMaxOdds] = useState<number | undefined>(efSettings?.maxOdds);
  const [localMinOdds, setLocalMinOdds] = useState<number | undefined>(efSettings?.minOdds);
  const [localHideCollegePlayerProps, setLocalHideCollegePlayerProps] = useState<boolean>(efSettings?.hideCollegePlayerProps || false);
  
  // -------------------------------------------------------------------------
  // Positive EV specific local state
  // -------------------------------------------------------------------------
  const evSettings = isPositiveEVSettings(toolSettings) ? toolSettings : null;
  const [localSportsEV, setLocalSportsEV] = useState<string[]>(evSettings?.selectedSports || []);
  const [localSharpPreset, setLocalSharpPreset] = useState<SharpPreset>(evSettings?.sharpPreset || "pinnacle");
  const [localDevigMethods, setLocalDevigMethods] = useState<DevigMethod[]>(evSettings?.devigMethods || ["power", "multiplicative"]);
  const [localEvCase, setLocalEvCase] = useState<"worst" | "best">(evSettings?.evCase || "worst");
  const [localMinEv, setLocalMinEv] = useState<number>(evSettings?.minEv || 2);
  const [localMaxEv, setLocalMaxEv] = useState<number | undefined>(evSettings?.maxEv);
  const [localMode, setLocalMode] = useState<"pregame" | "live" | "all">(evSettings?.mode || "pregame");
  const [localMinBooksPerSide, setLocalMinBooksPerSide] = useState<number>(evSettings?.minBooksPerSide || 2);
  
  // -------------------------------------------------------------------------
  // Sync local state with props when the sheet opens
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return; // Only sync when opening
    
    setLocalBooks(selectedBooks);
    setLocalMarkets(selectedMarkets);
    setLocalMinLiquidity(minLiquidity);
    setLocalBankrollStr(String(bankroll));
    setLocalKellyPercentStr(String(kellyPercent));
    setHasUnsavedChanges(false);
    
    if (efSettings) {
      setLocalLeagues(efSettings.selectedLeagues.length === 0 ? availableLeagues : efSettings.selectedLeagues);
      setLocalMarketLines(efSettings.marketLines);
      setLocalMinImprovement(efSettings.minImprovement);
      setLocalMaxOdds(efSettings.maxOdds);
      setLocalMinOdds(efSettings.minOdds);
      setLocalHideCollegePlayerProps(efSettings.hideCollegePlayerProps);
    }
    
    if (evSettings) {
      setLocalSportsEV(evSettings.selectedSports);
      setLocalSharpPreset(evSettings.sharpPreset);
      setLocalDevigMethods(evSettings.devigMethods);
      setLocalEvCase(evSettings.evCase);
      setLocalMinEv(evSettings.minEv);
      setLocalMaxEv(evSettings.maxEv);
      setLocalMode(evSettings.mode);
      setLocalMinBooksPerSide(evSettings.minBooksPerSide);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // Only re-sync when sheet opens
  
  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------
  const allBooksSelected = localBooks.length === 0;
  const allMarketsSelected = localMarkets.length === 0;
  
  // Group markets by sport type
  const groupedMarkets = useMemo(() => {
    const groups: Record<string, string[]> = {
      Basketball: [],
      Football: [],
      Hockey: [],
      Baseball: [],
      Soccer: [],
      Tennis: [],
      MMA: [],
    };
    
    const basketballMarkets = new Set<string>();
    const footballMarkets = new Set<string>();
    const hockeyMarkets = new Set<string>();
    const baseballMarkets = new Set<string>();
    const soccerMarkets = new Set<string>();
    const tennisMarkets = new Set<string>();
    const mmaMarkets = new Set<string>();
    
    ["basketball_nba", "basketball_ncaab", "basketball_wnba"].forEach((key) => {
      (SPORT_MARKETS[key] || []).forEach((m) => basketballMarkets.add(m.apiKey));
    });
    ["football_nfl", "football_ncaaf"].forEach((key) => {
      (SPORT_MARKETS[key] || []).forEach((m) => footballMarkets.add(m.apiKey));
    });
    (SPORT_MARKETS["icehockey_nhl"] || []).forEach((m) => hockeyMarkets.add(m.apiKey));
    (SPORT_MARKETS["baseball_mlb"] || []).forEach((m) => baseballMarkets.add(m.apiKey));
    (SPORT_MARKETS["baseball_ncaabaseball"] || []).forEach((m) => baseballMarkets.add(m.apiKey));
    ["soccer_epl", "soccer_laliga", "soccer_mls", "soccer_ucl", "soccer_uel"].forEach((key) => {
      (SPORT_MARKETS[key] || []).forEach((m) => soccerMarkets.add(m.apiKey));
    });
    ["tennis_atp", "tennis_challenger", "tennis_itf_men", "tennis_itf_women", "tennis_utr_men", "tennis_utr_women", "tennis_wta"].forEach((key) => {
      (SPORT_MARKETS[key] || []).forEach((m) => tennisMarkets.add(m.apiKey));
    });
    (SPORT_MARKETS["ufc"] || []).forEach((m) => mmaMarkets.add(m.apiKey));
    
    availableMarkets.forEach((market) => {
      const m = market.toLowerCase();
      if (basketballMarkets.has(m)) groups.Basketball.push(market);
      else if (footballMarkets.has(m)) groups.Football.push(market);
      else if (hockeyMarkets.has(m)) groups.Hockey.push(market);
      else if (baseballMarkets.has(m)) groups.Baseball.push(market);
      else if (soccerMarkets.has(m)) groups.Soccer.push(market);
      else if (tennisMarkets.has(m)) groups.Tennis.push(market);
      else if (mmaMarkets.has(m)) groups.MMA.push(market);
      else if (m.includes("point") || m.includes("rebound") || m.includes("assist") || m.includes("pra")) {
        groups.Basketball.push(market);
      } else if (m.includes("passing") || m.includes("rushing") || m.includes("receiving") || m.includes("touchdown")) {
        groups.Football.push(market);
      } else if (m.includes("shot") || m.includes("goal") || m.includes("save")) {
        groups.Hockey.push(market);
      } else if (m.includes("set") || m.includes("tiebreak") || m.includes("breaks")) {
        groups.Tennis.push(market);
      } else if (m.includes("fight") || m.includes("round") || m.includes("decision") || m.includes("finish")) {
        groups.MMA.push(market);
      }
    });
    
    return groups;
  }, [availableMarkets]);
  
  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (!allBooksSelected) count++;
    if (!allMarketsSelected) count++;
    if (localMinLiquidity > 0) count++;
    
    if (tool === "positive-ev" && evSettings) {
      if (localMaxEv !== undefined) count++;
      if (localSharpPreset !== "pinnacle") count++;
    }
    
    if (tool === "edge-finder" && efSettings) {
      if (localMinImprovement > 0) count++;
      if (localMaxOdds !== undefined || localMinOdds !== undefined) count++;
    }
    
    return count;
  }, [
    allBooksSelected, allMarketsSelected, localMinLiquidity, tool,
    evSettings, localMaxEv, localSharpPreset,
    efSettings, localMinImprovement, localMaxOdds, localMinOdds
  ]);
  
  // -------------------------------------------------------------------------
  // Toggle handlers
  // -------------------------------------------------------------------------
  // IMPORTANT: The two tools use DIFFERENT models for selectedBooks:
  // - Edge Finder: EXCLUSION model (array stores EXCLUDED books, empty = all selected)
  // - Positive EV: INCLUSION model (array stores INCLUDED books, empty = all selected)
  const isExclusionModel = tool === "edge-finder";
  
  const toggleBook = useCallback((id: string) => {
    if (locked) return;
    
    if (isExclusionModel) {
      // EXCLUSION model: array stores excluded books
      // - If in array (excluded), remove it (select it)
      // - If not in array (selected), add it (exclude it)
      setLocalBooks((prev) => prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]);
    } else {
      // INCLUSION model: array stores selected books
      // - If empty (all selected), create array with all OTHER books (deselect clicked one)
      // - If in array (selected), remove it (deselect)
      // - If not in array (not selected), add it (select)
      setLocalBooks((prev) => {
        if (prev.length === 0) {
          // All selected, deselect this one = create array with all others
          return allSportsbooks.filter((sb) => sb.id !== id).map((sb) => sb.id);
        }
        return prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id];
      });
    }
    setHasUnsavedChanges(true);
  }, [locked, isExclusionModel, allSportsbooks]);
  
  const toggleMarket = useCallback((id: string) => {
    if (locked) return;
    setLocalMarkets((prev) => {
      if (prev.length === 0) {
        return availableMarkets.filter((m) => m !== id);
      }
      return prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
    });
    setHasUnsavedChanges(true);
  }, [locked, availableMarkets]);
  
  // Positive EV: toggle sport
  const toggleSportEV = useCallback((id: string) => {
    if (locked) return;
    setLocalSportsEV((prev) => 
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    setHasUnsavedChanges(true);
  }, [locked]);
  
  // Edge Finder: toggle sport
  const toggleSportEF = useCallback((sportId: string) => {
    if (locked) return;
    setLocalSportsEF((prev) => {
      const isSelected = prev.includes(sportId);
      if (isSelected) {
        // Deselect sport and its leagues
        const sport = allSports.find(s => s.id === sportId);
        if (sport) {
          setLocalLeagues(l => l.filter(lid => !sport.leagues.some(sl => sl.id === lid)));
        }
        return prev.filter(s => s !== sportId);
      } else {
        // Select sport and all its leagues
        const sport = allSports.find(s => s.id === sportId);
        if (sport) {
          setLocalLeagues(l => [...new Set([...l, ...sport.leagues.map(sl => sl.id)])]);
        }
        return [...prev, sportId];
      }
    });
    setHasUnsavedChanges(true);
  }, [locked, allSports]);
  
  // Edge Finder: toggle league
  const toggleLeague = useCallback((leagueId: string) => {
    if (locked) return;
    setLocalLeagues((prev) => 
      prev.includes(leagueId) ? prev.filter((l) => l !== leagueId) : [...prev, leagueId]
    );
    setHasUnsavedChanges(true);
  }, [locked]);
  
  // Positive EV: toggle devig method
  const toggleDevigMethod = useCallback((method: DevigMethod) => {
    if (locked) return;
    setLocalDevigMethods((prev) => {
      if (prev.includes(method)) {
        if (prev.length <= 1) return prev;
        return prev.filter((m) => m !== method);
      }
      return [...prev, method];
    });
    setHasUnsavedChanges(true);
  }, [locked]);
  
  // -------------------------------------------------------------------------
  // Apply and Reset
  // -------------------------------------------------------------------------
  const apply = useCallback(() => {
    if (locked) return;
    
    const commonUpdates: Partial<CommonFilters> = {
      selectedBooks: localBooks,
      selectedMarkets: localMarkets,
      minLiquidity: localMinLiquidity,
    };
    
    // Apply Kelly changes
    if (onBankrollChange) {
      const num = Math.max(0, Number(localBankrollStr) || 0);
      onBankrollChange(num);
    }
    if (onKellyPercentChange) {
      const num = Math.max(1, Math.min(100, Number(localKellyPercentStr) || 25));
      onKellyPercentChange(num);
    }
    
    if (tool === "positive-ev") {
      onFiltersChange({
        ...commonUpdates,
        selectedSports: localSportsEV,
        sharpPreset: localSharpPreset,
        devigMethods: localDevigMethods,
        evCase: localEvCase,
        minEv: localMinEv,
        maxEv: localMaxEv,
        mode: localMode,
        minBooksPerSide: localMinBooksPerSide,
      });
    } else {
      onFiltersChange({
        ...commonUpdates,
        selectedLeagues: localLeagues,
        marketLines: localMarketLines,
        minImprovement: localMinImprovement,
        maxOdds: localMaxOdds,
        minOdds: localMinOdds,
        hideCollegePlayerProps: localHideCollegePlayerProps,
      });
    }
    
    setHasUnsavedChanges(false);
    setOpen(false);
  }, [
    locked, tool, localBooks, localMarkets, localMinLiquidity,
    localBankrollStr, localKellyPercentStr, onBankrollChange, onKellyPercentChange,
    localSportsEV, localSharpPreset, localDevigMethods, localEvCase,
    localMinEv, localMaxEv, localMode, localMinBooksPerSide,
    localLeagues, localMarketLines, localMinImprovement, localMaxOdds, localMinOdds,
    localHideCollegePlayerProps, onFiltersChange
  ]);
  
  const reset = useCallback(() => {
    if (locked) return;
    
    setLocalBooks([]);
    setLocalMarkets([]);
    setLocalMinLiquidity(0);
    setLocalBankrollStr("1000");
    setLocalKellyPercentStr("25");
    
    if (tool === "positive-ev") {
      setLocalSportsEV(["nba", "nfl"]);
      setLocalSharpPreset("pinnacle");
      setLocalDevigMethods(["power", "multiplicative"]);
      setLocalEvCase("worst");
      setLocalMinEv(2);
      setLocalMaxEv(undefined);
      setLocalMode("pregame");
      setLocalMinBooksPerSide(2);
      
      onFiltersChange({
        selectedBooks: [],
        selectedMarkets: [],
        minLiquidity: 0,
        selectedSports: ["nba", "nfl"],
        sharpPreset: "pinnacle",
        devigMethods: ["power", "multiplicative"],
        evCase: "worst",
        minEv: 2,
        maxEv: undefined,
        mode: "pregame",
        minBooksPerSide: 2,
      });
    } else {
      setLocalSportsEF(allSports.map(s => s.id));
      setLocalLeagues(allLeagues.map(l => l.id));
      setLocalMarketLines({});
      setLocalMinImprovement(0);
      setLocalMaxOdds(undefined);
      setLocalMinOdds(undefined);
      setLocalHideCollegePlayerProps(false);
      
      onFiltersChange({
        selectedBooks: [],
        selectedMarkets: [],
        minLiquidity: 0,
        selectedLeagues: [],
        marketLines: {},
        minImprovement: 0,
        maxOdds: undefined,
        minOdds: undefined,
        hideCollegePlayerProps: false,
      });
    }
    
    setHasUnsavedChanges(false);
  }, [locked, tool, allSports, allLeagues, onFiltersChange]);
  
  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const toolTitle = tool === "positive-ev" ? "EV Finder Filters" : "Edge Finder Filters";
  const toolIcon = tool === "positive-ev" ? <TrendingUp className="w-5 h-5 text-brand" /> : <Target className="w-5 h-5 text-brand" />;
  
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium transition-colors border",
            "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800",
            "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700",
            activeFiltersCount > 0 && "border-brand/40 dark:border-brand/60 bg-brand/5 dark:bg-brand/10 text-brand dark:text-brand"
          )}
          title="Filters"
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-white dark:bg-neutral-950 p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-neutral-200 px-4 sm:px-6 py-3 sm:py-4 dark:border-neutral-800">
            <SheetTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
              {toolIcon}
              {toolTitle}
            </SheetTitle>
          </SheetHeader>
          
          {/* Pro Lock Banner */}
          {locked && (
            <div className="mx-6 mt-4 rounded-lg border border-brand/20 dark:border-brand/60 bg-gradient-to-br from-brand/5 dark:from-brand/10 via-transparent to-transparent p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-brand" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white">Filters are a Sharp Feature</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {isLoggedIn ? "Upgrade to unlock full filtering capabilities" : "Try free to unlock full filtering capabilities"}
                    </p>
                  </div>
                </div>
                <ButtonLink href="/pricing" variant="pro" className="justify-center text-xs">
                  {isLoggedIn ? "Upgrade to Sharp" : "Try Free"}
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
              
              {/* ======================= Sportsbooks Tab ======================= */}
              <TabsContent value="books" className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Select books to show opportunities from
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => !locked && setLocalBooks([])}
                      disabled={locked}
                      className="h-8 rounded-lg px-3 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => !locked && setLocalBooks(allSportsbooks.map((sb) => sb.id))}
                      disabled={locked}
                      className="h-8 rounded-lg px-3 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {allSportsbooks
                    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                    .map((sb) => {
                      // Different models for different tools:
                      // - Edge Finder (exclusion): checked if ALL selected OR book is NOT in list
                      // - Positive EV (inclusion): checked if ALL selected OR book IS in list
                      const checked = isExclusionModel
                        ? (allBooksSelected || !localBooks.includes(sb.id))
                        : (allBooksSelected || localBooks.includes(sb.id));
                      const count = sportsbookCounts[sb.id] || 0;
                      return (
                        <button
                          key={sb.id}
                          type="button"
                          onClick={() => toggleBook(sb.id)}
                          disabled={locked}
                          className={cn(
                            "relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 text-left",
                            locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                            checked
                              ? "bg-white dark:bg-neutral-800/60 ring-2 ring-brand shadow-sm shadow-brand/20"
                              : "bg-white dark:bg-neutral-800/60 ring-1 ring-neutral-200 dark:ring-neutral-700/80 hover:ring-neutral-300 dark:hover:ring-neutral-600"
                          )}
                        >
                          <div className={cn(
                            "absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full transition-all",
                            checked
                              ? "bg-brand"
                              : "ring-1 ring-neutral-300 dark:ring-neutral-600 bg-white dark:bg-neutral-800"
                          )}>
                            {checked && (
                              <Check className="h-3 w-3 text-white" strokeWidth={3} />
                            )}
                          </div>
                          
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg overflow-hidden transition-colors bg-neutral-100 dark:bg-neutral-700/50">
                            {sb.image?.light ? (
                              <img src={sb.image.light} alt={sb.name} className="h-6 w-6 object-contain" />
                            ) : (
                              <Building2 className="h-4 w-4 text-neutral-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pr-6">
                            <span className="text-sm font-semibold leading-none block truncate text-neutral-900 dark:text-neutral-100">
                              {sb.name}
                            </span>
                            {count > 0 && (
                              <span className="text-xs mt-1 block text-neutral-500 dark:text-neutral-400">
                                {count} opportunities
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </TabsContent>
              
              {/* ======================= Sports & Markets Tab ======================= */}
              <TabsContent value="sports" className="mt-4 space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Filter by sports and markets
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (locked) return;
                        if (tool === "positive-ev") {
                          setLocalSportsEV(availableSports);
                        } else {
                          setLocalSportsEF(allSports.map(s => s.id));
                          setLocalLeagues(allLeagues.map(l => l.id));
                        }
                        setLocalMarkets([]);
                        setHasUnsavedChanges(true);
                      }}
                      disabled={locked}
                      className="h-8 rounded-lg px-3 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => {
                        if (locked) return;
                        if (tool === "positive-ev") {
                          setLocalSportsEV([]);
                        } else {
                          setLocalSportsEF([]);
                          setLocalLeagues([]);
                        }
                        setLocalMarkets(availableMarkets);
                        setHasUnsavedChanges(true);
                      }}
                      disabled={locked}
                      className="h-8 rounded-lg px-3 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Sports Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Sports</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(tool === "positive-ev" ? availableSports : allSports.map(s => s.id)).map((sport) => {
                      const sportId = typeof sport === "string" ? sport : sport;
                      const checked = tool === "positive-ev" 
                        ? localSportsEV.includes(sportId)
                        : localSportsEF.includes(sportId);
                      
                      return (
                        <button
                          key={sportId}
                          type="button"
                          onClick={() => tool === "positive-ev" ? toggleSportEV(sportId) : toggleSportEF(sportId)}
                          disabled={locked}
                          className={cn(
                            "relative flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 text-left",
                            locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                            checked
                              ? "bg-white dark:bg-neutral-800/60 ring-2 ring-brand shadow-sm shadow-brand/20"
                              : "bg-white dark:bg-neutral-800/60 ring-1 ring-neutral-200 dark:ring-neutral-700/80 hover:ring-neutral-300 dark:hover:ring-neutral-600"
                          )}
                        >
                          <div className={cn(
                            "absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full transition-all",
                            checked
                              ? "bg-brand"
                              : "ring-1 ring-neutral-300 dark:ring-neutral-600 bg-white dark:bg-neutral-800"
                          )}>
                            {checked && (
                              <Check className="h-3 w-3 text-white" strokeWidth={3} />
                            )}
                          </div>
                          
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700/50">
                            <SportIcon sport={sportId} className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                          </div>
                          <span className="text-sm font-semibold leading-none pr-6 text-neutral-900 dark:text-neutral-100">
                            {SPORT_LABELS[sportId] || sportId.toUpperCase()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Leagues Section - Edge Finder only */}
                {tool === "edge-finder" && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">Leagues</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {allLeagues.map((league) => {
                          const checked = localLeagues.includes(league.id);
                          const sportSelected = localSportsEF.length === 0 || localSportsEF.includes(league.sportId);
                          const isDisabled = locked || !sportSelected;
                          
                          return (
                            <button
                              key={league.id}
                              type="button"
                              onClick={() => !isDisabled && toggleLeague(league.id)}
                              disabled={isDisabled}
                              className={cn(
                                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                                isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                                checked && !isDisabled
                                  ? "bg-white dark:bg-neutral-800 ring-2 ring-brand shadow-sm shadow-brand/10"
                                  : "bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 ring-1 ring-neutral-200 dark:ring-neutral-700"
                              )}
                            >
                              <div className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors",
                                checked && !isDisabled
                                  ? "bg-brand" 
                                  : "ring-1 ring-neutral-300 dark:ring-neutral-600 bg-white dark:bg-neutral-700"
                              )}>
                                {checked && !isDisabled && (
                                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                                )}
                              </div>
                              <SportIcon sport={league.sportId.toLowerCase()} className="h-4 w-4 text-neutral-500" />
                              <span className="text-xs font-medium leading-tight text-neutral-700 dark:text-neutral-300">
                                {league.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Markets Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Markets</Label>
                    <span className="text-xs font-medium text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
                      {allMarketsSelected ? "All" : localMarkets.length} selected
                    </span>
                  </div>
                  
                  {/* Market Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search markets..."
                      value={marketSearchQuery}
                      onChange={(e) => setMarketSearchQuery(e.target.value)}
                      className="w-full rounded-xl border-0 ring-1 ring-neutral-200 dark:ring-neutral-700/80 bg-white dark:bg-neutral-800/60 py-2.5 pl-10 pr-4 text-sm placeholder:text-neutral-400 focus:ring-2 focus:ring-brand focus:outline-none dark:text-white dark:placeholder:text-neutral-500 transition-shadow"
                    />
                    {marketSearchQuery && (
                      <button
                        onClick={() => setMarketSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  {/* Custom Mode Warning (Edge Finder only) */}
                  {tool === "edge-finder" && customPresetActive && (
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/60">
                      <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                          Custom Mode Active
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          Market filters are controlled by your active custom model.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Sport Accordions */}
                  <div className={cn("space-y-3", tool === "edge-finder" && customPresetActive && "opacity-50 pointer-events-none")}>
                    {Object.entries(groupedMarkets).map(([sportType, markets]) => {
                      const filteredMarkets = marketSearchQuery 
                        ? markets.filter(m => (formatMarketLabel(m) || m).toLowerCase().includes(marketSearchQuery.toLowerCase()))
                        : markets;
                      
                      if (filteredMarkets.length === 0) return null;
                      
                      const isExpanded = expandedSportSections.has(sportType);
                      const selectedCount = filteredMarkets.filter(m => allMarketsSelected || localMarkets.includes(m)).length;
                      const allSelected = selectedCount === filteredMarkets.length;
                      
                      const sportIconMap: Record<string, string> = {
                        "Basketball": "basketball",
                        "Football": "football",
                        "Hockey": "icehockey",
                        "Baseball": "baseball",
                        "Soccer": "soccer",
                      };
                      
                      return (
                        <div 
                          key={sportType}
                          className="rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-800 bg-neutral-50 dark:bg-neutral-800/30 overflow-hidden"
                        >
                          {/* Accordion Header */}
                          <button
                            type="button"
                            onClick={() => {
                              const newExpanded = new Set(expandedSportSections);
                              if (isExpanded) {
                                newExpanded.delete(sportType);
                              } else {
                                newExpanded.add(sportType);
                              }
                              setExpandedSportSections(newExpanded);
                            }}
                            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-neutral-800 ring-1 ring-neutral-200 dark:ring-neutral-700">
                                <SportIcon sport={sportIconMap[sportType] || "football"} className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                              </div>
                              <div className="text-left">
                                <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                                  {sportType}
                                </div>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                  {filteredMarkets.length} market{filteredMarkets.length !== 1 ? "s" : ""}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                                allSelected 
                                  ? "bg-brand text-white" 
                                  : selectedCount > 0 
                                    ? "bg-white dark:bg-neutral-800 text-brand ring-1 ring-brand/30 dark:ring-brand/70"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500"
                              )}>
                                {allSelected ? (
                                  <>
                                    <Check className="h-3 w-3" />
                                    All
                                  </>
                                ) : (
                                  `${selectedCount}/${filteredMarkets.length}`
                                )}
                              </div>
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDown className="h-4 w-4 text-neutral-400" />
                              </motion.div>
                            </div>
                          </button>
                          
                          {/* Accordion Content */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                <div className="border-t border-neutral-200/50 dark:border-neutral-700/50">
                                  {/* Quick Actions */}
                                  <div className="flex items-center justify-between px-4 py-2.5 bg-white/50 dark:bg-neutral-900/30">
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                      Quick actions
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (locked) return;
                                          setLocalMarkets(prev => {
                                            if (prev.length === 0) {
                                              return [...filteredMarkets];
                                            } else {
                                              const newSelected = new Set(prev);
                                              filteredMarkets.forEach(m => newSelected.add(m));
                                              return Array.from(newSelected);
                                            }
                                          });
                                          setHasUnsavedChanges(true);
                                        }}
                                        disabled={locked}
                                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Select All
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (locked) return;
                                          setLocalMarkets(prev => prev.filter(m => !filteredMarkets.includes(m)));
                                          setHasUnsavedChanges(true);
                                        }}
                                        disabled={locked}
                                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Clear
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {/* Markets Grid */}
                                  <div className="p-3 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600 scrollbar-track-transparent">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {filteredMarkets.map(market => {
                                        const checked = allMarketsSelected || localMarkets.includes(market);
                                        const hasLines = tool === "edge-finder" && hasLineOptions(market);
                                        const isMarketExpanded = expandedMarkets.has(market);
                                        const lineOptions = hasLines ? getLineOptions(market) : null;
                                        const marketKey = market.toLowerCase().replace(/_/g, "");
                                        const selectedLinesForMarket = localMarketLines[marketKey] || [];
                                        
                                        return (
                                          <div key={market} className="space-y-2">
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => toggleMarket(market)}
                                                disabled={locked}
                                                className={cn(
                                                  "flex-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                                                  locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                                                  checked
                                                    ? "bg-white dark:bg-neutral-800 ring-2 ring-brand shadow-sm shadow-brand/10"
                                                    : "bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 ring-1 ring-neutral-200 dark:ring-neutral-700"
                                                )}
                                              >
                                                <div className={cn(
                                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors",
                                                  checked 
                                                    ? "bg-brand" 
                                                    : "ring-1 ring-neutral-300 dark:ring-neutral-600 bg-white dark:bg-neutral-700"
                                                )}>
                                                  {checked && (
                                                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                                                  )}
                                                </div>
                                                <span className="text-xs font-medium leading-tight text-neutral-700 dark:text-neutral-300">
                                                  {formatMarketLabel(market) || market.replace(/_/g, " ")}
                                                </span>
                                              </button>
                                              
                                              {/* Line Options Expander (Edge Finder only) */}
                                              {hasLines && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (locked) return;
                                                    const newExpanded = new Set(expandedMarkets);
                                                    if (isMarketExpanded) {
                                                      newExpanded.delete(market);
                                                    } else {
                                                      newExpanded.add(market);
                                                    }
                                                    setExpandedMarkets(newExpanded);
                                                  }}
                                                  disabled={locked}
                                                  className={cn(
                                                    "flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                                                    isMarketExpanded
                                                      ? "border-brand/30 bg-brand/5 text-brand dark:border-brand/40 dark:bg-brand/10"
                                                      : "border-neutral-200 bg-white text-neutral-400 hover:text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:text-neutral-300",
                                                    locked && "cursor-not-allowed opacity-50"
                                                  )}
                                                  title="Filter by line"
                                                >
                                                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isMarketExpanded && "rotate-180")} />
                                                </button>
                                              )}
                                            </div>
                                            
                                            {/* Line Options (Edge Finder only) */}
                                            <AnimatePresence>
                                              {hasLines && isMarketExpanded && lineOptions && (
                                                <motion.div
                                                  initial={{ height: 0, opacity: 0 }}
                                                  animate={{ height: "auto", opacity: 1 }}
                                                  exit={{ height: 0, opacity: 0 }}
                                                  transition={{ duration: 0.15 }}
                                                  className="overflow-hidden"
                                                >
                                                  <div className="rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/30">
                                                    <div className="flex items-center justify-between mb-2">
                                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                                                        Lines
                                                      </span>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          const newMarketLines = { ...localMarketLines };
                                                          delete newMarketLines[marketKey];
                                                          setLocalMarketLines(newMarketLines);
                                                          setHasUnsavedChanges(true);
                                                        }}
                                                        disabled={locked}
                                                        className="text-[10px] font-medium text-neutral-400 hover:text-brand transition-colors"
                                                      >
                                                        Reset
                                                      </button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                      {lineOptions.lines.map((line, idx) => {
                                                        const isMarketSelected = checked;
                                                        const lineChecked = isMarketSelected && (selectedLinesForMarket.length === 0 || selectedLinesForMarket.includes(line));
                                                        const isLineDisabled = locked || !isMarketSelected;
                                                        
                                                        return (
                                                          <button
                                                            key={line}
                                                            disabled={isLineDisabled}
                                                            onClick={() => {
                                                              if (locked) return;
                                                              if (!isMarketSelected) {
                                                                toggleMarket(market);
                                                              }
                                                              const newMarketLines = { ...localMarketLines };
                                                              const currentLines = newMarketLines[marketKey] || [];
                                                              if (currentLines.length === 0) {
                                                                newMarketLines[marketKey] = lineOptions.lines.filter(l => l !== line);
                                                              } else if (currentLines.includes(line)) {
                                                                newMarketLines[marketKey] = currentLines.filter(l => l !== line);
                                                                if (newMarketLines[marketKey].length === 0) {
                                                                  delete newMarketLines[marketKey];
                                                                  toggleMarket(market);
                                                                }
                                                              } else {
                                                                newMarketLines[marketKey] = [...currentLines, line];
                                                                if (newMarketLines[marketKey].length === lineOptions.lines.length) {
                                                                  delete newMarketLines[marketKey];
                                                                }
                                                              }
                                                              setLocalMarketLines(newMarketLines);
                                                              setHasUnsavedChanges(true);
                                                            }}
                                                            className={cn(
                                                              "rounded-md px-2 py-1 text-xs font-medium transition-all",
                                                              isLineDisabled && "cursor-not-allowed opacity-40",
                                                              lineChecked 
                                                                ? "bg-brand text-white shadow-sm"
                                                                : "bg-white text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                                                            )}
                                                          >
                                                            {lineOptions.labels[idx]}
                                                          </button>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>
              
              {/* ======================= Settings Tab ======================= */}
              <TabsContent value="settings" className="mt-4 space-y-6">
                {/* ---- Positive EV Specific: De-Vig Methods ---- */}
                {tool === "positive-ev" && (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">De-Vig Methods</Label>
                        <span className="text-xs font-medium text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
                          {localDevigMethods.length} selected
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {Object.entries(DEVIG_METHODS).map(([key, method]) => {
                          const isSelected = localDevigMethods.includes(key as DevigMethod);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleDevigMethod(key as DevigMethod)}
                              disabled={locked}
                              className={cn(
                                "group relative flex items-center gap-2.5 p-3 rounded-xl text-left transition-all duration-200",
                                locked && "cursor-not-allowed opacity-60",
                                isSelected
                                  ? "bg-white dark:bg-neutral-800/60 ring-2 ring-brand shadow-sm shadow-brand/20"
                                  : "bg-white dark:bg-neutral-800/60 ring-1 ring-neutral-200 dark:ring-neutral-700/80 hover:ring-neutral-300 dark:hover:ring-neutral-600"
                              )}
                            >
                              <div className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all",
                                isSelected
                                  ? "bg-brand"
                                  : "ring-1 ring-neutral-300 dark:ring-neutral-600 bg-white dark:bg-neutral-800"
                              )}>
                                {isSelected && (
                                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                                )}
                              </div>
                              <span className="flex-1 font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                                {method.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Formula Case */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">Formula Case</Label>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        When using multiple de-vig methods, which result to display
                      </p>
                      <div className="flex gap-2">
                        {(["worst", "best"] as const).map((caseType) => (
                          <button
                            key={caseType}
                            onClick={() => !locked && setLocalEvCase(caseType)}
                            disabled={locked}
                            className={cn(
                              "flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                              locked && "cursor-not-allowed opacity-60",
                              localEvCase === caseType
                                ? "bg-white dark:bg-neutral-800/60 text-neutral-900 dark:text-white ring-2 ring-brand shadow-sm shadow-brand/20"
                                : "bg-white dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400 ring-1 ring-neutral-200 dark:ring-neutral-700/80 hover:ring-neutral-300 dark:hover:ring-neutral-600"
                            )}
                          >
                            {caseType === "worst" ? "Worst Case (Conservative)" : "Best Case (Optimistic)"}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* EV Thresholds */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">EV Thresholds</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-xs text-neutral-500 dark:text-neutral-400">Minimum EV %</label>
                          <select
                            value={localMinEv}
                            onChange={(e) => !locked && setLocalMinEv(Number(e.target.value))}
                            disabled={locked}
                            className="w-full px-3 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-neutral-800/60 border-0 ring-1 ring-neutral-200 dark:ring-neutral-700/80 focus:ring-2 focus:ring-brand transition-shadow"
                          >
                            {MIN_EV_OPTIONS.map((val) => (
                              <option key={val} value={val}>
                                {val}%
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-neutral-500 dark:text-neutral-400">Maximum EV %</label>
                          <select
                            value={localMaxEv || ""}
                            onChange={(e) => !locked && setLocalMaxEv(e.target.value ? Number(e.target.value) : undefined)}
                            disabled={locked}
                            className="w-full px-3 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-neutral-800/60 border-0 ring-1 ring-neutral-200 dark:ring-neutral-700/80 focus:ring-2 focus:ring-brand transition-shadow"
                          >
                            <option value="">No limit</option>
                            {MAX_EV_OPTIONS.map((val) => (
                              <option key={val} value={val}>
                                {val}%
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Filter opportunities by expected value percentage range
                      </p>
                    </div>
                    
                    {/* Min Books Per Side */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">Market Width</Label>
                      <select
                        value={localMinBooksPerSide}
                        onChange={(e) => !locked && setLocalMinBooksPerSide(Number(e.target.value))}
                        disabled={locked}
                        className="w-full px-3 py-2.5 rounded-xl text-sm font-medium bg-neutral-50 dark:bg-neutral-800/50 border-0 ring-1 ring-neutral-200 dark:ring-neutral-700 focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition-shadow"
                      >
                        {[1, 2, 3, 4, 5].map((val) => (
                          <option key={val} value={val}>
                            {val} book{val > 1 ? "s" : ""} minimum per side
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Higher values ensure better market consensus and liquidity
                      </p>
                    </div>
                  </>
                )}
                
                {/* ---- Edge Finder Specific Settings ---- */}
                {tool === "edge-finder" && (
                  <>
                    {/* Hide College Player Props */}
                    <div className={cn(
                      "flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4 dark:border-neutral-800 dark:bg-neutral-900",
                      locked && "opacity-60"
                    )}>
                      <div className="space-y-0.5 flex-1 mr-3">
                        <div className="text-sm font-semibold">Hide College Props</div>
                        <div className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">
                          For restricted states
                        </div>
                      </div>
                      <Switch 
                        checked={localHideCollegePlayerProps} 
                        fn={(v: boolean) => {
                          if (!locked) {
                            setLocalHideCollegePlayerProps(!!v);
                            setHasUnsavedChanges(true);
                          }
                        }} 
                        disabled={locked}
                      />
                    </div>
                    
                    <Separator />
                    
                    {/* Min Edge % */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Min Edge %</Label>
                      <Input
                        type="number"
                        value={localMinImprovement}
                        onChange={(e) => {
                          if (!locked) {
                            setLocalMinImprovement(Number(e.target.value));
                            setHasUnsavedChanges(true);
                          }
                        }}
                        className="h-9 sm:h-10 text-sm bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                        min="0"
                        step="0.1"
                        disabled={locked}
                        title={locked ? "Sharp only" : ""}
                      />
                    </div>
                    
                    {/* Odds Range */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-6">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Min Odds</Label>
                        <Input
                          type="number"
                          value={localMinOdds ?? ""}
                          onChange={(e) => {
                            if (locked) return;
                            const val = e.target.value.trim();
                            setLocalMinOdds(val === "" ? undefined : Number(val));
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="-∞"
                          className="h-9 sm:h-10 text-sm bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                          min="-1000"
                          step="5"
                          disabled={locked}
                          title={locked ? "Sharp only" : ""}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Max Odds</Label>
                        <Input
                          type="number"
                          value={localMaxOdds ?? ""}
                          onChange={(e) => {
                            if (locked) return;
                            const val = e.target.value.trim();
                            setLocalMaxOdds(val === "" ? undefined : Number(val));
                            setHasUnsavedChanges(true);
                          }}
                          placeholder="+∞"
                          className="h-9 sm:h-10 text-sm bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                          min="-1000"
                          step="5"
                          disabled={locked}
                          title={locked ? "Sharp only" : ""}
                        />
                      </div>
                    </div>
                  </>
                )}
                
                <Separator />
                
                {/* ---- Shared: Hidden Edges Controls ---- */}
                {hiddenCount > 0 && (
                  <>
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4 dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="space-y-0.5 flex-1 mr-3">
                          <div className="text-sm font-semibold">Show Hidden ({hiddenCount})</div>
                          <div className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">
                            Display with dimmed styling
                          </div>
                        </div>
                        <Switch 
                          checked={showHidden} 
                          fn={(v: boolean) => onToggleShowHidden?.()} 
                        />
                      </div>

                      <button
                        onClick={() => setIsClearDialogOpen(true)}
                        className="w-full h-9 sm:h-10 rounded-xl border border-red-200 bg-red-50 px-3 text-xs sm:text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40"
                      >
                        Clear Hidden Edges
                      </button>

                      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
                        <DialogContent className="sm:max-w-md border-neutral-200 bg-white p-0 dark:border-neutral-800 dark:bg-neutral-900">
                          <div className="p-8 text-center">
                            <div className="relative mx-auto mb-6 w-fit">
                              <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-red-500/20 via-red-500/30 to-red-600/30 blur-2xl" />
                              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-white shadow-sm dark:border-red-500/30 dark:bg-neutral-900">
                                <Trash2 className="h-8 w-8 text-red-600 dark:text-red-400" />
                              </div>
                            </div>

                            <DialogTitle className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white text-center">
                              Clear Hidden Edges
                            </DialogTitle>
                            <p className="mb-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                              Are you sure you want to clear all {hiddenCount} hidden edge{hiddenCount !== 1 ? "s" : ""}? They will reappear in your results immediately.
                            </p>

                            <div className="flex flex-col gap-3">
                              <button
                                onClick={() => {
                                  if (onClearAllHidden) {
                                    onClearAllHidden();
                                    toast.success("All hidden edges cleared");
                                  }
                                  setIsClearDialogOpen(false);
                                }}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md dark:border-red-500 dark:bg-red-500 dark:hover:bg-red-400"
                              >
                                Clear All Edges
                              </button>
                              <button
                                onClick={() => setIsClearDialogOpen(false)}
                                className="w-full rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    <Separator />
                  </>
                )}
                
                {/* ---- Shared: Kelly Criterion Settings ---- */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">Kelly Criterion</h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Configure bet sizing recommendations</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Bankroll ($)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={localBankrollStr}
                        onChange={(e) => {
                          if (locked) return;
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setLocalBankrollStr(val);
                          setHasUnsavedChanges(true);
                        }}
                        onBlur={() => {
                          const num = Math.max(0, Number(localBankrollStr) || 0);
                          setLocalBankrollStr(String(num));
                        }}
                        placeholder="1000"
                        className="h-10"
                        disabled={locked}
                        title={locked ? "Sharp only" : ""}
                      />
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Your total betting bankroll</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Kelly Fraction (%)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={localKellyPercentStr}
                        onChange={(e) => {
                          if (locked) return;
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setLocalKellyPercentStr(val);
                          setHasUnsavedChanges(true);
                        }}
                        onBlur={() => {
                          const num = Number(localKellyPercentStr) || 25;
                          const clamped = Math.max(1, Math.min(100, num));
                          setLocalKellyPercentStr(String(clamped));
                        }}
                        placeholder="25"
                        className="h-10"
                        disabled={locked}
                        title={locked ? "Sharp only" : ""}
                      />
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {(() => {
                          const val = Number(localKellyPercentStr) || 25;
                          return val <= 25 ? "Quarter Kelly (conservative)" : 
                                 val <= 50 ? "Half Kelly (moderate)" : 
                                 val <= 75 ? "Three-quarter Kelly" : "Full Kelly (aggressive)";
                        })()}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      <strong>Tip:</strong> Quarter Kelly (25%) is recommended for most bettors. It reduces volatility while still capturing most of the long-term growth.
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                {/* ---- Shared: Min Liquidity Section ---- */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                    <h4 className="text-sm font-semibold">Minimum Liquidity</h4>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Filter out opportunities where the best book&apos;s max stake is below your minimum threshold.
                    This setting syncs across all tools (Edge Finder, Positive EV, Arbitrage).
                  </p>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Min Max Stake</Label>
                    <select
                      value={localMinLiquidity}
                      onChange={(e) => {
                        if (locked) return;
                        setLocalMinLiquidity(Number(e.target.value));
                        setHasUnsavedChanges(true);
                      }}
                      disabled={locked}
                      className="w-full px-3 py-2.5 rounded-xl text-sm font-medium bg-neutral-50 dark:bg-neutral-800/50 border-0 ring-1 ring-neutral-200 dark:ring-neutral-700 focus:ring-2 focus:ring-brand transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                      title={locked ? "Sharp only" : ""}
                    >
                      {MIN_LIQUIDITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Only shows opportunities where the best book offers at least this max stake
                    </p>
                  </div>
                </div>
                
                {/* ---- Shared: Show Hidden Toggle (alternative location for when hiddenCount = 0) ---- */}
                {hiddenCount === 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">Hidden Opportunities</Label>
                      <button
                        onClick={() => onFiltersChange({ showHidden: !showHidden })}
                        className={cn(
                          "w-full p-4 rounded-xl text-left transition-all duration-200 flex items-center justify-between",
                          showHidden
                            ? "bg-white dark:bg-neutral-800/60 ring-2 ring-amber-500 shadow-sm shadow-amber-500/20"
                            : "bg-white dark:bg-neutral-800/60 ring-1 ring-neutral-200 dark:ring-neutral-700/80 hover:ring-neutral-300 dark:hover:ring-neutral-600"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700/50">
                            {showHidden ? (
                              <Eye className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <EyeOff className="h-4.5 w-4.5 text-neutral-400 dark:text-neutral-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                              {showHidden ? "Showing Hidden" : "Hidden Opportunities"}
                            </p>
                            <p className="text-xs mt-0.5 text-neutral-500 dark:text-neutral-400">
                              No hidden opportunities
                            </p>
                          </div>
                        </div>
                        <div className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide transition-colors",
                          showHidden
                            ? "bg-amber-500 text-white"
                            : "bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
                        )}>
                          {showHidden ? "ON" : "OFF"}
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Footer */}
          <div className="flex items-center gap-3 border-t border-neutral-200 dark:border-neutral-800 px-4 sm:px-6 py-4">
            <button
              onClick={reset}
              disabled={locked}
              className="h-11 flex-1 rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-700 bg-white dark:bg-neutral-800/60 px-4 text-sm font-medium text-neutral-600 dark:text-neutral-400 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>
            <button
              onClick={apply}
              disabled={locked}
              className={cn(
                "h-11 flex-1 rounded-xl px-4 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50",
                hasUnsavedChanges
                  ? "bg-brand hover:bg-brand/90 shadow-lg shadow-brand/30"
                  : "bg-emerald-500 hover:bg-emerald-600"
              )}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
