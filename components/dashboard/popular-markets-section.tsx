"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { getSportsbookById } from "@/lib/data/sportsbooks";

interface MarketPlay {
  player: string;
  team: string | null;
  line: number;
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent: number | null;
  marketAvg: number | null;
  marketAvgFormatted: string | null;
  vsMarketAvg: number | null;
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

async function fetchPopularMarkets(): Promise<PopularMarketsResponse> {
  const response = await fetch("/api/dashboard/popular-markets");
  if (!response.ok) {
    throw new Error("Failed to fetch popular markets");
  }
  return response.json();
}

const SPORT_COLORS: Record<string, { 
  bg: string; 
  border: string; 
  text: string; 
  iconBg: string; 
  hoverBorder: string;
}> = {
  nba: { 
    bg: "bg-orange-50/50 dark:bg-orange-950/10", 
    border: "border-orange-100 dark:border-orange-900/20", 
    text: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-100 dark:bg-orange-900/40",
    hoverBorder: "hover:border-orange-200 dark:hover:border-orange-800/40"
  },
  nfl: { 
    bg: "bg-green-50/50 dark:bg-green-950/10", 
    border: "border-green-100 dark:border-green-900/20", 
    text: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-900/40",
    hoverBorder: "hover:border-green-200 dark:hover:border-green-800/40"
  },
  nhl: { 
    bg: "bg-blue-50/50 dark:bg-blue-950/10", 
    border: "border-blue-100 dark:border-blue-900/20", 
    text: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
    hoverBorder: "hover:border-blue-200 dark:hover:border-blue-800/40"
  },
};

export function PopularMarketsSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-popular-markets"],
    queryFn: fetchPopularMarkets,
    refetchInterval: 60000,
  });

  const markets = data?.markets || [];
  
  // Hide section entirely if no data
  if (!isLoading && !error && markets.length === 0) {
    return null;
  }

  if (error) return null;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            Popular Markets
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Trending props and lines happening soon
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading ? (
          // Skeletons
          [1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
          ))
        ) : (
          markets.map((market) => {
            const colors = SPORT_COLORS[market.sport] || SPORT_COLORS.nba;
            
            return (
              <div 
                key={market.marketKey}
                className={cn(
                  "group flex flex-col justify-between rounded-xl border transition-all duration-300",
                  "bg-white dark:bg-neutral-900", // Clean base
                  colors.border,
                  colors.hoverBorder,
                  "hover:shadow-lg hover:-translate-y-1 hover:shadow-neutral-100 dark:hover:shadow-black/20"
                )}
              >
                {/* Header: Icon + Market + League */}
                <div className={cn("px-4 py-3 border-b border-dashed", colors.border)}>
                  <div className="flex items-center gap-2.5">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-sm", colors.iconBg)}>
                      {market.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-none">
                        {market.displayName}
                      </h3>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider mt-0.5 block", colors.text)}>
                        {market.sport.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Content: Plays */}
                <div className="p-4 space-y-4 flex-1">
                  {market.plays.slice(0, 2).map((play, idx) => {
                    const bookMeta = getSportsbookById(play.book);
                    const bookLogo = bookMeta?.image?.light;
                    const teamLogo = play.team ? getTeamLogoUrl(play.team, market.sport) : null;
                    
                    return (
                      <div key={idx} className="space-y-1.5">
                        {/* Player + Team Logo */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                            {play.player}
                          </span>
                          {teamLogo && (
                            <img 
                              src={teamLogo} 
                              alt={play.team || ""} 
                              className="w-4 h-4 object-contain opacity-70 grayscale group-hover:grayscale-0 transition-all" 
                            />
                          )}
                        </div>

                        {/* Odds + Book + vs Market Avg */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Odds Pill */}
                          <div className={cn(
                            "flex items-center gap-2 px-2 py-1 rounded-md border",
                            "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                          )}>
                            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                              {play.bestOddsFormatted}
                            </span>
                            {/* Inline Book Logo */}
                            {bookLogo && (
                              <img 
                                src={bookLogo} 
                                alt={play.book} 
                                className="h-4 w-auto object-contain opacity-80 group-hover:opacity-100 transition-opacity" 
                              />
                            )}
                          </div>
                          
                          {/* vs Market Avg Badge */}
                          {play.vsMarketAvg && play.vsMarketAvg > 0 && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                              <TrendingUp className="w-3 h-3" />
                              +{play.vsMarketAvg}% vs Avg
                            </div>
                          )}
                        </div>

                        {/* Market Avg Line - Trust Builder */}
                        {play.marketAvgFormatted && (
                          <div className="flex items-center gap-2 text-[10px] text-neutral-400 pl-0.5">
                            <span>Market Avg: <span className="font-medium text-neutral-500 dark:text-neutral-400">{play.marketAvgFormatted}</span></span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer: View All */}
                <Link 
                  href={market.edgeFinderUrl}
                  className={cn(
                    "px-4 py-2.5 text-xs font-medium border-t flex items-center justify-between transition-colors rounded-b-xl",
                    colors.border,
                    "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200",
                    "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  View all props
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
