"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { HitRateProfile } from "@/lib/hit-rates-schema";
import {
  usePlayerBoxScores,
  type BoxScoreGame,
} from "@/hooks/use-player-box-scores";
import { usePlayerPeriodBoxScores } from "@/hooks/use-player-period-box-scores";
import { useTeamRoster } from "@/hooks/use-team-roster";
import {
  useLineup,
  type LineupPlayer,
  type TeamLineup,
} from "@/hooks/use-lineup";
import {
  usePlayerGamesWithInjuries,
  usePlayersOutForFilter,
  type GameWithInjuries,
  type PlayerOutInfo,
} from "@/hooks/use-injury-context";
import { type LineOdds } from "@/hooks/use-hit-rate-odds";
import {
  getBestSideFromOddsLine,
  useOddsLine,
  type OddsLineResponse,
} from "@/hooks/use-odds-line";
import {
  useAlternateLines,
  type AlternateLine,
} from "@/hooks/use-alternate-lines";
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
import {
  getQuickFilters,
  dvpRankFieldForMarket,
  resolveQuickFilter,
} from "./shared/quick-filters";
import { useDvpRankings } from "@/hooks/use-dvp-rankings";
import { useTeamPace } from "@/hooks/use-team-pace";
import { useTeamPlayTypeRanks } from "@/hooks/use-team-play-type-ranks";
import { getHitRateTableConfig } from "@/lib/hit-rates/table-config";
import {
  RosterRail,
  type TeammateFilter,
  type RosterTeammate,
} from "./hero/roster-rail";
import { MatchupContextPanel } from "./hero/matchup-context-panel";
import { DrilldownTabs } from "./tabs/drilldown-tabs";
import { computeHitRates } from "./shared/hit-rate-utils";
import { useChartPreferences } from "@/hooks/use-chart-preferences";
import { getDvpTeamCount } from "@/lib/dvp-rank-scale";

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

const normalizeInjuryGameId = (
  id: string | number | null | undefined,
): string => {
  if (id === null || id === undefined) return "";
  return String(id).replace(/^0+/, "") || "0";
};

const isPlayoffSeasonType = (seasonType: string | null | undefined) => {
  if (!seasonType) return false;
  const lower = seasonType.toLowerCase();
  if (isCupSeasonType(lower)) return false;
  return /\b(playoffs?|postseason|round|conf\.?|finals?|play-in)\b/.test(lower);
};

const isRegularSeasonType = (seasonType: string | null | undefined) => {
  if (!seasonType) return false;
  const lower = seasonType.toLowerCase();
  if (isPlayoffSeasonType(seasonType)) return false;
  return lower !== "preseason";
};

const isCupSeasonType = (lowerSeasonType: string) =>
  /\b(cup|in-season|ist|emirates|commissioner)\b/.test(lowerSeasonType);

const gameMatchesChartSplit = (game: BoxScoreGame, split: ChartSplit) => {
  switch (split) {
    case "home":
      return game.homeAway === "H";
    case "away":
      return game.homeAway === "A";
    case "win":
      return game.result === "W";
    case "loss":
      return game.result === "L";
    case "winBy10":
      return game.result === "W" && game.margin >= 10;
    case "lossBy10":
      return game.result === "L" && game.margin <= -10;
    case "reg":
      return isRegularSeasonType(game.seasonType);
    case "playoffs":
      return isPlayoffSeasonType(game.seasonType);
    default:
      return true;
  }
};

const SINGLE_LINE_ODDS_MARKETS = new Set([
  "player_double_double",
  "player_triple_double",
]);

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
  const [customLineState, setCustomLineState] = useState<{
    market: string;
    line: number;
  } | null>(null);
  const [chartSplit, setChartSplit] = useState<ChartSplit>("all");
  const [chartRange, setChartRange] = useState<ChartRange>("l20");
  const [teammateFilters, setTeammateFilters] = useState<TeammateFilter[]>([]);
  // Market-aware quick-filter chip ids the user has toggled on. Cleared on
  // market change since chip ids are scoped per market.
  const [quickFilters, setQuickFilters] = useState<Set<string>>(new Set());
  // Stat overlays (Minutes / FGA / 3PA / Passes today) live on the user
  // preferences row so the user's preferred chart layout follows them
  // across sessions and devices. Toggled from either the per-metric
  // popovers in the chart's quick-filter row or from the chart settings
  // gear popover — both write to the same persisted set.
  const chartPrefs = useChartPreferences();
  const metricOverlays = useMemo(
    () => new Set(chartPrefs.settings.metricOverlays),
    [chartPrefs.settings.metricOverlays],
  );

  const defaultLine = profile.line ?? 0;
  // Custom lines are scoped to the market they were selected on. This avoids a
  // stale PTS line being used for the first REB/AST odds request during market
  // switches, which can make the live Redis lookup come back empty.
  const customLine =
    customLineState?.market === profile.market ? customLineState.line : null;
  const setActiveCustomLine = (line: number) => {
    setCustomLineState({ market: profile.market, line });
  };
  const resetActiveCustomLine = () => setCustomLineState(null);
  const effectiveLine = customLine ?? defaultLine;
  const isCustomLine =
    customLine !== null && Math.abs(customLine - defaultLine) > 1e-6;
  const oddsContextProfile = useMemo(() => {
    if (profile.eventId && (profile.selKey || profile.oddsSelectionId)) {
      return profile;
    }

    const isSingleLineMarket = SINGLE_LINE_ODDS_MARKETS.has(profile.market);
    if (!isSingleLineMarket) return profile;

    const donor = allPlayerProfiles
      .filter(
        (candidate) =>
          candidate.playerId === profile.playerId &&
          !!candidate.eventId &&
          !!(candidate.selKey || candidate.oddsSelectionId) &&
          !SINGLE_LINE_ODDS_MARKETS.has(candidate.market),
      )
      .sort((a, b) => {
        const aSameGame =
          Number(a.gameId === profile.gameId && !!profile.gameId) +
          Number(a.gameDate === profile.gameDate && !!profile.gameDate) +
          Number(
            a.opponentTeamId === profile.opponentTeamId &&
              !!profile.opponentTeamId,
          );
        const bSameGame =
          Number(b.gameId === profile.gameId && !!profile.gameId) +
          Number(b.gameDate === profile.gameDate && !!profile.gameDate) +
          Number(
            b.opponentTeamId === profile.opponentTeamId &&
              !!profile.opponentTeamId,
          );
        return bSameGame - aSameGame;
      })[0];

    if (!donor) return profile;

    return {
      ...profile,
      eventId: profile.eventId ?? donor.eventId,
      selKey: profile.selKey ?? donor.selKey,
      oddsSelectionId: profile.oddsSelectionId ?? donor.oddsSelectionId,
      gameId: profile.gameId ?? donor.gameId,
      gameDate: profile.gameDate ?? donor.gameDate,
      startTime: profile.startTime ?? donor.startTime,
      gameStatus: profile.gameStatus ?? donor.gameStatus,
      opponentTeamId: profile.opponentTeamId ?? donor.opponentTeamId,
      opponentTeamAbbr: profile.opponentTeamAbbr ?? donor.opponentTeamAbbr,
      opponentTeamName: profile.opponentTeamName ?? donor.opponentTeamName,
      homeAway: profile.homeAway ?? donor.homeAway,
      spread: profile.spread ?? donor.spread,
      total: profile.total ?? donor.total,
      gameOddsBook: profile.gameOddsBook ?? donor.gameOddsBook,
      spreadBook: profile.spreadBook ?? donor.spreadBook,
      totalBook: profile.totalBook ?? donor.totalBook,
    };
  }, [allPlayerProfiles, profile]);

  const redisPlayerKey = useMemo(() => {
    const rawKey =
      oddsContextProfile.selKey ?? oddsContextProfile.oddsSelectionId;
    return rawKey ? rawKey.split(":")[0] : null;
  }, [oddsContextProfile.selKey, oddsContextProfile.oddsSelectionId]);
  const oddsLineQuery = useOddsLine({
    sport,
    eventId: oddsContextProfile.eventId,
    market: profile.market,
    playerId: redisPlayerKey,
    line: effectiveLine,
    includeSgp: true,
    enabled:
      !!oddsContextProfile.eventId && !!profile.market && !!redisPlayerKey,
  });
  const alternateLinesQuery = useAlternateLines({
    sport,
    eventId: oddsContextProfile.eventId,
    selKey: redisPlayerKey,
    playerId: profile.playerId,
    market: profile.market,
    currentLine: effectiveLine,
    enabled:
      !!oddsContextProfile.eventId &&
      !!redisPlayerKey &&
      !!profile.playerId &&
      !!profile.market,
  });
  const liveOdds = useMemo(
    () =>
      buildLiveLineOdds({
        profile: oddsContextProfile,
        effectiveLine,
        oddsLine: oddsLineQuery.data,
        alternateLines: alternateLinesQuery.lines,
      }),
    [
      oddsContextProfile,
      effectiveLine,
      oddsLineQuery.data,
      alternateLinesQuery.lines,
    ],
  );
  const isOddsLoading =
    oddsLineQuery.isLoading || alternateLinesQuery.isLoading;

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
  const isLoadingBoxScores =
    fullBoxScoresQuery.isLoading ||
    (isQ1Market && periodBoxScoresQuery.isLoading);

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

  // Daily lineup feed for tonight's matchup — drives the "Starter / Bench /
  // Projected vs Confirmed" badges in the Roster tab. Falls back to teamId+date
  // when gameId is missing client-side. We pull the whole game (both sides)
  // off a single gameId-keyed query so the Roster tab can show both teams.
  const lineupQuery = useLineup({
    gameId: profile.gameId,
    teamId: profile.teamId ?? null,
    date: profile.gameDate ?? null,
    sport,
    enabled: !!(profile.gameId || (profile.teamId && profile.gameDate)),
  });

  // Quick-lookup map: nba_player_id → LineupPlayer for the active player's
  // team. The roster table joins on this to surface starter slot, lineup
  // status (confirmed/expected/may_not_play) and play probability.
  const lineupByPlayerId = useMemo(() => {
    const map = new Map<number, LineupPlayer>();
    const playerTeamId = profile.teamId;
    if (playerTeamId == null) return map;
    const playerTeam = lineupQuery.teams.find((t) => t.teamId === playerTeamId);
    if (!playerTeam) return map;
    for (const p of playerTeam.players) {
      if (p.playerId != null) map.set(p.playerId, p);
    }
    return map;
  }, [lineupQuery.teams, profile.teamId]);

  const playerTeamLineup: TeamLineup | null = useMemo(() => {
    const teamId = profile.teamId;
    if (teamId == null) return null;
    return lineupQuery.teams.find((t) => t.teamId === teamId) ?? null;
  }, [lineupQuery.teams, profile.teamId]);

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
    season: sport === "wnba" ? "2026" : undefined,
    enabled: !!profile.position,
  });
  const dvpRankByOpponent = useMemo(() => {
    const map = new Map<number, number>();
    const field = dvpRankFieldForMarket(profile.market);
    if (!field) return map;
    for (const team of dvpQuery.teams) {
      const t = team as unknown as Record<string, unknown>;
      const rank = t[field];
      // The DvP API returns camelCase fields (`teamId`, `ptsRank`, etc.).
      // Reading `team_id` was always undefined → map stayed empty → DvP
      // overlay + filters silently no-op'd. v1 also reads `team.teamId`.
      const teamId = (team as { teamId?: number }).teamId;
      if (typeof teamId === "number" && typeof rank === "number") {
        map.set(teamId, rank);
      }
    }
    return map;
  }, [dvpQuery.teams, profile.market]);
  const dvpTotalTeams = getDvpTeamCount(
    sport,
    profile.gameDate,
    profile.dvpTotalTeams ?? dvpQuery.meta?.totalTeams,
  );

  const currentOpponentTeamId =
    oddsContextProfile.opponentTeamId ?? profile.opponentTeamId ?? null;

  // Pace ranks for every historical opponent, plus the current matchup
  // opponent. Keyed by opponent_team_id so the chart can color-code per-game
  // pace context and extend the line into the upcoming-game column.
  const opponentTeamIds = useMemo(() => {
    const set = new Set<number>();
    for (const g of boxScoreGames) {
      if (typeof g.opponentTeamId === "number") set.add(g.opponentTeamId);
    }
    if (typeof currentOpponentTeamId === "number") {
      set.add(currentOpponentTeamId);
    }
    return [...set];
  }, [boxScoreGames, currentOpponentTeamId]);
  const teamPaceQuery = useTeamPace({
    teamIds: opponentTeamIds,
    sport,
    enabled: opponentTeamIds.length > 0,
  });
  const paceRankByOpponent = useMemo(() => {
    const map = new Map<number, number>();
    const teams = teamPaceQuery.teams;
    if (!teams) return map;
    for (const [teamIdStr, pace] of Object.entries(teams)) {
      const teamId = Number(teamIdStr);
      if (!Number.isFinite(teamId)) continue;
      // Prefer L10 (recent form) over season-long, fall back to season.
      const rank = pace.l10?.rank ?? pace.season?.rank ?? null;
      if (rank != null) map.set(teamId, rank);
    }
    return map;
  }, [teamPaceQuery.teams]);

  const teamPlayTypeRanks = useTeamPlayTypeRanks({
    season: "2025-26",
    enabled: sport === "nba",
  });
  const playTypeDefenseFilters = useMemo(() => {
    if (sport !== "nba") return [];
    return teamPlayTypeRanks.playTypes
      .filter((playType) => playType.teams.length > 0)
      .map((playType) => ({
        playType: playType.playType,
        label: playType.displayName || playType.playType,
        rankByOpponentAbbr: new Map(
          playType.teams.map((team) => [team.teamAbbr, team.pppRank]),
        ),
      }));
  }, [sport, teamPlayTypeRanks.playTypes]);

  // Fresh injury overlay — switcherPlayers is sourced from
  // nba_hit_rate_profiles_v2 which is updated as props refresh, while the
  // team-roster RPC reads nba_players_hr (lags by hours). Build a Map of
  // playerId/nbaPlayerId → fresh status so we can overlay it onto the roster
  // and the rail surfaces the same Questionable/Out badges the switcher pills
  // already show.
  const freshInjuryByPlayerId = useMemo(() => {
    const map = new Map<
      number,
      {
        injuryStatus: string | null;
        injuryNotes: string | null;
        injuryUpdatedAt: string | null;
        injuryReturnDate: string | null;
        injurySource: string | null;
        injuryRawStatus: string | null;
      }
    >();
    for (const p of switcherPlayers) {
      const entry = {
        injuryStatus: p.injuryStatus ?? null,
        injuryNotes: p.injuryNotes ?? null,
        injuryUpdatedAt: p.injuryUpdatedAt ?? null,
        injuryReturnDate: p.injuryReturnDate ?? null,
        injurySource: p.injurySource ?? null,
        injuryRawStatus: p.injuryRawStatus ?? null,
      };
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
    const merge = (
      p: {
        injuryStatus?: string | null;
        injuryNotes?: string | null;
        injuryUpdatedAt?: string | null;
        injuryReturnDate?: string | null;
        injurySource?: string | null;
        injuryRawStatus?: string | null;
      },
      fresh:
        | {
            injuryStatus: string | null;
            injuryNotes: string | null;
            injuryUpdatedAt: string | null;
            injuryReturnDate: string | null;
            injurySource: string | null;
            injuryRawStatus: string | null;
          }
        | undefined,
    ) => {
      // Prefer the fresh value when it's a non-available status (Q/Out/etc).
      // Fall back to roster otherwise so non-matched players still surface
      // their stale-but-valid status.
      const freshIsMeaningful =
        fresh?.injuryStatus &&
        fresh.injuryStatus.toLowerCase() !== "available" &&
        fresh.injuryStatus.toLowerCase() !== "active";
      if (freshIsMeaningful) {
        return {
          injuryStatus: fresh!.injuryStatus,
          injuryNotes: fresh!.injuryNotes ?? p.injuryNotes ?? null,
          injuryUpdatedAt: fresh!.injuryUpdatedAt ?? p.injuryUpdatedAt ?? null,
          injuryReturnDate:
            fresh!.injuryReturnDate ?? p.injuryReturnDate ?? null,
          injurySource: fresh!.injurySource ?? p.injurySource ?? null,
          injuryRawStatus: fresh!.injuryRawStatus ?? p.injuryRawStatus ?? null,
        };
      }
      return {
        injuryStatus: p.injuryStatus ?? null,
        injuryNotes: p.injuryNotes ?? null,
        injuryUpdatedAt: p.injuryUpdatedAt ?? null,
        injuryReturnDate: p.injuryReturnDate ?? null,
        injurySource: p.injurySource ?? null,
        injuryRawStatus: p.injuryRawStatus ?? null,
      };
    };

    const playerTeam = rosterQuery.players
      .filter((p) => p.playerId !== profile.playerId)
      .map((p) => {
        const fresh = freshInjuryByPlayerId.get(p.playerId);
        const merged = merge(p, fresh);
        return {
          playerId: String(p.playerId),
          name: p.name,
          position: p.position ?? null,
          injuryStatus: merged.injuryStatus,
          injuryNotes: merged.injuryNotes,
          injuryUpdatedAt: merged.injuryUpdatedAt,
          injuryReturnDate: merged.injuryReturnDate,
          injurySource: merged.injurySource,
          injuryRawStatus: merged.injuryRawStatus,
          teamAbbr: profile.teamAbbr ?? "",
          isOpponent: false,
        };
      });
    const oppTeam = opponentRosterQuery.players.map((p) => {
      const fresh = freshInjuryByPlayerId.get(p.playerId);
      const merged = merge(p, fresh);
      return {
        playerId: String(p.playerId),
        name: p.name,
        position: p.position ?? null,
        injuryStatus: merged.injuryStatus,
        injuryNotes: merged.injuryNotes,
        injuryUpdatedAt: merged.injuryUpdatedAt,
        injuryReturnDate: merged.injuryReturnDate,
        injurySource: merged.injurySource,
        injuryRawStatus: merged.injuryRawStatus,
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
          injuryUpdatedAt: fresh!.injuryUpdatedAt ?? p.injuryUpdatedAt,
          injuryReturnDate: fresh!.injuryReturnDate ?? p.injuryReturnDate,
          injurySource: fresh!.injurySource ?? p.injurySource,
          injuryRawStatus: fresh!.injuryRawStatus ?? p.injuryRawStatus,
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
      const inj =
        gameInjuriesByGameId.get(g.gameId) ??
        gameInjuriesByGameId.get(normalizeInjuryGameId(g.gameId));
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

  // Apply quick-filter chip predicates (FG%, FGM range, DvP tier, venue, etc.)
  // on top of the teammate-filtered set. Same predicate logic the chart uses
  // — applied here so the L5/L10/L20 strip recomputes off the same dataset
  // the chart bars are drawn from. Without this the strip would still show
  // unfiltered hit rates while the bars change underneath.
  const fullyFilteredBoxScores = useMemo(() => {
    const splitFiltered =
      chartSplit === "all"
        ? filteredBoxScores
        : filteredBoxScores.filter((game) =>
            gameMatchesChartSplit(game, chartSplit),
          );
    if (quickFilters.size === 0) return splitFiltered;
    const ctx = {
      market: profile.market,
      upcomingHomeAway: profile.homeAway,
      recentGames: boxScoreGames,
      dvpRankByOpponent,
      paceRankByOpponent,
      totalTeams: dvpTotalTeams,
      playTypeDefenseFilters,
      tonightDate: profile.gameDate,
      tonightSpread: profile.spread,
      tonightOpponentTeamId: currentOpponentTeamId,
    };
    const available = getQuickFilters(ctx);
    const predicates = [...quickFilters]
      .map((id) => resolveQuickFilter(id, available, ctx))
      .filter((qf): qf is NonNullable<typeof qf> => qf !== null);
    if (predicates.length === 0) return splitFiltered;
    return splitFiltered.filter((g) =>
      predicates.every((qf) => qf.predicate(g)),
    );
  }, [
    filteredBoxScores,
    chartSplit,
    quickFilters,
    profile.market,
    profile.homeAway,
    profile.gameDate,
    profile.spread,
    boxScoreGames,
    dvpRankByOpponent,
    paceRankByOpponent,
    dvpTotalTeams,
    playTypeDefenseFilters,
    currentOpponentTeamId,
  ]);

  // Recompute hit rates from box scores whenever ANY filter is in play —
  // custom line, teammate filters, OR quick-filter chips. Each case
  // invalidates the server-computed defaults that ship in `profile.last*Pct`.
  // The chart header chips (L5/L10/L20/SZN/H2H) and BarColumn ghosts both
  // consume this.
  const shouldRecompute =
    isCustomLine ||
    teammateFilters.length > 0 ||
    quickFilters.size > 0 ||
    chartSplit !== "all";
  const computedRates = useMemo(() => {
    if (!shouldRecompute || fullyFilteredBoxScores.length === 0) return null;
    return computeHitRates(
      fullyFilteredBoxScores,
      profile.market,
      effectiveLine,
      profile.opponentTeamId,
    );
  }, [
    shouldRecompute,
    fullyFilteredBoxScores,
    profile.market,
    profile.opponentTeamId,
    effectiveLine,
  ]);

  // Hit-rate segments rendered in the chart header — server-computed by default,
  // recomputed from box scores when the user is on a custom line.
  const chartHitRateSegments: ChartHitRateSegment[] = useMemo(() => {
    const config = getHitRateTableConfig(sport);
    if (computedRates) {
      return [
        {
          range: "l5",
          label: "L5",
          pct: computedRates.last5Pct,
          sample: computedRates.last5Sample,
        },
        {
          range: "l10",
          label: "L10",
          pct: computedRates.last10Pct,
          sample: computedRates.last10Sample,
        },
        {
          range: "l20",
          label: "L20",
          pct: computedRates.last20Pct,
          sample: computedRates.last20Sample,
        },
        {
          range: "szn",
          label: config.seasonPctLabel,
          pct: computedRates.seasonPct,
          sample: computedRates.seasonSample,
        },
        {
          range: "h2h",
          label: "H2H",
          pct: computedRates.h2hPct,
          sample: computedRates.h2hSample,
        },
      ];
    }
    return [
      { range: "l5", label: "L5", pct: profile.last5Pct, sample: 5 },
      { range: "l10", label: "L10", pct: profile.last10Pct, sample: 10 },
      { range: "l20", label: "L20", pct: profile.last20Pct, sample: 20 },
      {
        range: "szn",
        label: config.seasonPctLabel,
        pct: profile.seasonPct,
        sample: profile.seasonGames ?? null,
      },
      {
        range: "h2h",
        label: "H2H",
        pct: profile.h2hPct,
        sample: profile.h2hGames ?? null,
      },
    ];
  }, [
    computedRates,
    profile.last5Pct,
    profile.last10Pct,
    profile.last20Pct,
    profile.seasonPct,
    profile.seasonGames,
    profile.h2hPct,
    profile.h2hGames,
    sport,
  ]);

  // Build the unified active-filter chip list for the chart's "Active" row.
  // Each chip carries its own onRemove so the chart doesn't need to know
  // about every filter type — it just renders + removes.
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> =
      [];

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
        paceRankByOpponent,
        totalTeams: dvpTotalTeams,
        playTypeDefenseFilters,
        tonightOpponentTeamId: currentOpponentTeamId,
      });
      for (const id of quickFilters) {
        const qf = resolveQuickFilter(id, available, {
          market: profile.market,
          upcomingHomeAway: profile.homeAway,
          recentGames: boxScoreGames,
          dvpRankByOpponent,
          paceRankByOpponent,
          totalTeams: dvpTotalTeams,
          playTypeDefenseFilters,
          tonightOpponentTeamId: currentOpponentTeamId,
        });
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
    for (const t of topTeammates)
      teammateById.set(`${t.playerId}-${t.isOpponent}`, t);
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
                ),
            ),
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
    dvpRankByOpponent,
    paceRankByOpponent,
    dvpTotalTeams,
    playTypeDefenseFilters,
    currentOpponentTeamId,
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
      const sameSide = (f: TeammateFilter) =>
        Boolean(f.isOpponent) === Boolean(next.isOpponent);
      const existing = prev.find(
        (f) => f.playerId === next.playerId && sameSide(f),
      );
      if (!existing) return [...prev, next];
      if (existing.mode === next.mode) {
        // Same chip clicked — remove the filter
        return prev.filter(
          (f) => !(f.playerId === next.playerId && sameSide(f)),
        );
      }
      // Different mode — swap
      return prev.map((f) =>
        f.playerId === next.playerId && sameSide(f) ? next : f,
      );
    });
  };

  return (
    <div className="pb-8">
      {/* Top cap — switcher + markets stay sticky as one unit so market nav and
          player swap are always one click away. The command-bar header below
          scrolls naturally with the rest of the content. */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-neutral-200/60 bg-white/95 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:border-neutral-800/60 dark:bg-neutral-950/95">
        <PlayerSwitcherStrip
          backHref={backHref}
          sport={sport}
          players={switcherPlayers}
          games={switcherGames}
          activePlayerId={profile.playerId}
          activeProfile={profile}
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
            paceRankByOpponent={paceRankByOpponent}
            paceTotalTeams={teamPaceQuery.totalTeams}
            metricOverlays={metricOverlays}
            onMetricOverlayToggle={(key) => chartPrefs.toggleMetricOverlay(key)}
            playTypeDefenseFilters={playTypeDefenseFilters}
            tonightDate={oddsContextProfile.gameDate}
            tonightSpread={oddsContextProfile.spread}
            tonightTotal={oddsContextProfile.total}
            tonightOpponentTeamId={currentOpponentTeamId}
            activeFilterChips={activeFilterChips}
            onClearAllFilters={onClearAllFilters}
            onLineChange={setActiveCustomLine}
            onLineReset={resetActiveCustomLine}
            topSlot={
              <DrilldownHeader
                profile={oddsContextProfile}
                sport={sport}
                effectiveLine={effectiveLine}
                onLineChange={setActiveCustomLine}
                onLineReset={resetActiveCustomLine}
                odds={liveOdds}
              />
            }
            upcomingGameDate={oddsContextProfile.gameDate}
            upcomingOpponentAbbr={oddsContextProfile.opponentTeamAbbr}
            upcomingHomeAway={oddsContextProfile.homeAway}
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
            className="min-h-0 flex-1"
          />
          <MatchupContextPanel profile={oddsContextProfile} sport={sport} />
        </div>
      </div>

      <DrilldownTabs
        profile={oddsContextProfile}
        profiles={allPlayerProfiles}
        sport={sport}
        games={boxScoreGames}
        rosterPlayers={sortedRosterPlayers}
        teammateFilters={teammateFilters}
        onTeammateFilterToggle={toggleTeammate}
        isLoadingGames={isLoadingBoxScores}
        isLoadingRoster={rosterQuery.isLoading}
        lineupByPlayerId={lineupByPlayerId}
        teamLineup={playerTeamLineup}
        isLoadingLineup={lineupQuery.isLoading}
        activeLine={effectiveLine}
        onLineSelect={setActiveCustomLine}
        odds={liveOdds}
        isOddsLoading={isOddsLoading}
        chartRange={chartRange}
      />
    </div>
  );
}

type NormalizedLineOdds = LineOdds["allLines"][number];

function buildLiveLineOdds({
  profile,
  effectiveLine,
  oddsLine,
  alternateLines,
}: {
  profile: HitRateProfile;
  effectiveLine: number;
  oddsLine: OddsLineResponse | null;
  alternateLines: AlternateLine[];
}): LineOdds | null {
  const normalizedAlternateLines = alternateLines.map(
    mapAlternateLineToLineOdds,
  );
  const activeLineOdds = oddsLine
    ? mapOddsLineResponseToLineOdds(oddsLine)
    : null;

  const allLinesByLine = new Map<number, NormalizedLineOdds>();
  for (const line of normalizedAlternateLines) {
    allLinesByLine.set(line.line, line);
  }
  if (activeLineOdds) {
    allLinesByLine.set(activeLineOdds.line, activeLineOdds);
  }

  const sortedAllLines = Array.from(allLinesByLine.values()).sort(
    (a, b) => a.line - b.line,
  );
  const exactActiveLine =
    activeLineOdds ??
    sortedAllLines.find(
      (line) => Math.abs(line.line - effectiveLine) < 0.001,
    ) ??
    null;
  const isDefaultLine =
    profile.line !== null && Math.abs(profile.line - effectiveLine) < 0.001;

  const fallbackBestOver =
    isDefaultLine && profile.bestOdds
      ? {
          book: profile.bestOdds.book,
          price: profile.bestOdds.price,
          url: null,
          mobileUrl: null,
        }
      : null;

  const bestOver = exactActiveLine?.bestOver ?? fallbackBestOver;
  const bestUnder = exactActiveLine?.bestUnder ?? null;

  if (!bestOver && !bestUnder && sortedAllLines.length === 0) {
    return null;
  }

  return {
    stableKey: profile.selKey ?? profile.oddsSelectionId ?? "",
    eventId: profile.eventId,
    market: profile.market,
    primaryLine: profile.line,
    currentLine: effectiveLine,
    bestOver,
    bestUnder,
    allLines: sortedAllLines,
    live: true,
    timestamp: oddsLine?.updated_at ?? profile.bestOdds?.updated_at ?? null,
  };
}

function mapOddsLineResponseToLineOdds(
  oddsLine: OddsLineResponse,
): NormalizedLineOdds {
  const books: NormalizedLineOdds["books"] = {};

  for (const book of oddsLine.books ?? []) {
    if (!books[book.book]) books[book.book] = {};
    if (book.over !== null) {
      books[book.book].over = {
        price: book.over,
        url: book.link_over ?? null,
        mobileUrl: book.link_over ?? null,
        sgp: book.sgp_over ?? null,
        oddId: book.odd_id_over ?? null,
      };
    }
    if (book.under !== null) {
      books[book.book].under = {
        price: book.under,
        url: book.link_under ?? null,
        mobileUrl: book.link_under ?? null,
        sgp: book.sgp_under ?? null,
        oddId: book.odd_id_under ?? null,
      };
    }
  }

  return {
    line: oddsLine.line,
    bestOver: getBestSideFromOddsLine(oddsLine, "over"),
    bestUnder: getBestSideFromOddsLine(oddsLine, "under"),
    books,
  };
}

function mapAlternateLineToLineOdds(line: AlternateLine): NormalizedLineOdds {
  const books: NormalizedLineOdds["books"] = {};

  for (const book of line.books ?? []) {
    if (!books[book.book]) books[book.book] = {};
    if (book.price !== null && book.price !== undefined) {
      books[book.book].over = {
        price: book.price,
        url: book.url ?? null,
        mobileUrl: book.mobileUrl ?? null,
        oddId: book.oddId ?? null,
      };
    }
    if (book.underPrice !== null && book.underPrice !== undefined) {
      books[book.book].under = {
        price: book.underPrice,
        url: book.underUrl ?? null,
        mobileUrl: book.underMobileUrl ?? null,
        oddId: book.underOddId ?? null,
      };
    }
  }

  const overBooks = Object.entries(books)
    .map(([book, odds]) =>
      odds.over
        ? {
            book,
            price: odds.over.price,
            url: odds.over.url,
            mobileUrl: odds.over.mobileUrl,
            sgp: odds.over.sgp ?? null,
          }
        : null,
    )
    .filter(Boolean) as NonNullable<NormalizedLineOdds["bestOver"]>[];
  const underBooks = Object.entries(books)
    .map(([book, odds]) =>
      odds.under
        ? {
            book,
            price: odds.under.price,
            url: odds.under.url,
            mobileUrl: odds.under.mobileUrl,
            sgp: odds.under.sgp ?? null,
          }
        : null,
    )
    .filter(Boolean) as NonNullable<NormalizedLineOdds["bestUnder"]>[];

  overBooks.sort((a, b) => b.price - a.price);
  underBooks.sort((a, b) => b.price - a.price);

  return {
    line: line.line,
    bestOver: overBooks[0] ?? null,
    bestUnder: underBooks[0] ?? null,
    books,
  };
}

function lastNameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
}
