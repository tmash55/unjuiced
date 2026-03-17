"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatOdds, computeSummaryStats, relativeTime } from "@/lib/line-history/utils";
import type { LineHistoryBookData } from "@/lib/odds/line-history";

interface SummaryStatsProps {
  bookData: LineHistoryBookData | undefined;
  isMobile: boolean;
}

export function SummaryStats({ bookData, isMobile }: SummaryStatsProps) {
  const stats = useMemo(() => {
    if (!bookData?.entries?.length) return null;
    return computeSummaryStats(bookData.entries);
  }, [bookData]);

  if (!stats) return null;

  const changeColor =
    stats.impliedProbChange === 0
      ? "text-neutral-400"
      : stats.impliedProbChange > 0
        ? "text-rose-500 dark:text-rose-400"
        : "text-emerald-500 dark:text-emerald-400";

  const changeSign = stats.impliedProbChange > 0 ? "+" : "";

  const cells = [
    { label: "Open", value: formatOdds(stats.openPrice) },
    { label: "High", value: formatOdds(stats.highPrice), sub: relativeTime(stats.highTimestamp) },
    { label: "Low", value: formatOdds(stats.lowPrice), sub: relativeTime(stats.lowTimestamp) },
    { label: "Current", value: formatOdds(stats.currentPrice) },
    {
      label: "% Change",
      value: `${changeSign}${stats.impliedProbChange.toFixed(1)}%`,
      className: changeColor,
    },
    { label: "Moves", value: String(stats.lineMovesCount) },
  ];

  return (
    <div
      className={cn(
        "rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-3 py-3",
        isMobile ? "grid grid-cols-3 gap-x-3 gap-y-1.5" : "grid grid-cols-6 gap-3"
      )}
    >
      {cells.map((cell) => (
        <div key={cell.label} className="rounded-xl bg-neutral-50/75 dark:bg-white/[0.03] px-2.5 py-2">
          <p className="text-[9px] text-neutral-500 uppercase tracking-[0.16em] font-medium">{cell.label}</p>
          <p className={cn("text-[14px] font-bold tabular-nums text-neutral-950 dark:text-white", cell.className)}>
            {cell.value}
          </p>
          {cell.sub && <p className="text-[9px] text-neutral-500 mt-0.5">{cell.sub}</p>}
        </div>
      ))}
    </div>
  );
}
