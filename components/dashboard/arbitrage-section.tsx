"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsPro } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";
import { Scale, ChevronRight, Loader2, Shield, Lock, ArrowLeftRight, Calculator } from "lucide-react";
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

// Calculate profit from ROI and stake
function calculateProfit(roiPercent: number, totalStake: number = 200): number {
  return (roiPercent / 100) * totalStake;
}

// Format time for display
function formatTime(startTime: string | null): string {
  if (!startTime) return "TBD";
  
  const date = new Date(startTime);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  
  if (isToday) {
    return `Today · ${timeStr}`;
  }
  
  // Check if tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow · ${timeStr}`;
  }
  
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// Animated profit counter component
function AnimatedProfit({ profit }: { profit: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 600; // ms
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
  
  return (
    <span className="tabular-nums">${displayValue.toFixed(2)}</span>
  );
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
  
  // Pro users see up to 4, others see first 1 (max 4 for dashboard)
  const visibleArbs = isPro ? arbs.slice(0, 4) : arbs.slice(0, 1);
  const hiddenCount = isPro ? 0 : Math.max(0, arbs.length - 1);
  
  return (
    <section className={cn(
      "h-full flex flex-col relative group/bento",
      // Blue-focused gradient for arbitrage branding (brand primary)
      "bg-gradient-to-br from-[#0EA5E9]/[0.06] via-transparent to-[#0EA5E9]/[0.03]",
      "dark:from-[#0EA5E9]/[0.08] dark:via-transparent dark:to-[#7DD3FC]/[0.04]",
      "rounded-xl"
    )}>
      {/* Section Header - Assertive value proposition */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "flex items-center justify-center w-7 h-7 rounded-lg shadow-sm",
              // Brand blue gradient
              "bg-gradient-to-br from-[#0EA5E9] to-[#0284C7]"
            )}>
              <Shield className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Risk-Free Arbitrage
              </h2>
              <p className="text-[10px] text-[#0EA5E9]/70 dark:text-[#7DD3FC]/70 font-medium">
                Guaranteed profit • Auto-calculated stakes
              </p>
            </div>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#0EA5E9]/10 dark:bg-[#7DD3FC]/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] dark:bg-[#7DD3FC] animate-pulse" />
            <span className="text-[9px] font-bold text-[#0EA5E9] dark:text-[#7DD3FC]">LIVE</span>
          </div>
        </div>
      </div>

      {/* Content - Opportunity Cards */}
      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-3 pb-2"
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
          <div className="py-8 text-center">
            <div className={cn(
              "w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3",
              "bg-neutral-100 dark:bg-neutral-800"
            )}>
              <Shield className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />
            </div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              No arbitrage detected
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              We scan continuously • Check back soon
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleArbs.map((arb, idx) => (
              <ArbOpportunityCard key={`${arb.id}-${idx}`} arb={arb} index={idx} />
            ))}
            
            {/* Upgrade prompt for non-pro */}
            {!isPro && hiddenCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl",
                  "bg-[#0EA5E9]/5 dark:bg-[#7DD3FC]/5",
                  "border border-[#0EA5E9]/20 dark:border-[#7DD3FC]/20"
                )}
              >
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#0EA5E9] dark:text-[#7DD3FC]" />
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                    +{hiddenCount} more opportunities
                  </span>
                </div>
                <Link
                  href="/subscribe"
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold",
                    "bg-gradient-to-r from-[#0EA5E9] to-[#0284C7]",
                    "text-white shadow-sm shadow-[#0EA5E9]/20",
                    "hover:from-[#38BDF8] hover:to-[#0EA5E9]",
                    "transition-all"
                  )}
                >
                  Unlock All
                </Link>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Footer CTA with hover effect */}
      <div className="mt-auto px-3 py-2.5 border-t border-[#0EA5E9]/10 dark:border-[#7DD3FC]/10 flex items-center justify-between transition duration-200 group-hover/bento:translate-x-2">
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
          <Scale className="h-3 w-3" />
          <span>Updated every few minutes</span>
        </div>
        
        <Link
          href="/arbitrage"
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
            "text-[#0284C7] dark:text-[#7DD3FC]",
            "bg-[#0EA5E9]/10 dark:bg-[#7DD3FC]/10",
            "hover:bg-[#0EA5E9]/20 dark:hover:bg-[#7DD3FC]/20",
            "border border-[#0EA5E9]/20 dark:border-[#7DD3FC]/20"
          )}
        >
          <Calculator className="h-3 w-3" />
          Open Arbitrage Tool
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}

// Premium Opportunity Card
function ArbOpportunityCard({ arb, index }: { arb: ArbOpportunity; index: number }) {
  const overBookMeta = getSportsbookById(arb.overBook.id);
  const underBookMeta = getSportsbookById(arb.underBook.id);
  
  const overLogo = overBookMeta?.image?.light;
  const underLogo = underBookMeta?.image?.light;
  
  // Calculate profit on $200 total stake
  const profit = calculateProfit(arb.roiPercent, 200);
  
  // Build human-readable market summary
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
        "relative p-3 rounded-xl transition-all duration-200",
        "bg-white/80 dark:bg-neutral-900/60",
        "border border-[#0EA5E9]/10 dark:border-[#7DD3FC]/10",
        "hover:shadow-lg hover:shadow-[#0EA5E9]/10 hover:-translate-y-0.5",
        "hover:border-[#0EA5E9]/30 dark:hover:border-[#7DD3FC]/30"
      )}
    >
      {/* Top Row: ROI + Market + Live Badge */}
      <div className="flex items-start justify-between gap-3 mb-2">
        {/* Left: ROI Pill with Guarantee label */}
        <div className="flex flex-col items-center shrink-0">
          <div className={cn(
            "flex items-center justify-center px-2.5 py-1.5 rounded-lg",
            "bg-gradient-to-br from-emerald-500 to-teal-600",
            "shadow-sm shadow-emerald-500/30"
          )}>
            <span className="text-sm font-black text-white tabular-nums">
              +{arb.roiPercent.toFixed(1)}%
            </span>
          </div>
          <span className="text-[8px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mt-1">
            Guaranteed
          </span>
        </div>
        
        {/* Center: Market Summary */}
        <div className="flex-1 min-w-0">
          {arb.player && (
            <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
              {arb.player}
            </p>
          )}
          <p className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate">
            {marketLine}
          </p>
          <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
            {arb.event} · {formatTime(arb.startTime)}
          </p>
        </div>
        
        {/* Right: Live indicator */}
        {arb.isLive && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">LIVE</span>
          </div>
        )}
      </div>
      
      {/* Book Split Row - Visual arbitrage explanation */}
      <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#0EA5E9]/[0.03] dark:bg-[#7DD3FC]/[0.05] border border-[#0EA5E9]/10 dark:border-[#7DD3FC]/10">
        {/* Over Book */}
        <div className="flex items-center gap-1.5">
          {overLogo ? (
            <img src={overLogo} alt={arb.overBook.id} className="h-5 w-auto object-contain" />
          ) : (
            <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-700" />
          )}
          <span className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {arb.overBook.oddsFormatted}
          </span>
        </div>
        
        {/* Swap Icon */}
        <div className={cn(
          "flex items-center justify-center w-6 h-6 rounded-full",
          "bg-white dark:bg-neutral-800 border border-[#0EA5E9]/20 dark:border-[#7DD3FC]/20"
        )}>
          <ArrowLeftRight className="w-3 h-3 text-[#0EA5E9] dark:text-[#7DD3FC]" />
        </div>
        
        {/* Under Book */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {arb.underBook.oddsFormatted}
          </span>
          {underLogo ? (
            <img src={underLogo} alt={arb.underBook.id} className="h-5 w-auto object-contain" />
          ) : (
            <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-700" />
          )}
        </div>
      </div>
      
      {/* Bottom Row: Profit Preview */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#0EA5E9]/10 dark:border-[#7DD3FC]/10">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-[#0EA5E9] dark:text-[#7DD3FC]" />
          <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
            Profit on $200:
          </span>
        </div>
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
          <AnimatedProfit profit={profit} />
        </span>
      </div>
    </motion.div>
  );
}
