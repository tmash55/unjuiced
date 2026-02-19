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
    is_primetime: null,
    national_broadcast: null,
    neutral_site: false,
    season_type: row.game_type ?? null,
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
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = etFormatter.format(tomorrowDate);

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
      home_team:mlb_teams!mlb_games_home_id_fkey (abbreviation),
      away_team:mlb_teams!mlb_games_away_id_fkey (abbreviation)
    `;

    const [todayResult, tomorrowResult] = await Promise.all([
      supabase.from("mlb_games").select(selectFields).eq("game_date", today),
      supabase.from("mlb_games").select(selectFields).eq("game_date", tomorrow),
    ]);

    if (todayResult.error) {
      return NextResponse.json(
        { error: "Failed to fetch games", details: todayResult.error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    let allGames = [...(todayResult.data || []), ...(tomorrowResult.data || [])];

    if (allGames.length === 0) {
      const { data: futureGames, error: futureError } = await supabase
        .from("mlb_games")
        .select(selectFields)
        .gte("game_date", today)
        .order("game_date", { ascending: true })
        .limit(60);

      if (!futureError && futureGames) {
        const dates = [...new Set(futureGames.map((g) => g.game_date))].slice(0, 2);
        allGames = futureGames.filter((g) => dates.includes(g.game_date));
      }
    }

    const normalized = allGames.map(toGameRow);
    const sortedGames = sortGamesByDateTime(normalized);
    const dates = [...new Set(sortedGames.map((g) => g.game_date))];
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

