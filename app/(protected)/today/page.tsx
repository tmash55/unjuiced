"use client";

import { BestBetsSection } from "@/components/dashboard/best-bets-section";
import { PopularMarketsSection } from "@/components/dashboard/popular-markets-section";
import { ArbitrageSection } from "@/components/dashboard/arbitrage-section";
import { DataSignalsSection } from "@/components/dashboard/data-signals-section";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function TodayPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  
  // Format current date
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    
    // Invalidate all dashboard queries
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard-best-bets"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-popular-markets"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-arbitrage"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-signals"] }),
    ]);
    
    setTimeout(() => setIsRefreshing(false), 500);
  }, [queryClient]);
  
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-medium text-neutral-500 dark:text-neutral-400">
              Today
            </h1>
            <p className="text-sm text-neutral-400 dark:text-neutral-500">
              {dateStr}
            </p>
          </div>
          
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
              "bg-white dark:bg-neutral-900",
              "border border-neutral-200 dark:border-neutral-800",
              "text-neutral-600 dark:text-neutral-400",
              "hover:bg-neutral-50 dark:hover:bg-neutral-800",
              "disabled:opacity-50 transition-all"
            )}
          >
            <RefreshCw className={cn(
              "h-4 w-4",
              isRefreshing && "animate-spin"
            )} />
            Refresh
          </button>
        </div>
        
        {/* Dashboard Sections - Vertical Editorial Flow */}
        <div className="space-y-8">
          {/* 1. Best Bets - Hero Section (Full Width) */}
          <BestBetsSection />
          
          {/* 2. Popular Markets (Full Width, Hidden When Empty) */}
          <PopularMarketsSection />
          
          {/* 3. Risk-Free Arbitrage (Full Width) */}
          <ArbitrageSection />
          
          {/* 4. Data Signals - Supporting Content (2-Panel Grid) */}
          <DataSignalsSection />
        </div>
        
        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-center gap-6 text-xs text-neutral-400 dark:text-neutral-500">
            <span>Data refreshes automatically</span>
            <span>•</span>
            <span>Odds may vary by sportsbook</span>
            <span>•</span>
            <span>Gamble responsibly</span>
          </div>
        </div>
      </div>
    </div>
  );
}
