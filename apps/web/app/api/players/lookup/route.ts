import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Request validation - accept either odds_player_id or player_name
const RequestSchema = z.object({
  odds_player_id: z.string().uuid().optional(),
  player_name: z.string().optional(),
}).refine(
  (data) => data.odds_player_id || data.player_name,
  { message: "Either odds_player_id or player_name must be provided" }
);

export interface PlayerLookupResult {
  nba_player_id: number;
  odds_player_id: string;
  name: string;
  first_name: string;
  last_name: string;
  team_id: number | null;
  team_name: string | null;
  team_abbr: string | null;
  position: string | null;
  depth_chart_pos: string | null;
  jersey_number: number | null;
  injury_status: string | null;
  injury_notes: string | null;
  height_feet: number | null;
  height_inches: number | null;
  weight_pounds: number | null;
  birthdate: string | null;
}

export interface PlayerLookupResponse {
  player: PlayerLookupResult | null;
  found: boolean;
}

/**
 * Player Lookup API
 * Maps odds_player_id (UUID) to nba_player_id (number) and returns full player data
 * 
 * POST /api/players/lookup
 * Body: { odds_player_id: "uuid" } or { player_name: "LeBron James" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { odds_player_id, player_name } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Build query based on what was provided
    let query = supabase
      .from("nba_players_hr")
      .select(`
        nba_player_id,
        odds_player_id,
        name,
        first_name,
        last_name,
        team_id,
        odds_team_name,
        odds_team_abbr,
        position,
        depth_chart_pos,
        jersey_number,
        injury_status,
        injury_notes,
        height_feet,
        height_inches,
        weight_pounds,
        birthdate
      `);

    // Filter by odds_player_id if provided, otherwise by name
    if (odds_player_id) {
      query = query.eq("odds_player_id", odds_player_id);
    } else if (player_name) {
      query = query.ilike("name", player_name);
    }

    const { data, error } = await query.limit(1).single();

    if (error) {
      // If not found, return graceful response
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { player: null, found: false } as PlayerLookupResponse,
          {
            headers: {
              // Cache not-found responses for 1 hour (player might be added later)
              "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200",
            },
          }
        );
      }

      console.error("[Player Lookup] Query error:", error);
      return NextResponse.json(
        { error: "Failed to lookup player", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Transform response to match interface
    const playerResult: PlayerLookupResult = {
      nba_player_id: data.nba_player_id,
      odds_player_id: data.odds_player_id,
      name: data.name,
      first_name: data.first_name,
      last_name: data.last_name,
      team_id: data.team_id,
      team_name: data.odds_team_name,
      team_abbr: data.odds_team_abbr,
      position: data.position,
      depth_chart_pos: data.depth_chart_pos,
      jersey_number: data.jersey_number,
      injury_status: data.injury_status,
      injury_notes: data.injury_notes,
      height_feet: data.height_feet,
      height_inches: data.height_inches,
      weight_pounds: data.weight_pounds,
      birthdate: data.birthdate,
    };

    return NextResponse.json(
      { player: playerResult, found: true } as PlayerLookupResponse,
      {
        headers: {
          // Cache for 24 hours - player IDs don't change
          "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=172800",
        },
      }
    );
  } catch (error: any) {
    console.error("[Player Lookup] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

