import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Returns L5 / L10 / Season pace + league rank for one or more teams. Used by
// the drilldown's Matchup Context table to show the player's team and the
// opponent's pace side by side. Sourced from `basketball_team_pace_rankings`,
// the same precomputed table that powers the table-row pace context.

const QuerySchema = z.object({
  teamIds: z.string().transform((v) =>
    v
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
  ),
  season: z.string().nullish().transform((v) => v ?? "2025-26"),
});

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
  league: "nba";
  season: string;
  totalTeams: number;
  teams: Record<string, TeamPace>;
}

const EMPTY: WindowEntry = { pace: null, rank: null, gamesPlayed: null };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      teamIds: searchParams.get("teamIds"),
      season: searchParams.get("season"),
    });

    if (!parsed.success || parsed.data.teamIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error?.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { teamIds, season } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Don't filter by season or season_type — the table stores raw provider
    // strings whose format/casing varies (`"2025-26"` vs `"2025"`,
    // `"Regular Season"` vs `"regular"`). Pull all rows for the teams and
    // pick the (team, window) entry with the highest games_played, which is
    // naturally the current bucket with real data.
    const { data, error } = await supabase
      .from("basketball_team_pace_rankings")
      .select("team_id, pace_window, pace, pace_rank, games_played, season, season_type")
      .eq("league", "nba")
      .in("team_id", teamIds);

    if (error) {
      console.error("[NBA Team Pace] query error:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch team pace", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const teams: Record<string, TeamPace> = {};
    for (const id of teamIds) {
      teams[String(id)] = { l5: { ...EMPTY }, l10: { ...EMPTY }, season: { ...EMPTY } };
    }

    // For each (team, window) take the row with the highest games_played —
    // that's the primary season-type bucket (regular season for most of
    // the year). Avoids picking a 0-game playoff row that overrides a
    // populated regular-season row.
    for (const row of (data ?? []) as Array<{
      team_id: number;
      pace_window: string;
      pace: number | null;
      pace_rank: number | null;
      games_played: number | null;
      season_type: string | null;
    }>) {
      const win = row.pace_window as Window;
      if (win !== "l5" && win !== "l10" && win !== "season") continue;
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

    const response: TeamPaceResponse = {
      league: "nba",
      season,
      totalTeams: 30,
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
