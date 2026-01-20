import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Request validation
const QuerySchema = z.object({
  season: z.string().nullish().transform(v => v ?? "2025-26"),
});

// Team data for a specific play type
export interface PlayTypeTeamData {
  teamId: number;
  teamAbbr: string;
  teamName: string;
  pppRank: number;
  pppAllowed: number | null;
  fgPctAllowed: number | null;
  possessions: number | null;
  matchupLabel: "tough" | "neutral" | "favorable";
}

// Play type with all teams' data
export interface PlayTypeData {
  playType: string;
  displayName: string;
  teams: PlayTypeTeamData[];
}

export interface TeamPlayTypeRanksResponse {
  playTypes: PlayTypeData[];
  displayNames: Record<string, string>;
  season: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const parsed = QuerySchema.safeParse({
      season: searchParams.get("season"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { season } = parsed.data;
    const supabase = createServerSupabaseClient();

    // Call the RPC function
    const { data, error } = await supabase.rpc("get_all_team_defense_play_types", {
      p_season: season,
    });

    if (error) {
      // If RPC doesn't exist yet, return empty data
      if (error.message.includes("does not exist") || error.code === "42883") {
        console.log("[Team Play Type Ranks] RPC not yet available, returning empty data");
        return NextResponse.json({
          playTypes: [],
          displayNames: {},
          season,
        } as TeamPlayTypeRanksResponse, {
          headers: { "Cache-Control": "public, max-age=60" },
        });
      }

      console.error("[Team Play Type Ranks] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch team play type ranks", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // The RPC returns JSON with play_types object
    const rpcResult = data as {
      season: string;
      play_types: Record<string, any[]>;
      display_names: Record<string, string>;
    };

    // Transform to our response format
    const playTypes: PlayTypeData[] = Object.entries(rpcResult?.play_types || {}).map(
      ([playType, teamsData]) => ({
        playType,
        displayName: rpcResult?.display_names?.[playType] || playType,
        teams: (teamsData || []).map((team: any) => ({
          teamId: team.team_id,
          teamAbbr: team.team_abbr,
          teamName: team.team_name,
          pppRank: team.ppp_rank,
          pppAllowed: team.ppp_allowed,
          fgPctAllowed: team.fg_pct_allowed,
          possessions: team.possessions,
          matchupLabel: team.matchup_label,
        })),
      })
    );

    const response: TeamPlayTypeRanksResponse = {
      playTypes,
      displayNames: rpcResult?.display_names || {},
      season: rpcResult?.season || season,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/team-play-type-ranks] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
