"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X, Target, TrendingUp, Shield, Flame, DollarSign, HelpCircle } from "lucide-react";

interface ConfidenceGlossaryProps {
  isOpen: boolean;
  onClose: () => void;
}

// Grade thresholds
const GRADE_THRESHOLDS = [
  { grade: "A+", range: "90 - 100", color: "text-emerald-500 bg-emerald-500/10" },
  { grade: "A", range: "80 - 89", color: "text-green-500 bg-green-500/10" },
  { grade: "B+", range: "70 - 79", color: "text-yellow-500 bg-yellow-500/10" },
  { grade: "B", range: "60 - 69", color: "text-orange-500 bg-orange-500/10" },
  { grade: "C", range: "Below 60", color: "text-neutral-500 bg-neutral-500/10" },
];

// Score factors
const SCORE_FACTORS = [
  {
    icon: Target,
    name: "Hit Rate",
    weight: "40%",
    maxPoints: 40,
    description: "How often the player has cleared this line recently",
    calculation: "hit_rate × 40",
    example: "90% hit rate = 36 pts",
    color: "text-blue-500",
  },
  {
    icon: TrendingUp,
    name: "Edge / Cushion",
    weight: "20%",
    maxPoints: 20,
    description: "The cushion between the player's average and the betting line",
    calculation: "(avg - line) × 4, capped at 20",
    example: "+3.0 edge = 12 pts",
    color: "text-emerald-500",
  },
  {
    icon: Shield,
    name: "DvP Matchup",
    weight: "20%",
    maxPoints: 20,
    description: "Defense vs Position ranking — favorable matchups score higher",
    calculation: "((rank - 1) / 29) × 20",
    example: "Rank 28 (easy) = 18.6 pts",
    color: "text-purple-500",
  },
  {
    icon: Flame,
    name: "Hit Streak",
    weight: "10%",
    maxPoints: 10,
    description: "Current consecutive games hitting the over",
    calculation: "streak × 2, capped at 10",
    example: "5+ streak = 10 pts",
    color: "text-orange-500",
  },
  {
    icon: DollarSign,
    name: "Odds Value",
    weight: "10%",
    maxPoints: 10,
    description: "Better odds indicate more value — plus odds score highest",
    calculation: "Based on decimal odds",
    example: "+100 or better = 10 pts",
    color: "text-green-500",
  },
];

export function ConfidenceGlossary({ isOpen, onClose }: ConfidenceGlossaryProps) {
  // Handle Esc key to close
  React.useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  React.useEffect(() => {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] mx-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/10 rounded-xl">
              <HelpCircle className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                How Confidence Scores Work
              </h2>
              <p className="text-sm text-neutral-500">
                Understanding our 0-100 rating system
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Intro */}
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              The <span className="font-semibold text-brand">Confidence Score</span> is a composite rating from 0-100 that combines five key factors to evaluate betting opportunities. Higher scores indicate stronger plays.
            </p>
          </div>

          {/* Score Breakdown */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">
              Score Breakdown
            </h3>
            <div className="space-y-3">
              {SCORE_FACTORS.map((factor) => (
                <div 
                  key={factor.name}
                  className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg bg-neutral-100 dark:bg-neutral-700", factor.color)}>
                      <factor.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {factor.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-neutral-500">{factor.weight}</span>
                          <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded">
                            {factor.maxPoints} pts max
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                        {factor.description}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <code className="px-2 py-1 bg-neutral-100 dark:bg-neutral-700 rounded text-neutral-600 dark:text-neutral-300">
                          {factor.calculation}
                        </code>
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">
                          e.g., {factor.example}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grade Thresholds */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">
              Grade Thresholds
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {GRADE_THRESHOLDS.map((item) => (
                <div 
                  key={item.grade}
                  className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-center"
                >
                  <span className={cn("inline-flex items-center justify-center w-10 h-8 rounded-lg font-bold text-sm mb-1.5", item.color)}>
                    {item.grade}
                  </span>
                  <p className="text-xs text-neutral-500">{item.range}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Example Calculation */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">
              Example Calculation
            </h3>
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                <span className="font-bold text-neutral-900 dark:text-white">LeBron James</span>
                <span className="text-sm text-neutral-500">Points O25.5 @ -115</span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Hit Rate (90% L10)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">0.90 × 40 = <span className="text-brand font-semibold">36 pts</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Edge (+3.2)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">3.2 × 4 = <span className="text-brand font-semibold">12.8 pts</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">DvP Rank (28th)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">(27/29) × 20 = <span className="text-brand font-semibold">18.6 pts</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Hit Streak (5 games)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">5 × 2 = <span className="text-brand font-semibold">10 pts</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Odds Value (-115)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">~1.87 dec → <span className="text-brand font-semibold">6 pts</span></span>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-700">
                <span className="font-bold text-neutral-900 dark:text-white">Total</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg text-neutral-900 dark:text-white">83.4</span>
                  <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-green-500/10 text-green-500 font-bold text-sm">
                    A
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sharp Tips */}
          <div className="bg-brand/5 border border-brand/20 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand mb-3">
              Sharp Tips
            </h3>
            <ul className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              <li className="flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                <span><strong>A+ grades (90+)</strong> are rare and indicate exceptional value — these are the cream of the crop.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                <span><strong>Hit Rate is king</strong> — it accounts for 40% of the score because consistency matters most.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                <span><strong>DvP matchups</strong> can swing a play significantly — an easy matchup (21-30) adds up to 20 points.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                <span><strong>Streaks compound</strong> — a hot player on a streak against a weak defense is the ideal scenario.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

