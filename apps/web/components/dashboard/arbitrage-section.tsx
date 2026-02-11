"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ChevronRight, Loader2, Shield } from "lucide-react";
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

// Deduplicate arbs: keep the best ROI for each unique player+market+line combo
function dedupeArbs(arbs: ArbOpportunity[]): ArbOpportunity[] {
  const seen = new Map<string, ArbOpportunity>();
  for (const arb of arbs) {
    const key = `${arb.player || arb.event}::${arb.market}::${arb.line}`;
    const existing = seen.get(key);
    if (!existing || arb.roiPercent > existing.roiPercent) {
      seen.set(key, arb);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.roiPercent - a.roiPercent);
}

export function ArbitrageSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-arbitrage"],
    queryFn: fetchArbitrage,
    refetchInterval: 15000,
    staleTime: 10000,
  });
  
  const arbs = dedupeArbs(data?.arbs || []);
  const maxVisible = isMobileView ? 2 : 4;
  const visibleArbs = arbs.slice(0, maxVisible);
  
  return (
    <section className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-8 rounded-lg bg-cyan-500/10 dark:bg-cyan-400/10">
            <Shield className="size-4 text-cyan-500 dark:text-cyan-400" />
          </div>
          <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">Risk-Free Arbs</span>
        </div>
        
        <Link
          href="/arbitrage"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          View All
          <ChevronRight className="size-3" />
        </Link>
      </div>

      {/* Content */}
      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-3 py-2"
      >
        {isLoading ? (
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
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {visibleArbs.map((arb, idx) => (
                <ArbCard key={`${arb.id}-${idx}`} arb={arb} index={idx} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// Compact Arb Card — ROI prominent, inline layout
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
    arb.underBook.odds,
  );

  let marketLine = arb.marketDisplay;
  if (arb.line !== null) {
    marketLine += ` ${arb.line}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "rounded-xl overflow-hidden",
        "bg-white dark:bg-neutral-900/80",
        "border border-neutral-200/50 dark:border-neutral-700/30",
        "transition-all duration-200",
      )}
    >
      {/* Top row: ROI badge + player/market + game time */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {/* ROI Badge */}
        <div className="flex items-center justify-center shrink-0 size-11 rounded-lg bg-emerald-500/10 dark:bg-emerald-400/10">
          <span className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">
            {arb.roiPercent.toFixed(1)}%
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
            {arb.player || arb.event}
          </p>
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
            {marketLine} · {formatTime(arb.startTime)}
          </p>
        </div>

        {/* Live badge or profit */}
        {arb.isLive ? (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 shrink-0">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">LIVE</span>
          </div>
        ) : (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
            +${profit.toFixed(2)}
          </span>
        )}
      </div>

      {/* Bottom row: Book vs Book comparison — compact inline */}
      <div className="grid grid-cols-2 gap-px bg-neutral-100 dark:bg-neutral-800 border-t border-neutral-100 dark:border-neutral-800">
        {/* Over side */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-1.5 min-w-0">
            {overLogo ? (
              <img src={overLogo} alt={overName} className="size-4 object-contain rounded shrink-0" />
            ) : (
              <div className="size-4 rounded bg-neutral-200 dark:bg-neutral-700 shrink-0" />
            )}
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">{overName}</span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {arb.overBook.oddsFormatted}
            </span>
            <p className="text-[9px] text-neutral-400 tabular-nums">${overStake}</p>
          </div>
        </div>

        {/* Under side */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-1.5 min-w-0">
            {underLogo ? (
              <img src={underLogo} alt={underName} className="size-4 object-contain rounded shrink-0" />
            ) : (
              <div className="size-4 rounded bg-neutral-200 dark:bg-neutral-700 shrink-0" />
            )}
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">{underName}</span>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums">
              {arb.underBook.oddsFormatted}
            </span>
            <p className="text-[9px] text-neutral-400 tabular-nums">${underStake}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
