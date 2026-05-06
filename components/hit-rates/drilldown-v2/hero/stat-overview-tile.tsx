"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tile } from "../shared/tile";
import type { HitRateProfile } from "@/lib/hit-rates-schema";

interface StatOverviewTileProps {
  profiles: HitRateProfile[];
  /** Currently selected market — its row is subtly emphasized. */
  activeMarket: string;
}

// The shortlist of markets we care about for the overview — basketball-focused.
// We pick from `profiles` rather than the raw box scores so the values reflect
// the same server-computed numbers that drive the hit-rate table.
const OVERVIEW_MARKETS: { market: string; label: string }[] = [
  { market: "player_points", label: "PTS" },
  { market: "player_rebounds", label: "REB" },
  { market: "player_assists", label: "AST" },
  { market: "player_threes_made", label: "3PM" },
];

// Recent vs season average — one-glance "is this player trending up or down?"
// Each row shows last10Avg with a delta arrow vs seasonAvg.
export function StatOverviewTile({ profiles, activeMarket }: StatOverviewTileProps) {
  const rows = OVERVIEW_MARKETS.map(({ market, label }) => {
    const p = profiles.find((profile) => profile.market === market);
    return {
      market,
      label,
      last10Avg: p?.last10Avg ?? null,
      seasonAvg: p?.seasonAvg ?? null,
    };
  });

  return (
    <Tile label="Stat Overview">
      <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
        {rows.map((row) => (
          <StatRow
            key={row.market}
            label={row.label}
            value={row.last10Avg}
            seasonAvg={row.seasonAvg}
            isActive={row.market === activeMarket}
          />
        ))}
      </div>
    </Tile>
  );
}

function StatRow({
  label,
  value,
  seasonAvg,
  isActive,
}: {
  label: string;
  value: number | null;
  seasonAvg: number | null;
  isActive: boolean;
}) {
  const delta =
    value !== null && seasonAvg !== null ? value - seasonAvg : null;
  const deltaTier =
    delta === null
      ? "neutral"
      : Math.abs(delta) < 0.05
      ? "neutral"
      : delta > 0
      ? "up"
      : "down";

  const Icon = deltaTier === "up" ? TrendingUp : deltaTier === "down" ? TrendingDown : Minus;
  const deltaColor =
    deltaTier === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : deltaTier === "down"
      ? "text-rose-600 dark:text-rose-400"
      : "text-neutral-400 dark:text-neutral-500";

  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-2 rounded-md px-1 py-0.5",
        isActive && "bg-brand/10 ring-1 ring-brand/20"
      )}
    >
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.14em]",
          isActive ? "text-brand" : "text-neutral-500 dark:text-neutral-400"
        )}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-base font-black leading-none tabular-nums text-neutral-900 dark:text-white">
          {value !== null ? value.toFixed(1) : "—"}
        </span>
        {delta !== null && (
          <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums", deltaColor)}>
            <Icon className="h-3 w-3" />
            {Math.abs(delta).toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}
