"use client";

import { useQuery } from "@tanstack/react-query";
import { BetCard } from "./bet-card";
import { useIsPro } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";
import { ChevronRight, Lock, Trophy } from "lucide-react";
import Link from "next/link";

interface BestBet {
  id: string;
  player: string;
  team: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  market: string;
  marketDisplay: string;
  line: number;
  side: "over" | "under";
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent: number | null;
  edgePercent: number | null;
  kelly: number | null;
  fairOdds: number | null;
  devigMethod: string | null;
  deepLink?: string | null;
  sport: string;
  startTime?: string | null;
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

// Skeleton card for loading states
function SkeletonCard() {
  return (
    <div className={cn(
      "rounded-xl border border-neutral-200 dark:border-neutral-800",
      "bg-white dark:bg-neutral-900 p-4",
      "animate-pulse h-full"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-12 bg-neutral-100 dark:bg-neutral-800 rounded" />
        <div className="h-3 w-14 bg-neutral-100 dark:bg-neutral-800 rounded" />
      </div>
      <div className="flex items-start gap-2 mb-3">
        <div className="w-5 h-5 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-neutral-100 dark:bg-neutral-800 rounded" />
          <div className="h-3 w-24 bg-neutral-100 dark:bg-neutral-800 rounded" />
        </div>
      </div>
      <div className="h-10 w-full bg-neutral-50 dark:bg-neutral-800/50 rounded-lg mb-3" />
      <div className="h-8 w-full bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
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
  
  // Pro users see all (up to 9), others see first 3
  const visibleBets = isPro ? bets : bets.slice(0, 3);
  const hiddenCount = isPro ? 0 : Math.max(0, bets.length - 3);
  
  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-9 h-9 rounded-lg",
            "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/20"
          )}>
            <Trophy className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              Today's Best Bets
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Top +EV opportunities • Devigged to Pinnacle
            </p>
          </div>
        </div>
        
        <Link
          href="/positive-ev"
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium",
            "text-neutral-500 dark:text-neutral-400",
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <div className={cn(
          "py-10 text-center rounded-xl border border-dashed",
          "border-neutral-200 dark:border-neutral-800",
          "bg-neutral-50/50 dark:bg-neutral-900/50"
        )}>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">
            Unable to load opportunities
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            Please try refreshing the page
          </p>
        </div>
      ) : bets.length === 0 ? (
        <div className={cn(
          "py-10 text-center rounded-xl border border-dashed",
          "border-neutral-200 dark:border-neutral-800",
          "bg-neutral-50/50 dark:bg-neutral-900/50"
        )}>
          <p className="text-neutral-600 dark:text-neutral-300 text-sm font-medium">
            Markets are updating
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Best bets refresh throughout the day
          </p>
        </div>
      ) : (
        <>
          {/* Bet Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-fr">
            {visibleBets.map((bet, index) => {
              // First card gets featured styling (gradient bg, not larger)
              const isHero = index === 0;
              
              // Narrative badge logic
              let badgeText = undefined;
              if (isHero) badgeText = "Top Value";
              else if (bet.kelly && bet.kelly > 0.04) badgeText = "High Conf";
              else if (bet.evPercent && bet.evPercent > 6) badgeText = "Strong";
              
              return (
                <BetCard
                  key={bet.id}
                  player={bet.player}
                  team={bet.team}
                  homeTeam={bet.homeTeam}
                  awayTeam={bet.awayTeam}
                  market={bet.market}
                  marketDisplay={bet.marketDisplay}
                  line={bet.line}
                  side={bet.side}
                  bestOdds={bet.bestOdds}
                  bestOddsFormatted={bet.bestOddsFormatted}
                  book={bet.book}
                  evPercent={bet.evPercent}
                  edgePercent={bet.edgePercent}
                  kelly={bet.kelly}
                  fairOdds={bet.fairOdds}
                  devigMethod={bet.devigMethod}
                  deepLink={bet.deepLink}
                  startTime={bet.startTime}
                  sport={bet.sport}
                  isPro={isPro}
                  isFeatured={isHero}
                  compact={!isHero}
                  badgeText={badgeText}
                />
              );
            })}
          </div>
          
          {/* Upgrade prompt for non-pro users */}
          {!isPro && hiddenCount > 0 && (
            <div className="relative mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 blur-sm pointer-events-none select-none opacity-30">
                {bets.slice(3, 6).map((bet) => (
                  <BetCard
                    key={`blur-${bet.id}`}
                    player={bet.player}
                    team={bet.team}
                    homeTeam={bet.homeTeam}
                    awayTeam={bet.awayTeam}
                    market={bet.market}
                    marketDisplay={bet.marketDisplay}
                    line={bet.line}
                    side={bet.side}
                    bestOdds={bet.bestOdds}
                    bestOddsFormatted={bet.bestOddsFormatted}
                    book={bet.book}
                    evPercent={bet.evPercent}
                    edgePercent={bet.edgePercent}
                    sport={bet.sport}
                    isPro={false}
                    compact={true}
                  />
                ))}
              </div>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={cn(
                  "flex flex-col items-center gap-3 p-6 rounded-xl",
                  "bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm",
                  "border border-neutral-200 dark:border-neutral-700 shadow-xl"
                )}>
                  <div className="p-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <Lock className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                      +{hiddenCount} more bets
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 max-w-[200px]">
                      Unlock all +EV bets, arbs, and signals
                    </p>
                  </div>
                  <Link
                    href="/subscribe"
                    className={cn(
                      "px-5 py-2 rounded-lg text-sm font-bold",
                      "bg-neutral-900 dark:bg-white",
                      "text-white dark:text-neutral-900",
                      "hover:bg-neutral-800 dark:hover:bg-neutral-100",
                      "transition-all shadow-md"
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
