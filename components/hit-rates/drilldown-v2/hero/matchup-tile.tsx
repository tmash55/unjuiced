"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Tile } from "../shared/tile";
import { formatMarketLabel } from "@/lib/data/markets";
import type { HitRateProfile } from "@/lib/hit-rates-schema";

interface MatchupTileProps {
  profile: HitRateProfile;
  sport: "nba" | "wnba";
}

const TOTAL_TEAMS_BY_SPORT: Record<"nba" | "wnba", number> = { nba: 30, wnba: 13 };

// Mirrors the table's matchup tier system. Pace tier is INVERTED relative to
// DEF: high pace rank = fast pace = good for offensive props.
type Tier = "elite" | "strong" | "neutral" | "bad" | "worst";

function getTier(rank: number | null, total: number): Tier | null {
  if (rank === null) return null;
  const toughEliteCutoff = Math.max(1, Math.floor(total * 0.17));
  const toughCutoff = Math.ceil(total / 3);
  const favorableCutoff = total - toughCutoff + 1;
  const favorableEliteCutoff = total - toughEliteCutoff + 1;
  if (rank <= toughEliteCutoff) return "worst";
  if (rank <= toughCutoff) return "bad";
  if (rank >= favorableEliteCutoff) return "elite";
  if (rank >= favorableCutoff) return "strong";
  return "neutral";
}

const tierTextColor = (tier: Tier | null) => {
  switch (tier) {
    case "elite":
      return "text-emerald-700 dark:text-emerald-300";
    case "strong":
      return "text-emerald-600 dark:text-emerald-400";
    case "bad":
      return "text-rose-500 dark:text-rose-400";
    case "worst":
      return "text-rose-600 dark:text-rose-300";
    case "neutral":
    default:
      return "text-neutral-700 dark:text-neutral-200";
  }
};

const defTierLabel = (tier: Tier | null) => {
  switch (tier) {
    case "elite": return "Easy";
    case "strong": return "Favorable";
    case "neutral": return "Average";
    case "bad": return "Hard";
    case "worst": return "Toughest";
    default: return "—";
  }
};

const paceTierLabel = (tier: Tier | null) => {
  switch (tier) {
    case "elite": return "Fast";
    case "strong": return "Above avg";
    case "neutral": return "Average";
    case "bad": return "Slow";
    case "worst": return "Slowest";
    default: return "—";
  }
};

// Compact matchup context — defense rank vs position, allowed value, opponent
// pace, and the supporting game lines. Each row sits flush so the eye reads
// the rank+tier badge as one chunk.
export function MatchupTile({ profile, sport }: MatchupTileProps) {
  const total = TOTAL_TEAMS_BY_SPORT[sport];
  const defTier = getTier(profile.matchupRank, total);
  // Pace rank is inverted: high rank = fast pace = good
  const paceRank = profile.paceContext?.opponentRecent.l5Rank ?? null;
  const paceTierInverted = paceRank !== null ? getTier(total - paceRank + 1, total) : null;

  return (
    <Tile label="Matchup">
      <div className="space-y-2.5">
        {/* DEF rank row */}
        <Row
          label="DEF Rank"
          mainValue={profile.matchupRank !== null ? `#${profile.matchupRank}` : "—"}
          mainColor={tierTextColor(defTier)}
          badge={defTierLabel(defTier)}
          badgeTier={defTier}
          subText={
            profile.matchupAvgAllowed !== null
              ? `Allows ${profile.matchupAvgAllowed.toFixed(1)} ${formatMarketLabel(profile.market)}/g`
              : null
          }
        />

        {/* Pace row */}
        <Row
          label="Opp Pace"
          mainValue={paceRank !== null ? `#${paceRank}` : "—"}
          mainColor={tierTextColor(paceTierInverted)}
          badge={paceTierLabel(paceTierInverted)}
          badgeTier={paceTierInverted}
          subText={
            profile.paceContext?.opponentRecent.l5 != null
              ? `${profile.paceContext.opponentRecent.l5.toFixed(1)} possessions / 48`
              : null
          }
        />

        {/* Game lines — quietly muted at the bottom */}
        {(profile.spread !== null || profile.total !== null) && (
          <div className="flex items-center gap-2 border-t border-neutral-200/50 pt-2.5 text-[11px] font-bold tabular-nums text-neutral-500 dark:border-neutral-800/50 dark:text-neutral-400">
            {profile.spread !== null && (
              <>
                <span className="text-[9px] uppercase tracking-[0.12em] text-neutral-400 dark:text-neutral-500">Spread</span>
                <span className="text-neutral-700 dark:text-neutral-200">
                  {profile.spread > 0 ? "+" : ""}
                  {profile.spread}
                </span>
              </>
            )}
            {profile.spread !== null && profile.total !== null && (
              <span className="text-neutral-300 dark:text-neutral-700">·</span>
            )}
            {profile.total !== null && (
              <>
                <span className="text-[9px] uppercase tracking-[0.12em] text-neutral-400 dark:text-neutral-500">Total</span>
                <span className="text-neutral-700 dark:text-neutral-200">
                  {Number.isInteger(profile.total) ? profile.total : profile.total.toFixed(1)}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </Tile>
  );
}

function Row({
  label,
  mainValue,
  mainColor,
  badge,
  badgeTier,
  subText,
}: {
  label: string;
  mainValue: string;
  mainColor: string;
  badge: string;
  badgeTier: Tier | null;
  subText: string | null;
}) {
  const badgeBg =
    badgeTier === "elite" || badgeTier === "strong"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : badgeTier === "bad" || badgeTier === "worst"
      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
      : "bg-neutral-500/15 text-neutral-500 dark:text-neutral-400";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
        <div className="flex items-center gap-2">
          <span className={cn("text-base font-black leading-none tabular-nums", mainColor)}>
            {mainValue}
          </span>
          <span
            className={cn(
              "rounded-sm px-1.5 py-px text-[9px] font-black uppercase tracking-wider",
              badgeBg
            )}
          >
            {badge}
          </span>
        </div>
      </div>
      {subText && (
        <div className="mt-0.5 text-right text-[10px] font-medium tabular-nums text-neutral-400 dark:text-neutral-500">
          {subText}
        </div>
      )}
    </div>
  );
}
