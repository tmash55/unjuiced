"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { usePlayerBoxScores } from "@/hooks/use-player-box-scores";
import { useTeamRoster } from "@/hooks/use-team-roster";
import { DrilldownHeader } from "./header/drilldown-header";
import { MarketScroller } from "./hero/market-scroller";
import { HitRateSummaryStrip } from "./hero/hit-rate-summary-strip";
import { HitRateChart, type ChartSplit, type ChartWindow } from "./hero/hit-rate-chart";
import { MatchupTile } from "./hero/matchup-tile";
import { StatOverviewTile } from "./hero/stat-overview-tile";
import {
  RosterRail,
  type TeammateFilter,
  type RosterTeammate,
} from "./hero/roster-rail";
import { computeHitRates } from "./shared/hit-rate-utils";

interface PlayerDrilldownV2Props {
  profile: HitRateProfile;
  allPlayerProfiles: HitRateProfile[];
  sport: "nba" | "wnba";
  onMarketChange: (market: string) => void;
  backHref: string;
}

// v2 player drilldown — bento grid above the fold (chart hero + matchup +
// stat overview + roster/injuries rail), tabs below for deep dives.
export function PlayerDrilldownV2({
  profile,
  allPlayerProfiles,
  sport,
  onMarketChange,
  backHref,
}: PlayerDrilldownV2Props) {
  // ── Filter state lives at the orchestrator so all tiles stay in sync ──────
  const [customLine, setCustomLine] = useState<number | null>(null);
  const [chartSplit, setChartSplit] = useState<ChartSplit>("all");
  const [chartWindow, setChartWindow] = useState<ChartWindow>(20);
  const [teammateFilters, setTeammateFilters] = useState<TeammateFilter[]>([]);

  // Reset filters whenever the active market changes — line for "Points" shouldn't
  // carry over to "Rebounds", and split filters often don't translate either.
  useEffect(() => {
    setCustomLine(null);
    setChartSplit("all");
  }, [profile.market]);

  const defaultLine = profile.line ?? 0;
  const effectiveLine = customLine ?? defaultLine;
  const isCustomLine = customLine !== null && Math.abs(customLine - defaultLine) > 1e-6;

  // Box scores power live recomputation when the user adjusts the line.
  const boxScoresQuery = usePlayerBoxScores({
    playerId: profile.playerId,
    sport,
    enabled: !!profile.playerId,
  });
  const boxScoreGames = boxScoresQuery.games ?? [];

  // Team roster powers the right-rail injury panel + WITH/WITHOUT toggles.
  const rosterQuery = useTeamRoster({
    teamId: profile.teamId,
    sport,
    enabled: !!profile.teamId,
  });

  // Top 5 rotation teammates by minutes, excluding the current player.
  const topTeammates: RosterTeammate[] = useMemo(() => {
    return rosterQuery.players
      .filter((p) => p.playerId !== profile.playerId)
      .sort((a, b) => (b.avgMinutes ?? 0) - (a.avgMinutes ?? 0))
      .slice(0, 6)
      .map((p) => ({
        playerId: String(p.playerId),
        name: p.name,
        position: p.position ?? null,
        injuryStatus: p.injuryStatus ?? null,
      }));
  }, [rosterQuery.players, profile.playerId]);

  // Recompute hit rates from box scores when the user is on a custom line.
  // (Teammate filters TODO: requires per-game teammate availability data, which
  //  isn't on the box-score response yet — UI is wired, recompute lands later.)
  const computedRates = useMemo(() => {
    if (!isCustomLine || boxScoreGames.length === 0) return null;
    return computeHitRates(
      boxScoreGames,
      profile.market,
      effectiveLine,
      profile.opponentTeamId
    );
  }, [isCustomLine, boxScoreGames, profile.market, profile.opponentTeamId, effectiveLine]);

  // Toggle teammate filter: clicking the same chip removes it; clicking the
  // opposite chip swaps the mode for that teammate.
  const toggleTeammate = (next: TeammateFilter) => {
    setTeammateFilters((prev) => {
      const existing = prev.find((f) => f.playerId === next.playerId);
      if (!existing) return [...prev, next];
      if (existing.mode === next.mode) {
        // Same chip clicked — remove the filter
        return prev.filter((f) => f.playerId !== next.playerId);
      }
      // Different mode — swap
      return prev.map((f) =>
        f.playerId === next.playerId ? next : f
      );
    });
  };

  return (
    <div className="space-y-4 pb-8">
      <DrilldownHeader
        profile={profile}
        sport={sport}
        effectiveLine={effectiveLine}
        onLineChange={(next) => setCustomLine(next)}
        onLineReset={() => setCustomLine(null)}
        backHref={backHref}
      />

      <MarketScroller
        profiles={allPlayerProfiles}
        selectedMarket={profile.market}
        onMarketChange={onMarketChange}
      />

      <HitRateSummaryStrip
        profile={profile}
        sport={sport}
        computedRates={computedRates}
        isCustomLine={isCustomLine}
      />

      {/* Bento grid — chart hero on the left (8 col), roster rail on the right
          (4 col, full bento height). Below the chart: matchup + stat overview
          tiles (4 col each). On <lg the grid stacks single-column. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <HitRateChart
            games={boxScoreGames}
            market={profile.market}
            line={effectiveLine}
            sport={sport}
            isCustomLine={isCustomLine}
            isLoading={boxScoresQuery.isLoading}
            split={chartSplit}
            onSplitChange={setChartSplit}
            windowSize={chartWindow}
            onWindowChange={setChartWindow}
            upcomingGameDate={profile.gameDate}
            upcomingOpponentAbbr={profile.opponentTeamAbbr}
            upcomingHomeAway={profile.homeAway}
          />
        </div>

        <div className="lg:col-span-4 lg:row-span-2">
          <RosterRail
            teammates={topTeammates}
            filters={teammateFilters}
            onFilterToggle={toggleTeammate}
            onClearFilters={() => setTeammateFilters([])}
            isLoading={rosterQuery.isLoading}
          />
        </div>

        <div className="lg:col-span-4">
          <MatchupTile profile={profile} sport={sport} />
        </div>

        <div className="lg:col-span-4">
          <StatOverviewTile
            profiles={allPlayerProfiles}
            activeMarket={profile.market}
          />
        </div>
      </div>

      {/* Tabs land here next */}
      <section className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/40 p-12 text-center text-sm font-medium text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-500">
        Tabs (Shooting • Play Types • Odds & Lines • Correlations • Game Log) land here next.
      </section>
    </div>
  );
}
