"use client";

import { useQuery } from "@tanstack/react-query";
import { useIsPro } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";
import { Scale, ChevronRight, Loader2, Shield, Lock } from "lucide-react";
import Link from "next/link";

interface ArbOpportunity {
  id: string;
  event: string;
  market: string;
  marketDisplay: string;
  books: string[];
  roiPercent: number;
  sport: string;
  startTime: string | null;
  isLive: boolean;
}

interface ArbitrageResponse {
  arbs: ArbOpportunity[];
  timestamp: number;
}

const BOOK_DISPLAY: Record<string, string> = {
  draftkings: "DK",
  fanduel: "FD",
  betmgm: "MGM",
  caesars: "CZR",
  pointsbet: "PB",
  bet365: "365",
  pinnacle: "PIN",
  circa: "CRC",
  "hard-rock": "HR",
  "bally-bet": "Bally",
  betrivers: "BR",
  espnbet: "ESPN",
  fanatics: "FAN",
  fliff: "Fliff",
};

async function fetchArbitrage(): Promise<ArbitrageResponse> {
  const response = await fetch("/api/dashboard/arbitrage");
  if (!response.ok) {
    throw new Error("Failed to fetch arbitrage");
  }
  return response.json();
}

export function ArbitrageSection() {
  const { isPro, isLoading: isLoadingPlan } = useIsPro();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-arbitrage"],
    queryFn: fetchArbitrage,
    refetchInterval: 15000,
    staleTime: 10000,
  });
  
  const arbs = data?.arbs || [];
  
  // Pro users see all, others see first 1
  const visibleArbs = isPro ? arbs : arbs.slice(0, 1);
  const hiddenCount = isPro ? 0 : Math.max(0, arbs.length - 1);
  
  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg",
            "bg-blue-500/10 dark:bg-blue-500/20"
          )}>
            <Scale className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Risk-Free Arbitrage
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Guaranteed profit opportunities
            </p>
          </div>
        </div>
        
        <Link
          href="/arbitrage"
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium",
            "text-neutral-600 dark:text-neutral-400",
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
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        </div>
      ) : error ? (
        <div className={cn(
          "py-8 text-center rounded-lg border",
          "border-neutral-200 dark:border-neutral-800",
          "bg-neutral-50 dark:bg-neutral-900"
        )}>
          <p className="text-neutral-500 dark:text-neutral-400">
            Unable to load arbitrage
          </p>
        </div>
      ) : arbs.length === 0 ? (
        <div className={cn(
          "py-8 text-center rounded-lg border border-dashed",
          "border-neutral-200 dark:border-neutral-700",
          "bg-neutral-50 dark:bg-neutral-900"
        )}>
          <Shield className="h-8 w-8 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
          <p className="text-neutral-600 dark:text-neutral-400 font-medium">
            No arbitrage opportunities right now
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            Arbs appear and disappear quickly — check back soon
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Visible Arbs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleArbs.map((arb) => (
              <ArbCard key={arb.id} arb={arb} />
            ))}
          </div>
          
          {/* Blurred Arbs for non-pro */}
          {!isPro && hiddenCount > 0 && (
            <div className="relative">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 blur-sm pointer-events-none select-none opacity-50">
                {arbs.slice(1, 3).map((arb) => (
                  <ArbCard key={arb.id} arb={arb} />
                ))}
              </div>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={cn(
                  "flex flex-col items-center gap-3 p-5 rounded-lg",
                  "bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm",
                  "border border-neutral-200 dark:border-neutral-700 shadow-lg"
                )}>
                  <div className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <Lock className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                      {hiddenCount} more opportunities
                    </p>
                  </div>
                  <Link
                    href="/subscribe"
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-sm font-semibold",
                      "bg-neutral-900 dark:bg-white",
                      "text-white dark:text-neutral-900",
                      "hover:bg-neutral-800 dark:hover:bg-neutral-100",
                      "transition-colors"
                    )}
                  >
                    Upgrade
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ArbCard({ arb }: { arb: ArbOpportunity }) {
  const books = arb.books.map(b => BOOK_DISPLAY[b] || b).join(" + ");
  
  return (
    <div className={cn(
      "p-4 rounded-lg border",
      "bg-white dark:bg-neutral-900",
      "border-neutral-200 dark:border-neutral-800",
      "hover:border-neutral-300 dark:hover:border-neutral-700",
      "transition-colors"
    )}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
            {arb.event}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {arb.marketDisplay}
            </span>
            <span className="text-xs text-neutral-300 dark:text-neutral-600">
              •
            </span>
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {books}
            </span>
          </div>
        </div>
        
        <div className={cn(
          "flex items-center gap-1 px-2.5 py-1.5 rounded-lg ml-3",
          "bg-emerald-50 dark:bg-emerald-900/20"
        )}>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">ROI</span>
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {arb.roiPercent.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}
