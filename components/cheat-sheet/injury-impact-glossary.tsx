"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X, Target, BarChart3, TrendingUp, Users, HelpCircle } from "lucide-react";

interface InjuryImpactGlossaryProps {
  isOpen: boolean;
  onClose: () => void;
}

// Grade thresholds for Injury Impact
const GRADE_THRESHOLDS = [
  { grade: "A+", range: "85 - 100", color: "text-emerald-500 bg-emerald-500/10", meaning: "Elite opportunity" },
  { grade: "A", range: "75 - 84", color: "text-green-500 bg-green-500/10", meaning: "Strong opportunity" },
  { grade: "B+", range: "65 - 74", color: "text-yellow-500 bg-yellow-500/10", meaning: "Good opportunity" },
  { grade: "B", range: "55 - 64", color: "text-orange-500 bg-orange-500/10", meaning: "Moderate opportunity" },
  { grade: "C", range: "Below 55", color: "text-neutral-500 bg-neutral-500/10", meaning: "Speculative" },
];

// Score factors for Injury Impact
const SCORE_FACTORS = [
  {
    icon: Target,
    name: "Hit Rate",
    weight: "35%",
    maxPoints: 35,
    description: "How often the player goes over the line when this teammate is out",
    calculation: "hit_rate × 35",
    example: "80% hit rate = 28 pts",
    color: "text-blue-500",
  },
  {
    icon: BarChart3,
    name: "Sample Size",
    weight: "25%",
    maxPoints: 25,
    description: "Number of games with teammate out — more games = more reliable data",
    calculation: "MIN(games, 10) / 10 × 25",
    example: "10+ games = 25 pts",
    color: "text-purple-500",
  },
  {
    icon: TrendingUp,
    name: "Stat Boost",
    weight: "20%",
    maxPoints: 20,
    description: "How much the player's stats improve when the teammate is out",
    calculation: "IF boost > 0: MIN(boost × 4, 20)",
    example: "+5 boost = 20 pts",
    color: "text-emerald-500",
  },
  {
    icon: Users,
    name: "Teammate Impact",
    weight: "20%",
    maxPoints: 20,
    description: "The importance of the out teammate based on their minutes played",
    calculation: "MIN(teammate_mins, 35) / 35 × 20",
    example: "35+ min = 20 pts",
    color: "text-orange-500",
  },
];

export function InjuryImpactGlossary({ isOpen, onClose }: InjuryImpactGlossaryProps) {
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
                Teammate Out Confidence Score
              </h2>
              <p className="text-sm text-neutral-500">
                Understanding injury impact opportunities
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
              The <span className="font-semibold text-brand">Confidence Score</span> (0-100) evaluates "teammate out" betting opportunities by combining four key factors. Higher scores indicate stronger plays with more reliable data.
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
              Opportunity Grades
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
                  <p className="text-[10px] text-neutral-400 mt-0.5">{item.meaning}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Example Calculations */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">
              Example Scenarios
            </h3>
            
            {/* A+ Example */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 mb-3">
              <div className="flex items-center gap-2 pb-3 border-b border-emerald-200 dark:border-emerald-700">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold text-sm">
                  A+
                </span>
                <span className="font-bold text-neutral-900 dark:text-white">Elite Opportunity</span>
                <span className="text-sm text-neutral-500 ml-auto">Score: 88</span>
              </div>
              
              <div className="space-y-2 text-sm mt-3">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Hit Rate (90%)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">0.90 × 35 = <span className="text-emerald-600 dark:text-emerald-400 font-semibold">31.5 pts</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Sample Size (8 games)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">8/10 × 25 = <span className="text-emerald-600 dark:text-emerald-400 font-semibold">20 pts</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Stat Boost (+4.2)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">4.2 × 4 = <span className="text-emerald-600 dark:text-emerald-400 font-semibold">16.8 pts</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Teammate (32 min/game)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">32/35 × 20 = <span className="text-emerald-600 dark:text-emerald-400 font-semibold">18.3 pts</span></span>
                </div>
              </div>
              
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700 italic">
                "Player goes over 90% of the time when their 32-minute teammate is out, with a +4.2 stat boost across 8 games."
              </p>
            </div>

            {/* B Example */}
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-500 font-bold text-sm">
                  B
                </span>
                <span className="font-bold text-neutral-900 dark:text-white">Moderate Opportunity</span>
                <span className="text-sm text-neutral-500 ml-auto">Score: 58</span>
              </div>
              
              <div className="space-y-2 text-sm mt-3">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Hit Rate (70%)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">0.70 × 35 = <span className="text-brand font-semibold">24.5 pts</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Sample Size (4 games)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">4/10 × 25 = <span className="text-brand font-semibold">10 pts</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Stat Boost (+1.5)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">1.5 × 4 = <span className="text-brand font-semibold">6 pts</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Teammate (22 min/game)</span>
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">22/35 × 20 = <span className="text-brand font-semibold">12.6 pts</span></span>
                </div>
              </div>
              
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700 italic">
                "Decent hit rate but small sample size and moderate teammate impact."
              </p>
            </div>
          </div>

          {/* Pro Tips */}
          <div className="bg-brand/5 border border-brand/20 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand mb-3">
              Pro Tips
            </h3>
            <ul className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              <li className="flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                <span><strong>A+ grades (85+)</strong> are elite opportunities — high hit rate with a significant teammate out.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                <span><strong>Sample size matters</strong> — 2-3 games is speculative, 8+ games gives real confidence.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                <span><strong>Stat boost shows opportunity</strong> — players who genuinely step up get higher scores.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                <span><strong>Star teammates matter most</strong> — a 35+ minute player being out creates the biggest ripple effect.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

