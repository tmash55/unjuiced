"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Stats {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  roi: number;
  pnl100: number;
  since: string | null;
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
      <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-xl border border-neutral-800/60 px-4 py-3 animate-pulse">
        <div className="h-5 w-64 bg-neutral-700/50 rounded" />
      </div>
    );
  }

  if (!stats || stats.total === 0) return null;

  const positive = stats.roi >= 0;

  return (
    <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-xl border border-neutral-800/60 px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="font-semibold text-white">
          {positive ? "🟢" : "🔴"}{" "}
          <span className="text-emerald-400">{stats.wins}</span>
          <span className="text-neutral-500">-</span>
          <span className="text-red-400">{stats.losses}</span>
          <span className="text-neutral-400 ml-1">({stats.winRate}%)</span>
        </span>

        <span className="text-neutral-600">·</span>

        <span className={cn("font-bold tabular-nums", positive ? "text-emerald-400" : "text-red-400")}>
          {positive ? "+" : ""}{stats.roi}% ROI
        </span>

        <span className="text-neutral-600">·</span>

        <span className={cn("font-medium tabular-nums", positive ? "text-emerald-400" : "text-red-400")}>
          {stats.pnl100 >= 0 ? "+" : ""}${Math.abs(stats.pnl100).toLocaleString()}
          <span className="text-neutral-500 font-normal"> on $100/bet</span>
        </span>

        {stats.since && (
          <>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-500">Since {formatSince(stats.since)}</span>
          </>
        )}

        <span className="text-[10px] text-neutral-600 ml-auto" title="Based on consensus sharp money picks (≥60% dollar flow on one side)">
          ℹ️ Consensus picks only
        </span>
      </div>
    </div>
  );
}
