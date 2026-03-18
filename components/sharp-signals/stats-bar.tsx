"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TierStats {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  roi: number;
  pnl100: number;
}

interface Stats {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  roi: number;
  pnl100: number;
  since: string | null;
  byTier?: {
    sharp: TierStats;
    whale: TierStats;
    all: TierStats;
  };
}

function formatSince(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/polymarket/stats")
      .then((r) => r.json())
      .then((d) => { if (d.total != null) setStats(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/80 px-5 py-3.5 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-4 w-20 bg-neutral-700/40 rounded" />
          <div className="h-4 w-px bg-neutral-700/40" />
          <div className="h-4 w-16 bg-neutral-700/40 rounded" />
          <div className="h-4 w-px bg-neutral-700/40" />
          <div className="h-4 w-24 bg-neutral-700/40 rounded" />
        </div>
      </div>
    );
  }

  if (!stats || stats.total === 0) return null;

  const positive = stats.roi >= 0;

  return (
    <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/80 backdrop-blur-sm px-5 py-3.5 shadow-sm shadow-black/10">
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <div className="flex items-center gap-2 font-semibold text-white">
          <span className={cn("h-2 w-2 rounded-full", positive ? "bg-emerald-400" : "bg-red-400")} />
          <span className="tabular-nums">
            <span className="text-emerald-400">{stats.wins}</span>
            <span className="text-neutral-600 mx-0.5">–</span>
            <span className="text-red-400">{stats.losses}</span>
          </span>
          <span className="text-neutral-500 font-normal">({stats.winRate}%)</span>
        </div>

        <span className="h-4 w-px bg-neutral-700/60" />

        <span className={cn("font-bold tabular-nums", positive ? "text-emerald-400" : "text-red-400")}>
          {positive ? "+" : ""}{stats.roi}% ROI
        </span>

        <span className="h-4 w-px bg-neutral-700/60" />

        <span className={cn("font-medium tabular-nums", positive ? "text-emerald-400" : "text-red-400")}>
          {stats.pnl100 >= 0 ? "+" : ""}${Math.abs(stats.pnl100).toLocaleString()}
          <span className="text-neutral-500 font-normal ml-1">on $100/bet</span>
        </span>

        {stats.since && (
          <>
            <span className="h-4 w-px bg-neutral-700/60" />
            <span className="text-neutral-500">Since {formatSince(stats.since)}</span>
          </>
        )}

        <span
          className="text-[10px] text-neutral-600 ml-auto cursor-help"
          title="Based on consensus sharp money picks (≥60% dollar flow on one side). Sharps only — excludes whale and burner tiers."
        >
          Sharp consensus only
        </span>
      </div>
    </div>
  );
}
