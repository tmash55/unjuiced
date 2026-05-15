import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeBasketballSeasonType } from "@/lib/basketball/pace-context";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Returns L5 / L10 / Season pace + league rank for one or more teams. Used by
// the drilldown's Matchup Context table to show the player's team and the
// opponent's pace side by side. Prefers `basketball_team_pace_rankings`, with
// a game-level fallback for seasons before the precomputed table is backfilled.
// Path lives under /api/nba for legacy reasons, but the route serves both
// leagues via the `league` query param.

type BasketballLeague = "nba" | "wnba";
type Window = "l5" | "l10" | "season";

interface WindowEntry {
  pace: number | null;
  rank: number | null;
  gamesPlayed: number | null;
}
interface TeamPace {
  l5: WindowEntry;
  l10: WindowEntry;
  season: WindowEntry;
}

export interface TeamPaceResponse {
  league: "nba" | "wnba";
  season: string;
  totalTeams: number;
  teams: Record<string, TeamPace>;
}

const EMPTY: WindowEntry = { pace: null, rank: null, gamesPlayed: null };
const WINDOWS: Window[] = ["l5", "l10", "season"];

const QuerySchema = z
  .object({
    teamIds: z.string().transform((v) =>
      v
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
    season: z.string().nullish(),
    league: z
      .enum(["nba", "wnba"])
      .nullish()
      .transform((v) => v ?? "nba"),
  })
  .transform((value) => ({
    ...value,
    season: value.season ?? defaultSeasonForLeague(value.league),
  }));

interface RankingRow {
  team_id: number;
  pace_window: string;
  pace: number | null;
  pace_rank: number | null;
  games_played: number | null;
  season_type: string | null;
}

interface GamePaceRow {
  team_id: number | null;
  pace: number | null;
  game_date: string | null;
  season_type: string | null;
}

function defaultSeasonForLeague(league: BasketballLeague) {
  return league === "wnba" ? "2026" : "2025-26";
}

function totalTeamsForLeagueSeason(league: BasketballLeague, season: string) {
  if (league === "nba") return 30;
  const seasonYear = Number(season);
  return Number.isFinite(seasonYear) && seasonYear >= 2026 ? 15 : 13;
}

function createEmptyTeams(teamIds: number[]) {
  const teams: Record<string, TeamPace> = {};
  for (const id of teamIds) {
    teams[String(id)] = { l5: { ...EMPTY }, l10: { ...EMPTY }, season: { ...EMPTY } };
  }
  return teams;
}

function roundPace(value: number) {
  return Math.round(value * 100) / 100;
}

function averagePace(rows: GamePaceRow[]) {
  const values = rows
    .map((row) => row.pace)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return null;
  return roundPace(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function applyRankingRows(teams: Record<string, TeamPace>, rows: RankingRow[]) {
  // For each (team, window) take the row with the highest games_played —
  // that's the primary season-type bucket (regular season for most of
  // the year). Avoids picking a 0-game playoff row that overrides a
  // populated regular-season row.
  for (const row of rows) {
    const win = row.pace_window as Window;
    if (!WINDOWS.includes(win)) continue;
    const entry = teams[String(row.team_id)];
    if (!entry) continue;
    const existing = entry[win];
    const newer = (row.games_played ?? 0) > (existing.gamesPlayed ?? -1);
    if (existing.pace === null || newer) {
      entry[win] = {
        pace: row.pace,
        rank: row.pace_rank,
        gamesPlayed: row.games_played,
      };
    }
  }
}

function hasMissingPace(teams: Record<string, TeamPace>) {
  return Object.values(teams).some((team) =>
    WINDOWS.some((window) => team[window].pace === null || team[window].rank === null)
  );
}

function fillMissingPace(target: Record<string, TeamPace>, fallback: Record<string, TeamPace>) {
  for (const [teamId, team] of Object.entries(target)) {
    const fallbackTeam = fallback[teamId];
    if (!fallbackTeam) continue;

    for (const window of WINDOWS) {
      if (team[window].pace === null || team[window].rank === null) {
        team[window] = fallbackTeam[window];
      }
    }
  }
}

async function computePaceFromGameRows(
  supabase: any,
  league: BasketballLeague,
  season: string,
  teamIds: number[]
) {
  const { data, error } = await supabase
    .from("basketball_team_game_pace")
    .select("team_id, pace, game_date, season_type")
    .eq("league", league)
    .eq("season", season)
    .order("game_date", { ascending: false });

  if (error) {
    console.error(`[${league.toUpperCase()} Team Pace] game pace fallback error:`, error.message);
    return createEmptyTeams(teamIds);
  }

  const rows = ((data ?? []) as GamePaceRow[]).filter(
    (row) =>
      row.team_id &&
      row.game_date &&
      typeof row.pace === "number" &&
      normalizeBasketballSeasonType(row.season_type, league, row.game_date) === "Regular Season"
  );
  const requestedIds = new Set(teamIds);
  const rowsByTeam = new Map<number, GamePaceRow[]>();

  for (const row of rows) {
    const teamId = row.team_id!;
    const current = rowsByTeam.get(teamId) ?? [];
    current.push(row);
    rowsByTeam.set(teamId, current);
  }

  const teams = createEmptyTeams(teamIds);

  for (const window of WINDOWS) {
    const ranked: Array<{ teamId: number; pace: number; gamesPlayed: number }> = [];
    for (const [teamId, teamRows] of rowsByTeam.entries()) {
      const sorted = [...teamRows].sort((a, b) => String(b.game_date).localeCompare(String(a.game_date)));
      const sample = window === "season" ? sorted : sorted.slice(0, window === "l5" ? 5 : 10);
      const pace = averagePace(sample);
      if (pace !== null && sample.length > 0) {
        ranked.push({ teamId, pace, gamesPlayed: sample.length });
      }
    }

    ranked.sort((a, b) => b.pace - a.pace || a.teamId - b.teamId);

    ranked.forEach((entry, index) => {
      if (!requestedIds.has(entry.teamId)) return;
      teams[String(entry.teamId)][window] = {
        pace: entry.pace,
        rank: index + 1,
        gamesPlayed: entry.gamesPlayed,
      };
    });
  }

  return teams;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      teamIds: searchParams.get("teamIds"),
      season: searchParams.get("season"),
      league: searchParams.get("league"),
    });

    if (!parsed.success || parsed.data.teamIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error?.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { teamIds, season, league } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Prefer the requested season so WNBA 2026 expansion teams do not inherit
    // stale 2025 rows. If the precomputed table is missing a season, fill from
    // game-level pace rows below.
    const { data, error } = await supabase
      .from("basketball_team_pace_rankings")
      .select("team_id, pace_window, pace, pace_rank, games_played, season, season_type")
      .eq("league", league)
      .eq("season", season)
      .in("team_id", teamIds);

    if (error) {
      console.error(`[${league.toUpperCase()} Team Pace] query error:`, error.message);
      return NextResponse.json(
        { error: "Failed to fetch team pace", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const teams = createEmptyTeams(teamIds);
    applyRankingRows(teams, (data ?? []) as RankingRow[]);

    if (hasMissingPace(teams)) {
      const computed = await computePaceFromGameRows(supabase, league, season, teamIds);
      fillMissingPace(teams, computed);
    }

    const response: TeamPaceResponse = {
      league,
      season,
      totalTeams: totalTeamsForLeagueSeason(league, season),
      teams,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/team-pace] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
