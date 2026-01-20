"use client";

import { useQuery } from "@tanstack/react-query";
import { BetCard } from "./bet-card";
import { useIsPro } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";
import { TrendingUp, ChevronRight, Loader2, Lock } from "lucide-react";
import Link from "next/link";

interface BestBet {
  id: string;
  player: string;
  team: string | null;
  market: string;
  marketDisplay: string;
  line: number;
  side: "over" | "under";
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent: number | null;
  edgePercent: number | null;
  sport: string;
}

interface BestBetsResponse {
  bets: BestBet[];
  timestamp: number;
}

async function fetchBestBets(): Promise<BestBetsResponse> {
  const response = await fetch("/api/dashboard/best-bets");
  if (!response.ok) {
    throw new Error("Failed to fetch best bets");
  }
  return response.json();
}

// Skeleton card for loading/empty states - matches existing tool styling
function SkeletonCard() {
  return (
    <div className={cn(
      "rounded-lg border border-neutral-200 dark:border-neutral-800",
      "bg-white dark:bg-neutral-900 p-4",
      "animate-pulse"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-12 bg-neutral-100 dark:bg-neutral-800 rounded" />
        <div className="h-4 w-16 bg-neutral-100 dark:bg-neutral-800 rounded" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-5 w-32 bg-neutral-100 dark:bg-neutral-800 rounded" />
        <div className="h-3 w-12 bg-neutral-100 dark:bg-neutral-800 rounded" />
      </div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-16 bg-neutral-100 dark:bg-neutral-800 rounded" />
          <div className="h-5 w-14 bg-neutral-100 dark:bg-neutral-800 rounded" />
        </div>
        <div className="h-6 w-14 bg-neutral-100 dark:bg-neutral-800 rounded" />
      </div>
      <div className="h-10 w-full bg-neutral-50 dark:bg-neutral-800/50 rounded-lg" />
    </div>
  );
}

export function BestBetsSection() {
  const { isPro, isLoading: isLoadingPlan } = useIsPro();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-best-bets"],
    queryFn: fetchBestBets,
    refetchInterval: 30000,
    staleTime: 15000,
  });
  
  const bets = data?.bets || [];
  
  // Pro users see all, others see first 3
  const visibleBets = isPro ? bets : bets.slice(0, 3);
  const hiddenCount = isPro ? 0 : Math.max(0, bets.length - 3);
  
  return (
    <section className="space-y-4">
      {/* Header - Matches tool page headers */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg",
            "bg-emerald-500/10 dark:bg-emerald-500/20"
          )}>
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Today's Best Bets
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Highest expected value across all sports
            </p>
          </div>
        </div>
        
        <Link
          href="/edge-finder"
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
      
      {/* Content */}
      {isLoading || isLoadingPlan ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <div className={cn(
          "py-12 text-center rounded-lg border",
          "border-neutral-200 dark:border-neutral-800",
          "bg-neutral-50 dark:bg-neutral-900"
        )}>
          <p className="text-neutral-500 dark:text-neutral-400">
            Unable to load opportunities
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            Please try refreshing the page
          </p>
        </div>
      ) : bets.length === 0 ? (
        <div className={cn(
          "rounded-lg border border-neutral-200 dark:border-neutral-800",
          "bg-white dark:bg-neutral-900 p-6"
        )}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 opacity-30">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="text-center">
            <p className="text-neutral-600 dark:text-neutral-300 font-medium">
              Markets are updating
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Best bets refresh throughout the day as new opportunities appear
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Bet Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleBets.map((bet) => (
              <BetCard
                key={bet.id}
                player={bet.player}
                team={bet.team}
                market={bet.market}
                marketDisplay={bet.marketDisplay}
                line={bet.line}
                side={bet.side}
                bestOdds={bet.bestOdds}
                bestOddsFormatted={bet.bestOddsFormatted}
                book={bet.book}
                evPercent={bet.evPercent}
                edgePercent={bet.edgePercent}
                sport={bet.sport as "nba" | "nfl" | "nhl"}
                isPro={isPro}
              />
            ))}
          </div>
          
          {/* Upgrade prompt for non-pro users */}
          {!isPro && hiddenCount > 0 && (
            <div className="relative">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 blur-sm pointer-events-none select-none opacity-50">
                {bets.slice(3, 6).map((bet) => (
                  <BetCard
                    key={bet.id}
                    player={bet.player}
                    team={bet.team}
                    market={bet.market}
                    marketDisplay={bet.marketDisplay}
                    line={bet.line}
                    side={bet.side}
                    bestOdds={bet.bestOdds}
                    bestOddsFormatted={bet.bestOddsFormatted}
                    book={bet.book}
                    evPercent={bet.evPercent}
                    edgePercent={bet.edgePercent}
                    sport={bet.sport as "nba" | "nfl" | "nhl"}
                    isPro={false}
                  />
                ))}
              </div>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={cn(
                  "flex flex-col items-center gap-3 p-6 rounded-lg",
                  "bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm",
                  "border border-neutral-200 dark:border-neutral-700 shadow-lg"
                )}>
                  <div className="p-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <Lock className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">
                      {hiddenCount} more opportunities
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Upgrade to Pro for full access
                    </p>
                  </div>
                  <Link
                    href="/subscribe"
                    className={cn(
                      "px-5 py-2 rounded-lg text-sm font-semibold",
                      "bg-neutral-900 dark:bg-white",
                      "text-white dark:text-neutral-900",
                      "hover:bg-neutral-800 dark:hover:bg-neutral-100",
                      "transition-colors"
                    )}
                  >
                    Upgrade to Pro
                  </Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
