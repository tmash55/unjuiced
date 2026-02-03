"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsPro } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";
import { ChevronRight, Lock, Trophy, ChevronDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getSportsbookById } from "@/lib/data/sportsbooks";

interface BestBet {
  id: string;
  player: string;
  team: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  market: string;
  marketDisplay: string;
  line: number;
  side: "over" | "under";
  bestOdds: number;
  bestOddsFormatted: string;
  book: string;
  evPercent: number;
  fairProb: number | null;
  fairOdds: number | null;
  fairOddsFormatted: string | null;
  u: string | null;
  m: string | null;
  deepLink: string | null;
  sport: string;
  startTime: string | null;
}

interface BestBetsResponse {
  bets: BestBet[];
  timestamp: number;
  source: "l1_cache" | "redis_cache" | "computed";
}

async function fetchBestBets(): Promise<BestBetsResponse> {
  const response = await fetch("/api/dashboard/best-bets?limit=10");
  if (!response.ok) {
    throw new Error("Failed to fetch best bets");
  }
  return response.json();
}

const SPORT_LABEL: Record<string, string> = {
  nba: "NBA",
  nfl: "NFL",
  nhl: "NHL",
  mlb: "MLB",
  ncaab: "NCAAB",
  ncaaf: "NCAAF",
};

// Detect if user is on mobile device
function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         window.innerWidth < 768;
}

// Get the best link based on device type
function getBetLink(bet: BestBet): string | null {
  if (isMobile() && bet.m) return bet.m;
  return bet.u || bet.deepLink || null;
}

// Generate the insight text - the "why"
function getInsightText(bet: BestBet): string {
  if (bet.fairOddsFormatted && bet.bestOddsFormatted) {
    // Calculate the edge in cents
    const fairOdds = bet.fairOdds || 0;
    const bestOdds = bet.bestOdds || 0;
    
    // Show the misprice narrative
    if (fairOdds !== 0 && bestOdds !== 0) {
      const diff = Math.abs(fairOdds - bestOdds);
      if (diff >= 10) {
        return `Fair ${bet.fairOddsFormatted} → Market ${bet.bestOddsFormatted}`;
      }
    }
  }
  
  // Fallback to EV narrative
  return `+${bet.evPercent.toFixed(1)}% edge vs Pinnacle`;
}

// Premium Bet Row Component - Mobile-first responsive
function BetRow({ bet }: { bet: BestBet }) {
  const bookMeta = getSportsbookById(bet.book);
  const bookLogo = bookMeta?.image?.light;
  const bookName = bookMeta?.name || bet.book;
  const betLink = getBetLink(bet);
  const sportLabel = SPORT_LABEL[bet.sport.toLowerCase()] || bet.sport.toUpperCase();
  const insight = getInsightText(bet);

  return (
    <div className={cn(
      "group relative rounded-lg sm:rounded-xl overflow-hidden transition-all duration-300 mb-2 sm:mb-3",
      "bg-white dark:bg-neutral-900",
      "border border-neutral-200 dark:border-neutral-800",
      "hover:ring-1 hover:ring-emerald-500/30",
      "hover:shadow-lg hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/5"
    )}>
      {/* Main Content Row */}
      <div className="flex items-stretch">
        {/* EV Badge Column - Prominent visual anchor */}
        <div className="flex items-center justify-center px-2.5 sm:px-4 py-3 sm:py-4 bg-emerald-50 dark:bg-emerald-500/10 border-r border-emerald-200 dark:border-emerald-500/20">
          <div className="text-center">
            <span className="text-base sm:text-xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">
              {bet.evPercent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Context Column - Player & Market Info */}
        <div className="flex-1 min-w-0 px-2.5 sm:px-4 py-2.5 sm:py-3 flex flex-col justify-center">
          {/* Player Name + Sport */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white truncate">
              {bet.player}
            </span>
            <span className="text-[9px] sm:text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide shrink-0">
              {sportLabel}
            </span>
          </div>
          
          {/* Market + Line */}
          <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
            <span className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {bet.marketDisplay}
            </span>
            <span className={cn(
              "text-xs sm:text-sm font-bold shrink-0",
              bet.side === "over" 
                ? "text-emerald-600 dark:text-emerald-400" 
                : "text-rose-600 dark:text-rose-400"
            )}>
              {bet.side === "over" ? "O" : "U"} {bet.line}
            </span>
          </div>
          
          {/* Insight - Hidden on mobile to save space */}
          <div className="mt-1.5 sm:mt-2 hidden sm:block">
            <span className="text-[11px] text-neutral-500 italic">
              {insight}
            </span>
          </div>
        </div>

        {/* Action Column - Book, Odds & CTA */}
        <div className="flex flex-col items-end justify-center sm:justify-between px-2.5 sm:px-4 py-2.5 sm:py-3 shrink-0">
          {/* Book Logo + Odds */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {bookLogo && (
              <img 
                src={bookLogo} 
                alt={bookName} 
                className="h-4 w-4 sm:h-5 sm:w-5 object-contain rounded" 
              />
            )}
            <span className="text-base sm:text-lg font-bold tabular-nums text-neutral-900 dark:text-white">
              {bet.bestOddsFormatted}
            </span>
          </div>
          
          {/* CTA Button - Smaller on mobile */}
          {betLink ? (
            <a
              href={betLink}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-1.5 sm:py-2 mt-1.5 sm:mt-2 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold transition-all",
                "bg-emerald-500 text-white",
                "hover:bg-emerald-400",
                "active:scale-[0.97]"
              )}
            >
              Bet
              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </a>
          ) : (
            <div className="flex items-center gap-1.5 px-4 py-2 mt-2 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
              <Lock className="w-3 h-3" />
              <span>Link</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Locked Bet Row for non-pro users - Light/Dark responsive
function LockedBetRow() {
  return (
    <div className={cn(
      "relative rounded-xl overflow-hidden mb-3",
      "bg-neutral-100/60 dark:bg-neutral-900/60",
      "border border-dashed border-neutral-300 dark:border-neutral-700/50"
    )}>
      {/* Blurred content mimicking the row layout */}
      <div className="flex items-stretch opacity-40 blur-[3px]">
        {/* EV Badge area */}
        <div className="flex items-center justify-center px-4 py-4 bg-neutral-200/50 dark:bg-neutral-800/50 border-r border-neutral-300/30 dark:border-neutral-700/30">
          <span className="text-xl font-black tabular-nums text-neutral-400 dark:text-neutral-500 leading-none">?.?%</span>
        </div>
        
        {/* Content area */}
        <div className="flex-1 min-w-0 px-4 py-3">
          <div className="h-4 w-28 bg-neutral-300 dark:bg-neutral-700 rounded mb-2" />
          <div className="h-3 w-20 bg-neutral-200 dark:bg-neutral-800 rounded mb-2" />
          <div className="h-2 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
        
        {/* Action area */}
        <div className="flex flex-col items-end justify-between px-4 py-3">
          <div className="h-5 w-14 bg-neutral-300 dark:bg-neutral-700 rounded" />
          <div className="h-8 w-16 bg-neutral-200 dark:bg-neutral-800 rounded-lg mt-2" />
        </div>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-neutral-900/30">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/95 dark:bg-neutral-800/95 border border-neutral-200 dark:border-neutral-700 shadow-sm">
          <Lock className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
          <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Sharp Only</span>
        </div>
      </div>
    </div>
  );
}

export function BestBetsSection() {
  const { isPro, isLoading: isLoadingPlan } = useIsPro();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollArrow, setShowScrollArrow] = useState(false);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-best-bets"],
    queryFn: fetchBestBets,
    refetchInterval: 30000,
    staleTime: 15000,
  });
  
  const bets = data?.bets || [];
  
  // Sharp users see all (up to 10), others see first 2 + locked previews
  const visibleBets = isPro ? bets.slice(0, 10) : bets.slice(0, 2);
  const hiddenCount = isPro ? 0 : Math.max(0, bets.length - 2);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollArrow(scrollHeight > clientHeight && scrollTop + clientHeight < scrollHeight - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [visibleBets]);

  const handleScrollDown = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ top: 150, behavior: "smooth" });
    }
  };
  
  return (
    <section className="h-full flex flex-col relative group/bento">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className={cn(
            "flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg shadow-sm",
            "bg-gradient-to-br from-emerald-500 to-teal-600"
          )}>
            <Trophy className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
          </div>
          <div>
            <span className="font-bold text-neutral-800 dark:text-neutral-100 text-xs sm:text-sm">Best Bets</span>
            <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:block">
              +EV edges • Devigged vs Pinnacle
            </p>
          </div>
        </div>
        
        <Link
          href="/positive-ev"
          className={cn(
            "flex items-center gap-0.5 sm:gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-semibold transition-all",
            "text-emerald-700 dark:text-emerald-300",
            "bg-emerald-50 dark:bg-emerald-900/30",
            "hover:bg-emerald-100 dark:hover:bg-emerald-900/50",
            "border border-emerald-200/50 dark:border-emerald-700/30"
          )}
        >
          View All
          <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
        </Link>
      </div>

      {/* Content - padding to prevent hover ring clipping */}
      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex-1 min-h-0 overflow-y-auto px-1 scrollbar-hide pt-1"
      >
        {isLoading || isLoadingPlan ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 animate-pulse overflow-hidden">
                <div className="flex items-stretch">
                  <div className="w-20 py-4 bg-emerald-50 dark:bg-emerald-500/10 border-r border-emerald-200 dark:border-emerald-500/20" />
                  <div className="flex-1 px-4 py-3 space-y-2">
                    <div className="h-4 w-28 bg-neutral-200 dark:bg-neutral-700 rounded" />
                    <div className="h-3 w-20 bg-neutral-100 dark:bg-neutral-800 rounded" />
                    <div className="h-2 w-32 bg-neutral-100 dark:bg-neutral-800 rounded" />
                  </div>
                  <div className="w-24 px-4 py-3 flex flex-col items-end gap-2">
                    <div className="h-5 w-14 bg-neutral-200 dark:bg-neutral-700 rounded" />
                    <div className="h-8 w-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">
              Unable to load opportunities
            </p>
          </div>
        ) : bets.length === 0 ? (
          <div className="py-8 text-center rounded-xl bg-neutral-900/50 dark:bg-neutral-950/50">
            <p className="text-neutral-300 text-sm font-medium">
              Markets are updating
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Best bets refresh throughout the day
            </p>
          </div>
        ) : (
          <>
            {/* Bet Rows */}
            <div>
              {visibleBets.map((bet) => (
                <BetRow key={bet.id} bet={bet} />
              ))}
            </div>
            
            {/* Locked previews + Upgrade prompt for non-pro users */}
            {!isPro && hiddenCount > 0 && (
              <div className="mt-1">
                {/* Show 1-2 locked rows as teasers */}
                <LockedBetRow />
                {hiddenCount > 1 && <LockedBetRow />}
                
                {/* Upgrade CTA */}
                <Link
                  href="/subscribe"
                  className={cn(
                    "flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl mt-3",
                    "bg-gradient-to-r from-emerald-600 to-teal-600",
                    "text-white",
                    "text-sm font-bold",
                    "hover:from-emerald-500 hover:to-teal-500 transition-all",
                    "shadow-lg shadow-emerald-500/20"
                  )}
                >
                  <Lock className="h-4 w-4" />
                  Unlock {hiddenCount} more edges
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Scroll Arrow */}
      {showScrollArrow && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={handleScrollDown}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 shadow-md pointer-events-auto hover:scale-110 hover:bg-neutral-700 transition-all"
          >
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          </button>
        </div>
      )}
    </section>
  );
}
