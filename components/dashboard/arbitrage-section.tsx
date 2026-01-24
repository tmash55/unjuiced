"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsPro } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2, Shield, Lock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { motion } from "motion/react";

interface BookInfo {
  id: string;
  odds: number;
  oddsFormatted: string;
}

interface ArbOpportunity {
  id: string;
  event: string;
  market: string;
  marketDisplay: string;
  player: string | null;
  line: number | null;
  overBook: BookInfo;
  underBook: BookInfo;
  roiPercent: number;
  sport: string;
  league: string | null;
  startTime: string | null;
  isLive: boolean;
}

interface ArbitrageResponse {
  arbs: ArbOpportunity[];
  timestamp: number;
}

async function fetchArbitrage(): Promise<ArbitrageResponse> {
  const response = await fetch("/api/dashboard/arbitrage?limit=4");
  if (!response.ok) {
    throw new Error("Failed to fetch arbitrage");
  }
  return response.json();
}

// Total stake for calculations
const TOTAL_STAKE = 300;

// Calculate stake splits and profit
function calculateArbMath(roiPercent: number, overOdds: number, underOdds: number) {
  const profit = (roiPercent / 100) * TOTAL_STAKE;
  
  // Convert American odds to decimal
  const overDecimal = overOdds > 0 ? (overOdds / 100) + 1 : (100 / Math.abs(overOdds)) + 1;
  const underDecimal = underOdds > 0 ? (underOdds / 100) + 1 : (100 / Math.abs(underOdds)) + 1;
  
  // Calculate implied probabilities
  const overImplied = 1 / overDecimal;
  const underImplied = 1 / underDecimal;
  const totalImplied = overImplied + underImplied;
  
  // Calculate stake distribution
  const overStake = Math.round((overImplied / totalImplied) * TOTAL_STAKE);
  const underStake = TOTAL_STAKE - overStake;
  
  return { profit, overStake, underStake };
}

// Format time for display
function formatTime(startTime: string | null): string {
  if (!startTime) return "TBD";
  
  const date = new Date(startTime);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  
  if (isToday) {
    return `Today ${timeStr}`;
  }
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${timeStr}`;
  }
  
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// Animated profit counter
function AnimatedProfit({ profit }: { profit: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 600;
    const steps = 20;
    const increment = profit / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= profit) {
        setDisplayValue(profit);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [profit]);
  
  return <span className="tabular-nums">${displayValue.toFixed(2)}</span>;
}

export function ArbitrageSection() {
  const { isPro, isLoading: isLoadingPlan } = useIsPro();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-arbitrage"],
    queryFn: fetchArbitrage,
    refetchInterval: 15000,
    staleTime: 10000,
  });
  
  const arbs = data?.arbs || [];
  const visibleArbs = isPro ? arbs.slice(0, 4) : arbs.slice(0, 1);
  const hiddenCount = isPro ? 0 : Math.max(0, arbs.length - 1);
  
  return (
    <section className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className={cn(
            "flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg shadow-sm",
            "bg-gradient-to-br from-cyan-500 to-blue-600"
          )}>
            <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
          </div>
          <div>
            <span className="font-bold text-neutral-800 dark:text-neutral-100 text-xs sm:text-sm">Risk-Free Arbs</span>
            <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:block">
              Guaranteed profit calculator
            </p>
          </div>
        </div>
        
        <Link
          href="/arbitrage"
          className={cn(
            "flex items-center gap-0.5 sm:gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-semibold transition-all",
            "text-cyan-700 dark:text-cyan-300",
            "bg-cyan-50 dark:bg-cyan-900/30",
            "hover:bg-cyan-100 dark:hover:bg-cyan-900/50",
            "border border-cyan-200/50 dark:border-cyan-700/30"
          )}
        >
          View All
          <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
        </Link>
      </div>

      {/* Content */}
      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-2 sm:px-3 py-2 sm:py-3"
      >
        {isLoading || isLoadingPlan ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Unable to load arbitrage
            </p>
          </div>
        ) : arbs.length === 0 ? (
          <div className="py-6 text-center">
            <div className={cn(
              "w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2",
              "bg-neutral-100 dark:bg-neutral-800"
            )}>
              <Shield className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
            </div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              No arbs detected
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Scanning continuously
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleArbs.map((arb, idx) => (
              <ArbCard key={`${arb.id}-${idx}`} arb={arb} index={idx} />
            ))}
            
            {/* Upgrade prompt */}
            {!isPro && hiddenCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl",
                  "bg-cyan-50 dark:bg-cyan-900/20",
                  "border border-cyan-200 dark:border-cyan-700/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                    +{hiddenCount} more arbs
                  </span>
                </div>
                <Link
                  href="/subscribe"
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold",
                    "bg-gradient-to-r from-cyan-500 to-blue-600",
                    "text-white shadow-sm",
                    "hover:from-cyan-400 hover:to-blue-500",
                    "transition-all"
                  )}
                >
                  Unlock
                </Link>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// Arb Card with math breakdown
function ArbCard({ arb, index }: { arb: ArbOpportunity; index: number }) {
  const overBookMeta = getSportsbookById(arb.overBook.id);
  const underBookMeta = getSportsbookById(arb.underBook.id);
  
  const overLogo = overBookMeta?.image?.light;
  const underLogo = underBookMeta?.image?.light;
  const overName = overBookMeta?.name || arb.overBook.id;
  const underName = underBookMeta?.name || arb.underBook.id;
  
  const { profit, overStake, underStake } = calculateArbMath(
    arb.roiPercent,
    arb.overBook.odds,
    arb.underBook.odds
  );
  
  let marketLine = arb.marketDisplay;
  if (arb.line !== null) {
    marketLine += ` ${arb.line}`;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-3",
        "bg-white dark:bg-neutral-900",
        "border border-neutral-200 dark:border-neutral-800",
        "hover:shadow-lg hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/5",
        "transition-all duration-200"
      )}
    >
      {/* Header: Market Info */}
      <div className="px-2.5 sm:px-3 py-2 sm:py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] sm:text-xs font-bold text-neutral-900 dark:text-white truncate">
              {arb.player || arb.event}
            </p>
            <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
              {marketLine} • {formatTime(arb.startTime)}
            </p>
          </div>
          {arb.isLive && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-400">LIVE</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Math Breakdown */}
      <div className="px-2.5 sm:px-3 py-2.5 sm:py-3">
        {/* Stake Header */}
        <div className="text-center mb-2 sm:mb-3">
          <span className="text-[9px] sm:text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
            With ${TOTAL_STAKE} total stake
          </span>
        </div>
        
        {/* Two-column bet split */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-2 sm:mb-3">
          {/* Over Side */}
          <div className={cn(
            "p-2 sm:p-2.5 rounded-md sm:rounded-lg text-center",
            "bg-emerald-50 dark:bg-emerald-900/20",
            "border border-emerald-200/50 dark:border-emerald-800/30"
          )}>
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
              {overLogo ? (
                <img src={overLogo} alt={overName} className="h-3.5 w-3.5 sm:h-4 sm:w-4 object-contain rounded" />
              ) : (
                <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded bg-neutral-200 dark:bg-neutral-700" />
              )}
              <span className="text-[9px] sm:text-[10px] font-medium text-neutral-600 dark:text-neutral-400 truncate max-w-[60px] sm:max-w-none">
                {overName}
              </span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {arb.overBook.oddsFormatted}
            </div>
            <div className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 sm:mt-1">
              Bet <span className="font-semibold text-neutral-700 dark:text-neutral-200">${overStake}</span>
            </div>
          </div>
          
          {/* Under Side */}
          <div className={cn(
            "p-2 sm:p-2.5 rounded-md sm:rounded-lg text-center",
            "bg-rose-50 dark:bg-rose-900/20",
            "border border-rose-200/50 dark:border-rose-800/30"
          )}>
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
              {underLogo ? (
                <img src={underLogo} alt={underName} className="h-3.5 w-3.5 sm:h-4 sm:w-4 object-contain rounded" />
              ) : (
                <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded bg-neutral-200 dark:bg-neutral-700" />
              )}
              <span className="text-[9px] sm:text-[10px] font-medium text-neutral-600 dark:text-neutral-400 truncate max-w-[60px] sm:max-w-none">
                {underName}
              </span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {arb.underBook.oddsFormatted}
            </div>
            <div className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 sm:mt-1">
              Bet <span className="font-semibold text-neutral-700 dark:text-neutral-200">${underStake}</span>
            </div>
          </div>
        </div>
        
        {/* Arrow pointing to profit - hidden on mobile to save space */}
        <div className="hidden sm:flex justify-center mb-2">
          <div className="flex items-center gap-1 text-[9px] text-neutral-400">
            <div className="w-8 h-px bg-neutral-200 dark:bg-neutral-700" />
            <ArrowRight className="w-3 h-3" />
            <div className="w-8 h-px bg-neutral-200 dark:bg-neutral-700" />
          </div>
        </div>
        
        {/* Profit Highlight */}
        <div className={cn(
          "p-2.5 sm:p-3 rounded-lg sm:rounded-xl text-center",
          "bg-gradient-to-r from-emerald-500 to-teal-500",
          "shadow-lg shadow-emerald-500/20"
        )}>
          <div className="text-[9px] sm:text-[10px] font-semibold text-emerald-100 uppercase tracking-wide mb-0.5">
            Guaranteed Profit
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tabular-nums">
            +<AnimatedProfit profit={profit} />
          </div>
          <div className="text-[9px] sm:text-[10px] text-emerald-100 mt-0.5">
            {arb.roiPercent.toFixed(2)}% ROI
          </div>
        </div>
      </div>
    </motion.div>
  );
}
