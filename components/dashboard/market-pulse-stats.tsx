"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
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
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: fetchMetrics,
    refetchInterval: 30000,
    staleTime: 15000,
  });
  
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className={cn(
            "flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg shadow-sm",
            "bg-gradient-to-br from-violet-500 to-purple-600"
          )}>
            <IconBolt className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
          </div>
          <div>
            <span className="font-bold text-neutral-800 dark:text-neutral-100 text-xs sm:text-sm">Market Pulse</span>
            <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400 font-medium hidden sm:block">
              Today's activity snapshot
            </p>
          </div>
        </div>
        {/* Live indicator */}
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 border border-violet-200/50 dark:border-violet-700/30">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400 animate-pulse" />
          <span className="text-[8px] sm:text-[9px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Live</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 px-2 sm:px-3 pb-2 sm:pb-3 flex items-center">
        {isLoading ? (
          <div className="w-full flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
          </div>
        ) : (
          /* 3-Column Stats Grid */
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full">
            {/* Edges Found Today */}
            <div className={cn(
              "flex flex-col items-center justify-center px-1.5 sm:px-2 py-2 sm:py-3 rounded-md sm:rounded-lg text-center",
              "bg-violet-50 dark:bg-violet-900/20",
              "border border-violet-200/50 dark:border-violet-800/30"
            )}>
              <span className="text-base sm:text-lg font-black text-violet-700 dark:text-violet-300 tabular-nums leading-none">
                <AnimatedNumber value={metrics.edgesFoundToday} />
              </span>
              <span className="text-[8px] sm:text-[9px] font-semibold text-violet-600/80 dark:text-violet-400/80 uppercase tracking-wide mt-0.5 sm:mt-1">
                Edges
              </span>
            </div>

            {/* Highest EV */}
            <div className={cn(
              "flex flex-col items-center justify-center px-1.5 sm:px-2 py-2 sm:py-3 rounded-md sm:rounded-lg text-center",
              "bg-emerald-50 dark:bg-emerald-900/20",
              "border border-emerald-200/50 dark:border-emerald-800/30"
            )}>
              <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300 tabular-nums leading-none">
                {metrics.highestEvToday > 0 ? `+${metrics.highestEvToday.toFixed(1)}%` : "—"}
              </span>
              <span className="text-[8px] sm:text-[9px] font-semibold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wide mt-0.5 sm:mt-1">
                Best EV
              </span>
            </div>

            {/* Best Arb */}
            <div className={cn(
              "flex flex-col items-center justify-center px-1.5 sm:px-2 py-2 sm:py-3 rounded-md sm:rounded-lg text-center",
              "bg-sky-50 dark:bg-sky-900/20",
              "border border-sky-200/50 dark:border-sky-800/30"
            )}>
              <span className="text-base sm:text-lg font-black text-sky-700 dark:text-sky-300 tabular-nums leading-none">
                {metrics.highestArbToday > 0 ? `${metrics.highestArbToday.toFixed(2)}%` : "—"}
              </span>
              <span className="text-[8px] sm:text-[9px] font-semibold text-sky-600/80 dark:text-sky-400/80 uppercase tracking-wide mt-0.5 sm:mt-1">
                Best Arb
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
