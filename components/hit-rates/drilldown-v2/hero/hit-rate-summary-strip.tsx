"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { getHitRateTableConfig, type HitRateSport } from "@/lib/hit-rates/table-config";
import type { HitRateBuckets } from "../shared/hit-rate-utils";

interface HitRateSummaryStripProps {
  profile: HitRateProfile;
  sport: HitRateSport;
  /** When provided (e.g. user adjusted the line), these override the profile's
      server-computed values so the cards reflect the what-if. */
  computedRates?: HitRateBuckets | null;
  /** Display hint that the user is on a custom line; tints the strip subtly. */
  isCustomLine?: boolean;
}

// Tier classes mirror the hit-rate table's getHitRateHeatClass so the drilldown
// reads as a continuation of the table — same color language for the same data.
const tierClasses = (
  value: number | null
): { bg: string; text: string; label: string; ring: string } => {
  if (value === null || value === undefined) {
    return {
      bg: "bg-neutral-50 dark:bg-neutral-900/80",
      text: "text-neutral-400 dark:text-neutral-500",
      label: "text-neutral-400 dark:text-neutral-500",
      ring: "ring-neutral-200/60 dark:ring-neutral-800/60",
    };
  }
  if (value >= 75) {
    return {
      bg: "bg-emerald-100 dark:bg-emerald-500/40",
      text: "text-emerald-800 dark:text-white",
      label: "text-emerald-700 dark:text-white/80",
      ring: "ring-emerald-500/30 dark:ring-emerald-400/30",
    };
  }
  if (value >= 60) {
    return {
      bg: "bg-emerald-50 dark:bg-emerald-500/20",
      text: "text-emerald-700 dark:text-emerald-300",
      label: "text-emerald-700/70 dark:text-emerald-300/70",
      ring: "ring-emerald-500/20 dark:ring-emerald-400/20",
    };
  }
  if (value >= 50) {
    return {
      bg: "bg-neutral-100 dark:bg-neutral-500/15",
      text: "text-neutral-700 dark:text-neutral-300",
      label: "text-neutral-500 dark:text-neutral-400",
      ring: "ring-neutral-300/50 dark:ring-neutral-600/40",
    };
  }
  if (value >= 35) {
    return {
      bg: "bg-red-50 dark:bg-red-500/20",
      text: "text-red-600 dark:text-red-300",
      label: "text-red-600/70 dark:text-red-300/70",
      ring: "ring-red-500/20 dark:ring-red-400/20",
    };
  }
  return {
    bg: "bg-red-100 dark:bg-red-500/40",
    text: "text-red-800 dark:text-white",
    label: "text-red-700 dark:text-white/80",
    ring: "ring-red-500/30 dark:ring-red-400/30",
  };
};

const formatPct = (value: number | null) => {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)}%`;
};

const formatCount = (pct: number | null, sample: number | null | undefined) => {
  if (pct === null || pct === undefined) return null;
  if (sample === null || sample === undefined || sample <= 0) return null;
  const hits = Math.round((pct / 100) * sample);
  return `${hits}/${sample}`;
};

// One-row "consistency profile" the user reads BEFORE the chart — color tiers
// communicate strength at a glance. When `computedRates` is provided (custom
// line in play), the strip recomputes from box scores so the user's what-if
// adjustment is reflected immediately.
export function HitRateSummaryStrip({
  profile,
  sport,
  computedRates,
  isCustomLine,
}: HitRateSummaryStripProps) {
  const config = getHitRateTableConfig(sport);

  // Prefer client-side computations when on a custom line, otherwise trust the
  // server's pre-computed values (split logic, season-type filtering, etc.).
  const segments = computedRates
    ? [
        { label: "L5", pct: computedRates.last5Pct, sample: computedRates.last5Sample },
        { label: "L10", pct: computedRates.last10Pct, sample: computedRates.last10Sample },
        { label: "L20", pct: computedRates.last20Pct, sample: computedRates.last20Sample },
        { label: config.seasonPctLabel, pct: computedRates.seasonPct, sample: computedRates.seasonSample },
        { label: "H2H", pct: computedRates.h2hPct, sample: computedRates.h2hSample },
      ]
    : [
        { label: "L5", pct: profile.last5Pct, sample: 5 },
        { label: "L10", pct: profile.last10Pct, sample: 10 },
        { label: "L20", pct: profile.last20Pct, sample: 20 },
        { label: config.seasonPctLabel, pct: profile.seasonPct, sample: profile.seasonGames },
        { label: "H2H", pct: profile.h2hPct, sample: profile.h2hGames },
      ];

  return (
    <div className="space-y-2">
      {isCustomLine && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand ring-1 ring-brand/20">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
          Custom line — recalculated from game logs
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-5">
      {segments.map((seg) => {
        const tone = tierClasses(seg.pct);
        const count = formatCount(seg.pct, seg.sample ?? null);
        const hasValue = seg.pct !== null && seg.pct !== undefined;
        return (
          <div
            key={seg.label}
            className={cn(
              "rounded-xl px-3 py-2.5 ring-1 transition-all duration-200",
              "hover:scale-[1.015] hover:shadow-sm",
              tone.bg,
              tone.ring
            )}
          >
            <div
              className={cn(
                "text-[9px] font-bold uppercase tracking-[0.18em]",
                tone.label
              )}
            >
              {seg.label}
            </div>
            <div className={cn("mt-1 flex items-baseline gap-1.5", tone.text)}>
              <span className="text-lg font-black leading-none tabular-nums">
                {formatPct(seg.pct)}
              </span>
              {hasValue && count && (
                <span className="text-[10px] font-bold tabular-nums opacity-60">
                  {count}
                </span>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
