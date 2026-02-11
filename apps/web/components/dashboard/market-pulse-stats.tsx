"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { IconBolt } from "@tabler/icons-react";
import { useEffect, useState, useMemo } from "react";

// Re-use the same fetch functions & types from sibling dashboard components
// so React Query shares the cache — no extra network requests.

interface BestBet {
  evPercent: number;
}
interface BestBetsResponse {
  bets: BestBet[];
}

interface ArbBookInfo { odds: number; oddsFormatted: string; id: string; }
interface ArbOpportunity {
  roiPercent: number;
  overBook: ArbBookInfo;
  underBook: ArbBookInfo;
}
interface ArbitrageResponse {
  arbs: ArbOpportunity[];
}

async function fetchBestBets(): Promise<BestBetsResponse> {
  const res = await fetch("/api/dashboard/best-bets?limit=10");
  if (!res.ok) throw new Error("Failed to fetch best bets");
  return res.json();
}

async function fetchArbitrage(): Promise<ArbitrageResponse> {
  const res = await fetch("/api/dashboard/arbitrage?limit=4");
  if (!res.ok) throw new Error("Failed to fetch arbitrage");
  return res.json();
}

// Animated counter
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) { setDisplayValue(0); return; }
    const duration = 800;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) { setDisplayValue(value); clearInterval(timer); }
      else { setDisplayValue(Math.floor(current)); }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return <span className="tabular-nums">{displayValue}{suffix}</span>;
}

export function MarketPulseStats() {
  // Read from the same React Query cache that BestBetsSection & ArbitrageSection populate.
  // This means zero extra network requests — we just read the already-fetched data.
  const { data: betsData, isLoading: betsLoading } = useQuery({
    queryKey: ["dashboard-best-bets"],
    queryFn: fetchBestBets,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: arbsData, isLoading: arbsLoading } = useQuery({
    queryKey: ["dashboard-arbitrage"],
    queryFn: fetchArbitrage,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const isLoading = betsLoading || arbsLoading;

  const stats = useMemo(() => {
    const bets = betsData?.bets || [];
    const arbs = arbsData?.arbs || [];

    const edgeCount = bets.length;
    const bestEv = bets.length > 0 ? Math.max(...bets.map(b => b.evPercent)) : 0;
    const bestArb = arbs.length > 0 ? Math.max(...arbs.map(a => a.roiPercent)) : 0;

    return { edgeCount, bestEv, bestArb };
  }, [betsData, arbsData]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-8 rounded-lg bg-violet-500/10 dark:bg-violet-400/10">
            <IconBolt className="size-4 text-violet-500 dark:text-violet-400" />
          </div>
          <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">Market Pulse</span>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 dark:bg-violet-400/10">
          <span className="size-1.5 rounded-full bg-violet-500 dark:bg-violet-400 animate-pulse" />
          <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Live</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 px-4 pb-4 flex items-center">
        {isLoading ? (
          <div className="w-full flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 w-full">
            {/* Edges Available */}
            <div className="flex flex-col items-center justify-center py-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 text-center">
              <span className="text-lg font-black text-violet-600 dark:text-violet-400 tabular-nums leading-none">
                <AnimatedNumber value={stats.edgeCount} />
              </span>
              <span className="text-[9px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mt-1">
                Edges
              </span>
            </div>

            {/* Highest EV */}
            <div className="flex flex-col items-center justify-center py-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 text-center">
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">
                {stats.bestEv > 0 ? `+${stats.bestEv.toFixed(1)}%` : "—"}
              </span>
              <span className="text-[9px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mt-1">
                Best EV
              </span>
            </div>

            {/* Best Arb */}
            <div className="flex flex-col items-center justify-center py-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 text-center">
              <span className="text-lg font-black text-sky-600 dark:text-sky-400 tabular-nums leading-none">
                {stats.bestArb > 0 ? `${stats.bestArb.toFixed(2)}%` : "—"}
              </span>
              <span className="text-[9px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mt-1">
                Best Arb
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
