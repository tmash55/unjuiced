"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Compass, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { SportIcon } from "@/components/icons/sport-icons";

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

// Sport-specific accent colors for the icon
const SPORT_ICON_COLORS: Record<string, string> = {
  nba: "text-orange-400",
  nfl: "text-emerald-400",
  nhl: "text-blue-400",
  ncaab: "text-orange-400",
  ncaaf: "text-emerald-400",
};


// Premium Market Card Component - Light/Dark responsive
function MarketCard({ market }: { market: PopularMarket }) {
  const plays = market.plays.slice(0, 2); // Show max 2 example edges
  const iconColor = SPORT_ICON_COLORS[market.sport.toLowerCase()] || "text-orange-400";
  
  return (
    <Link 
      href={market.edgeFinderUrl}
      className={cn(
        "group relative flex flex-col rounded-xl transition-all duration-300",
        "bg-white dark:bg-neutral-900",
        "border border-neutral-200 dark:border-neutral-800",
        "hover:ring-1 hover:ring-amber-500/30",
        "hover:shadow-lg hover:shadow-amber-500/10 dark:hover:shadow-amber-500/5"
      )}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
        <div className="flex items-center gap-2">
          {/* Sport Icon */}
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800">
            <SportIcon 
              sport={market.sport} 
              className={cn("w-4 h-4", iconColor)} 
            />
          </div>
          {/* Market Name */}
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">
            {market.displayName}
          </h3>
        </div>
        {/* League Pill */}
        <span className="text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
          {market.sport.toUpperCase()}
        </span>
      </div>
      
      {/* Player Rows */}
      <div className="flex-1 px-3 py-2 space-y-2">
        {plays.length > 0 ? (
          plays.map((play, idx) => {
            const bookMeta = getSportsbookById(play.book);
            const bookLogo = bookMeta?.image?.light;
            
            return (
              <div 
                key={idx}
                className="flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {/* Left: Player + EV Badge */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate block">
                    {play.player}
                  </span>
                  {/* EV Pill */}
                  {play.vsMarketAvg && play.vsMarketAvg > 0 ? (
                    <span className="inline-flex items-center mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-500/20">
                      +{play.vsMarketAvg.toFixed(0)}% vs Market
                    </span>
                  ) : null}
                </div>
                
                {/* Right: Odds + Book Logo */}
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-base font-bold tabular-nums text-neutral-900 dark:text-white">
                    {play.bestOddsFormatted}
                  </span>
                  {bookLogo && (
                    <img 
                      src={bookLogo} 
                      alt="" 
                      className="h-4 w-4 object-contain mt-1 rounded opacity-70" 
                    />
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-center py-4 text-xs text-neutral-500">
            <Sparkles className="w-4 h-4 mr-1.5" />
            Scanning markets...
          </div>
        )}
      </div>
      
    </Link>
  );
}

// Loading skeleton for market card - Light/Dark responsive
function MarketCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 animate-pulse overflow-hidden">
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-4 w-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
        <div className="h-4 w-10 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
      </div>
      {/* Plays skeleton */}
      <div className="px-3 py-2 space-y-2">
        <div className="h-14 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg" />
        <div className="h-14 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg" />
      </div>
    </div>
  );
}

export function PopularMarketsSection() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-popular-markets"],
    queryFn: fetchPopularMarkets,
    refetchInterval: 60000,
  });

  const markets = data?.markets || [];
  
  return (
    <section className="h-full flex flex-col relative group/bento rounded-xl">
      {/* Header with hover animation */}
      <div className="flex items-center justify-between px-1 py-2 transition duration-200 group-hover/bento:translate-x-2">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "flex items-center justify-center w-7 h-7 rounded-lg shadow-sm",
            "bg-gradient-to-br from-amber-500 to-orange-500"
          )}>
            <Compass className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <span className="font-bold text-neutral-800 dark:text-neutral-100 text-sm">Popular Markets</span>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
              Longshot props • Fun bets
            </p>
          </div>
        </div>
        
        <Link
          href="/edge-finder"
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
            "text-amber-700 dark:text-amber-300",
            "bg-amber-50 dark:bg-amber-900/30",
            "hover:bg-amber-100 dark:hover:bg-amber-900/50",
            "border border-amber-200/50 dark:border-amber-700/30"
          )}
        >
          Edge Finder
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Market Cards Grid - padding to prevent hover ring clipping */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-1 py-1">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <MarketCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-neutral-500">Unable to load markets</p>
          </div>
        ) : markets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 rounded-xl bg-neutral-900/50">
            <Sparkles className="w-8 h-8 text-amber-500/50 mb-2" />
            <p className="text-sm text-neutral-300 font-medium">Markets updating</p>
            <p className="text-[10px] text-neutral-500">Check back soon</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {markets.slice(0, 4).map((market) => (
              <MarketCard 
                key={market.marketKey} 
                market={market} 
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
