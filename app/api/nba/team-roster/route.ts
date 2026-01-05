import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Request validation
const QuerySchema = z.object({
  teamId: z.coerce.number().int().positive(),
  season: z.string().nullish().transform(v => v ?? "2025-26"),
});

// RPC response structure
interface RpcPlayer {
  player_id: number;
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
}

interface RpcResponse {
  players: RpcPlayer[];
  team_id: number;
  team_abbr: string;
  team_name: string;
  player_count: number;
}

// Frontend response structure
export interface TeamRosterPlayer {
  playerId: number;
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
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { teamId, season } = parsed.data;

    const supabase = createServerSupabaseClient();

    // Call the RPC function with retry logic for transient errors (520, 503, timeout)
    let rpcResult: RpcResponse | null = null;
    let lastError: any = null;
    const maxRetries = 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const { data, error } = await supabase.rpc("get_team_roster", {
        p_team_id: teamId,
        p_season: season,
      });
      
      if (!error) {
        rpcResult = data;
        break;
      }
      
      lastError = error;
      const errorMsg = error.message?.toLowerCase() || "";
      const isTransient = errorMsg.includes("520") || 
                          errorMsg.includes("503") || 
                          errorMsg.includes("timeout") ||
                          errorMsg.includes("cloudflare");
      
      if (isTransient && attempt < maxRetries) {
        console.warn(`[Team Roster] Transient error, retrying (${attempt + 1}/${maxRetries}):`, error.message?.slice(0, 100));
        await new Promise(r => setTimeout(r, 500 * (attempt + 1))); // Exponential backoff
        continue;
      }
      
      break;
    }

    if (lastError && !rpcResult) {
      console.error("[Team Roster] RPC error after retries:", lastError.message?.slice(0, 200));
      return NextResponse.json(
        { error: "Failed to fetch team roster", details: "Server temporarily unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } }
      );
    }

    // Handle null result
    if (!rpcResult) {
      return NextResponse.json({
        players: [],
        teamId,
        teamAbbr: "",
        teamName: "",
        playerCount: 0,
        season,
      });
    }

    const data = rpcResult as RpcResponse;

    // Map to frontend format
    const players: TeamRosterPlayer[] = (data.players || []).map((p) => ({
      playerId: p.player_id,
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

    // Sort by avg minutes (starters first)
    players.sort((a, b) => b.avgMinutes - a.avgMinutes);

    const response: TeamRosterResponse = {
      players,
      teamId: data.team_id || teamId,
      teamAbbr: data.team_abbr || "",
      teamName: data.team_name || "",
      playerCount: data.player_count || players.length,
      season,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/team-roster] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

