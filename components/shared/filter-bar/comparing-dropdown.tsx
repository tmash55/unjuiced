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
  prophetx: "prophetx",
  pinnacle_circa: null, // Blend - no single logo
  hardrock_thescore: null, // Blend - no single logo
  draftkings: "draftkings",
  fanduel: "fanduel",
  betmgm: "betmgm",
  caesars: "caesars",
  hardrock: "hardrock",
  bet365: "bet365",
  market_average: null, // Average - no logo
};

// Sharp books for Edge Finder (primary sharp books)
const SHARP_BOOK_OPTIONS = [
  { id: "pinnacle", name: "Pinnacle" },
  { id: "circa", name: "Circa" },
  { id: "prophetx", name: "ProphetX" },
  { id: "hardrock", name: "Hard Rock" },
  { id: "thescore", name: "theScore" },
];

// Retail books for Edge Finder
const RETAIL_BOOK_OPTIONS = [
  { id: "fanduel", name: "FanDuel" },
  { id: "draftkings", name: "DraftKings" },
  { id: "betmgm", name: "BetMGM" },
  { id: "caesars", name: "Caesars" },
  { id: "bet365", name: "Bet365" },
  { id: "espnbet", name: "ESPN Bet" },
  { id: "fanatics", name: "Fanatics" },
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

      <DropdownMenuContent align="start" className="w-56 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            {tool === "positive-ev" ? "De-vig Against" : "Compare Against"}
          </span>
        </div>

        {/* Positive EV: Sharp presets */}
        {tool === "positive-ev" && (
          <div className="p-1.5 space-y-0.5">
            {Object.entries(SHARP_PRESETS)
              .filter(([key]) => key !== "custom" && key !== "hardrock_thescore")
              .map(([key, preset]) => {
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
                    {/* Logo or icon */}
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      {logo ? (
                        <img src={logo} alt={preset.label} className="max-w-full max-h-full object-contain" />
                      ) : key === "pinnacle_circa" ? (
                        <div className="flex -space-x-1">
                          <img src={getSportsbookById("pinnacle")?.image?.light} alt="" className="w-3.5 h-3.5 object-contain" />
                          <img src={getSportsbookById("circa")?.image?.light} alt="" className="w-3.5 h-3.5 object-contain" />
                        </div>
                      ) : (
                        <TrendingUp className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>

                    {/* Label */}
                    <span className={cn(
                      "text-sm font-medium flex-1",
                      isSelected
                        ? "text-neutral-900 dark:text-white"
                        : "text-neutral-700 dark:text-neutral-300"
                    )}>
                      {preset.label}
                    </span>

                    {/* Check */}
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    )}
                  </button>
                );
              })}
          </div>
        )}

        {/* Edge Finder: Comparison modes or book selector */}
        {tool === "edge-finder" && !showBookSelector && (
          <div className="p-1.5 space-y-0.5">
            {/* Market Average */}
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
              <span className={cn(
                "text-sm font-medium flex-1",
                comparisonMode === "average"
                  ? "text-neutral-900 dark:text-white"
                  : "text-neutral-700 dark:text-neutral-300"
              )}>
                Market Average
              </span>
              {comparisonMode === "average" && (
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
            </button>

            {/* Next Best */}
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

            <DropdownMenuSeparator className="my-1" />

            {/* Sharp Books */}
            <div className="px-2 py-1">
              <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
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

            <DropdownMenuSeparator className="my-1" />

            {/* Retail Books */}
            <div className="px-2 py-1">
              <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
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
          </div>
        )}

        {/* Edge Finder: Book selector (if using old flow) */}
        {tool === "edge-finder" && showBookSelector && (
          <div className="p-1.5">
            <button
              onClick={() => setShowBookSelector(false)}
              className="w-full px-2 py-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 text-left mb-1"
            >
              ← Back
            </button>
            
            <DropdownMenuSeparator className="my-1" />
            
            <div className="space-y-0.5">
              {[...SHARP_BOOK_OPTIONS, ...RETAIL_BOOK_OPTIONS].map((book) => {
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
