"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import Link from "next/link";

interface HitRateSignal {
  playerId: number;
  playerName: string;
  team: string;
  market: string;
  marketDisplay: string;
  line: number;
  l10Pct: number;
  l5Pct: number | null;
  avg: number | null;
  streak: number | null;
  profileUrl: string;
}

interface SignalsResponse {
  hitRates: HitRateSignal[];
  injuryBoosts: any[];
  timestamp: number;
}

async function fetchSignals(): Promise<SignalsResponse> {
  const response = await fetch("/api/dashboard/signals");
  if (!response.ok) {
    throw new Error("Failed to fetch signals");
  }
  return response.json();
}

// Simple horizontal bar chart
function HitRateBar({ 
  label, 
  pct, 
  color 
}: { 
  label: string; 
  pct: number | null; 
  color: string;
}) {
  if (pct === null) return null;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 w-6">
        {label}
      </span>
      <div className="flex-1 h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn(
        "text-xs font-bold tabular-nums w-10 text-right",
        pct >= 80 ? "text-emerald-600 dark:text-emerald-400" : 
        pct >= 60 ? "text-amber-600 dark:text-amber-400" : 
        "text-neutral-600 dark:text-neutral-300"
      )}>
        {pct}%
      </span>
    </div>
  );
}

export function HitRatesCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-signals"],
    queryFn: fetchSignals,
    refetchInterval: 60000,
    staleTime: 30000,
  });
  
  const hitRates = data?.hitRates || [];
  const totalSlides = hitRates.length;
  
  // Auto-scroll every 5 seconds
  useEffect(() => {
    if (totalSlides <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [totalSlides]);
  
  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);
  
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);
  
  const currentSlide = hitRates[currentIndex];

  return (
    <section className={cn(
      "rounded-xl border border-neutral-200 dark:border-neutral-800",
      "bg-white dark:bg-neutral-900 flex flex-col min-h-[280px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Top Hit Rates
            </h2>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
              L5/L10 performance
            </p>
          </div>
        </div>
        
        {/* Navigation Arrows */}
        {totalSlides > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrev}
              className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-neutral-500" />
            </button>
            <span className="text-[10px] text-neutral-400 tabular-nums px-1">
              {currentIndex + 1}/{totalSlides}
            </span>
            <button
              onClick={goToNext}
              className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-neutral-500" />
            </button>
          </div>
        )}
      </div>

      {/* Carousel Content */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-6 w-32 bg-neutral-100 dark:bg-neutral-800 rounded" />
            <div className="h-4 w-24 bg-neutral-100 dark:bg-neutral-800 rounded" />
            <div className="space-y-2">
              <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded" />
              <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded" />
            </div>
          </div>
        ) : error || hitRates.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No hit rate data available
            </p>
          </div>
        ) : currentSlide ? (
          <Link 
            href={currentSlide.profileUrl}
            className="block h-full group"
          >
            <div className="space-y-4">
              {/* Player Info */}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {currentSlide.playerName}
                  </h3>
                  <span className="text-[10px] font-medium text-neutral-400 uppercase">
                    {currentSlide.team}
                  </span>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                  {currentSlide.marketDisplay} O {currentSlide.line}
                </p>
              </div>

              {/* Hit Streak Badge */}
              {currentSlide.streak && currentSlide.streak >= 5 && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/40">
                  <Zap className="w-3 h-3 text-amber-600 dark:text-amber-400 fill-current" />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    {currentSlide.streak} game streak
                  </span>
                </div>
              )}

              {/* Hit Rate Bars */}
              <div className="space-y-2 pt-2">
                <HitRateBar 
                  label="L5" 
                  pct={currentSlide.l5Pct} 
                  color="bg-emerald-500"
                />
                <HitRateBar 
                  label="L10" 
                  pct={currentSlide.l10Pct} 
                  color="bg-teal-500"
                />
              </div>
            </div>
          </Link>
        ) : null}
      </div>

      {/* Dots Indicator */}
      {totalSlides > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-3">
          {hitRates.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                idx === currentIndex 
                  ? "w-4 bg-amber-500" 
                  : "bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600"
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
