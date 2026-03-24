import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";
import { getStandardAbbreviation } from "@/lib/data/team-mappings";

const GAMES_CACHE_KEY = "mlb:games:today";
const GAMES_CACHE_TTL = 300;

function parseGameTimeToMinutes(gameStatus: string): number {
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch) {
    if (gameStatus.toLowerCase().includes("final")) return 9999;
    return 5000;
  }

  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  return hour * 60 + parseInt(minutes, 10);
}

function sortGamesByDateTime(games: any[]): any[] {
  return [...games].sort((a, b) => {
    const dateCompare = a.game_date.localeCompare(b.game_date);
    if (dateCompare !== 0) return dateCompare;
    return parseGameTimeToMinutes(a.game_status || "") - parseGameTimeToMinutes(b.game_status || "");
  });
}

function formatScheduledStatus(gameDateTime: string | null): string {
  if (!gameDateTime) return "TBD";
  const date = new Date(gameDateTime);
  if (Number.isNaN(date.getTime())) return "TBD";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace("AM", "am")
    .replace("PM", "pm")
    .concat(" ET");
}

function getDisplayStatus(statusDetailed: string | null, gameDateTime: string | null): string {
  const status = statusDetailed?.toLowerCase() ?? "";
  if (status.includes("final")) return "Final";
  if (status.includes("in progress") || status.includes("manager challenge")) {
    return statusDetailed || "In Progress";
  }
  return formatScheduledStatus(gameDateTime);
}

function toGameRow(row: any) {
  const homeAbbr =
    row.home_team?.abbreviation ||
    getStandardAbbreviation(row.home_name || "", "mlb");
  const awayAbbr =
    row.away_team?.abbreviation ||
    getStandardAbbreviation(row.away_name || "", "mlb");

  return {
    game_id: String(row.game_id),
    game_date: row.game_date,
    home_team_name: row.home_name,
    away_team_name: row.away_name,
    home_team_tricode: homeAbbr,
    away_team_tricode: awayAbbr,
    home_team_score: row.home_score ?? null,
    away_team_score: row.away_score ?? null,
    game_status: getDisplayStatus(row.status_detailed_state || row.status, row.game_datetime),
    venue_id: row.venue_id ?? null,
    home_probable_pitcher: row.home_probable_pitcher ?? null,
    away_probable_pitcher: row.away_probable_pitcher ?? null,
    is_primetime: null,
    national_broadcast: null,
    neutral_site: false,
    season_type: row.game_type ?? null,
    // Enriched below
    weather: null as {
      temperature_f: number | null;
      wind_speed_mph: number | null;
      wind_label: string | null;
      wind_impact: string | null;
      hr_impact_score: number | null;
      roof_type: string | null;
      venue_name: string | null;
    } | null,
    park_factor: null as number | null,
  };
}

export async function GET() {
  const startTime = Date.now();

  try {
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const today = etFormatter.format(now);
    const dayAfter = (offset: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      return etFormatter.format(d);
    };
    const tomorrow = dayAfter(1);
    const dayAfterTomorrow = dayAfter(2);

    const cacheKey = `${GAMES_CACHE_KEY}:${today}`;
    try {
      const cached = await redis.get<{ games: any[]; dates: string[]; primaryDate: string }>(cacheKey);
      if (cached?.games) {
        return NextResponse.json(
          {
            games: cached.games,
            dates: cached.dates,
            primaryDate: cached.primaryDate,
            cached: true,
          },
          {
            headers: {
              "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
            },
          }
        );
      }
    } catch (cacheError) {
      console.error("[/api/mlb/games] Cache read error:", cacheError);
    }

    const supabase = createServerSupabaseClient();
    const selectFields = `
      game_id,
      game_date,
      game_datetime,
      game_type,
      status,
      status_detailed_state,
      home_name,
      away_name,
      home_score,
      away_score,
      venue_id,
      home_probable_pitcher,
      away_probable_pitcher,
      home_team:mlb_teams!mlb_games_home_id_fkey (abbreviation),
      away_team:mlb_teams!mlb_games_away_id_fkey (abbreviation)
    `;

    // Fetch today + next 2 days to always show today's games plus tomorrow
    const { data: nearGames, error: nearError } = await supabase
      .from("mlb_games")
      .select(selectFields)
      .in("game_date", [today, tomorrow, dayAfterTomorrow]);

    if (nearError) {
      return NextResponse.json(
        { error: "Failed to fetch games", details: nearError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    let allGames = nearGames || [];
    const currentDates = [...new Set(allGames.map((g: any) => g.game_date))];

    // Always ensure we have at least 2 game days; if not, fetch further ahead
    if (currentDates.length < 2) {
      const lastDate = currentDates.length > 0 ? currentDates[currentDates.length - 1] : today;
      const nextDay = new Date(lastDate + "T12:00:00");
      nextDay.setDate(nextDay.getDate() + 1);
      const searchFrom = etFormatter.format(nextDay);

      const { data: futureGames, error: futureError } = await supabase
        .from("mlb_games")
        .select(selectFields)
        .gte("game_date", searchFrom)
        .order("game_date", { ascending: true })
        .limit(60);

      if (!futureError && futureGames && futureGames.length > 0) {
        const needed = 2 - currentDates.length;
        const futureDates = [...new Set(futureGames.map((g: any) => g.game_date))].slice(0, needed);
        const extraGames = futureGames.filter((g: any) => futureDates.includes(g.game_date));
        allGames = [...allGames, ...extraGames];
      }
    }

    const normalized = allGames.map(toGameRow);
    const sortedGames = sortGamesByDateTime(normalized);
    const dates = [...new Set(sortedGames.map((g) => g.game_date))];

    // Enrich with weather + park factors (best-effort, don't block on failure)
    try {
      const gameIds = sortedGames.map((g) => Number(g.game_id)).filter(Boolean);
      const venueIds = [...new Set(sortedGames.map((g) => g.venue_id).filter(Boolean))] as number[];

      const currentYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(new Date()));

      const [weatherResult, parkResult] = await Promise.all([
        gameIds.length > 0
          ? supabase
              .from("mlb_game_weather")
              .select("game_id, temperature_f, wind_speed_mph, wind_label, wind_impact, hr_impact_score, roof_type, venue_name")
              .in("game_id", gameIds)
          : Promise.resolve({ data: null, error: null }),
        venueIds.length > 0
          ? supabase
              .from("mlb_ballpark_factors")
              .select("venue_id, factor_overall")
              .in("venue_id", venueIds)
              .eq("factor_type", "hr")
              .in("season", [currentYear, currentYear - 1])
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (weatherResult.data) {
        const weatherMap = new Map(weatherResult.data.map((w: any) => [String(w.game_id), w]));
        for (const g of sortedGames) {
          const w = weatherMap.get(g.game_id);
          if (w) {
            g.weather = {
              temperature_f: w.temperature_f ?? null,
              wind_speed_mph: w.wind_speed_mph ?? null,
              wind_label: w.wind_label ?? null,
              wind_impact: w.wind_impact ?? null,
              hr_impact_score: w.hr_impact_score ?? null,
              roof_type: w.roof_type ?? null,
              venue_name: w.venue_name ?? null,
            };
          }
        }
      }

      if (parkResult.data && parkResult.data.length > 0) {
        // Prefer current year, fallback to previous
        const parkMap = new Map<number, number>();
        for (const p of parkResult.data as any[]) {
          if (!parkMap.has(p.venue_id)) parkMap.set(p.venue_id, p.factor_overall);
        }
        for (const g of sortedGames) {
          if (g.venue_id && parkMap.has(g.venue_id)) {
            g.park_factor = parkMap.get(g.venue_id)!;
          }
        }
      }
    } catch (enrichErr) {
      console.error("[/api/mlb/games] Weather/park enrichment error:", enrichErr);
    }

    const response = {
      games: sortedGames,
      dates,
      primaryDate: dates[0] || today,
    };

    redis
      .set(cacheKey, { ...response, ts: Date.now() }, { ex: GAMES_CACHE_TTL })
      .catch((e) => console.error("[/api/mlb/games] Cache write error:", e));

    console.log(`[/api/mlb/games] DB fetch in ${Date.now() - startTime}ms`);

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error: any) {
    console.error("[/api/mlb/games] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

