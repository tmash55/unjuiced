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

// 70 / 50 / below — same thresholds the desktop hit-rate table, the mobile
// drilldown chips, and the mobile player-card all use, so a player reads the
// same tier across every surface they appear on. Three tiers (emerald /
// amber / red) instead of the previous five-tier scheme; the strip's pill
// background carries the visual weight, so we don't need extra gradient
// stops to convey "very good" vs "good".
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
  if (value >= 70) {
    return {
      bg: "bg-emerald-50 dark:bg-emerald-500/20",
      text: "text-emerald-600 dark:text-emerald-400",
      label: "text-emerald-700/70 dark:text-emerald-300/70",
      ring: "ring-emerald-500/20 dark:ring-emerald-400/20",
    };
  }
  if (value >= 50) {
    return {
      bg: "bg-amber-50 dark:bg-amber-500/15",
      text: "text-amber-600 dark:text-amber-400",
      label: "text-amber-700/70 dark:text-amber-300/70",
      ring: "ring-amber-500/20 dark:ring-amber-400/20",
    };
  }
  return {
    bg: "bg-red-50 dark:bg-red-500/20",
    text: "text-red-500 dark:text-red-400",
    label: "text-red-600/70 dark:text-red-300/70",
    ring: "ring-red-500/20 dark:ring-red-400/20",
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

// Inline "consistency profile" — one tight row of chips the user reads before
// the chart. Tier colors carry the same meaning as the hit-rate table so the
// drilldown reads as a continuation of it. When `computedRates` is provided
// (custom line in play), the strip recomputes from box scores so the user's
// what-if adjustment is reflected immediately.
export function HitRateSummaryStrip({
  profile,
  sport,
  computedRates,
  isCustomLine,
}: HitRateSummaryStripProps) {
  const config = getHitRateTableConfig(sport);

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
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
        Hit Rates
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {segments.map((seg) => {
          const tone = tierClasses(seg.pct);
          const count = formatCount(seg.pct, seg.sample ?? null);
          const hasValue = seg.pct !== null && seg.pct !== undefined;
          return (
            <div
              key={seg.label}
              className={cn(
                "inline-flex items-baseline gap-1.5 rounded-md px-2 py-1 ring-1 transition-colors",
                tone.bg,
                tone.ring
              )}
            >
              <span
                className={cn(
                  "text-[9px] font-bold uppercase tracking-[0.16em]",
                  tone.label
                )}
              >
                {seg.label}
              </span>
              <span className={cn("text-xs font-black leading-none tabular-nums", tone.text)}>
                {formatPct(seg.pct)}
              </span>
              {hasValue && count && (
                <span className={cn("text-[10px] font-bold tabular-nums opacity-60", tone.text)}>
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {isCustomLine && (
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand ring-1 ring-brand/20">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
          Custom line
        </span>
      )}
    </div>
  );
}
