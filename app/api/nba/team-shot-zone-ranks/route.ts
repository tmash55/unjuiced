import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Request validation
const QuerySchema = z.object({
  season: z.string().nullish().transform(v => v ?? "2025-26"),
});

// Team data for a specific shot zone
export interface ShotZoneTeamData {
  teamId: number;
  teamAbbr: string;
  teamName: string;
  rank: number;
  oppFgPct: number | null;
  oppFgm: number | null;
  oppFga: number | null;
  matchupLabel: "tough" | "neutral" | "favorable";
}

// Shot zone with all teams' data
export interface ShotZoneData {
  zone: string;
  teams: ShotZoneTeamData[];
}

export interface TeamShotZoneRanksResponse {
  zones: ShotZoneData[];
  zoneList: string[];
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
    const { data, error } = await supabase.rpc("get_all_team_defense_shot_zones", {
      p_season: season,
    });

    if (error) {
      // If RPC doesn't exist yet, return empty data
      if (error.message.includes("does not exist") || error.code === "42883") {
        console.log("[Team Shot Zone Ranks] RPC not yet available, returning empty data");
        return NextResponse.json({
          zones: [],
          zoneList: [],
          season,
        } as TeamShotZoneRanksResponse, {
          headers: { "Cache-Control": "public, max-age=60" },
        });
      }

      console.error("[Team Shot Zone Ranks] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch team shot zone ranks", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // The RPC returns JSON with zones object
    const rpcResult = data as {
      season: string;
      zones: Record<string, any[]>;
      summary?: { zone_list?: string[] };
    };

    // Transform to our response format
    const zones: ShotZoneData[] = Object.entries(rpcResult?.zones || {}).map(
      ([zone, teamsData]) => ({
        zone,
        teams: (teamsData || []).map((team: any) => ({
          teamId: team.team_id,
          teamAbbr: team.team_abbr,
          teamName: team.team_name,
          rank: team.rank,
          oppFgPct: team.opp_fg_pct,
          oppFgm: team.opp_fgm,
          oppFga: team.opp_fga,
          matchupLabel: team.matchup_label,
        })),
      })
    );

    const response: TeamShotZoneRanksResponse = {
      zones,
      zoneList: rpcResult?.summary?.zone_list || Object.keys(rpcResult?.zones || {}),
      season: rpcResult?.season || season,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/team-shot-zone-ranks] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
