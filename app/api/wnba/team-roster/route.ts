import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

const WNBA_ROSTER_SEASONS = ["2024", "2025", "2026"] as const;

const QuerySchema = z.object({
  teamId: z.coerce.number().int().positive(),
  season: z
    .enum(WNBA_ROSTER_SEASONS)
    .nullish()
    .transform((v) => v ?? "2026"),
});

interface RpcPlayer {
  player_id: number;
  nba_player_id: number | null;
  name: string;
  position: string;
  jersey_number: number | null;
  games_played: number;
  avg_minutes: number;
  avg_points: number;
  avg_rebounds: number;
  avg_assists: number;
  avg_pra: number;
  avg_threes: number;
  avg_steals: number;
  avg_blocks: number;
  avg_usage: number;
  injury_status: string | null;
  injury_notes: string | null;
  injury_updated_at?: string | null;
  injury_return_date?: string | null;
  injury_source?: string | null;
  injury_raw_status?: string | null;
}

interface RpcResponse {
  players: RpcPlayer[];
  team_id: number;
  team_abbr: string;
  team_name: string;
  player_count: number;
}

export interface TeamRosterPlayer {
  playerId: number;
  nbaPlayerId?: number | null;
  name: string;
  position: string;
  jerseyNumber: number | null;
  gamesPlayed: number;
  avgMinutes: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  avgPra: number;
  avgThrees: number;
  avgSteals: number;
  avgBlocks: number;
  avgUsage: number;
  injuryStatus: string | null;
  injuryNotes: string | null;
  injuryUpdatedAt?: string | null;
  injuryReturnDate?: string | null;
  injurySource?: string | null;
  injuryRawStatus?: string | null;
}

export interface TeamRosterResponse {
  players: TeamRosterPlayer[];
  teamId: number;
  teamAbbr: string;
  teamName: string;
  playerCount: number;
  season: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const parsed = QuerySchema.safeParse({
      teamId: searchParams.get("teamId"),
      season: searchParams.get("season"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { teamId, season } = parsed.data;
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc("get_wnba_team_roster", {
      p_team_id: teamId,
      p_season: season,
    });

    if (error) {
      console.error("[WNBA Team Roster] RPC error:", error.message);
      return NextResponse.json(
        { error: "Failed to fetch team roster", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!data) {
      return NextResponse.json({
        players: [],
        teamId,
        teamAbbr: "",
        teamName: "",
        playerCount: 0,
        season,
      });
    }

    const rpcResult = data as RpcResponse;
    const playerIds = [
      ...new Set(
        (rpcResult.players || []).map((p) => p.player_id).filter(Boolean),
      ),
    ] as number[];
    const injuryMeta = new Map<
      number,
      {
        injuryUpdatedAt: string | null;
        injuryReturnDate: string | null;
        injurySource: string | null;
        injuryRawStatus: string | null;
      }
    >();

    if (playerIds.length > 0) {
      const { data: playerRows, error: playerError } = await supabase
        .from("wnba_players_hr")
        .select(
          "wnba_player_id, injury_updated_at, injury_return_date, injury_source, injury_raw_status",
        )
        .in("wnba_player_id", playerIds);

      if (playerError) {
        console.error(
          "[WNBA Team Roster] Player injury metadata fetch error:",
          playerError.message,
        );
      } else {
        for (const player of playerRows || []) {
          injuryMeta.set(Number(player.wnba_player_id), {
            injuryUpdatedAt: player.injury_updated_at ?? null,
            injuryReturnDate: player.injury_return_date ?? null,
            injurySource: player.injury_source ?? null,
            injuryRawStatus: player.injury_raw_status ?? null,
          });
        }
      }
    }

    const players: TeamRosterPlayer[] = (rpcResult.players || []).map((p) => ({
      ...(() => {
        const meta = injuryMeta.get(p.player_id);
        return {
          injuryUpdatedAt: p.injury_updated_at ?? meta?.injuryUpdatedAt ?? null,
          injuryReturnDate:
            p.injury_return_date ?? meta?.injuryReturnDate ?? null,
          injurySource: p.injury_source ?? meta?.injurySource ?? null,
          injuryRawStatus: p.injury_raw_status ?? meta?.injuryRawStatus ?? null,
        };
      })(),
      playerId: p.player_id,
      nbaPlayerId: p.nba_player_id ?? null,
      name: p.name,
      position: p.position,
      jerseyNumber: p.jersey_number,
      gamesPlayed: p.games_played,
      avgMinutes: p.avg_minutes,
      avgPoints: p.avg_points,
      avgRebounds: p.avg_rebounds,
      avgAssists: p.avg_assists,
      avgPra: p.avg_pra,
      avgThrees: p.avg_threes,
      avgSteals: p.avg_steals,
      avgBlocks: p.avg_blocks,
      avgUsage: p.avg_usage,
      injuryStatus: p.injury_status,
      injuryNotes: p.injury_notes,
    }));

    players.sort((a, b) => b.avgMinutes - a.avgMinutes);

    const response: TeamRosterResponse = {
      players,
      teamId: rpcResult.team_id || teamId,
      teamAbbr: rpcResult.team_abbr || "",
      teamName: rpcResult.team_name || "",
      playerCount: rpcResult.player_count || players.length,
      season,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/wnba/team-roster] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
