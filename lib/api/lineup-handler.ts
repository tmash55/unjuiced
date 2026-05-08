import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Query: gameId is the canonical lookup. teamId+date is a fallback for cases
// where the gameId isn't yet available client-side.
const QuerySchema = z
  .object({
    gameId: z.coerce.number().int().positive().optional(),
    teamId: z.coerce.number().int().positive().optional(),
    date: z.string().optional(),
  })
  .refine((v) => v.gameId !== undefined || (v.teamId !== undefined && v.date !== undefined), {
    message: "Provide either gameId, or both teamId and date",
  });

export interface LineupPlayer {
  playerId: number;
  playerName: string;
  position: string | null;
  lineupSlot: number | null;
  isStarter: boolean;
  lineupStatus: string | null;
  isConfirmed: boolean;
  playProbability: number | null;
  injuryStatus: string | null;
  injuryNote: string | null;
}

export interface TeamLineup {
  teamId: number;
  teamAbbr: string;
  teamName: string | null;
  side: string | null;
  // overallStatus is the rolled-up label for the team's lineup feed —
  // 'confirmed' if at least one player on the team is confirmed (real lineup
  // posted), otherwise 'projected'.
  overallStatus: "confirmed" | "projected";
  source: string | null;
  sourceUpdatedAt: string | null;
  confirmedAt: string | null;
  players: LineupPlayer[];
}

export interface LineupResponse {
  gameId: number | null;
  gameDate: string | null;
  teams: TeamLineup[];
}

export async function handleLineupRequest(req: NextRequest, sport: "nba" | "wnba") {
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    gameId: url.searchParams.get("gameId") ?? undefined,
    teamId: url.searchParams.get("teamId") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { gameId, teamId, date } = parsed.data;
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from("basketball_daily_lineups")
    .select(
      "game_id, game_date, team_id, team_abbr, team_name, side, player_id, player_name, position, lineup_slot, is_starter, lineup_status, is_confirmed, play_probability, injury_status, injury_note, source, source_url, source_updated_at, confirmed_at"
    )
    .eq("sport", sport);

  if (gameId !== undefined) {
    query = query.eq("game_id", gameId);
  } else {
    query = query.eq("game_date", date!).eq("team_id", teamId!);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error(`[/api/${sport}/lineup] Supabase error:`, error.message);
    return NextResponse.json(
      { error: "Failed to fetch lineup", details: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Group by team. Source/timestamps are taken from the row that's most
  // recently confirmed (or latest source_updated_at) per team — they all
  // share the same feed snapshot, so any row's metadata is representative.
  const byTeam = new Map<number, TeamLineup>();
  let resolvedGameId: number | null = null;
  let resolvedGameDate: string | null = null;

  for (const r of rows ?? []) {
    if (r.game_id != null) resolvedGameId = r.game_id;
    if (r.game_date != null) resolvedGameDate = r.game_date;

    let team = byTeam.get(r.team_id);
    if (!team) {
      team = {
        teamId: r.team_id,
        teamAbbr: r.team_abbr ?? "",
        teamName: r.team_name ?? null,
        side: r.side ?? null,
        overallStatus: "projected",
        source: r.source ?? null,
        sourceUpdatedAt: r.source_updated_at ?? null,
        confirmedAt: r.confirmed_at ?? null,
        players: [],
      };
      byTeam.set(r.team_id, team);
    }

    team.players.push({
      playerId: r.player_id,
      playerName: r.player_name ?? "",
      position: r.position ?? null,
      lineupSlot: r.lineup_slot,
      isStarter: !!r.is_starter,
      lineupStatus: r.lineup_status ?? null,
      isConfirmed: !!r.is_confirmed,
      playProbability: r.play_probability,
      injuryStatus: r.injury_status ?? null,
      injuryNote: r.injury_note ?? null,
    });

    // Roll up team status. Any confirmed row wins.
    if (r.is_confirmed) team.overallStatus = "confirmed";
    if (r.confirmed_at && (!team.confirmedAt || r.confirmed_at > team.confirmedAt)) {
      team.confirmedAt = r.confirmed_at;
    }
    if (r.source_updated_at && (!team.sourceUpdatedAt || r.source_updated_at > team.sourceUpdatedAt)) {
      team.sourceUpdatedAt = r.source_updated_at;
    }
  }

  // Dedupe per player_id. The Rotowire feed sometimes lists a starter who's
  // also questionable in BOTH the starting-five AND the may-not-play list
  // (e.g., Embiid: starter at C + may_not_play with Q). Prefer the starter
  // entry so the player lands in the Starters section downstream — the
  // injury status carries through the merged record so the questionable
  // badge still surfaces. Confirmed > expected > may_not_play tiebreaker.
  const lineupStatusRank = (s: string | null): number => {
    if (s === "confirmed") return 0;
    if (s === "expected") return 1;
    return 2; // may_not_play / null / anything else
  };
  for (const team of byTeam.values()) {
    const byPlayerId = new Map<number, LineupPlayer>();
    for (const p of team.players) {
      const existing = byPlayerId.get(p.playerId);
      if (!existing) {
        byPlayerId.set(p.playerId, p);
        continue;
      }
      const incomingWins =
        // Starter always wins over non-starter
        (p.isStarter && !existing.isStarter) ||
        // Among same starter-state, prefer better lineup status
        (p.isStarter === existing.isStarter &&
          lineupStatusRank(p.lineupStatus) < lineupStatusRank(existing.lineupStatus));
      if (incomingWins) {
        // Carry the may_not_play injury context onto the starter entry so
        // downstream UI still knows this player is flagged questionable.
        byPlayerId.set(p.playerId, {
          ...p,
          injuryStatus: p.injuryStatus ?? existing.injuryStatus,
          injuryNote: p.injuryNote ?? existing.injuryNote,
        });
      } else {
        byPlayerId.set(p.playerId, {
          ...existing,
          injuryStatus: existing.injuryStatus ?? p.injuryStatus,
          injuryNote: existing.injuryNote ?? p.injuryNote,
        });
      }
    }
    team.players = Array.from(byPlayerId.values());

    // Sort: starters first (by lineup_slot), then bench (by play probability
    // desc, then name).
    team.players.sort((a, b) => {
      if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
      if (a.isStarter && b.isStarter) {
        return (a.lineupSlot ?? 99) - (b.lineupSlot ?? 99);
      }
      const probDelta = (b.playProbability ?? 0) - (a.playProbability ?? 0);
      if (probDelta !== 0) return probDelta;
      return a.playerName.localeCompare(b.playerName);
    });
  }

  const response: LineupResponse = {
    gameId: resolvedGameId,
    gameDate: resolvedGameDate,
    teams: Array.from(byTeam.values()),
  };

  return NextResponse.json(response, {
    headers: {
      // Lineups change frequently as confirmations roll in pre-game; keep CDN
      // cache short and let SWR for a couple minutes.
      "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=180",
    },
  });
}
