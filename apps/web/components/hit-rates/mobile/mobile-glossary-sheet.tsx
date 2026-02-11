"use client";

import React, { useRef, useEffect } from "react";
import { X, HelpCircle, Percent, Target, BarChart3, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileGlossarySheetProps {
  isOpen: boolean;
  onClose: () => void;
}

// Glossary sections with the same data as desktop but formatted for mobile
const GLOSSARY_SECTIONS = [
  {
    title: "How to Read",
    icon: HelpCircle,
    items: [
      { term: "Hit Rate", definition: "Percentage of games where a player exceeded (hit the over on) a stat line." },
      { term: "L5 / L10 / L20", definition: "Hit rate from the last 5, 10, or 20 games respectively." },
      { term: "Season", definition: "Hit rate from all games played this season." },
      { term: "H2H", definition: "Head-to-head hit rate vs the current opponent this season." },
      { term: "Streak", definition: "Consecutive games the player has hit the current line." },
    ],
  },
  {
    title: "Matchup Analysis",
    icon: Target,
    items: [
      { term: "DvP", definition: "Defense vs Position - ranks how a team defends a specific position." },
      { term: "Rank 1-10", definition: "Tough matchup - opponent has strong defense (allows least). Red highlight." },
      { term: "Rank 21-30", definition: "Favorable matchup - opponent has weak defense (allows most). Green highlight." },
      { term: "Usage %", definition: "Percentage of team plays used by the player while on court." },
      { term: "PPP", definition: "Points per possession - efficiency metric for scoring." },
    ],
  },
  {
    title: "Stats & Markets",
    icon: BarChart3,
    items: [
      { term: "PTS", definition: "Points scored in a game." },
      { term: "REB", definition: "Total rebounds (offensive + defensive)." },
      { term: "AST", definition: "Assists - passes leading to made baskets." },
      { term: "3PM", definition: "Three-pointers made." },
      { term: "STL / BLK", definition: "Steals and blocks." },
      { term: "TO", definition: "Turnovers - lost possessions." },
      { term: "FG%", definition: "Field goal percentage." },
    ],
  },
  {
    title: "Combo Stats",
    icon: Zap,
    items: [
      { term: "PRA", definition: "Points + Rebounds + Assists combined." },
      { term: "P+R", definition: "Points + Rebounds combined." },
      { term: "P+A", definition: "Points + Assists combined." },
      { term: "R+A", definition: "Rebounds + Assists combined." },
      { term: "B+S", definition: "Blocks + Steals (stocks)." },
      { term: "DD", definition: "Double-double: 10+ in two stat categories." },
    ],
  },
  {
    title: "Betting Terms",
    icon: TrendingUp,
    items: [
      { term: "Line", definition: "The threshold number set by sportsbooks. Player must exceed for over to hit." },
      { term: "Over / Under", definition: "Betting on whether player exceeds (O) or stays below (U) the line." },
      { term: "Odds", definition: "Payout multiplier. -110 means bet $110 to win $100." },
      { term: "Alt Lines", definition: "Different line options with varying odds." },
      { term: "Sharp Line", definition: "Lines from professional sportsbooks considered most accurate." },
    ],
  },
];

export function MobileGlossarySheet({ isOpen, onClose }: MobileGlossarySheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close sheet when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm">
      <div 
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 rounded-t-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300"
      >
        {/* Sheet Header */}
        <div className="shrink-0 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-brand" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">How to Read</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Glossary Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-5">
          {GLOSSARY_SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            return (
              <div key={section.title}>
                {idx > 0 && (
                  <div className="border-t border-neutral-200 dark:border-neutral-700 -mx-4 mb-4" />
                )}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-brand/10 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-brand" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand">
                    {section.title}
                  </h4>
                </div>
                <div className="space-y-2.5">
                  {section.items.map((item) => (
                    <div key={item.term} className="flex gap-3">
                      <span className="font-semibold text-sm text-neutral-900 dark:text-white shrink-0 w-20">
                        {item.term}
                      </span>
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {item.definition}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

