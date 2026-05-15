import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Request validation - accept either odds_player_id or player_name
const RequestSchema = z.object({
  sport: z.enum(["nba", "wnba", "mlb"]).default("nba"),
  odds_player_id: z.string().min(1).optional(),
  player_name: z.string().optional(),
}).refine(
  (data) => data.odds_player_id || data.player_name,
  { message: "Either odds_player_id or player_name must be provided" }
);

export interface PlayerLookupResult {
  nba_player_id?: number | null;
  wnba_player_id?: number | null;
  mlb_player_id?: number | null;
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

async function getWnbaTeam(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  teamId: number | null,
) {
  if (!teamId) return null;

  const { data } = await supabase
    .from("wnba_teams")
    .select("name, abbreviation")
    .eq("team_id", teamId)
    .maybeSingle();

  return data;
}

/**
 * Player Lookup API
 * Maps odds_player_id to the internal sport player ID and returns full player data
 * 
 * POST /api/players/lookup
 * Body: { sport: "nba" | "mlb", odds_player_id: "uuid" } or { sport, player_name }
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

    const { sport, odds_player_id, player_name } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Build query based on what was provided. WNBA uses its own players table
    // but its rows carry the nba.com player_id for headshot CDN compatibility.
    let query;
    if (sport === "mlb") {
      query = supabase
        .from("mlb_players_hr")
        .select(`
          mlb_player_id,
          odds_player_id,
          name,
          team_id,
          odds_team_name,
          odds_team_abbr,
          position,
          pos_abbr
        `);
    } else if (sport === "wnba") {
      query = supabase
        .from("wnba_players_hr")
        .select(`
          wnba_player_id,
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
    } else {
      query = supabase
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
    }

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

    const row = data as any;
    const wnbaTeam = sport === "wnba" ? await getWnbaTeam(supabase, row.team_id) : null;

    // Transform response to match interface
    const playerResult: PlayerLookupResult = {
      nba_player_id: row.nba_player_id ?? null,
      wnba_player_id: row.wnba_player_id ?? null,
      mlb_player_id: row.mlb_player_id ?? null,
      odds_player_id: row.odds_player_id,
      name: row.name,
      first_name: row.first_name ?? "",
      last_name: row.last_name ?? "",
      team_id: row.team_id,
      team_name: sport === "wnba" ? (wnbaTeam?.name || row.odds_team_name) : row.odds_team_name,
      team_abbr: sport === "wnba" ? (wnbaTeam?.abbreviation || row.odds_team_abbr) : row.odds_team_abbr,
      position: row.pos_abbr ?? row.position ?? null,
      depth_chart_pos: row.depth_chart_pos ?? null,
      jersey_number: row.jersey_number ?? null,
      injury_status: row.injury_status ?? null,
      injury_notes: row.injury_notes ?? null,
      height_feet: row.height_feet ?? null,
      height_inches: row.height_inches ?? null,
      weight_pounds: row.weight_pounds ?? null,
      birthdate: row.birthdate ?? null,
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
