import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Helper to parse game time from game_status like "7:00 pm ET" into sortable minutes
function parseGameTimeToMinutes(gameStatus: string): number {
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch) {
    // Final games or other statuses go to the end
    if (gameStatus.toLowerCase().includes("final")) return 9999;
    return 5000; // Unknown status in the middle
  }
  
  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  
  return hour * 60 + parseInt(minutes, 10);
}

// Sort games by date first, then by game time
function sortGamesByDateTime(games: any[]): any[] {
  return [...games].sort((a, b) => {
    // First sort by date
    const dateCompare = a.game_date.localeCompare(b.game_date);
    if (dateCompare !== 0) return dateCompare;
    
    // Then sort by game time
    const aMinutes = parseGameTimeToMinutes(a.game_status || "");
    const bMinutes = parseGameTimeToMinutes(b.game_status || "");
    return aMinutes - bMinutes;
  });
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Use Eastern Time for "today" since NBA games are scheduled in ET
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = etFormatter.format(now);
    
    // Calculate tomorrow
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = etFormatter.format(tomorrowDate);

    const selectFields = `
      game_id, 
      game_date, 
      home_team_name, 
      away_team_name, 
      home_team_tricode, 
      away_team_tricode, 
      game_status,
      is_primetime,
      national_broadcast,
      neutral_site,
      season_type
    `;

    // OPTIMIZATION: Fetch today AND tomorrow in parallel (single round-trip)
    const [todayResult, tomorrowResult] = await Promise.all([
      supabase
        .from("nba_games_hr")
        .select(selectFields)
        .eq("game_date", today),
      supabase
        .from("nba_games_hr")
        .select(selectFields)
        .eq("game_date", tomorrow),
    ]);

    if (todayResult.error) {
      console.error("[/api/nba/games] Error fetching today's games:", todayResult.error);
      return NextResponse.json(
        { error: "Failed to fetch games", details: todayResult.error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Combine today's and tomorrow's games
    let allGames = [
      ...(todayResult.data || []),
      ...(tomorrowResult.data || []),
    ];

    // If no games found, look further into the future (fallback)
    if (allGames.length === 0) {
      const { data: futureGames, error: futureError } = await supabase
        .from("nba_games_hr")
        .select(selectFields)
        .gte("game_date", today)
        .order("game_date", { ascending: true })
        .limit(30);

      if (!futureError && futureGames) {
        // Get unique dates and take games from first two dates
        const dates = [...new Set(futureGames.map(g => g.game_date))].slice(0, 2);
        allGames = futureGames.filter(g => dates.includes(g.game_date));
      }
    }

    // Sort all games by date and time
    const sortedGames = sortGamesByDateTime(allGames);

    // Get unique dates for the response
    const dates = [...new Set(sortedGames.map(g => g.game_date))];

    return NextResponse.json(
      { 
        games: sortedGames,
        dates: dates,
        primaryDate: dates[0] || today
      },
      { 
        headers: { 
          // Aggressive caching for games data (changes infrequently)
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" 
        } 
      }
    );
  } catch (error: any) {
    console.error("[/api/nba/games] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
