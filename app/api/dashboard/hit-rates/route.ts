import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = 'force-dynamic';

interface GameLog {
  date: string;
  market_stat: number;
  win_loss: string;
  home_away: string;
  margin: string;
  minutes: string;
  opponent_team_id: number;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Get today's date in ET
    const now = new Date();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    // Use regular query with client-side deduplication
    return await fetchTopHitRates(supabase, today);
  } catch (error) {
    console.error("Error fetching hit rates:", error);
    return NextResponse.json({ error: "Failed to fetch hit rates" }, { status: 500 });
  }
}

async function fetchTopHitRates(supabase: any, today: string) {
  const markets = [
    'player_points', 
    'player_rebounds', 
    'player_assists', 
    'player_threes_made', 
    'player_steals'
  ];

  console.log(`[HitRatesAPI] Fetching for date: ${today}`);

  // Fetch top 1 for each market in parallel to ensure diversity
  // Filter for last_10_pct IS NOT NULL to match the working SQL query
  const queries = markets.map(market => 
    supabase
      .from("nba_hit_rate_profiles_v2")
      .select(`
        player_id,
        player_name,
        team_abbr,
        position,
        market,
        line,
        last_5_pct,
        last_10_pct,
        last_20_pct,
        season_pct,
        last_5_avg,
        last_10_avg,
        hit_streak,
        game_logs,
        opponent_team_abbr,
        game_status,
        home_away,
        dvp_rank,
        dvp_label
      `)
      .eq("game_date", today)
      .eq("has_live_odds", true)
      .eq("market", market)
      .not("last_10_pct", "is", null)
      .order("last_10_pct", { ascending: false, nullsFirst: false })
      .limit(1)
  );

  const results = await Promise.all(queries);
  const topHitRates = [];

  for (const result of results) {
    if (result.error) {
      console.error(`[HitRatesAPI] Error fetching market:`, result.error);
      continue;
    }
    if (result.data && result.data.length > 0) {
      console.log(`[HitRatesAPI] Found profile for ${result.data[0].market}:`, result.data[0].player_name, result.data[0].last_10_pct);
      topHitRates.push(formatProfile(result.data[0]));
    }
  }

  // Sort by L10% descending so the best cards come first in carousel
  topHitRates.sort((a, b) => b.l10 - a.l10);

  console.log(`[HitRatesAPI] Returning ${topHitRates.length} unique hit rates`);
  return NextResponse.json({ hitRates: topHitRates });
}

function formatProfile(profile: any) {
  // Parse percentages (DB returns strings like "80.0" or numbers)
  const parsePct = (val: string | number | null) => {
    if (val === null || val === undefined) return 0;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num / 100;
  };

  // Parse game logs
  let gameLogs: GameLog[] = [];
  try {
    if (profile.game_logs) {
      const parsed = typeof profile.game_logs === 'string' 
        ? JSON.parse(profile.game_logs) 
        : profile.game_logs;
      gameLogs = Array.isArray(parsed) ? parsed.slice(0, 10) : [];
    }
  } catch (e) {
    console.error("Error parsing game logs:", e);
  }

  // Fallback for player name if null (shouldn't happen often but good for safety)
  const playerName = profile.player_name || `Player #${profile.player_id}`;

  return {
    playerId: profile.player_id,
    playerName: playerName,
    team: profile.team_abbr,
    position: profile.position,
    market: profile.market,
    marketDisplay: formatMarketDisplay(profile.market),
    line: profile.line,
    l5: parsePct(profile.last_5_pct),
    l10: parsePct(profile.last_10_pct),
    l20: parsePct(profile.last_20_pct),
    szn: parsePct(profile.season_pct),
    l5Avg: profile.last_5_avg,
    l10Avg: profile.last_10_avg,
    hitStreak: profile.hit_streak,
    gameLogs,
    opponent: profile.opponent_team_abbr,
    gameStatus: profile.game_status,
    homeAway: profile.home_away,
    dvpRank: profile.dvp_rank,
    dvpLabel: profile.dvp_label,
    profileUrl: `/hit-rates/nba/player/${profile.player_id}?market=${profile.market}`
  };
}

function formatMarketDisplay(market: string): string {
  const map: Record<string, string> = {
    player_points: "Points",
    player_rebounds: "Rebounds",
    player_assists: "Assists",
    player_threes_made: "Threes",
    player_steals: "Steals",
  };
  return map[market] || market.replace(/_/g, " ").replace("player ", "");
}
