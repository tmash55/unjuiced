"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, TrendingUp, ArrowLeftRight } from "lucide-react";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { FilterTool } from "./unified-filter-bar";
import type { SharpPreset } from "@/lib/ev/types";
import type { BestOddsPrefs } from "@/lib/best-odds-schema";
import { SHARP_PRESETS } from "@/lib/ev/constants";

// Sharp books mapping with their IDs for logo lookup
const SHARP_PRESET_TO_BOOK: Record<string, string | null> = {
  pinnacle: "pinnacle",
  circa: "circa",
  betonline: "betonline",
  prophetx: "prophetx",
  pinnacle_circa: null, // Blend - no single logo
  hardrock_thescore: null, // Blend - no single logo
  draftkings: "draftkings",
  fanduel: "fanduel",
  betmgm: "betmgm",
  caesars: "caesars",
  hardrock: "hardrock",
  bet365: "bet365",
  thescore: "thescore",
  ballybet: "ballybet",
  betrivers: "betrivers",
  fanatics: "fanatics",
  polymarket: "polymarket",
  kalshi: "kalshi",
  market_average: null, // Average - no logo
};

// Sharp books for Edge Finder
const SHARP_BOOK_OPTIONS = [
  { id: "pinnacle", name: "Pinnacle" },
  { id: "circa", name: "Circa" },
  { id: "betonline", name: "BetOnline" },
];

// Retail books for Edge Finder
const RETAIL_BOOK_OPTIONS = [
  { id: "draftkings", name: "DraftKings" },
  { id: "fanduel", name: "FanDuel" },
  { id: "betmgm", name: "BetMGM" },
  { id: "caesars", name: "Caesars" },
  { id: "hardrock", name: "Hard Rock" },
  { id: "bet365", name: "Bet365" },
  { id: "thescore", name: "theScore" },
  { id: "ballybet", name: "Bally Bet" },
  { id: "betrivers", name: "BetRivers" },
  { id: "fanatics", name: "Fanatics" },
];

// Betting exchanges for Edge Finder
const BETTING_EXCHANGE_OPTIONS = [
  { id: "prophetx", name: "ProphetX" },
];

// Prediction markets for Edge Finder
const PREDICTION_MARKET_OPTIONS = [
  { id: "polymarket", name: "Polymarket" },
  { id: "kalshi", name: "Kalshi" },
];

interface ComparingDropdownProps {
  tool: FilterTool;
  
  // Positive EV props
  sharpPreset?: SharpPreset;
  onSharpPresetChange?: (preset: SharpPreset) => void;
  
  // Edge Finder props
  comparisonMode?: BestOddsPrefs["comparisonMode"];
  comparisonBook?: string | null;
  onComparisonChange?: (mode: BestOddsPrefs["comparisonMode"], book: string | null) => void;
  
  disabled?: boolean;
}

export function ComparingDropdown({
  tool,
  sharpPreset,
  onSharpPresetChange,
  comparisonMode,
  comparisonBook,
  onComparisonChange,
  disabled = false,
}: ComparingDropdownProps) {
  const [open, setOpen] = useState(false);
  const [showBookSelector, setShowBookSelector] = useState(false);

  // Get current display name and logo (without "vs" prefix - that's added separately)
  const getDisplayInfo = () => {
    if (tool === "positive-ev" && sharpPreset) {
      const preset = SHARP_PRESETS[sharpPreset];
      const bookId = SHARP_PRESET_TO_BOOK[sharpPreset];
      const book = bookId ? getSportsbookById(bookId) : null;
      return {
        name: preset?.label || "Pinnacle",
        logo: book?.image?.light || null
      };
    }
    
    if (tool === "edge-finder") {
      if (comparisonMode === "average") return { name: "Average", logo: null };
      if (comparisonMode === "next_best") return { name: "Next Best", logo: null };
      if (comparisonMode === "book" && comparisonBook) {
        const book = getSportsbookById(comparisonBook);
        return {
          name: book?.name || comparisonBook,
          logo: book?.image?.light || null
        };
      }
      return { name: "Average", logo: null };
    }
    
    return { name: "Comparing", logo: null };
  };

  const { name: displayName, logo: displayLogo } = getDisplayInfo();

  const handlePositiveEVPresetChange = (preset: SharpPreset) => {
    onSharpPresetChange?.(preset);
    setOpen(false);
  };

  const handleEdgeFinderModeChange = (mode: BestOddsPrefs["comparisonMode"], book: string | null = null) => {
    if (mode === "book" && !book) {
      setShowBookSelector(true);
      return;
    }
    onComparisonChange?.(mode, book);
    setShowBookSelector(false);
    setOpen(false);
  };

  const handleBookSelect = (bookId: string) => {
    onComparisonChange?.("book", bookId);
    setShowBookSelector(false);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) setShowBookSelector(false);
    }}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          className={cn(
            "flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium transition-all",
            "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
            "border border-neutral-200/80 dark:border-neutral-700/80",
            "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="text-neutral-500 dark:text-neutral-400">vs</span>
          {displayLogo ? (
            <img src={displayLogo} alt="" className="w-4 h-4 object-contain" />
          ) : null}
          <span>{displayName}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            {tool === "positive-ev" ? "De-vig Against" : "Compare Against"}
          </span>
        </div>

        {/* Positive EV: Sharp presets - organized by category */}
        {tool === "positive-ev" && (
          <div className="p-1.5 space-y-0.5 max-h-[500px] overflow-y-auto">
            {/* 1. Sharp Books Section */}
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Sharp Books (Recommended)
              </span>
            </div>

            {(["pinnacle", "circa", "betonline"] as const).map((key) => {
              const preset = SHARP_PRESETS[key];
              const bookId = SHARP_PRESET_TO_BOOK[key];
              const book = bookId ? getSportsbookById(bookId) : null;
              const logo = book?.image?.light;
              const isSelected = sharpPreset === key;

              return (
                <button
                  key={key}
                  onClick={() => handlePositiveEVPresetChange(key as SharpPreset)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                    isSelected
                      ? "bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {logo ? (
                      <img src={logo} alt={preset.label} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-medium flex-1",
                    isSelected
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-neutral-700 dark:text-neutral-300"
                  )}>
                    {preset.label}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                </button>
              );
            })}

            <DropdownMenuSeparator className="my-1.5" />

            {/* 2. Market Average */}
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                Market Consensus
              </span>
            </div>

            <button
              onClick={() => handlePositiveEVPresetChange("market_average")}
              className={cn(
                "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                sharpPreset === "market_average"
                  ? "bg-neutral-100 dark:bg-neutral-800"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              )}
            >
              <TrendingUp className="w-4 h-4 text-neutral-400 shrink-0" />
              <div className="flex-1">
                <span className={cn(
                  "text-sm font-medium",
                  sharpPreset === "market_average"
                    ? "text-neutral-900 dark:text-white"
                    : "text-neutral-700 dark:text-neutral-300"
                )}>
                  Market Average
                </span>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                  Averages all books
                </p>
              </div>
              {sharpPreset === "market_average" && (
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
            </button>

            <DropdownMenuSeparator className="my-1.5" />

            {/* 3. Retail Books Section */}
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                Retail Books
              </span>
            </div>

            {(["draftkings", "fanduel", "betmgm", "caesars", "hardrock", "bet365", "thescore", "ballybet", "betrivers", "fanatics"] as const).map((key) => {
              const preset = SHARP_PRESETS[key];
              const bookId = SHARP_PRESET_TO_BOOK[key];
              const book = bookId ? getSportsbookById(bookId) : null;
              const logo = book?.image?.light;
              const isSelected = sharpPreset === key;

              return (
                <button
                  key={key}
                  onClick={() => handlePositiveEVPresetChange(key as SharpPreset)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                    isSelected
                      ? "bg-neutral-100 dark:bg-neutral-800"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {logo ? (
                      <img src={logo} alt={preset.label} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-medium flex-1",
                    isSelected
                      ? "text-neutral-900 dark:text-white"
                      : "text-neutral-700 dark:text-neutral-300"
                  )}>
                    {preset.label}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                </button>
              );
            })}

            <DropdownMenuSeparator className="my-1.5" />

            {/* 4. Betting Exchange Section */}
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
                Betting Exchange
              </span>
            </div>

            {(["prophetx"] as const).map((key) => {
              const preset = SHARP_PRESETS[key];
              const bookId = SHARP_PRESET_TO_BOOK[key];
              const book = bookId ? getSportsbookById(bookId) : null;
              const logo = book?.image?.light;
              const isSelected = sharpPreset === key;

              return (
                <button
                  key={key}
                  onClick={() => handlePositiveEVPresetChange(key as SharpPreset)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                    isSelected
                      ? "bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {logo ? (
                      <img src={logo} alt={preset.label} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-medium flex-1",
                    isSelected
                      ? "text-violet-700 dark:text-violet-300"
                      : "text-neutral-700 dark:text-neutral-300"
                  )}>
                    {preset.label}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-violet-500 shrink-0" />
                  )}
                </button>
              );
            })}

            <DropdownMenuSeparator className="my-1.5" />

            {/* 5. Prediction Markets Section */}
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500" />
                Prediction Markets
              </span>
            </div>

            {(["polymarket", "kalshi"] as const).map((key) => {
              const preset = SHARP_PRESETS[key];
              const bookId = SHARP_PRESET_TO_BOOK[key];
              const book = bookId ? getSportsbookById(bookId) : null;
              const logo = book?.image?.light;
              const isSelected = sharpPreset === key;

              return (
                <button
                  key={key}
                  onClick={() => handlePositiveEVPresetChange(key as SharpPreset)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                    isSelected
                      ? "bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {logo ? (
                      <img src={logo} alt={preset.label} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-medium flex-1",
                    isSelected
                      ? "text-sky-700 dark:text-sky-300"
                      : "text-neutral-700 dark:text-neutral-300"
                  )}>
                    {preset.label}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-sky-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Edge Finder: Comparison modes or book selector */}
        {tool === "edge-finder" && !showBookSelector && (
          <div className="p-1.5 space-y-0.5 max-h-[500px] overflow-y-auto">
            {/* 1. Average (default) + Next Best */}
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                Market Consensus
              </span>
            </div>

            <button
              onClick={() => handleEdgeFinderModeChange("average")}
              className={cn(
                "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                comparisonMode === "average"
                  ? "bg-neutral-100 dark:bg-neutral-800"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              )}
            >
              <TrendingUp className="w-4 h-4 text-neutral-400 shrink-0" />
              <div className="flex-1">
                <span className={cn(
                  "text-sm font-medium",
                  comparisonMode === "average"
                    ? "text-neutral-900 dark:text-white"
                    : "text-neutral-700 dark:text-neutral-300"
                )}>
                  Market Average
                </span>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                  Default • Averages all books
                </p>
              </div>
              {comparisonMode === "average" && (
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
            </button>

            <button
              onClick={() => handleEdgeFinderModeChange("next_best")}
              className={cn(
                "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                comparisonMode === "next_best"
                  ? "bg-neutral-100 dark:bg-neutral-800"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              )}
            >
              <ArrowLeftRight className="w-4 h-4 text-neutral-400 shrink-0" />
              <span className={cn(
                "text-sm font-medium flex-1",
                comparisonMode === "next_best"
                  ? "text-neutral-900 dark:text-white"
                  : "text-neutral-700 dark:text-neutral-300"
              )}>
                Next Best Price
              </span>
              {comparisonMode === "next_best" && (
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
            </button>

            <DropdownMenuSeparator className="my-1.5" />

            {/* 2. Sharp Books */}
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Sharp Books
              </span>
            </div>

            {SHARP_BOOK_OPTIONS.map((book) => {
              const sportsbook = getSportsbookById(book.id);
              const logo = sportsbook?.image?.light;
              const isSelected = comparisonMode === "book" && comparisonBook === book.id;

              return (
                <button
                  key={book.id}
                  onClick={() => handleBookSelect(book.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                    isSelected
                      ? "bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {logo ? (
                      <img src={logo} alt={book.name} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-medium flex-1",
                    isSelected
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-neutral-700 dark:text-neutral-300"
                  )}>
                    {book.name}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                </button>
              );
            })}

            <DropdownMenuSeparator className="my-1.5" />

            {/* 3. Retail Books */}
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                Retail Books
              </span>
            </div>

            {RETAIL_BOOK_OPTIONS.map((book) => {
              const sportsbook = getSportsbookById(book.id);
              const logo = sportsbook?.image?.light;
              const isSelected = comparisonMode === "book" && comparisonBook === book.id;

              return (
                <button
                  key={book.id}
                  onClick={() => handleBookSelect(book.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                    isSelected
                      ? "bg-neutral-100 dark:bg-neutral-800"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {logo ? (
                      <img src={logo} alt={book.name} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-medium flex-1",
                    isSelected
                      ? "text-neutral-900 dark:text-white"
                      : "text-neutral-700 dark:text-neutral-300"
                  )}>
                    {book.name}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                </button>
              );
            })}

            <DropdownMenuSeparator className="my-1.5" />

            {/* 4. Betting Exchange */}
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500" />
                Betting Exchange
              </span>
            </div>

            {BETTING_EXCHANGE_OPTIONS.map((book) => {
              const sportsbook = getSportsbookById(book.id);
              const logo = sportsbook?.image?.light;
              const isSelected = comparisonMode === "book" && comparisonBook === book.id;

              return (
                <button
                  key={book.id}
                  onClick={() => handleBookSelect(book.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                    isSelected
                      ? "bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {logo ? (
                      <img src={logo} alt={book.name} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-medium flex-1",
                    isSelected
                      ? "text-violet-700 dark:text-violet-300"
                      : "text-neutral-700 dark:text-neutral-300"
                  )}>
                    {book.name}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-violet-500 shrink-0" />
                  )}
                </button>
              );
            })}

            <DropdownMenuSeparator className="my-1.5" />

            {/* 5. Prediction Markets */}
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wide flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500" />
                Prediction Markets
              </span>
            </div>

            {PREDICTION_MARKET_OPTIONS.map((book) => {
              const sportsbook = getSportsbookById(book.id);
              const logo = sportsbook?.image?.light;
              const isSelected = comparisonMode === "book" && comparisonBook === book.id;

              return (
                <button
                  key={book.id}
                  onClick={() => handleBookSelect(book.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                    isSelected
                      ? "bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {logo ? (
                      <img src={logo} alt={book.name} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-medium flex-1",
                    isSelected
                      ? "text-sky-700 dark:text-sky-300"
                      : "text-neutral-700 dark:text-neutral-300"
                  )}>
                    {book.name}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-sky-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Edge Finder: Book selector (if using old flow) */}
        {tool === "edge-finder" && showBookSelector && (
          <div className="p-1.5 max-h-[500px] overflow-y-auto">
            <button
              onClick={() => setShowBookSelector(false)}
              className="w-full px-2 py-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 text-left mb-1"
            >
              ← Back
            </button>
            
            <DropdownMenuSeparator className="my-1" />
            
            <div className="space-y-0.5">
              {[...SHARP_BOOK_OPTIONS, ...RETAIL_BOOK_OPTIONS, ...BETTING_EXCHANGE_OPTIONS, ...PREDICTION_MARKET_OPTIONS].map((book) => {
                const sportsbook = getSportsbookById(book.id);
                const logo = sportsbook?.image?.light;
                const isSelected = comparisonBook === book.id;

                return (
                  <button
                    key={book.id}
                    onClick={() => handleBookSelect(book.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors",
                      isSelected
                        ? "bg-neutral-100 dark:bg-neutral-800"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    )}
                  >
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      {logo ? (
                        <img src={logo} alt={book.name} className="max-w-full max-h-full object-contain" />
                      ) : (
                        <div className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />
                      )}
                    </div>
                    <span className={cn(
                      "text-sm font-medium flex-1",
                      isSelected
                        ? "text-neutral-900 dark:text-white"
                        : "text-neutral-700 dark:text-neutral-300"
                    )}>
                      {book.name}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
