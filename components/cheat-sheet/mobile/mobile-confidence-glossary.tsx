"use client";

import React, { useRef, useEffect } from "react";
import { X, HelpCircle, Target, TrendingUp, Shield, Flame, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileConfidenceGlossaryProps {
  isOpen: boolean;
  onClose: () => void;
  /** Drives the example player + DvP rank since league size differs
   *  (NBA = 30, WNBA = 13). Defaults to NBA. */
  sport?: "nba" | "wnba" | "mlb";
}

function getMobileSampleLine(sport: "nba" | "wnba" | "mlb") {
  if (sport === "wnba") {
    return {
      player: "A'ja Wilson",
      lineLabel: "Points O25.5",
      hitRatePts: 36,
      edgePts: "12.8",
      dvpRank: 12,
      dvpPts: ((12 - 1) / 12) * 20, // ≈ 18.3
      totalTeams: 13,
      streakPts: 10,
      oddsPts: 6,
    };
  }
  return {
    player: "LeBron James",
    lineLabel: "Points O25.5",
    hitRatePts: 36,
    edgePts: "12.8",
    dvpRank: 28,
    dvpPts: ((28 - 1) / 29) * 20, // ≈ 18.6
    totalTeams: 30,
    streakPts: 10,
    oddsPts: 6,
  };
}

// Grade thresholds
const GRADE_THRESHOLDS = [
  { grade: "A+", range: "90+", color: "text-emerald-500 bg-emerald-500/10" },
  { grade: "A", range: "80-89", color: "text-green-500 bg-green-500/10" },
  { grade: "B+", range: "70-79", color: "text-yellow-500 bg-yellow-500/10" },
  { grade: "B", range: "60-69", color: "text-orange-500 bg-orange-500/10" },
  { grade: "C", range: "<60", color: "text-neutral-500 bg-neutral-500/10" },
];

// Score factors simplified for mobile
const SCORE_FACTORS = [
  {
    icon: Target,
    name: "Hit Rate",
    weight: "40%",
    description: "How often the player clears this line",
    color: "text-blue-500",
  },
  {
    icon: TrendingUp,
    name: "Edge",
    weight: "20%",
    description: "Cushion between average and line",
    color: "text-emerald-500",
  },
  {
    icon: Shield,
    name: "DvP Matchup",
    weight: "20%",
    description: "Defense vs Position ranking",
    color: "text-purple-500",
  },
  {
    icon: Flame,
    name: "Hit Streak",
    weight: "10%",
    description: "Consecutive games hitting over",
    color: "text-orange-500",
  },
  {
    icon: DollarSign,
    name: "Odds Value",
    weight: "10%",
    description: "Better odds = more value",
    color: "text-green-500",
  },
];

export function MobileConfidenceGlossary({ isOpen, onClose, sport = "nba" }: MobileConfidenceGlossaryProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const sample = getMobileSampleLine(sport);
  const totalPts =
    sample.hitRatePts +
    Number(sample.edgePts) +
    sample.dvpPts +
    sample.streakPts +
    sample.oddsPts;
  const totalGrade =
    totalPts >= 90 ? "A+" : totalPts >= 80 ? "A" : totalPts >= 70 ? "B+" : totalPts >= 60 ? "B" : "C";
  const totalGradeClass =
    totalPts >= 90
      ? "bg-emerald-500/10 text-emerald-500"
      : totalPts >= 80
        ? "bg-green-500/10 text-green-500"
        : totalPts >= 70
          ? "bg-yellow-500/10 text-yellow-500"
          : totalPts >= 60
            ? "bg-orange-500/10 text-orange-500"
            : "bg-neutral-500/10 text-neutral-500";

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

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">How Confidence Scores Work</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-5">
          {/* Intro */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3">
            <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
              The <span className="font-semibold text-brand">Confidence Score</span> is a composite rating from 0-100 that combines five key factors to evaluate betting opportunities.
            </p>
          </div>

          {/* Grade Thresholds */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand mb-3">
              Grade Scale
            </h4>
            <div className="flex gap-2">
              {GRADE_THRESHOLDS.map((item) => (
                <div 
                  key={item.grade}
                  className="flex-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-2 text-center"
                >
                  <span className={cn("block font-bold text-sm mb-0.5", item.color.split(" ")[0])}>
                    {item.grade}
                  </span>
                  <p className="text-[10px] text-neutral-500">{item.range}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Score Factors */}
          <div>
            <div className="border-t border-neutral-200 dark:border-neutral-700 -mx-4 mb-4" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-brand/10 flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-brand" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand">
                Score Breakdown
              </h4>
            </div>
            <div className="space-y-2.5">
              {SCORE_FACTORS.map((factor) => {
                const Icon = factor.icon;
                return (
                  <div key={factor.name} className="flex items-start gap-3">
                    <div className={cn("p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-700 shrink-0", factor.color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-neutral-900 dark:text-white">
                          {factor.name}
                        </span>
                        <span className="text-xs font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                          {factor.weight}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {factor.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Example */}
          <div>
            <div className="border-t border-neutral-200 dark:border-neutral-700 -mx-4 mb-4" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-brand/10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-brand" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand">
                Example
              </h4>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-700">
                <span className="font-semibold text-sm text-neutral-900 dark:text-white">{sample.player}</span>
                <span className="text-xs text-neutral-500">{sample.lineLabel}</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Hit Rate (90%)</span>
                  <span className="font-mono text-brand">{sample.hitRatePts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Edge (+3.2)</span>
                  <span className="font-mono text-brand">{sample.edgePts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">DvP ({sample.dvpRank} of {sample.totalTeams})</span>
                  <span className="font-mono text-brand">{sample.dvpPts.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Streak (5)</span>
                  <span className="font-mono text-brand">{sample.streakPts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Odds (-115)</span>
                  <span className="font-mono text-brand">{sample.oddsPts}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700">
                <span className="font-bold text-sm text-neutral-900 dark:text-white">Total</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-neutral-900 dark:text-white">{totalPts.toFixed(1)}</span>
                  <span className={cn("inline-flex items-center justify-center px-2 py-0.5 rounded font-bold text-xs", totalGradeClass)}>
                    {totalGrade}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sharp Tip */}
          <div className="bg-brand/5 border border-brand/20 rounded-xl p-3">
            <h4 className="text-xs font-bold text-brand mb-2">
              Sharp Tip
            </h4>
            <p className="text-xs text-neutral-700 dark:text-neutral-300">
              <strong>A+ grades (90+)</strong> are rare and indicate exceptional value. <strong>Hit Rate</strong> accounts for 40% of the score because consistency matters most.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

