import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";

// Cache configuration
const GAMES_CACHE_KEY = "wnba:games:regular-season-preferred:v2";
const GAMES_CACHE_TTL = 300; // 5 minutes

// Helper to parse game time from game_status like "7:00 pm ET" into sortable minutes
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

    const aMinutes = parseGameTimeToMinutes(a.game_status || "");
    const bMinutes = parseGameTimeToMinutes(b.game_status || "");
    return aMinutes - bMinutes;
  });
}

function isPlayableGame(game: any): boolean {
  const status = String(game.game_status || "").toLowerCase();
  return !status.includes("postponed") && !status.includes("cancelled");
}

function isRegularSeasonGame(game: any): boolean {
  return String(game.season_type || "").toLowerCase().includes("regular");
}

function getPreferredDateWindowGames(games: any[], dateCount = 2): any[] {
  const playableGames = sortGamesByDateTime(games.filter(isPlayableGame));
  const regularSeasonGames = playableGames.filter(isRegularSeasonGame);
  const preferredGames = regularSeasonGames.length > 0 ? regularSeasonGames : playableGames;
  const dates = [...new Set(preferredGames.map((game) => game.game_date))].slice(0, dateCount);

  if (dates.length === 0) return [];

  return preferredGames.filter((game) => dates.includes(game.game_date));
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = etFormatter.format(now);

    const cacheKey = `${GAMES_CACHE_KEY}:${today}`;

    try {
      const cached = await redis.get<{ games: any[]; dates: string[]; primaryDate: string; ts: number }>(cacheKey);
      if (cached && cached.games) {
        console.log(`[/api/wnba/games] Cache HIT in ${Date.now() - startTime}ms`);
        return NextResponse.json(
          {
            games: cached.games,
            dates: cached.dates,
            primaryDate: cached.primaryDate,
            cached: true,
          },
          {
            headers: {
              "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120"
            }
          }
        );
      }
    } catch (cacheError) {
      console.error("[/api/wnba/games] Cache read error:", cacheError);
    }

    const supabase = createServerSupabaseClient();

    const selectFields = `
      game_id,
      game_date,
      home_team_name,
      away_team_name,
      home_team_tricode,
      away_team_tricode,
      home_team_score,
      away_team_score,
      game_status,
      is_primetime,
      national_broadcast,
      neutral_site,
      season_type
    `;

    const { data: futureGames, error: futureError } = await supabase
      .from("wnba_games_hr")
      .select(selectFields)
      .gte("game_date", today)
      .order("game_date", { ascending: true })
      .limit(60);

    if (futureError) {
      console.error("[/api/wnba/games] Error fetching upcoming games:", futureError);
      return NextResponse.json(
        { error: "Failed to fetch games", details: futureError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const allGames = getPreferredDateWindowGames(futureGames || []);
    const sortedGames = sortGamesByDateTime(allGames);
    const dates = [...new Set(sortedGames.map(g => g.game_date))];

    const response = {
      games: sortedGames,
      dates: dates,
      primaryDate: dates[0] || today
    };

    redis.set(cacheKey, { ...response, ts: Date.now() }, { ex: GAMES_CACHE_TTL }).catch(e =>
      console.error("[/api/wnba/games] Cache write error:", e)
    );

    console.log(`[/api/wnba/games] DB fetch in ${Date.now() - startTime}ms`);

    return NextResponse.json(
      response,
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120"
        }
      }
    );
  } catch (error: any) {
    console.error("[/api/wnba/games] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
