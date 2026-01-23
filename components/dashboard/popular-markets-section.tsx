"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ArrowRight, Compass, ChevronRight, Flame } from "lucide-react";
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

// Sport-specific styling
const SPORT_STYLES: Record<string, { 
  iconBg: string; 
  iconColor: string; 
  accent: string;
  borderAccent: string;
}> = {
  nba: { 
    iconBg: "bg-orange-50 dark:bg-orange-900/20", 
    iconColor: "text-orange-500 dark:text-orange-400",
    accent: "from-orange-500/5 to-transparent",
    borderAccent: "hover:border-orange-300/50 dark:hover:border-orange-800/40"
  },
  nfl: { 
    iconBg: "bg-emerald-50 dark:bg-emerald-900/20", 
    iconColor: "text-emerald-600 dark:text-emerald-400",
    accent: "from-emerald-500/5 to-transparent",
    borderAccent: "hover:border-emerald-300/50 dark:hover:border-emerald-800/40"
  },
  nhl: { 
    iconBg: "bg-blue-50 dark:bg-blue-900/20", 
    iconColor: "text-blue-500 dark:text-blue-400",
    accent: "from-blue-500/5 to-transparent",
    borderAccent: "hover:border-blue-300/50 dark:hover:border-blue-800/40"
  },
  ncaab: { 
    iconBg: "bg-orange-50 dark:bg-orange-900/20", 
    iconColor: "text-orange-500 dark:text-orange-400",
    accent: "from-orange-500/5 to-transparent",
    borderAccent: "hover:border-orange-300/50 dark:hover:border-orange-800/40"
  },
  ncaaf: { 
    iconBg: "bg-emerald-50 dark:bg-emerald-900/20", 
    iconColor: "text-emerald-600 dark:text-emerald-400",
    accent: "from-emerald-500/5 to-transparent",
    borderAccent: "hover:border-emerald-300/50 dark:hover:border-emerald-800/40"
  },
};


// Premium Market Card Component
function MarketCard({ market, isTrending = false }: { market: PopularMarket; isTrending?: boolean }) {
  const plays = market.plays.slice(0, 2); // Show max 2 example edges
  const totalEdges = market.plays.length;
  const sportStyle = SPORT_STYLES[market.sport.toLowerCase()] || SPORT_STYLES.nba;
  
  return (
    <Link 
      href={market.edgeFinderUrl}
      className={cn(
        "group relative flex flex-col p-3 rounded-xl transition-all duration-200",
        // Allow badge to overflow
        "overflow-visible",
        // Subtle background with sport-specific gradient accent
        "bg-neutral-50/80 dark:bg-neutral-900/60",
        `bg-gradient-to-br ${sportStyle.accent}`,
        // Border with sport-specific hover accent
        "border border-neutral-200/80 dark:border-neutral-800/60",
        // Softer glow in light mode
        "hover:shadow-md hover:shadow-neutral-300/30 dark:hover:shadow-lg hover:-translate-y-0.5",
        sportStyle.borderAccent
      )}
    >
      {/* Trending Badge - Only on first card */}
      {isTrending && (
        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-0.5 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] font-bold uppercase tracking-wide shadow-md">
          <Flame className="w-2.5 h-2.5 fill-white" />
          Trending
        </div>
      )}
      
      {/* Card Header - Market identity */}
      <div className="flex items-center gap-2 mb-2">
        {/* Sport Icon with sport-specific tint */}
        <div className={cn(
          "flex items-center justify-center w-7 h-7 rounded-lg",
          sportStyle.iconBg
        )}>
          <SportIcon 
            sport={market.sport} 
            className={cn("w-4 h-4", sportStyle.iconColor)} 
          />
        </div>
        {/* Market Name + League Pill */}
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
            {market.displayName}
          </h3>
          {/* League as subtle pill */}
          <span className="text-[8px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
            {market.sport.toUpperCase()}
          </span>
        </div>
      </div>
      
      {/* Example Edges - 1-2 players, restructured layout */}
      <div className="flex-1 space-y-1.5 mb-2">
        {plays.length > 0 ? (
          plays.map((play, idx) => {
            const bookMeta = getSportsbookById(play.book);
            const bookLogo = bookMeta?.image?.light;
            
            return (
              <div 
                key={idx}
                className={cn(
                  "flex flex-col gap-1 py-2 px-2.5 rounded-lg",
                  "bg-white/80 dark:bg-neutral-800/40",
                  // Subtle row hover affordance
                  "transition-colors cursor-pointer",
                  "hover:bg-white dark:hover:bg-neutral-800/60"
                )}
              >
                {/* Top row: Player Name + Odds */}
                <div className="flex items-start justify-between gap-2">
                  {/* Player name - more prominent, 2-line wrap */}
                  <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 line-clamp-2 leading-snug">
                    {play.player}
                  </span>
                  
                  {/* Odds - right aligned */}
                  <span className="text-xs font-bold tabular-nums text-neutral-900 dark:text-neutral-100 shrink-0">
                    {play.bestOddsFormatted}
                  </span>
                </div>
                
                {/* Bottom row: EV pill + Book logo */}
                <div className="flex items-center justify-between">
                  {/* EV Pill - compact */}
                  {play.vsMarketAvg && play.vsMarketAvg > 0 ? (
                    <span className={cn(
                      "text-[9px] font-semibold text-emerald-600 dark:text-emerald-400",
                      "bg-emerald-50/80 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded",
                      // Subtle depth
                      "border border-emerald-200/40 dark:border-emerald-700/30"
                    )}>
                      +{play.vsMarketAvg.toFixed(0)}% vs Market
                    </span>
                  ) : (
                    <span />
                  )}
                  
                  {/* Book logo - small, right aligned */}
                  {bookLogo && (
                    <img 
                      src={bookLogo} 
                      alt="" 
                      className="h-3 w-auto object-contain opacity-50" 
                    />
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex items-center justify-center py-3 text-[10px] text-neutral-400">
            No edges found
          </div>
        )}
      </div>
      
      {/* Card Footer - CTA + Edge count */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-200/60 dark:border-neutral-800/40">
        <span className="text-[8px] text-neutral-500 dark:text-neutral-400">
          {totalEdges > 0 ? `${totalEdges} active edge${totalEdges !== 1 ? 's' : ''}` : 'Scanning...'}
        </span>
        {/* Consistent CTA styling */}
        <div className="flex items-center gap-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 transition-colors">
          <span>View all</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

// Loading skeleton for market card
function MarketCardSkeleton() {
  return (
    <div className={cn(
      "flex flex-col p-3 rounded-xl animate-pulse",
      "bg-neutral-50/80 dark:bg-neutral-900/60",
      "border border-neutral-200/80 dark:border-neutral-800/60"
    )}>
      {/* Header skeleton */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-20 bg-neutral-100 dark:bg-neutral-800 rounded" />
          <div className="h-2 w-10 bg-neutral-100 dark:bg-neutral-800 rounded" />
        </div>
      </div>
      {/* Plays skeleton */}
      <div className="space-y-1.5 mb-2">
        <div className="h-8 bg-white/60 dark:bg-neutral-800/40 rounded-md" />
        <div className="h-8 bg-white/60 dark:bg-neutral-800/40 rounded-md" />
      </div>
      {/* Footer skeleton */}
      <div className="flex justify-between pt-2 border-t border-neutral-200/60 dark:border-neutral-800/40">
        <div className="h-2 w-16 bg-neutral-100 dark:bg-neutral-800 rounded" />
        <div className="h-2 w-12 bg-neutral-100 dark:bg-neutral-800 rounded" />
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
    <section className={cn(
      "h-full flex flex-col relative group/bento rounded-xl",
      // Amber/orange gradient for Edge Finder branding
      "bg-gradient-to-br from-amber-50/40 via-transparent to-orange-50/20",
      "dark:from-amber-950/20 dark:via-transparent dark:to-orange-950/10"
    )}>
      {/* Market Cards Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-visible scrollbar-hide pb-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {[1, 2, 3, 4].map((i) => (
              <MarketCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-neutral-500">Unable to load markets</p>
          </div>
        ) : markets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8">
            <Compass className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mb-2" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Markets updating</p>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-500">Check back soon</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {markets.slice(0, 6).map((market, index) => (
              <MarketCard 
                key={market.marketKey} 
                market={market} 
                isTrending={index === 0 && market.plays.length > 0 && (market.plays[0]?.vsMarketAvg || 0) >= 30}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer - Section title with hover animation */}
      <div className="mt-auto pt-3 px-1 flex items-center justify-between transition duration-200 group-hover/bento:translate-x-2 border-t border-amber-100/50 dark:border-amber-900/30">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "flex items-center justify-center w-7 h-7 rounded-lg shadow-sm",
            // Amber/orange gradient for Edge Finder
            "bg-gradient-to-br from-amber-500 to-orange-500"
          )}>
            <Compass className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
              Popular Markets
            </h2>
            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 font-medium">
              Discovery hub • Fun props
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
    </section>
  );
}
