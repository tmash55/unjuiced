"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Activity, TrendingUp, Zap, Clock } from "lucide-react";

interface MarketPulseData {
  liveEvBets: number;
  liveArbs: number;
  lastUpdated: string;
}

async function fetchMarketPulse(): Promise<MarketPulseData> {
  // Fetch from existing endpoints to aggregate counts
  const [evResponse, arbResponse] = await Promise.all([
    fetch("/api/dashboard/best-bets"),
    fetch("/api/dashboard/arbitrage"),
  ]);
  
  const evData = evResponse.ok ? await evResponse.json() : { bets: [] };
  const arbData = arbResponse.ok ? await arbResponse.json() : { arbs: [] };
  
  return {
    liveEvBets: evData.bets?.length || 0,
    liveArbs: arbData.arbs?.length || 0,
    lastUpdated: new Date().toLocaleTimeString("en-US", { 
      hour: "numeric", 
      minute: "2-digit" 
    }),
  };
}

export function MarketPulseCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-market-pulse"],
    queryFn: fetchMarketPulse,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  return (
    <section className={cn(
      "rounded-xl border border-neutral-200 dark:border-neutral-800",
      "bg-white dark:bg-neutral-900 h-full"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
          <Activity className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Market Pulse
          </h2>
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
            Live system status
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
            <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
            <div className="h-8 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
          </div>
        ) : (
          <>
            {/* Live +EV Bets */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg",
              "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30"
            )}>
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {data?.liveEvBets || 0}
                </p>
                <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-500">
                  +EV bets live
                </p>
              </div>
            </div>

            {/* Live Arbs */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg",
              "bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/30"
            )}>
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40">
                <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                  {data?.liveArbs || 0}
                </p>
                <p className="text-[10px] font-medium text-blue-600 dark:text-blue-500">
                  Arb opportunities
                </p>
              </div>
            </div>

            {/* Last Updated */}
            <div className="flex items-center gap-2 px-1 text-xs text-neutral-400 dark:text-neutral-500">
              <Clock className="w-3 h-3" />
              <span>Updated {data?.lastUpdated}</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
