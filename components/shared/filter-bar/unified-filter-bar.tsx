"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { InputSearch } from "@/components/icons/input-search";
import { Tooltip } from "@/components/tooltip";
import { RefreshCw } from "lucide-react";

// Sub-components
import { BoostButton } from "./boost-button";
import { SportsDropdown } from "./sports-dropdown";
import { SportsbooksDropdown } from "./sportsbooks-dropdown";
import { ComparingDropdown } from "./comparing-dropdown";
import { GlobalSettingsDropdown } from "./global-settings-dropdown";
import { ResetButton } from "./reset-button";
import { FilterPresetsManagerModal } from "@/components/filter-presets/filter-presets-manager-modal";
import { EvModelsManagerModal } from "@/components/ev-models/ev-models-manager-modal";
import { Layers, X } from "lucide-react";

// Types
import type { SharpPreset, DevigMethod, EVMode } from "@/lib/ev/types";
import type { BestOddsPrefs } from "@/lib/best-odds-schema";

export type FilterTool = "positive-ev" | "edge-finder" | "arbitrage";

// Common filter state shared between tools
export interface CommonFilterState {
  mode: EVMode;
  searchQuery: string;
  boostPercent: number;
  selectedBooks: string[];
  selectedMarkets: string[];
  minLiquidity: number;
  showHidden: boolean;
}

// Positive EV specific state
export interface PositiveEVFilterState extends CommonFilterState {
  selectedSports: string[];
  sharpPreset: SharpPreset;
  devigMethods: DevigMethod[];
  evCase: "worst" | "best";
  minEv: number;
  maxEv?: number;
  minBooksPerSide: number;
}

// Edge Finder specific state
export interface EdgeFinderFilterState extends CommonFilterState {
  selectedLeagues: string[];
  comparisonMode: BestOddsPrefs["comparisonMode"];
  comparisonBook: string | null;
  minOdds?: number;
  maxOdds?: number;
  hideCollegePlayerProps?: boolean;
  marketLines?: Record<string, number[]>;
}

// Arbitrage specific state
export interface ArbitrageFilterState extends CommonFilterState {
  selectedLeagues: string[];
  selectedMarketTypes: ("player" | "game")[];
  minArb: number;
  maxArb: number;
  totalBetAmount: number;
}

export type FilterState = PositiveEVFilterState | EdgeFinderFilterState | ArbitrageFilterState;

// Props for the unified filter bar
export interface UnifiedFilterBarProps {
  tool: FilterTool;
  
  // Filter state
  mode: EVMode;
  onModeChange: (mode: EVMode) => void;
  
  searchQuery: string;
  onSearchChange: (query: string) => void;
  
  boostPercent: number;
  onBoostChange: (percent: number) => void;
  
  // Sports/Leagues
  selectedSports?: string[]; // For Positive EV
  onSportsChange?: (sports: string[]) => void;
  selectedLeagues?: string[]; // For Edge Finder
  onLeaguesChange?: (leagues: string[]) => void;
  availableSports?: string[];
  availableLeagues?: string[];
  
  // Markets
  selectedMarkets: string[];
  onMarketsChange: (markets: string[]) => void;
  availableMarkets: { key: string; label: string }[];
  
  // Sportsbooks
  selectedBooks: string[];
  onBooksChange: (books: string[]) => void;
  sportsbookCounts?: Record<string, number>;
  
  // Comparison method (adapts per tool)
  // Positive EV: sharpPreset
  sharpPreset?: SharpPreset;
  onSharpPresetChange?: (preset: SharpPreset) => void;
  devigMethods?: DevigMethod[];
  onDevigMethodsChange?: (methods: DevigMethod[]) => void;
  evCase?: "worst" | "best";
  onEvCaseChange?: (evCase: "worst" | "best") => void;
  
  // Edge Finder: comparisonMode
  comparisonMode?: BestOddsPrefs["comparisonMode"];
  comparisonBook?: string | null;
  onComparisonChange?: (mode: BestOddsPrefs["comparisonMode"], book: string | null) => void;
  
  // Global settings
  minEv?: number;
  onMinEvChange?: (value: number) => void;
  maxEv?: number;
  onMaxEvChange?: (value: number | undefined) => void;
  minOdds?: number;
  onMinOddsChange?: (value: number) => void;
  maxOdds?: number;
  onMaxOddsChange?: (value: number) => void;
  minBooksPerSide?: number;
  onMinBooksPerSideChange?: (value: number) => void;
  minLiquidity: number;
  onMinLiquidityChange: (value: number) => void;
  
  // Arbitrage-specific settings
  minArb?: number;
  onMinArbChange?: (value: number) => void;
  maxArb?: number;
  onMaxArbChange?: (value: number) => void;
  totalBetAmount?: number;
  onTotalBetAmountChange?: (value: number) => void;
  selectedMarketTypes?: ("player" | "game")[];
  onMarketTypesChange?: (types: ("player" | "game")[]) => void;
  
  // Kelly criterion
  bankroll?: number;
  kellyPercent?: number;
  onBankrollChange?: (value: number) => void;
  onKellyPercentChange?: (value: number) => void;
  
  // Hidden edges
  showHidden: boolean;
  hiddenCount: number;
  onToggleShowHidden: () => void;
  
  // Custom models (for Edge Finder)
  activePresets?: { id: string; name: string }[];
  onManageModels?: () => void;
  onClearPresets?: () => void;
  
  // Custom EV models (for Positive EV)
  activeEvModels?: { id: string; name: string }[];
  onManageEvModels?: () => void;
  onClearEvModels?: () => void;
  
  // Auto refresh
  autoRefresh?: boolean;
  onAutoRefreshChange?: (value: boolean) => void;
  isConnected?: boolean;
  isReconnecting?: boolean;
  hasFailed?: boolean;
  
  // Reset
  onReset: () => void;
  
  // UI state
  locked?: boolean;
  isPro?: boolean;
  
  // Optional refresh button
  onRefresh?: () => void;
  isRefreshing?: boolean;
  
  className?: string;
}

export function UnifiedFilterBar({
  tool,
  mode,
  onModeChange,
  searchQuery,
  onSearchChange,
  boostPercent,
  onBoostChange,
  selectedSports,
  onSportsChange,
  selectedLeagues,
  onLeaguesChange,
  availableSports,
  availableLeagues,
  selectedMarkets,
  onMarketsChange,
  availableMarkets,
  selectedBooks,
  onBooksChange,
  sportsbookCounts,
  sharpPreset,
  onSharpPresetChange,
  devigMethods,
  onDevigMethodsChange,
  evCase,
  onEvCaseChange,
  comparisonMode,
  comparisonBook,
  onComparisonChange,
  minEv,
  onMinEvChange,
  maxEv,
  onMaxEvChange,
  minOdds,
  onMinOddsChange,
  maxOdds,
  onMaxOddsChange,
  minBooksPerSide,
  onMinBooksPerSideChange,
  minLiquidity,
  onMinLiquidityChange,
  minArb,
  onMinArbChange,
  maxArb,
  onMaxArbChange,
  totalBetAmount,
  onTotalBetAmountChange,
  selectedMarketTypes,
  onMarketTypesChange,
  bankroll,
  kellyPercent,
  onBankrollChange,
  onKellyPercentChange,
  showHidden,
  hiddenCount,
  onToggleShowHidden,
  activePresets,
  onManageModels,
  onClearPresets,
  activeEvModels,
  onManageEvModels,
  onClearEvModels,
  autoRefresh,
  onAutoRefreshChange,
  isConnected,
  isReconnecting,
  hasFailed,
  onReset,
  locked = false,
  isPro = true,
  onRefresh,
  isRefreshing,
  className,
}: UnifiedFilterBarProps) {
  const [showModelsModal, setShowModelsModal] = React.useState(false);
  const [showEvModelsModal, setShowEvModelsModal] = React.useState(false);

  return (
    <div
      className={cn(
        "relative rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm shadow-sm",
        className
      )}
    >
      <div className="relative z-10 flex flex-wrap items-center gap-3 p-3 sm:p-4">
        {/* Left Section */}
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
          {/* Mode Tabs - Show for Arbitrage only (Positive EV and Edge Finder are pregame only for now) */}
          {tool === "arbitrage" && (
            <div className="flex items-center gap-0.5 p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200/50 dark:border-neutral-700/50">
              <button
                onClick={() => onModeChange("pregame")}
                disabled={locked}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  mode === "pregame" || mode === "all"
                    ? "bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                Pre-Match
              </button>
              <button
                onClick={() => onModeChange("live")}
                disabled={locked || !isPro}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                  mode === "live"
                    ? "bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300",
                  !isPro && "opacity-50"
                )}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                </span>
                Live
                {!isPro && (
                  <span className="text-[9px] opacity-60">Pro</span>
                )}
              </button>
            </div>
          )}

          {/* Refresh Controls - grouped together */}
          <div className="flex items-center gap-1.5">
            {/* Manual Refresh Button */}
            {onRefresh && (
              <Tooltip content="Refresh data">
                <button
                  onClick={onRefresh}
                  disabled={locked || isRefreshing}
                  className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-lg transition-all",
                    "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400",
                    "border border-neutral-200/80 dark:border-neutral-700/80",
                    "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50",
                    (locked || isRefreshing) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                </button>
              </Tooltip>
            )}

            {/* Auto Refresh Toggle */}
            {onAutoRefreshChange && (
              <Tooltip content={isPro ? (autoRefresh ? "Auto-refresh enabled" : "Enable auto-refresh") : "Pro required for auto-refresh"}>
                <button
                  onClick={() => isPro && onAutoRefreshChange(!autoRefresh)}
                  disabled={!isPro}
                  className={cn(
                    "flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-all",
                    autoRefresh && isConnected && "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800",
                    autoRefresh && isReconnecting && "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800",
                    autoRefresh && hasFailed && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800",
                    !autoRefresh && "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200/80 dark:border-neutral-700/80 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50",
                    !isPro && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "inline-flex h-1.5 w-1.5 rounded-full",
                    autoRefresh && isConnected && "bg-emerald-500",
                    autoRefresh && isReconnecting && "bg-amber-500 animate-pulse",
                    autoRefresh && hasFailed && "bg-red-500",
                    !autoRefresh && "bg-neutral-400"
                  )} />
                  Auto
                </button>
              </Tooltip>
            )}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 hidden sm:block" />

          {/* Search */}
          <div className="relative">
            <InputSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
            <Input
              placeholder="Search players, teams..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 h-8 w-48 text-sm bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200/80 dark:border-neutral-700/80"
              disabled={locked}
            />
          </div>

          {/* Divider - only show if boost button is visible */}
          {tool !== "arbitrage" && (
            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 hidden sm:block" />
          )}

          {/* Boost Button - not used for arbitrage */}
          {tool !== "arbitrage" && (
            <BoostButton
              value={boostPercent}
              onChange={onBoostChange}
              disabled={locked}
            />
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Sports/Leagues Dropdown */}
          <SportsDropdown
            tool={tool}
            selectedSports={selectedSports}
            onSportsChange={onSportsChange}
            selectedLeagues={selectedLeagues}
            onLeaguesChange={onLeaguesChange}
            selectedMarkets={selectedMarkets}
            onMarketsChange={onMarketsChange}
            availableSports={availableSports}
            availableLeagues={availableLeagues}
            availableMarkets={availableMarkets}
            disabled={locked}
          />

          {/* Sportsbooks Dropdown */}
          <SportsbooksDropdown
            tool={tool}
            selectedBooks={selectedBooks}
            onBooksChange={onBooksChange}
            sportsbookCounts={sportsbookCounts}
            disabled={locked}
          />

          {/* Comparing Against Dropdown - Not needed for Arbitrage */}
          {/* Disabled for Positive EV when custom models are active, or for Edge Finder when presets are active */}
          {tool !== "arbitrage" && (
            <ComparingDropdown
              tool={tool}
              sharpPreset={sharpPreset}
              onSharpPresetChange={onSharpPresetChange}
              comparisonMode={comparisonMode}
              comparisonBook={comparisonBook}
              onComparisonChange={onComparisonChange}
              disabled={
                locked || 
                (tool === "positive-ev" && activeEvModels && activeEvModels.length > 0) ||
                (tool === "edge-finder" && activePresets && activePresets.length > 0)
              }
            />
          )}

          {/* Global Settings Dropdown */}
          <GlobalSettingsDropdown
            tool={tool}
            minEv={minEv}
            onMinEvChange={onMinEvChange}
            maxEv={maxEv}
            onMaxEvChange={onMaxEvChange}
            minOdds={minOdds}
            onMinOddsChange={onMinOddsChange}
            maxOdds={maxOdds}
            onMaxOddsChange={onMaxOddsChange}
            minBooksPerSide={minBooksPerSide}
            onMinBooksPerSideChange={onMinBooksPerSideChange}
            minLiquidity={minLiquidity}
            onMinLiquidityChange={onMinLiquidityChange}
            devigMethods={devigMethods}
            onDevigMethodsChange={onDevigMethodsChange}
            evCase={evCase}
            onEvCaseChange={onEvCaseChange}
            bankroll={bankroll}
            kellyPercent={kellyPercent}
            onBankrollChange={onBankrollChange}
            onKellyPercentChange={onKellyPercentChange}
            showHidden={showHidden}
            hiddenCount={hiddenCount}
            onToggleShowHidden={onToggleShowHidden}
            // Arbitrage-specific
            minArb={minArb}
            onMinArbChange={onMinArbChange}
            maxArb={maxArb}
            onMaxArbChange={onMaxArbChange}
            totalBetAmount={totalBetAmount}
            onTotalBetAmountChange={onTotalBetAmountChange}
            selectedMarketTypes={selectedMarketTypes}
            onMarketTypesChange={onMarketTypesChange}
            disabled={locked}
          />

          {/* Custom Models Button - Edge Finder (Animated Border) */}
          {tool === "edge-finder" && onManageModels && (
            <div className="flex items-center gap-1">
              <Tooltip content="Manage custom models">
                <div className="relative">
                  <button
                    onClick={() => setShowModelsModal(true)}
                    disabled={locked}
                    className={cn(
                      "group relative inline-flex h-10 w-10 overflow-hidden rounded-xl p-[1.5px] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-neutral-900 transition-transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.4)]",
                      locked && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {/* Animated spinning gradient border */}
                    <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#FBBF24_0%,#F97316_20%,#DC2626_40%,#F97316_60%,#FBBF24_80%,#FDE68A_100%)]" />
                    {/* Inner button content */}
                    <span className="relative inline-flex h-full w-full items-center justify-center rounded-[9px] bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 group-hover:bg-amber-50 dark:group-hover:bg-amber-950/30 transition-colors">
                      <Layers className="w-5 h-5" />
                    </span>
                  </button>
                  {activePresets && activePresets.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white z-10 shadow-md ring-2 ring-white dark:ring-neutral-900">
                      {activePresets.length}
                    </span>
                  )}
                </div>
              </Tooltip>
              
              {/* X button to exit custom mode */}
              {activePresets && activePresets.length > 0 && onClearPresets && (
                <Tooltip content="Exit custom mode">
                  <button
                    onClick={onClearPresets}
                    disabled={locked}
                    className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 dark:hover:text-red-400 border border-neutral-200/80 dark:border-neutral-700/80 transition-all",
                      locked && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
              
              <FilterPresetsManagerModal
                open={showModelsModal}
                onOpenChange={setShowModelsModal}
              />
            </div>
          )}

          {/* Custom EV Models Button - Positive EV (Animated Border) */}
          {tool === "positive-ev" && onManageEvModels && (
            <div className="flex items-center gap-1">
              <Tooltip content="Manage custom EV models">
                <div className="relative">
                  <button
                    onClick={() => setShowEvModelsModal(true)}
                    disabled={locked}
                    className={cn(
                      "group relative inline-flex h-10 w-10 overflow-hidden rounded-xl p-[1.5px] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-neutral-900 transition-transform hover:scale-105 shadow-[0_0_15px_rgba(16,185,129,0.4)]",
                      locked && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {/* Animated spinning gradient border */}
                    <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#34D399_0%,#10B981_20%,#047857_40%,#10B981_60%,#34D399_80%,#A7F3D0_100%)]" />
                    {/* Inner button content */}
                    <span className="relative inline-flex h-full w-full items-center justify-center rounded-[9px] bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/30 transition-colors">
                      <Layers className="w-5 h-5" />
                    </span>
                  </button>
                  {activeEvModels && activeEvModels.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white z-10 shadow-md ring-2 ring-white dark:ring-neutral-900">
                      {activeEvModels.length}
                    </span>
                  )}
                </div>
              </Tooltip>
              
              {/* X button to exit custom mode */}
              {activeEvModels && activeEvModels.length > 0 && onClearEvModels && (
                <Tooltip content="Exit custom mode">
                  <button
                    onClick={onClearEvModels}
                    disabled={locked}
                    className={cn(
                      "flex items-center justify-center h-8 w-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 dark:hover:text-red-400 border border-neutral-200/80 dark:border-neutral-700/80 transition-all",
                      locked && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
              
              <EvModelsManagerModal
                open={showEvModelsModal}
                onOpenChange={setShowEvModelsModal}
                onModelsChanged={onManageEvModels}
              />
            </div>
          )}

          {/* Reset Button */}
          <ResetButton onReset={onReset} disabled={locked} />
        </div>
      </div>
    </div>
  );
}
