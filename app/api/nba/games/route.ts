// app/api/nba/games/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get today's NBA game schedule
 * Returns: Scheduled, Live, and Final games for today
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // Get the most recent date in database (handles timezone issues)
    const { data: latestGameData } = await supabase
      .from('nba_games')
      .select('game_date')
      .order('game_date', { ascending: false })
      .limit(1);

    const targetDate = latestGameData?.[0]?.game_date || new Date().toISOString().split('T')[0];

    // Fetch today's games
    const { data: games, error } = await supabase
      .from('nba_games')
      .select('*')
      .eq('game_date', targetDate)
      .order('start_time_utc', { ascending: true });

    if (error) {
      console.error('[NBA Games] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch games', details: error.message },
        { status: 500 }
      );
    }

    // Transform and enrich game data
    const enrichedGames = (games || []).map(game => ({
      game_id: game.game_id,
      matchup: `${game.away_team_tricode} @ ${game.home_team_tricode}`,
      full_matchup: `${game.away_team_name} @ ${game.home_team_name}`,
      away_team: {
        tricode: game.away_team_tricode,
        name: game.away_team_name,
        score: game.away_team_score,
        record: `${game.away_team_wins}-${game.away_team_losses}`,
      },
      home_team: {
        tricode: game.home_team_tricode,
        name: game.home_team_name,
        score: game.home_team_score,
        record: `${game.home_team_wins}-${game.home_team_losses}`,
      },
      status: game.game_status, // 1=Scheduled, 2=Live, 3=Final
      status_text: game.game_status_text,
      display_time: game.game_status === 3 
        ? 'Final'
        : game.game_status === 2
          ? `Q${game.period} ${game.game_clock || ''}`
          : game.game_status_text, // e.g., "7:00 PM ET"
      period: game.period,
      game_clock: game.game_clock,
      start_time: game.start_time_utc,
      is_live: game.game_status === 2,
      is_final: game.game_status === 3,
    }));

    // Group games by status
    const scheduled = enrichedGames.filter(g => g.status === 1);
    const live = enrichedGames.filter(g => g.status === 2);
    const final = enrichedGames.filter(g => g.status === 3);

    const response = {
      date: targetDate,
      games: enrichedGames,
      summary: {
        total: enrichedGames.length,
        live: live.length,
        scheduled: scheduled.length,
        final: final.length,
      },
      grouped: {
        live,
        scheduled,
        final,
      },
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=20, s-maxage=20', // 20 second cache
      },
    });
  } catch (error: any) {
    console.error('[NBA Games] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || '' },
      { status: 500 }
    );
  }
}