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

// Premium Bet Row Component - Conviction → Context → Action
function BetRow({ bet }: { bet: BestBet }) {
  const bookMeta = getSportsbookById(bet.book);
  const bookLogo = bookMeta?.image?.light;
  const bookName = bookMeta?.name || bet.book;
  const betLink = getBetLink(bet);
  const sportLabel = SPORT_LABEL[bet.sport.toLowerCase()] || bet.sport.toUpperCase();
  const insight = getInsightText(bet);

  return (
    <div className={cn(
      "group relative flex gap-3 p-3 mb-3 rounded-xl transition-all duration-200",
      "bg-neutral-50/50 dark:bg-neutral-900/50",
      "hover:bg-neutral-100/80 dark:hover:bg-neutral-800/50",
      "border border-transparent hover:border-neutral-200/50 dark:hover:border-neutral-700/50"
    )}>
      {/* 1️⃣ CONVICTION COLUMN - EV Badge (premium pill treatment) */}
      <div className="flex flex-col items-center justify-center shrink-0">
        {/* EV Badge - Soft pill with tinted background */}
        <div className={cn(
          "relative flex items-center justify-center px-3 py-2 rounded-lg",
          // Subtle tinted background - works in light + dark mode
          "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12]",
          // Optional soft border for extra definition
          "border border-emerald-500/20 dark:border-emerald-500/20"
        )}>
          {/* EV % - The visual anchor */}
          <span className="text-lg font-black tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">
            {bet.evPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 2️⃣ CONTEXT COLUMN - Player, Market, Insight */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* Player + Sport - tighter grouping */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
            {bet.player}
          </span>
          <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 shrink-0">
            {sportLabel}
          </span>
        </div>
        
        {/* Market + Line - reduced spacing, leaning into O/U color */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
            {bet.marketDisplay}
          </span>
          <span className={cn(
            "text-xs font-semibold",
            bet.side === "over" 
              ? "text-emerald-600 dark:text-emerald-400" 
              : "text-rose-600 dark:text-rose-400"
          )}>
            {bet.side === "over" ? "O" : "U"} {bet.line}
          </span>
        </div>
        
        {/* Insight Row - The "why" (KEY differentiator) */}
        <div className="mt-2 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/50">
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400 italic">
            {insight}
          </span>
        </div>
      </div>

      {/* 3️⃣ ACTION COLUMN - Book + Odds + CTA (brand first = trust) */}
      <div className="flex flex-col items-end justify-between shrink-0">
        {/* Book + Odds grouped (brand first, odds second) */}
        <div className="flex items-center gap-1.5">
          {bookLogo && (
            <img 
              src={bookLogo} 
              alt={bookName} 
              className="h-4 w-auto object-contain opacity-80" 
            />
          )}
          <span className="text-base font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
            {bet.bestOddsFormatted}
          </span>
        </div>
        
        {/* CTA Button - Calm, confident */}
        {betLink ? (
          <a
            href={betLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 mt-2 rounded-lg text-xs font-semibold transition-all",
              "bg-emerald-600 text-white",
              "hover:bg-emerald-500",
              "active:scale-[0.98]"
            )}
          >
            Bet
            <ArrowRight className="w-3 h-3" />
          </a>
        ) : (
          <div className="flex items-center gap-1 px-3 py-1.5 mt-2 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
            <Lock className="w-3 h-3" />
            <span>Link</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Locked Bet Row for non-pro users
function LockedBetRow() {
  return (
    <div className={cn(
      "relative flex gap-3 p-3 mb-3 rounded-xl",
      "bg-neutral-50/30 dark:bg-neutral-900/30",
      "border border-dashed border-neutral-200 dark:border-neutral-800"
    )}>
      {/* Blurred conviction column - matching new badge style */}
      <div className="flex flex-col items-center justify-center shrink-0 opacity-30 blur-[2px]">
        <div className="flex items-center justify-center px-3 py-2 rounded-lg bg-neutral-200/50 dark:bg-neutral-700/50 border border-neutral-300/30">
          <span className="text-lg font-black tabular-nums text-neutral-400 leading-none">?.?%</span>
        </div>
      </div>

      {/* Blurred content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center opacity-30 blur-[2px]">
        <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 rounded" />
        <div className="h-3 w-20 bg-neutral-100 dark:bg-neutral-800 rounded mt-1" />
        <div className="h-2 w-36 bg-neutral-100 dark:bg-neutral-800 rounded mt-2.5" />
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-700">
          <Lock className="w-3.5 h-3.5 text-neutral-400" />
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Pro Only</span>
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
  
  // Pro users see all (up to 10), others see first 2 + locked previews
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
    <section className={cn(
      "h-full flex flex-col relative group/bento rounded-xl",
      // Subtle emerald gradient background for +EV branding
      "bg-gradient-to-br from-emerald-50/30 via-transparent to-emerald-50/10",
      "dark:from-emerald-950/20 dark:via-transparent dark:to-emerald-950/10"
    )}>
      {/* Content */}
      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-hide pb-6"
      >
        {isLoading || isLoadingPlan ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 rounded-xl p-3 bg-neutral-50/50 dark:bg-neutral-900/50 animate-pulse">
                {/* Conviction skeleton */}
                <div className="w-12 flex flex-col items-center">
                  <div className="w-1 h-full bg-neutral-200 dark:bg-neutral-700 rounded-full" />
                </div>
                {/* Content skeleton */}
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-700 rounded" />
                  <div className="h-3 w-24 bg-neutral-100 dark:bg-neutral-800 rounded" />
                  <div className="h-2 w-40 bg-neutral-100 dark:bg-neutral-800 rounded" />
                </div>
                {/* Action skeleton */}
                <div className="w-20 flex flex-col items-end gap-2">
                  <div className="h-5 w-14 bg-neutral-200 dark:bg-neutral-700 rounded" />
                  <div className="h-7 w-16 bg-emerald-200 dark:bg-emerald-900/30 rounded-lg" />
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
          <div className="py-8 text-center">
            <p className="text-neutral-600 dark:text-neutral-300 text-sm font-medium">
              Markets are updating
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Best bets refresh throughout the day
            </p>
          </div>
        ) : (
          <>
            {/* Bet Rows - Vertical Stack with Conviction → Context → Action */}
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
                    "flex items-center justify-center gap-2 py-3 px-4 rounded-xl mt-2",
                    "bg-gradient-to-r from-neutral-900 to-neutral-800",
                    "dark:from-white dark:to-neutral-100",
                    "text-white dark:text-neutral-900",
                    "text-sm font-bold",
                    "hover:opacity-90 transition-opacity"
                  )}
                >
                  <Lock className="h-3.5 w-3.5" />
                  Unlock {hiddenCount} more edges
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Scroll Arrow */}
      {showScrollArrow && (
        <div className="absolute bottom-14 left-0 right-0 flex justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={handleScrollDown}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-md pointer-events-auto hover:scale-110 transition-transform"
          >
            <ChevronDown className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
          </button>
        </div>
      )}

      {/* Footer - Section title with hover animation */}
      <div className="mt-auto pt-3 px-1 flex items-center justify-between transition duration-200 group-hover/bento:translate-x-2 border-t border-emerald-100/50 dark:border-emerald-900/30">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "flex items-center justify-center w-7 h-7 rounded-lg shadow-sm",
            "bg-gradient-to-br from-emerald-500 to-teal-600"
          )}>
            <Trophy className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
              Today's Best Bets
            </h2>
            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-medium">
              +EV edges • Devigged vs Pinnacle
            </p>
          </div>
        </div>
        
        <Link
          href="/positive-ev"
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
            "text-emerald-700 dark:text-emerald-300",
            "bg-emerald-50 dark:bg-emerald-900/30",
            "hover:bg-emerald-100 dark:hover:bg-emerald-900/50",
            "border border-emerald-200/50 dark:border-emerald-700/30"
          )}
        >
          View All
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
