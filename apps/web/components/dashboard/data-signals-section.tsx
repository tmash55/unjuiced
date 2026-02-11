"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { BarChart3, UserMinus, ChevronRight, Loader2, TrendingUp, Zap } from "lucide-react";
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

interface InjuryBoost {
  playerId: number;
  playerName: string;
  team: string;
  market: string;
  marketDisplay: string;
  boostReason: string;
  avgWithout: number;
  avgWith: number;
  usageDelta: number;
  profileUrl: string;
}

interface SignalsResponse {
  hitRates: HitRateSignal[];
  injuryBoosts: InjuryBoost[];
  timestamp: number;
}

async function fetchSignals(): Promise<SignalsResponse> {
  const response = await fetch("/api/dashboard/signals");
  if (!response.ok) {
    throw new Error("Failed to fetch signals");
  }
  return response.json();
}

export function DataSignalsSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-signals"],
    queryFn: fetchSignals,
    refetchInterval: 60000,
    staleTime: 30000,
  });
  
  const hitRates = data?.hitRates || [];
  const injuryBoosts = data?.injuryBoosts || [];
  
  const hasData = hitRates.length > 0 || injuryBoosts.length > 0;
  
  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg",
            "bg-amber-500/10 dark:bg-amber-500/20"
          )}>
            <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Data Signals
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Statistical insights and injury impacts
            </p>
          </div>
        </div>
        
        <Link
          href="/hit-rates/nba"
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium",
            "text-neutral-600 dark:text-neutral-400",
            "hover:bg-neutral-100 dark:hover:bg-neutral-800",
            "transition-colors"
          )}
        >
          View All
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      
      {/* Content - 2-Panel Grid with Quiet, Matte Finish */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        </div>
      ) : error || !hasData ? (
        <div className={cn(
          "py-8 text-center rounded-lg border",
          "border-neutral-200 dark:border-neutral-800",
          "bg-neutral-50 dark:bg-neutral-900"
        )}>
          <p className="text-neutral-400 dark:text-neutral-500 text-sm">
            {error ? "Unable to load signals" : "No signals available"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Hit Rates Panel */}
          <div className={cn(
            "p-5 rounded-xl border",
            "bg-neutral-50 dark:bg-neutral-900/50", // Matte background
            "border-neutral-200 dark:border-neutral-800"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">
                Top Hit Rates
              </h3>
            </div>
            
            {hitRates.length === 0 ? (
              <p className="py-4 text-center text-xs text-neutral-400">
                No high hit rates found
              </p>
            ) : (
              <div className="space-y-2">
                {hitRates.map((signal) => (
                  <Link
                    key={`${signal.playerId}-${signal.market}`}
                    href={signal.profileUrl}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-all duration-200",
                      "bg-white dark:bg-neutral-900", // Card-like, but flatter
                      "border-neutral-200/60 dark:border-neutral-800",
                      "hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {signal.playerName}
                        </p>
                        <span className="text-[10px] text-neutral-400 uppercase font-medium">
                          {signal.team}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {signal.marketDisplay} O {signal.line}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {signal.streak && signal.streak >= 5 && (
                        <div className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                          <Zap className="h-3 w-3 fill-current" />
                          {signal.streak}
                        </div>
                      )}
                      <div className={cn(
                        "text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400"
                      )}>
                        {signal.l10Pct}%
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          
          {/* Injury Boosts Panel */}
          <div className={cn(
            "p-5 rounded-xl border",
            "bg-neutral-50 dark:bg-neutral-900/50", // Matte background
            "border-neutral-200 dark:border-neutral-800"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <UserMinus className="h-4 w-4 text-rose-500" />
              <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">
                Injury Boosts
              </h3>
            </div>
            
            {injuryBoosts.length === 0 ? (
              <p className="py-4 text-center text-xs text-neutral-400">
                No significant injury impacts found
              </p>
            ) : (
              <div className="space-y-2">
                {injuryBoosts.map((boost) => (
                  <Link
                    key={`${boost.playerId}-${boost.market}`}
                    href={boost.profileUrl}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-all duration-200",
                      "bg-white dark:bg-neutral-900",
                      "border-neutral-200/60 dark:border-neutral-800",
                      "hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {boost.playerName}
                        </p>
                        <span className="text-[10px] text-neutral-400 uppercase font-medium">
                          {boost.team}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                        {boost.boostReason} out
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
                        +{boost.usageDelta.toFixed(1)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
