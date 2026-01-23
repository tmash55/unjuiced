"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Zap, TrendingUp, Scale, BookOpen, Activity, Clock, Loader2 } from "lucide-react";
import { IconBolt } from "@tabler/icons-react";
import { useEffect, useState } from "react";

interface DashboardMetrics {
  edgesFoundToday: number;
  arbsFoundToday: number;
  highestEvToday: number;
  highestArbToday: number;
  activeSportsbooks: number;
  lineMovements: number;
  lastUpdated: string;
  date: string;
}

async function fetchMetrics(): Promise<DashboardMetrics> {
  const response = await fetch("/api/dashboard/metrics");
  if (!response.ok) {
    throw new Error("Failed to fetch metrics");
  }
  return response.json();
}

// Animated counter component
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }
    
    const duration = 800;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [value]);
  
  return <span className="tabular-nums">{displayValue}{suffix}</span>;
}

export function MarketPulseStats() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: fetchMetrics,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000,
  });
  
  // Fallback values
  const metrics = data || {
    edgesFoundToday: 0,
    arbsFoundToday: 0,
    highestEvToday: 0,
    highestArbToday: 0,
    activeSportsbooks: 17,
    lineMovements: 0,
    lastUpdated: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    date: new Date().toISOString().split("T")[0],
  };
  
  return (
    <div className={cn(
      "h-full flex flex-col p-2 rounded-xl",
      // Violet/purple gradient for premium pulse feel
      "bg-gradient-to-br from-violet-50/40 via-transparent to-purple-50/20",
      "dark:from-violet-950/20 dark:via-transparent dark:to-purple-950/10"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center justify-center w-7 h-7 rounded-lg shadow-sm",
            "bg-gradient-to-br from-violet-500 to-purple-600"
          )}>
            <IconBolt className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <span className="font-bold text-neutral-800 dark:text-neutral-100 text-sm">Market Pulse</span>
          </div>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-100/80 dark:bg-violet-900/30">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400 animate-pulse" />
          <span className="text-[9px] font-bold text-violet-600 dark:text-violet-400">LIVE</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between">
          {/* Hero Stat */}
          <div className="mb-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="h-3.5 w-3.5 text-violet-500 fill-violet-500" />
              <span className="text-[10px] font-bold text-violet-600/70 dark:text-violet-400/70 uppercase tracking-wider">
                Edges Found Today
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight">
                <AnimatedNumber value={metrics.edgesFoundToday} />
              </span>
              <span className="text-xs font-medium text-neutral-400">
                +EV bets surfaced
              </span>
            </div>
          </div>

          {/* Secondary Stats Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-2.5 border-t border-violet-100/50 dark:border-violet-900/30">
            {/* Highest EV - green for profit */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-[9px] font-medium text-neutral-400">
                <TrendingUp className="h-2.5 w-2.5" />
                Highest EV
              </div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {metrics.highestEvToday > 0 ? `+${metrics.highestEvToday.toFixed(1)}%` : "—"}
              </div>
            </div>

            {/* Best Arb - blue for arbitrage */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-[9px] font-medium text-neutral-400">
                <Scale className="h-2.5 w-2.5" />
                Best Arb
              </div>
              <div className="text-sm font-bold text-[#0EA5E9] dark:text-[#7DD3FC]">
                {metrics.highestArbToday > 0 ? `${metrics.highestArbToday.toFixed(2)}%` : "—"}
              </div>
            </div>

            {/* Books Tracked - violet accent */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-[9px] font-medium text-neutral-400">
                <BookOpen className="h-2.5 w-2.5" />
                Books Active
              </div>
              <div className="text-sm font-bold text-violet-600 dark:text-violet-400">
                {metrics.activeSportsbooks || 17}
              </div>
            </div>

            {/* Arbs Today */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-[9px] font-medium text-neutral-400">
                <Activity className="h-2.5 w-2.5" />
                Arbs Today
              </div>
              <div className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                <AnimatedNumber value={metrics.arbsFoundToday} />
              </div>
            </div>
          </div>

          {/* Last Updated Footer */}
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-violet-100/50 dark:border-violet-900/30 text-[9px] text-violet-500/70 dark:text-violet-400/70">
            <Clock className="h-2.5 w-2.5" />
            <span>Updated {metrics.lastUpdated}</span>
          </div>
        </div>
      )}
    </div>
  );
}
