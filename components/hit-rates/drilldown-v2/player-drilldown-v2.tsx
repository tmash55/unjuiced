"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import { usePlayerBoxScores } from "@/hooks/use-player-box-scores";
import { usePlayerPeriodBoxScores } from "@/hooks/use-player-period-box-scores";
import { useTeamRoster } from "@/hooks/use-team-roster";
import {
  usePlayerGamesWithInjuries,
  usePlayersOutForFilter,
  type GameWithInjuries,
  type PlayerOutInfo,
} from "@/hooks/use-injury-context";
import { DrilldownHeader } from "./header/drilldown-header";
import { PlayerSwitcherStrip } from "./header/player-switcher-strip";
import { MarketScroller } from "./hero/market-scroller";
import {
  HitRateChart,
  SPLIT_OPTIONS,
  type ChartHitRateSegment,
  type ChartRange,
  type ChartSplit,
} from "./hero/hit-rate-chart";
import { getQuickFilters, dvpRankFieldForMarket } from "./shared/quick-filters";
import { useDvpRankings } from "@/hooks/use-dvp-rankings";
import { getHitRateTableConfig } from "@/lib/hit-rates/table-config";
import {
  RosterRail,
  type TeammateFilter,
  type RosterTeammate,
} from "./hero/roster-rail";
import { MatchupContextPanel } from "./hero/matchup-context-panel";
import { DrilldownTabs } from "./tabs/drilldown-tabs";
import { computeHitRates } from "./shared/hit-rate-utils";

interface PlayerDrilldownV2Props {
  profile: HitRateProfile;
  allPlayerProfiles: HitRateProfile[];
  switcherPlayers: HitRateProfile[];
  switcherGames: React.ComponentProps<typeof PlayerSwitcherStrip>["games"];
  switcherGameId: string | null;
  onSwitcherGameSelect: (gameId: string | null) => void;
  onSwitcherPlayerSelect: (profile: HitRateProfile) => void;
  isLoadingSwitcherPlayers?: boolean;
  sport: "nba" | "wnba";
  onMarketChange: (market: string) => void;
  backHref: string;
}

const normalizeInjuryGameId = (id: string | number | null | undefined): string => {
  if (id === null || id === undefined) return "";
  return String(id).replace(/^0+/, "") || "0";
};

// v2 player drilldown — bento grid above the fold (chart hero + matchup +
// stat overview + roster/injuries rail), tabs below for deep dives.
export function PlayerDrilldownV2({
  profile,
  allPlayerProfiles,
  switcherPlayers,
  switcherGames,
  switcherGameId,
  onSwitcherGameSelect,
  onSwitcherPlayerSelect,
  isLoadingSwitcherPlayers = false,
  sport,
  onMarketChange,
  backHref,
}: PlayerDrilldownV2Props) {
  // ── Filter state lives at the orchestrator so all tiles stay in sync ──────
  const [customLine, setCustomLine] = useState<number | null>(null);
  const [chartSplit, setChartSplit] = useState<ChartSplit>("all");
  const [chartRange, setChartRange] = useState<ChartRange>("l20");
  const [teammateFilters, setTeammateFilters] = useState<TeammateFilter[]>([]);
  // Market-aware quick-filter chip ids the user has toggled on. Cleared on
  // market change since chip ids are scoped per market.
  const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set());

  // Reset only the custom line on market change — a "PTS line 25.5" doesn't
  // translate to "REB". chartRange / chartSplit / quickFilters / teammateFilters
  // carry forward; the chart's filter pass naturally ignores any active quick-
  // filter id that doesn't exist for the new market (volume chips are
  // market-specific) so it's safe to keep them in state.
  useEffect(() => {
    setCustomLine(null);
  }, [profile.market]);

  const defaultLine = profile.line ?? 0;
  const effectiveLine = customLine ?? defaultLine;
  const isCustomLine = customLine !== null && Math.abs(customLine - defaultLine) > 1e-6;

  // 1Q markets pull their stat values from the per-period table, but full-game
  // rows remain the base dataset so filters keep the same game/injury context.
  const isQ1Market = profile.market.startsWith("1st_quarter_player_");

  // Box scores power live recomputation when the user adjusts the line.
  const fullBoxScoresQuery = usePlayerBoxScores({
    playerId: profile.playerId,
    sport,
    enabled: !!profile.playerId,
  });
  const periodBoxScoresQuery = usePlayerPeriodBoxScores({
    playerId: profile.playerId,
    sport,
    period: 1,
    enabled: !!profile.playerId && isQ1Market,
  });
  const periodStatsByGameId = useMemo(() => {
    const map = new Map<
      string,
      {
        pts: number;
        reb: number;
        ast: number;
        minutes: number;
        stl: number;
        blk: number;
        fgm: number;
        fga: number;
        fg3m: number;
        fg3a: number;
      }
    >();
    for (const game of periodBoxScoresQuery.games ?? []) {
      map.set(normalizeInjuryGameId(game.gameId), {
        pts: game.pts ?? 0,
        reb: game.reb ?? 0,
        ast: game.ast ?? 0,
        minutes: game.minutes ?? 0,
        stl: game.stl ?? 0,
        blk: game.blk ?? 0,
        fgm: game.fgm ?? 0,
        fga: game.fga ?? 0,
        fg3m: game.fg3m ?? 0,
        fg3a: game.fg3a ?? 0,
      });
    }
    return map;
  }, [periodBoxScoresQuery.games]);
  const boxScoreGames = useMemo(() => {
    const games = fullBoxScoresQuery.games ?? [];
    if (!isQ1Market) return games;

    return games.map((game) => {
      const q1 = periodStatsByGameId.get(normalizeInjuryGameId(game.gameId));
      return {
        ...game,
        q1Pts: q1?.pts ?? 0,
        q1Reb: q1?.reb ?? 0,
        q1Ast: q1?.ast ?? 0,
        q1Minutes: q1?.minutes ?? 0,
        q1Stl: q1?.stl ?? 0,
        q1Blk: q1?.blk ?? 0,
        q1Fgm: q1?.fgm ?? 0,
        q1Fga: q1?.fga ?? 0,
        q1Fg3m: q1?.fg3m ?? 0,
        q1Fg3a: q1?.fg3a ?? 0,
      };
    });
  }, [fullBoxScoresQuery.games, isQ1Market, periodStatsByGameId]);
  const isLoadingBoxScores = fullBoxScoresQuery.isLoading || (isQ1Market && periodBoxScoresQuery.isLoading);

  // Team roster powers the right-rail injury panel + WITH/WITHOUT toggles.
  // We fetch BOTH the player's team and the opponent's team so the rail can
  // show injuries from both sides of the matchup, props.cash style.
  const rosterQuery = useTeamRoster({
    teamId: profile.teamId,
    sport,
    enabled: !!profile.teamId,
  });
  const opponentRosterQuery = useTeamRoster({
    teamId: profile.opponentTeamId,
    sport,
    enabled: !!profile.opponentTeamId,
  });

  // Per-game injury context — used to (a) render "Teammates Out" in each bar's
  // hover tooltip and (b) filter the chart by With/Without teammate filters.
  const injuriesQuery = usePlayerGamesWithInjuries({
    playerId: profile.playerId,
    sport,
    enabled: !!profile.playerId,
  });

  // Lookup map: normalized gameId → GameWithInjuries (carries teammates_out
  // and opponents_out arrays). Used by the chart for per-bar filtering and
  // by the tooltip for the teammates-out section.
  const gameInjuriesByGameId = useMemo(() => {
    const map = new Map<string, GameWithInjuries>();
    for (const g of injuriesQuery.games ?? []) {
      if (!g.game_id) continue;
      map.set(String(g.game_id), g);
      map.set(normalizeInjuryGameId(g.game_id), g);
    }
    return map;
  }, [injuriesQuery.games]);

  // Season-aggregate stats for any teammate who has been out at least once.
  // The per-game GameWithInjuries records only carry avgs in the WNBA path;
  // for NBA we need this lookup to know each teammate's PPG/RPG/APG so the
  // tooltip's "Teammates Out" section can rank by impact.
  const playersOutQuery = usePlayersOutForFilter({
    playerId: profile.playerId,
    sport,
    enabled: !!profile.playerId,
  });
  const playerAvgsById = useMemo(() => {
    const map = new Map<number, PlayerOutInfo>();
    for (const t of playersOutQuery.data?.teammates_out ?? []) {
      map.set(t.player_id, t);
    }
    return map;
  }, [playersOutQuery.data]);

  // DvP rankings for the player's position — drives the chart's defense
  // quick-filter chips (Top N D / Bottom N D). Map opp team_id → rank for
  // the ACTIVE market's stat so the predicate is one cheap lookup.
  const dvpQuery = useDvpRankings({
    position: profile.position ?? "",
    sport,
    enabled: !!profile.position,
  });
  const dvpRankByOpponent = useMemo(() => {
    const map = new Map<number, number>();
    const field = dvpRankFieldForMarket(profile.market);
    if (!field) return map;
    for (const team of dvpQuery.teams) {
      const t = team as unknown as Record<string, unknown>;
      const rank = t[field];
      const teamId = (team as { team_id?: number }).team_id;
      if (typeof teamId === "number" && typeof rank === "number") {
        map.set(teamId, rank);
      }
    }
    return map;
  }, [dvpQuery.teams, profile.market]);
  const dvpTotalTeams = sport === "wnba" ? 13 : 30;

  // Fresh injury overlay — switcherPlayers is sourced from
  // nba_hit_rate_profiles_v2 which is updated as props refresh, while the
  // team-roster RPC reads nba_players_hr (lags by hours). Build a Map of
  // playerId/nbaPlayerId → fresh status so we can overlay it onto the roster
  // and the rail surfaces the same Questionable/Out badges the switcher pills
  // already show.
  const freshInjuryByPlayerId = useMemo(() => {
    const map = new Map<number, { injuryStatus: string | null; injuryNotes: string | null }>();
    for (const p of switcherPlayers) {
      const entry = { injuryStatus: p.injuryStatus ?? null, injuryNotes: p.injuryNotes ?? null };
      // Index by both ids so an NBA-side roster id matches a WNBA-side
      // hit-rate playerId (and vice versa). Skip empty/zero ids.
      if (p.playerId) map.set(p.playerId, entry);
      if (p.nbaPlayerId) map.set(p.nbaPlayerId, entry);
    }
    return map;
  }, [switcherPlayers]);

  // Combine player-team + opponent-team rosters into a single list with team
  // metadata. The rail decides what to show (injured-only vs all) and renders
  // the team abbr per row so the user can tell which side a player is on.
  const topTeammates: RosterTeammate[] = useMemo(() => {
    const merge = (rosterStatus: string | null, rosterNotes: string | null, fresh: { injuryStatus: string | null; injuryNotes: string | null } | undefined) => {
      // Prefer the fresh value when it's a non-available status (Q/Out/etc).
      // Fall back to roster otherwise so non-matched players still surface
      // their stale-but-valid status.
      const freshIsMeaningful =
        fresh?.injuryStatus &&
        fresh.injuryStatus.toLowerCase() !== "available" &&
        fresh.injuryStatus.toLowerCase() !== "active";
      if (freshIsMeaningful) {
        return { injuryStatus: fresh!.injuryStatus, injuryNotes: fresh!.injuryNotes ?? rosterNotes };
      }
      return { injuryStatus: rosterStatus, injuryNotes: rosterNotes };
    };

    const playerTeam = rosterQuery.players
      .filter((p) => p.playerId !== profile.playerId)
      .map((p) => {
        const fresh = freshInjuryByPlayerId.get(p.playerId);
        const merged = merge(p.injuryStatus ?? null, p.injuryNotes ?? null, fresh);
        return {
          playerId: String(p.playerId),
          name: p.name,
          position: p.position ?? null,
          injuryStatus: merged.injuryStatus,
          injuryNotes: merged.injuryNotes,
          teamAbbr: profile.teamAbbr ?? "",
          isOpponent: false,
        };
      });
    const oppTeam = opponentRosterQuery.players.map((p) => {
      const fresh = freshInjuryByPlayerId.get(p.playerId);
      const merged = merge(p.injuryStatus ?? null, p.injuryNotes ?? null, fresh);
      return {
        playerId: String(p.playerId),
        name: p.name,
        position: p.position ?? null,
        injuryStatus: merged.injuryStatus,
        injuryNotes: merged.injuryNotes,
        teamAbbr: profile.opponentTeamAbbr ?? "",
        isOpponent: true,
      };
    });
    return [...playerTeam, ...oppTeam];
  }, [
    rosterQuery.players,
    opponentRosterQuery.players,
    profile.playerId,
    profile.teamAbbr,
    profile.opponentTeamAbbr,
    freshInjuryByPlayerId,
  ]);

  // Merge the fresh injury overlay onto the roster feed before handing it to
  // the tabs (Roster table needs the same fresh status the rail surfaces, not
  // the stale nba_players_hr value).
  const sortedRosterPlayers = useMemo(() => {
    return [...rosterQuery.players]
      .map((p) => {
        const fresh = freshInjuryByPlayerId.get(p.playerId);
        const freshIsMeaningful =
          fresh?.injuryStatus &&
          fresh.injuryStatus.toLowerCase() !== "available" &&
          fresh.injuryStatus.toLowerCase() !== "active";
        if (!freshIsMeaningful) return p;
        return {
          ...p,
          injuryStatus: fresh!.injuryStatus,
          injuryNotes: fresh!.injuryNotes ?? p.injuryNotes,
        };
      })
      .sort((a, b) => (b.avgMinutes ?? 0) - (a.avgMinutes ?? 0));
  }, [rosterQuery.players, freshInjuryByPlayerId]);

  // Apply roster With/Without filters to the box scores. Player-team filters
  // check teammates_out; opponent-team filters check opponents_out. A
  // "without" filter keeps games where that player WAS out, which lets H2H
  // answer questions like "LeBron vs OKC when Jalen Williams was out."
  const filteredBoxScores = useMemo(() => {
    if (teammateFilters.length === 0) return boxScoreGames;
    return boxScoreGames.filter((g) => {
      const inj = gameInjuriesByGameId.get(g.gameId) ?? gameInjuriesByGameId.get(normalizeInjuryGameId(g.gameId));
      // No injury context → can't verify the filter. Drop conservatively.
      if (!inj) return false;
      return teammateFilters.every((f) => {
        const outList = f.isOpponent ? inj.opponents_out : inj.teammates_out;
        const outIds = new Set(outList.map((t) => String(t.player_id)));
        const wasOut = outIds.has(f.playerId);
        return f.mode === "without" ? wasOut : !wasOut;
      });
    });
  }, [boxScoreGames, teammateFilters, gameInjuriesByGameId]);

  // Recompute hit rates from box scores when the user has adjusted the line OR
  // pinned at least one teammate filter — either case invalidates the
  // server-computed defaults. The chart header chips (L5/L10/L20/SZN/H2H) and
  // BarColumn ghosts both consume this.
  const shouldRecompute = isCustomLine || teammateFilters.length > 0;
  const computedRates = useMemo(() => {
    if (!shouldRecompute || filteredBoxScores.length === 0) return null;
    return computeHitRates(
      filteredBoxScores,
      profile.market,
      effectiveLine,
      profile.opponentTeamId
    );
  }, [shouldRecompute, filteredBoxScores, profile.market, profile.opponentTeamId, effectiveLine]);

  // Hit-rate segments rendered in the chart header — server-computed by default,
  // recomputed from box scores when the user is on a custom line.
  const chartHitRateSegments: ChartHitRateSegment[] = useMemo(() => {
    const config = getHitRateTableConfig(sport);
    if (computedRates) {
      return [
        { range: "l5", label: "L5", pct: computedRates.last5Pct, sample: computedRates.last5Sample },
        { range: "l10", label: "L10", pct: computedRates.last10Pct, sample: computedRates.last10Sample },
        { range: "l20", label: "L20", pct: computedRates.last20Pct, sample: computedRates.last20Sample },
        { range: "szn", label: config.seasonPctLabel, pct: computedRates.seasonPct, sample: computedRates.seasonSample },
        { range: "h2h", label: "H2H", pct: computedRates.h2hPct, sample: computedRates.h2hSample },
      ];
    }
    return [
      { range: "l5", label: "L5", pct: profile.last5Pct, sample: 5 },
      { range: "l10", label: "L10", pct: profile.last10Pct, sample: 10 },
      { range: "l20", label: "L20", pct: profile.last20Pct, sample: 20 },
      { range: "szn", label: config.seasonPctLabel, pct: profile.seasonPct, sample: profile.seasonGames ?? null },
      { range: "h2h", label: "H2H", pct: profile.h2hPct, sample: profile.h2hGames ?? null },
    ];
  }, [computedRates, profile.last5Pct, profile.last10Pct, profile.last20Pct, profile.seasonPct, profile.seasonGames, profile.h2hPct, profile.h2hGames, sport]);

  // Build the unified active-filter chip list for the chart's "Active" row.
  // Each chip carries its own onRemove so the chart doesn't need to know
  // about every filter type — it just renders + removes.
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];

    // Note: a custom line is treated as the chart's anchor metric, not a
    // filter — the cyan threshold + WHAT-IF chip in the chart header
    // already convey it, and surfacing it here would crowd actual filters.

    // Split (skip "all")
    if (chartSplit !== "all") {
      const splitOpt = SPLIT_OPTIONS.find((opt) => opt.value === chartSplit);
      if (splitOpt) {
        chips.push({
          id: `split-${chartSplit}`,
          label: splitOpt.label,
          onRemove: () => setChartSplit("all"),
        });
      }
    }

    // Quick filters
    if (quickFilters.size > 0) {
      const available = getQuickFilters({
        market: profile.market,
        upcomingHomeAway: profile.homeAway,
        recentGames: boxScoreGames,
        dvpRankByOpponent,
        totalTeams: dvpTotalTeams,
      });
      for (const id of quickFilters) {
        const qf = available.find((f) => f.id === id);
        if (qf) {
          chips.push({
            id: `quick-${id}`,
            label: qf.label,
            onRemove: () =>
              setQuickFilters((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              }),
          });
        }
      }
    }

    // Teammate filters — resolve names from the combined roster (player + opp).
    const teammateById = new Map<string, RosterTeammate>();
    for (const t of topTeammates) teammateById.set(`${t.playerId}-${t.isOpponent}`, t);
    for (const f of teammateFilters) {
      const key = `${f.playerId}-${Boolean(f.isOpponent)}`;
      const teammate = teammateById.get(key);
      const name = teammate ? lastNameOf(teammate.name) : f.playerId;
      chips.push({
        id: `teammate-${key}-${f.mode}`,
        label: `${f.mode === "with" ? "With" : "W/O"} ${name}`,
        onRemove: () =>
          setTeammateFilters((prev) =>
            prev.filter(
              (x) =>
                !(
                  x.playerId === f.playerId &&
                  x.mode === f.mode &&
                  Boolean(x.isOpponent) === Boolean(f.isOpponent)
                )
            )
          ),
      });
    }
    return chips;
  }, [
    chartSplit,
    quickFilters,
    profile.market,
    profile.homeAway,
    boxScoreGames,
    teammateFilters,
    topTeammates,
  ]);

  const onClearAllFilters = () => {
    // Don't reset customLine — line adjustments aren't filters; reset stays
    // local to the LineStepper / threshold double-click / R key.
    setChartSplit("all");
    setQuickFilters(new Set());
    setTeammateFilters([]);
  };

  // Toggle teammate filter: clicking the same chip removes it; clicking the
  // opposite chip swaps the mode for that teammate.
  const toggleTeammate = (next: TeammateFilter) => {
    setTeammateFilters((prev) => {
      const sameSide = (f: TeammateFilter) => Boolean(f.isOpponent) === Boolean(next.isOpponent);
      const existing = prev.find((f) => f.playerId === next.playerId && sameSide(f));
      if (!existing) return [...prev, next];
      if (existing.mode === next.mode) {
        // Same chip clicked — remove the filter
        return prev.filter((f) => !(f.playerId === next.playerId && sameSide(f)));
      }
      // Different mode — swap
      return prev.map((f) =>
        f.playerId === next.playerId && sameSide(f) ? next : f
      );
    });
  };

  return (
    <div className="pb-8">
      {/* Top cap — switcher + markets stay sticky as one unit so market nav and
          player swap are always one click away. The command-bar header below
          scrolls naturally with the rest of the content. */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 border-b border-neutral-200/60 bg-white/95 px-4 backdrop-blur-xl sm:px-6 lg:px-8 dark:border-neutral-800/60 dark:bg-neutral-950/95">
        <PlayerSwitcherStrip
          backHref={backHref}
          sport={sport}
          players={switcherPlayers}
          games={switcherGames}
          activePlayerId={profile.playerId}
          selectedGameId={switcherGameId}
          onGameSelect={onSwitcherGameSelect}
          onPlayerSelect={onSwitcherPlayerSelect}
          isLoading={isLoadingSwitcherPlayers}
        />
        <MarketScroller
          profiles={allPlayerProfiles}
          selectedMarket={profile.market}
          onMarketChange={onMarketChange}
        />
      </div>

      {/* Bento grid — chart hero (9 col, with player command bar baked in as
          its top row) + slim roster rail (3 col). The deep-dive tabs sit
          directly beneath this row so users do not have to hunt below summary
          tiles before switching context. */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-9">
          <HitRateChart
            games={boxScoreGames}
            market={profile.market}
            line={effectiveLine}
            sport={sport}
            isCustomLine={isCustomLine}
            isLoading={isLoadingBoxScores}
            split={chartSplit}
            onSplitChange={setChartSplit}
            range={chartRange}
            onRangeChange={setChartRange}
            hitRateSegments={chartHitRateSegments}
            opponentTeamId={profile.opponentTeamId}
            gameInjuriesByGameId={gameInjuriesByGameId}
            playerAvgsById={playerAvgsById}
            teammateFilters={teammateFilters}
            quickFilters={quickFilters}
            onQuickFilterToggle={(id) =>
              setQuickFilters((prev) => {
                const next = new Set(prev);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
              })
            }
            onQuickFiltersClear={() => setQuickFilters(new Set())}
            onQuickFiltersSet={(ids) => setQuickFilters(ids)}
            dvpRankByOpponent={dvpRankByOpponent}
            dvpTotalTeams={dvpTotalTeams}
            tonightDate={profile.gameDate}
            tonightSpread={profile.spread}
            activeFilterChips={activeFilterChips}
            onClearAllFilters={onClearAllFilters}
            onLineChange={(next) => setCustomLine(next)}
            onLineReset={() => setCustomLine(null)}
            topSlot={
              <DrilldownHeader
                profile={profile}
                sport={sport}
                effectiveLine={effectiveLine}
                onLineChange={(next) => setCustomLine(next)}
                onLineReset={() => setCustomLine(null)}
              />
            }
            upcomingGameDate={profile.gameDate}
            upcomingOpponentAbbr={profile.opponentTeamAbbr}
            upcomingHomeAway={profile.homeAway}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-3 lg:col-span-3">
          {/* Rail flex-grows so its body can scroll when the matchup card
              + chart-height constraint pushes more content than fits. */}
          <RosterRail
            teammates={topTeammates}
            filters={teammateFilters}
            onFilterToggle={toggleTeammate}
            onClearFilters={() => setTeammateFilters([])}
            isLoading={rosterQuery.isLoading}
            compact
            className="flex-1 min-h-0"
          />
          <MatchupContextPanel profile={profile} sport={sport} />
        </div>
      </div>

      <DrilldownTabs
        profile={profile}
        profiles={allPlayerProfiles}
        sport={sport}
        games={boxScoreGames}
        rosterPlayers={sortedRosterPlayers}
        teammateFilters={teammateFilters}
        onTeammateFilterToggle={toggleTeammate}
        isLoadingGames={isLoadingBoxScores}
        isLoadingRoster={rosterQuery.isLoading}
        activeLine={effectiveLine}
        onLineSelect={(line) => setCustomLine(line)}
        chartRange={chartRange}
      />
    </div>
  );
}

function lastNameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
}
