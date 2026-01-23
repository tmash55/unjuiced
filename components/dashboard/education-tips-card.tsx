"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Lightbulb, ChevronRight } from "lucide-react";
import Link from "next/link";

interface EducationTip {
  id: string;
  title: string;
  description: string;
  learnMoreUrl?: string;
}

const EDUCATION_TIPS: EducationTip[] = [
  {
    id: "ev",
    title: "What does +EV mean?",
    description: "Positive Expected Value (+EV) means the odds offered are better than the true probability, giving you a mathematical edge over time.",
    learnMoreUrl: "/learn/expected-value",
  },
  {
    id: "market-avg",
    title: "Why market average matters",
    description: "Comparing odds to the market average helps you spot when one sportsbook is offering significantly better value than others.",
  },
  {
    id: "pinnacle",
    title: "Why Pinnacle is our baseline",
    description: "Pinnacle has the sharpest odds in the world with low margins. We use them as a reference to calculate true probabilities.",
  },
  {
    id: "devig",
    title: "What is devigging?",
    description: "Devigging removes the sportsbook's margin (vig) from odds to reveal the implied true probability of an outcome.",
  },
  {
    id: "kelly",
    title: "Kelly Criterion explained",
    description: "The Kelly formula suggests optimal bet sizing based on your edge and bankroll to maximize long-term growth.",
    learnMoreUrl: "/learn/kelly-criterion",
  },
];

export function EducationTipsCard() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalTips = EDUCATION_TIPS.length;
  
  // Auto-rotate every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalTips);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [totalTips]);
  
  const currentTip = EDUCATION_TIPS[currentIndex];

  return (
    <section className={cn(
      "rounded-xl border border-neutral-200 dark:border-neutral-800",
      "bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800/50",
      "h-full flex flex-col"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200/50 dark:border-neutral-800/50">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
          <Lightbulb className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Quick Tip
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col justify-between">
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            {currentTip.title}
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {currentTip.description}
          </p>
        </div>
        
        {currentTip.learnMoreUrl && (
          <Link 
            href={currentTip.learnMoreUrl}
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 mt-3 transition-colors"
          >
            Learn more
            <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Dots Indicator */}
      <div className="flex items-center justify-center gap-1 pb-3">
        {EDUCATION_TIPS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={cn(
              "w-1 h-1 rounded-full transition-all",
              idx === currentIndex 
                ? "w-3 bg-amber-500" 
                : "bg-neutral-300 dark:bg-neutral-600"
            )}
          />
        ))}
      </div>
    </section>
  );
}
