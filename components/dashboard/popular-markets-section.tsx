"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Sparkles, ChevronRight } from "lucide-react";
import Link from "next/link";

interface MarketPlay {
  player: string;
  team: string | null;
  line: number;
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent: number | null;
}

interface PopularMarket {
  marketKey: string;
  displayName: string;
  sport: string;
  icon: string;
  plays: MarketPlay[];
  edgeFinderUrl: string;
}

interface PopularMarketsResponse {
  markets: PopularMarket[];
  timestamp: number;
}

const SPORT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  nba: {
    bg: "bg-orange-50 dark:bg-orange-900/10",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-neutral-200 dark:border-neutral-800",
  },
  nfl: {
    bg: "bg-green-50 dark:bg-green-900/10",
    text: "text-green-600 dark:text-green-400",
    border: "border-neutral-200 dark:border-neutral-800",
  },
  nhl: {
    bg: "bg-blue-50 dark:bg-blue-900/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-neutral-200 dark:border-neutral-800",
  },
};

async function fetchPopularMarkets(): Promise<PopularMarketsResponse> {
  const response = await fetch("/api/dashboard/popular-markets");
  if (!response.ok) {
    throw new Error("Failed to fetch popular markets");
  }
  return response.json();
}

function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

export function PopularMarketsSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-popular-markets"],
    queryFn: fetchPopularMarkets,
    refetchInterval: 60000,
    staleTime: 30000,
  });
  
  const markets = data?.markets || [];
  
  // Don't render section if loading, error, or no markets
  if (isLoading || error || markets.length === 0) {
    return null;
  }
  
  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg",
            "bg-violet-500/10 dark:bg-violet-500/20"
          )}>
            <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Popular Markets
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Trending player props and specials
            </p>
          </div>
        </div>
      </div>
      
      {/* Horizontal Scrollable Markets */}
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {markets.map((market) => {
          const colors = SPORT_COLORS[market.sport] || SPORT_COLORS.nba;
          
          return (
            <Link
              key={market.marketKey}
              href={market.edgeFinderUrl}
              className={cn(
                "flex-shrink-0 w-64 p-4 rounded-lg border",
                "bg-white dark:bg-neutral-900",
                colors.border,
                "hover:border-neutral-300 dark:hover:border-neutral-700",
                "hover:shadow-sm transition-all group"
              )}
            >
              {/* Market Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{market.icon}</span>
                  <div>
                    <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                      {market.displayName}
                    </p>
                    <p className={cn("text-[10px] font-medium uppercase tracking-wide", colors.text)}>
                      {market.sport.toUpperCase()}
                    </p>
                  </div>
                </div>
                <ChevronRight className={cn(
                  "h-4 w-4 text-neutral-300 dark:text-neutral-600 group-hover:translate-x-0.5 transition-transform",
                  "group-hover:text-neutral-400"
                )} />
              </div>
              
              {/* Top Plays */}
              <div className="space-y-2">
                {market.plays.slice(0, 2).map((play, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-2.5 rounded-lg",
                      colors.bg
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {play.player}
                        </p>
                        {play.team && (
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase">
                            {play.team}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          play.bestOdds > 0 
                            ? "text-emerald-600 dark:text-emerald-400" 
                            : "text-neutral-700 dark:text-neutral-300"
                        )}>
                          {formatOdds(play.bestOdds)}
                        </span>
                        {play.evPercent !== null && play.evPercent > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            +{play.evPercent.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* View More */}
              <div className={cn(
                "mt-3 text-center text-xs font-medium",
                colors.text
              )}>
                View all {market.displayName}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
