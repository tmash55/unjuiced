import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";
import type {
  ShotZoneData,
  TeamShotZoneRanksResponse,
} from "@/app/api/nba/team-shot-zone-ranks/route";

const QuerySchema = z.object({
  season: z.string().nullish().transform((v) => v ?? "2025"),
});

function getRankBuckets(totalTeams: number) {
  const total = Math.max(totalTeams || 13, 1);
  return {
    toughMax: Math.ceil(total / 3),
    neutralMax: Math.ceil((total * 2) / 3),
  };
}

function getMatchupLabel(
  rank: number | null,
  totalTeams: number
): "tough" | "neutral" | "favorable" {
  if (rank === null) return "neutral";
  const { toughMax, neutralMax } = getRankBuckets(totalTeams);
  if (rank <= toughMax) return "tough";
  if (rank > neutralMax) return "favorable";
  return "neutral";
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

    const [{ data: zoneRows, error: zoneError }, { data: teamRows, error: teamError }] =
      await Promise.all([
        supabase
          .from("wnba_team_defense_shot_zones")
          .select("team_id, zone, opp_fg_pct, opp_fgm, opp_fga, rank")
          .eq("season", season)
          .order("zone", { ascending: true })
          .order("rank", { ascending: true }),
        supabase
          .from("wnba_teams")
          .select("team_id, name, abbreviation"),
      ]);

    if (zoneError) {
      console.error("[/api/wnba/team-shot-zone-ranks] Zone query error:", zoneError);
      return NextResponse.json(
        { error: "Failed to fetch WNBA team shot zone ranks", details: zoneError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (teamError) {
      console.error("[/api/wnba/team-shot-zone-ranks] Team query error:", teamError);
      return NextResponse.json(
        { error: "Failed to fetch WNBA teams", details: teamError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const teamById = new Map(
      (teamRows ?? []).map((team) => [
        Number(team.team_id),
        {
          teamName: team.name,
          teamAbbr: team.abbreviation,
        },
      ])
    );
    const totalTeams = new Set((zoneRows ?? []).map((row) => row.team_id)).size || 13;
    const zonesByName = new Map<string, ShotZoneData["teams"]>();

    for (const row of zoneRows ?? []) {
      const zone = row.zone as string;
      const team = teamById.get(Number(row.team_id));
      if (!zonesByName.has(zone)) zonesByName.set(zone, []);
      zonesByName.get(zone)!.push({
        teamId: Number(row.team_id),
        teamAbbr: team?.teamAbbr ?? "",
        teamName: team?.teamName ?? "",
        rank: Number(row.rank),
        oppFgPct: row.opp_fg_pct,
        oppFgm: row.opp_fgm,
        oppFga: row.opp_fga,
        matchupLabel: getMatchupLabel(row.rank, totalTeams),
      });
    }

    const zones: ShotZoneData[] = Array.from(zonesByName.entries()).map(([zone, teams]) => ({
      zone,
      teams,
    }));

    const response: TeamShotZoneRanksResponse = {
      zones,
      zoneList: zones.map((zone) => zone.zone),
      season,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[/api/wnba/team-shot-zone-ranks] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
