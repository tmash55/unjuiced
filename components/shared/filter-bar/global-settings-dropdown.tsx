"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Settings, Eye, EyeOff, ChevronRight, DollarSign, Percent } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { FilterTool } from "./unified-filter-bar";
import type { DevigMethod } from "@/lib/ev/types";
import { DEVIG_METHODS } from "@/lib/ev/constants";

// Min EV options
const MIN_EV_OPTIONS = [0, 0.5, 1, 2, 3, 5, 10];
const MAX_EV_OPTIONS = [5, 10, 15, 20, 25, 50, 100];

// Min books per side options
const MIN_BOOKS_OPTIONS = [1, 2, 3, 4, 5];

// Odds range preset options (American odds)
const MIN_ODDS_PRESETS = [
  { value: -10000, label: "No min" },
  { value: -300, label: "-300" },
  { value: -200, label: "-200" },
  { value: -110, label: "-110" },
  { value: 100, label: "+100" },
];

const MAX_ODDS_PRESETS = [
  { value: 100000, label: "No max" },
  { value: 500, label: "+500" },
  { value: 1000, label: "+1000" },
  { value: 2000, label: "+2000" },
];

// Helper to format odds for display (add + for positive)
function formatOddsDisplay(odds: number): string {
  if (odds >= 100) return `+${odds}`;
  return odds.toString();
}

// Helper to parse odds input (handle +/- prefix)
function parseOddsInput(input: string): number | null {
  const trimmed = input.trim().replace(/^\+/, "");
  const num = parseInt(trimmed, 10);
  if (isNaN(num)) return null;
  return num;
}

// Min liquidity options
const MIN_LIQUIDITY_OPTIONS = [
  { value: 0, label: "No minimum" },
  { value: 25, label: "$25" },
  { value: 50, label: "$50" },
  { value: 100, label: "$100" },
  { value: 250, label: "$250" },
  { value: 500, label: "$500" },
  { value: 1000, label: "$1,000" },
];

// Kelly percent presets
const KELLY_PERCENT_OPTIONS = [
  { value: 10, label: "10% (Conservative)" },
  { value: 25, label: "25% (Quarter Kelly)" },
  { value: 50, label: "50% (Half Kelly)" },
  { value: 100, label: "100% (Full Kelly)" },
];

interface GlobalSettingsDropdownProps {
  tool: FilterTool;
  
  // EV thresholds (Positive EV)
  minEv?: number;
  onMinEvChange?: (value: number) => void;
  maxEv?: number;
  onMaxEvChange?: (value: number | undefined) => void;
  
  // Odds range (Edge Finder)
  minOdds?: number;
  onMinOddsChange?: (value: number) => void;
  maxOdds?: number;
  onMaxOddsChange?: (value: number) => void;
  
  // Min books per side
  minBooksPerSide?: number;
  onMinBooksPerSideChange?: (value: number) => void;
  
  // Min liquidity
  minLiquidity: number;
  onMinLiquidityChange: (value: number) => void;
  
  // De-vig methods (Positive EV)
  devigMethods?: DevigMethod[];
  onDevigMethodsChange?: (methods: DevigMethod[]) => void;
  
  // EV case (Positive EV)
  evCase?: "worst" | "best";
  onEvCaseChange?: (evCase: "worst" | "best") => void;
  
  // Kelly settings
  bankroll?: number;
  kellyPercent?: number;
  onBankrollChange?: (value: number) => void;
  onKellyPercentChange?: (value: number) => void;
  
  // Hidden edges
  showHidden: boolean;
  hiddenCount: number;
  onToggleShowHidden: () => void;
  
  disabled?: boolean;
}

export function GlobalSettingsDropdown({
  tool,
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
  devigMethods,
  onDevigMethodsChange,
  evCase,
  onEvCaseChange,
  bankroll,
  kellyPercent,
  onBankrollChange,
  onKellyPercentChange,
  showHidden,
  hiddenCount,
  onToggleShowHidden,
  disabled = false,
}: GlobalSettingsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["ev", "kelly"]));
  
  // Local state for bankroll input to allow proper typing/clearing
  const [bankrollInput, setBankrollInput] = useState<string>(
    bankroll !== undefined ? bankroll.toString() : "1000"
  );
  
  // Local state for odds inputs
  const [minOddsInput, setMinOddsInput] = useState<string>(
    minOdds !== undefined && minOdds !== -10000 ? formatOddsDisplay(minOdds) : ""
  );
  const [maxOddsInput, setMaxOddsInput] = useState<string>(
    maxOdds !== undefined && maxOdds !== 100000 ? formatOddsDisplay(maxOdds) : ""
  );
  
  // Sync local state when bankroll prop changes externally
  React.useEffect(() => {
    if (bankroll !== undefined) {
      setBankrollInput(bankroll.toString());
    }
  }, [bankroll]);
  
  // Sync local state when odds props change externally
  React.useEffect(() => {
    if (minOdds !== undefined) {
      setMinOddsInput(minOdds === -10000 ? "" : formatOddsDisplay(minOdds));
    }
  }, [minOdds]);
  
  React.useEffect(() => {
    if (maxOdds !== undefined) {
      setMaxOddsInput(maxOdds === 100000 ? "" : formatOddsDisplay(maxOdds));
    }
  }, [maxOdds]);
  
  const handleBankrollChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBankrollInput(value);
    
    // Only call onChange if we have a valid number
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      onBankrollChange?.(numValue);
    }
  };
  
  const handleBankrollBlur = () => {
    // On blur, if empty or invalid, reset to default
    const numValue = parseInt(bankrollInput, 10);
    if (isNaN(numValue) || numValue < 100) {
      setBankrollInput("1000");
      onBankrollChange?.(1000);
    }
  };
  
  // Handlers for min odds input
  const handleMinOddsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinOddsInput(e.target.value);
  };
  
  const handleMinOddsInputBlur = () => {
    if (minOddsInput.trim() === "") {
      // Empty = no minimum
      onMinOddsChange?.(-10000);
      return;
    }
    const parsed = parseOddsInput(minOddsInput);
    if (parsed !== null) {
      onMinOddsChange?.(parsed);
      setMinOddsInput(formatOddsDisplay(parsed));
    } else {
      // Invalid, reset to current value
      setMinOddsInput(minOdds === -10000 ? "" : formatOddsDisplay(minOdds ?? -10000));
    }
  };
  
  const handleMinOddsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleMinOddsInputBlur();
      (e.target as HTMLInputElement).blur();
    }
  };
  
  // Handlers for max odds input
  const handleMaxOddsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxOddsInput(e.target.value);
  };
  
  const handleMaxOddsInputBlur = () => {
    if (maxOddsInput.trim() === "") {
      // Empty = no maximum
      onMaxOddsChange?.(100000);
      return;
    }
    const parsed = parseOddsInput(maxOddsInput);
    if (parsed !== null) {
      onMaxOddsChange?.(parsed);
      setMaxOddsInput(formatOddsDisplay(parsed));
    } else {
      // Invalid, reset to current value
      setMaxOddsInput(maxOdds === 100000 ? "" : formatOddsDisplay(maxOdds ?? 100000));
    }
  };
  
  const handleMaxOddsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleMaxOddsInputBlur();
      (e.target as HTMLInputElement).blur();
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const toggleDevigMethod = (method: DevigMethod) => {
    if (!devigMethods || !onDevigMethodsChange) return;
    if (devigMethods.includes(method)) {
      // Don't allow removing all methods
      if (devigMethods.length > 1) {
        onDevigMethodsChange(devigMethods.filter((m) => m !== method));
      }
    } else {
      onDevigMethodsChange([...devigMethods, method]);
    }
  };

  // Check if there are active settings
  const hasActiveSettings = 
    (minEv !== undefined && minEv > 0) ||
    (minLiquidity > 0) ||
    hiddenCount > 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip content="Global settings & filters">
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-lg transition-all",
              hasActiveSettings
                ? "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-700"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200/80 dark:border-neutral-700/80 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Settings className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-80 max-h-[70vh] overflow-hidden flex flex-col">
        <DropdownMenuLabel>Global Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="flex-1 overflow-y-auto">
          {/* EV Settings (Positive EV only) */}
          {tool === "positive-ev" && (
            <div className="border-b border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => toggleSection("ev")}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  EV Thresholds
                </span>
                <ChevronRight
                  className={cn(
                    "w-4 h-4 text-neutral-400 transition-transform",
                    expandedSections.has("ev") && "rotate-90"
                  )}
                />
              </button>

              {expandedSections.has("ev") && (
                <div className="px-3 pb-3 space-y-3">
                  {/* Min EV */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-neutral-500 dark:text-neutral-400">Min EV %</label>
                    <select
                      value={minEv ?? 0}
                      onChange={(e) => onMinEvChange?.(Number(e.target.value))}
                      className="h-7 px-2 rounded text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
                    >
                      {MIN_EV_OPTIONS.map((val) => (
                        <option key={val} value={val}>
                          {val === 0 ? "Any" : `${val}%+`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Max EV */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-neutral-500 dark:text-neutral-400">Max EV %</label>
                    <select
                      value={maxEv ?? 100}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onMaxEvChange?.(val === 100 ? undefined : val);
                      }}
                      className="h-7 px-2 rounded text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
                    >
                      {MAX_EV_OPTIONS.map((val) => (
                        <option key={val} value={val}>
                          {val}%
                        </option>
                      ))}
                      <option value={100}>No limit</option>
                    </select>
                  </div>

                  {/* EV Case */}
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-neutral-500 dark:text-neutral-400">EV Calculation</label>
                    <div className="flex items-center gap-0.5 p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-md">
                      <button
                        onClick={() => onEvCaseChange?.("worst")}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] font-medium transition-all",
                          evCase === "worst"
                            ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                            : "text-neutral-500 dark:text-neutral-400"
                        )}
                      >
                        Worst
                      </button>
                      <button
                        onClick={() => onEvCaseChange?.("best")}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] font-medium transition-all",
                          evCase === "best"
                            ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                            : "text-neutral-500 dark:text-neutral-400"
                        )}
                      >
                        Best
                      </button>
                    </div>
                  </div>

                  {/* De-vig Methods */}
                  <div>
                    <label className="text-xs text-neutral-500 dark:text-neutral-400 block mb-1.5">
                      De-vig Methods
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(DEVIG_METHODS).map(([key, method]) => (
                        <button
                          key={key}
                          onClick={() => toggleDevigMethod(key as DevigMethod)}
                          className={cn(
                            "px-2 py-1 rounded text-[10px] font-medium transition-all",
                            devigMethods?.includes(key as DevigMethod)
                              ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                          )}
                        >
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Odds Range (Edge Finder only) */}
          {tool === "edge-finder" && (onMinOddsChange || onMaxOddsChange) && (
            <div className="border-b border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => toggleSection("odds")}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Odds Range
                </span>
                <ChevronRight
                  className={cn(
                    "w-4 h-4 text-neutral-400 transition-transform",
                    expandedSections.has("odds") && "rotate-90"
                  )}
                />
              </button>

              {expandedSections.has("odds") && (
                <div className="px-3 pb-3 space-y-4">
                  {/* Min Odds */}
                  {onMinOddsChange && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-neutral-500 dark:text-neutral-400">Min Odds</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. -200"
                          value={minOddsInput}
                          onChange={handleMinOddsInputChange}
                          onBlur={handleMinOddsInputBlur}
                          onKeyDown={handleMinOddsKeyDown}
                          className="w-20 h-7 px-2 text-xs text-right rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {MIN_ODDS_PRESETS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              onMinOddsChange(opt.value);
                              setMinOddsInput(opt.value === -10000 ? "" : formatOddsDisplay(opt.value));
                            }}
                            className={cn(
                              "px-2 py-1 rounded text-[10px] font-medium transition-all",
                              (minOdds ?? -10000) === opt.value
                                ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Max Odds */}
                  {onMaxOddsChange && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-neutral-500 dark:text-neutral-400">Max Odds</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. +500"
                          value={maxOddsInput}
                          onChange={handleMaxOddsInputChange}
                          onBlur={handleMaxOddsInputBlur}
                          onKeyDown={handleMaxOddsKeyDown}
                          className="w-20 h-7 px-2 text-xs text-right rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {MAX_ODDS_PRESETS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              onMaxOddsChange(opt.value);
                              setMaxOddsInput(opt.value === 100000 ? "" : formatOddsDisplay(opt.value));
                            }}
                            className={cn(
                              "px-2 py-1 rounded text-[10px] font-medium transition-all",
                              (maxOdds ?? 100000) === opt.value
                                ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Books & Liquidity */}
          <div className="border-b border-neutral-200 dark:border-neutral-700">
            <button
              onClick={() => toggleSection("books")}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Books & Liquidity
              </span>
              <ChevronRight
                className={cn(
                  "w-4 h-4 text-neutral-400 transition-transform",
                  expandedSections.has("books") && "rotate-90"
                )}
              />
            </button>

            {expandedSections.has("books") && (
              <div className="px-3 pb-3 space-y-3">
                {/* Min Books Per Side */}
                {onMinBooksPerSideChange && (
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-neutral-500 dark:text-neutral-400">Min Books/Side</label>
                    <select
                      value={minBooksPerSide ?? 2}
                      onChange={(e) => onMinBooksPerSideChange(Number(e.target.value))}
                      className="h-7 px-2 rounded text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
                    >
                      {MIN_BOOKS_OPTIONS.map((val) => (
                        <option key={val} value={val}>
                          {val}+
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Min Liquidity */}
                <div className="flex items-center justify-between">
                  <label className="text-xs text-neutral-500 dark:text-neutral-400">Min Liquidity</label>
                  <select
                    value={minLiquidity}
                    onChange={(e) => onMinLiquidityChange(Number(e.target.value))}
                    className="h-7 px-2 rounded text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
                  >
                    {MIN_LIQUIDITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Kelly Settings */}
          {(onBankrollChange || onKellyPercentChange) && (
            <div className="border-b border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => toggleSection("kelly")}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Kelly Criterion
                </span>
                <ChevronRight
                  className={cn(
                    "w-4 h-4 text-neutral-400 transition-transform",
                    expandedSections.has("kelly") && "rotate-90"
                  )}
                />
              </button>

              {expandedSections.has("kelly") && (
                <div className="px-3 pb-3 space-y-3">
                  {/* Bankroll */}
                  {onBankrollChange && (
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Bankroll
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={bankrollInput}
                          onChange={handleBankrollChange}
                          onBlur={handleBankrollBlur}
                          className="w-24 h-7 pl-5 text-xs text-right rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </div>
                    </div>
                  )}

                  {/* Kelly Percent */}
                  {onKellyPercentChange && (
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        Kelly %
                      </label>
                      <select
                        value={kellyPercent ?? 25}
                        onChange={(e) => onKellyPercentChange(Number(e.target.value))}
                        className="h-7 px-2 rounded text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300"
                      >
                        {KELLY_PERCENT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Hidden Edges */}
          <div className="px-3 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {showHidden ? (
                  <Eye className="w-4 h-4 text-neutral-500" />
                ) : (
                  <EyeOff className="w-4 h-4 text-neutral-500" />
                )}
                <label className="text-sm text-neutral-700 dark:text-neutral-300">
                  Show hidden edges
                </label>
                {hiddenCount > 0 && (
                  <span className="text-[10px] bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded-full">
                    {hiddenCount}
                  </span>
                )}
              </div>
              <Switch
                checked={showHidden}
                fn={onToggleShowHidden}
              />
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
