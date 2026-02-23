import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const QuerySchema = z.object({
  date: z
    .string()
    .optional()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "date must be YYYY-MM-DD"),
});

function getETDate(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function mapRow(row: any) {
  return {
    gameId: row.game_id,
    venueId: row.venue_id,
    homeId: row.home_id ?? null,
    awayId: row.away_id ?? null,
    gameDate: row.game_date,
    gameDatetime: row.game_datetime,
    temperatureF: row.temperature_f,
    feelsLikeF: row.feels_like_f,
    humidityPct: row.humidity_pct,
    windSpeedMph: row.wind_speed_mph,
    windGustMph: row.wind_gust_mph,
    windDirectionDeg: row.wind_direction_deg,
    windRelativeDeg: row.wind_relative_deg,
    windLabel: row.wind_label,
    windImpact: row.wind_impact,
    hrImpactScore: row.hr_impact_score,
    totalImpact: row.total_impact,
    weatherAlert: row.weather_alert,
    precipProbability: row.precip_probability,
    pressureMslHpa: row.pressure_msl_hpa,
    cloudCoverPct: row.cloud_cover_pct,
    uvIndex: row.uv_index,
    roofType: row.roof_type,
    venueName: row.venue_name,
    elevationFt: row.elevation_ft,
    homeTeamName: row.home_name ?? row.home_team_name ?? null,
    awayTeamName: row.away_name ?? row.away_team_name ?? null,
    homeTeamAbbr: row.home_team_abbr ?? row.home_team_tricode ?? null,
    awayTeamAbbr: row.away_team_abbr ?? row.away_team_tricode ?? null,
    homeTeamPrimaryColor: row.home_team_primary_color ?? null,
    homeTeamSecondaryColor: row.home_team_secondary_color ?? null,
    awayTeamPrimaryColor: row.away_team_primary_color ?? null,
    awayTeamSecondaryColor: row.away_team_secondary_color ?? null,
    venueCity: row.venue_city ?? row.city ?? null,
    venueState: row.venue_state ?? row.state ?? null,
    wallHeights: {
      lf: row.wall_height_lf != null ? Number(row.wall_height_lf) : null,
      lcf: row.wall_height_lcf != null ? Number(row.wall_height_lcf) : null,
      cf: row.wall_height_cf != null ? Number(row.wall_height_cf) : null,
      rcf: row.wall_height_rcf != null ? Number(row.wall_height_rcf) : null,
      rf: row.wall_height_rf != null ? Number(row.wall_height_rf) : null,
    },
    fieldDistances: {
      leftLine: row.left_line != null ? Number(row.left_line) : null,
      leftCenter: row.left_center != null ? Number(row.left_center) : null,
      centerField: row.center_field != null ? Number(row.center_field) : null,
      rightCenter: row.right_center != null ? Number(row.right_center) : null,
      rightLine: row.right_line != null ? Number(row.right_line) : null,
    },
    stadiumGeometry: row.stadium_geometry ?? null,
    ballparkFactors: row.ballpark_factors ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      date: searchParams.get("date") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const date = parsed.data.date ?? getETDate(0);
    const supabase = createServerSupabaseClient();

    // Preferred RPC includes game names joined from mlb_games.
    const withGames = await supabase.rpc("get_mlb_weather_with_games", { p_date: date });

    let rawRows = withGames.data;
    let error = withGames.error;

    // Fallback to raw weather RPC if joined RPC is unavailable.
    if (error || !rawRows) {
      const fallback = await supabase.rpc("get_mlb_game_weather", { p_date: date });
      rawRows = fallback.data;
      error = fallback.error;
    }

    // Final fallback: query tables directly so endpoint works even before RPCs are deployed.
    if (error || !rawRows) {
      const weatherRows = await supabase
        .from("mlb_game_weather")
        .select("*")
        .eq("game_date", date)
        .order("game_datetime", { ascending: true });

      rawRows = weatherRows.data;
      error = weatherRows.error;
    }

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch MLB weather report", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (rawRows && rawRows.length > 0) {
      const gameIds = Array.from(new Set(rawRows.map((row: any) => row.game_id).filter(Boolean)));

      if (gameIds.length > 0) {
        const games = await supabase
          .from("mlb_games")
          .select("game_id, home_name, away_name, home_id, away_id")
          .in("game_id", gameIds);

        if (!games.error && games.data) {
          const teamIds = Array.from(
            new Set(games.data.flatMap((g: any) => [g.home_id, g.away_id]).filter(Boolean))
          );

          let teamsById = new Map<number, { abbreviation: string | null; primary_color: string | null; secondary_color: string | null }>();
          if (teamIds.length > 0) {
            const teams = await supabase
              .from("mlb_teams")
              .select("team_id, abbreviation, primary_color, secondary_color")
              .in("team_id", teamIds);

            if (!teams.error && teams.data) {
              teamsById = new Map(teams.data.map((t: any) => [t.team_id, t]));
            }
          }

          const gamesById = new Map(
            games.data.map((game: any) => [
              game.game_id,
              {
                home_name: game.home_name ?? null,
                away_name: game.away_name ?? null,
                home_id: game.home_id ?? null,
                away_id: game.away_id ?? null,
                home_team_abbr: teamsById.get(game.home_id)?.abbreviation ?? null,
                away_team_abbr: teamsById.get(game.away_id)?.abbreviation ?? null,
                home_team_primary_color: teamsById.get(game.home_id)?.primary_color ?? null,
                home_team_secondary_color: teamsById.get(game.home_id)?.secondary_color ?? null,
                away_team_primary_color: teamsById.get(game.away_id)?.primary_color ?? null,
                away_team_secondary_color: teamsById.get(game.away_id)?.secondary_color ?? null,
              },
            ])
          );

          rawRows = rawRows.map((row: any) => {
            const game = gamesById.get(row.game_id);
            if (!game) return row;

            return {
              ...row,
              home_name: row.home_name ?? game.home_name,
              away_name: row.away_name ?? game.away_name,
              home_id: row.home_id ?? game.home_id,
              away_id: row.away_id ?? game.away_id,
              home_team_abbr: row.home_team_abbr ?? row.home_team_tricode ?? game.home_team_abbr,
              away_team_abbr: row.away_team_abbr ?? row.away_team_tricode ?? game.away_team_abbr,
              home_team_primary_color: row.home_team_primary_color ?? game.home_team_primary_color,
              home_team_secondary_color: row.home_team_secondary_color ?? game.home_team_secondary_color,
              away_team_primary_color: row.away_team_primary_color ?? game.away_team_primary_color,
              away_team_secondary_color: row.away_team_secondary_color ?? game.away_team_secondary_color,
            };
          });
        }
      }
    }

    const venueIds = Array.from(
      new Set((rawRows || []).map((row: any) => row.venue_id).filter((venueId: any) => Number.isFinite(Number(venueId))))
    );

    let venuesById = new Map<number, any>();
    let geometriesById = new Map<number, any>();
    let factorsByVenueId = new Map<number, Record<string, { overall: number | null; vsLhb: number | null; vsRhb: number | null }>>();

    // Use prior full season if before April (MLB off-season), else current year
    const now = new Date();
    const currentSeason = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();

    if (venueIds.length > 0) {
      const [venuesResult, geometriesResult, factorsResult] = await Promise.all([
        supabase
          .from("mlb_venues")
          .select(
            "venue_id, name, city, state, wall_height_lf, wall_height_lcf, wall_height_cf, wall_height_rcf, wall_height_rf, left_line, left_center, center_field, right_center, right_line"
          )
          .in("venue_id", venueIds),
        supabase
          .from("mlb_stadium_geometries")
          .select(
            "venue_id, season, outfield_outer, outfield_inner, infield_outer, infield_inner, foul_lines, home_plate"
          )
          .in("venue_id", venueIds)
          .order("season", { ascending: false }),
        supabase
          .from("mlb_ballpark_factors")
          .select("venue_id, factor_type, factor_overall, factor_vs_lhb, factor_vs_rhb")
          .in("venue_id", venueIds)
          .eq("season", currentSeason),
      ]);

      if (!venuesResult.error && venuesResult.data) {
        venuesById = new Map(
          venuesResult.data.map((venue: any) => [
            Number(venue.venue_id),
            venue,
          ])
        );
      }

      if (!geometriesResult.error && geometriesResult.data) {
        for (const geometry of geometriesResult.data) {
          const venueId = Number(geometry.venue_id);
          if (!Number.isFinite(venueId)) continue;
          if (geometriesById.has(venueId)) continue;
          geometriesById.set(venueId, {
            outfieldOuter: geometry.outfield_outer ?? [],
            outfieldInner: geometry.outfield_inner ?? [],
            infieldOuter: geometry.infield_outer ?? [],
            infieldInner: geometry.infield_inner ?? [],
            foulLines: geometry.foul_lines ?? [],
            homePlate: geometry.home_plate ?? [],
            season: geometry.season ?? null,
          });
        }
      }

      if (!factorsResult.error && factorsResult.data) {
        for (const f of factorsResult.data) {
          const vid = Number(f.venue_id);
          if (!Number.isFinite(vid)) continue;
          if (!factorsByVenueId.has(vid)) factorsByVenueId.set(vid, {});
          factorsByVenueId.get(vid)![f.factor_type] = {
            overall: f.factor_overall != null ? Number(f.factor_overall) : null,
            vsLhb: f.factor_vs_lhb != null ? Number(f.factor_vs_lhb) : null,
            vsRhb: f.factor_vs_rhb != null ? Number(f.factor_vs_rhb) : null,
          };
        }
      }
    }

    const rows = (rawRows || []).map((rawRow: any) => {
      const venueId = Number(rawRow.venue_id);
      const venue = Number.isFinite(venueId) ? venuesById.get(venueId) : null;
      const geometry = Number.isFinite(venueId) ? geometriesById.get(venueId) : null;
      const ballparkFactors = Number.isFinite(venueId) ? (factorsByVenueId.get(venueId) ?? null) : null;

      const merged = {
        ...rawRow,
        venue_city: rawRow.venue_city ?? venue?.city ?? null,
        venue_state: rawRow.venue_state ?? venue?.state ?? null,
        wall_height_lf: rawRow.wall_height_lf ?? venue?.wall_height_lf ?? null,
        wall_height_lcf: rawRow.wall_height_lcf ?? venue?.wall_height_lcf ?? null,
        wall_height_cf: rawRow.wall_height_cf ?? venue?.wall_height_cf ?? null,
        wall_height_rcf: rawRow.wall_height_rcf ?? venue?.wall_height_rcf ?? null,
        wall_height_rf: rawRow.wall_height_rf ?? venue?.wall_height_rf ?? null,
        left_line: rawRow.left_line ?? venue?.left_line ?? null,
        left_center: rawRow.left_center ?? venue?.left_center ?? null,
        center_field: rawRow.center_field ?? venue?.center_field ?? null,
        right_center: rawRow.right_center ?? venue?.right_center ?? null,
        right_line: rawRow.right_line ?? venue?.right_line ?? null,
        stadium_geometry: geometry ?? null,
        ballpark_factors: ballparkFactors,
      };

      return mapRow(merged);
    }).sort((a: any, b: any) => {
      const scoreA = Number(a.hrImpactScore ?? 0);
      const scoreB = Number(b.hrImpactScore ?? 0);
      return scoreB - scoreA;
    });

    return NextResponse.json(
      {
        date,
        rows,
        count: rows.length,
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
