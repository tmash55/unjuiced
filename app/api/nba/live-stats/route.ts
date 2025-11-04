// app/api/nba/live-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get NBA live PRA leaderboard
 * Query params:
 *  - view: "leaderboard" | "live-only" | "oncourt"
 *  - limit: number (default: 50)
 *  - minPRA: number (default: 0)
 *  - date: YYYY-MM-DD (optional, defaults to latest)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'leaderboard';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const minPRA = parseInt(searchParams.get('minPRA') || '0', 10);
    const dateFilter = searchParams.get('date'); // Optional specific date

    const supabase = createServerSupabaseClient();

    // Get target date (specified or latest)
    let targetDate = dateFilter;
    if (!targetDate) {
      const { data: latestGame } = await supabase
        .from('nba_games')
        .select('game_date')
        .order('game_date', { ascending: false })
        .limit(1);
      targetDate = latestGame?.[0]?.game_date || new Date().toISOString().split('T')[0];
    }

    // Build query
    let query = supabase
      .from('nba_player_game_stats')
      .select(`
        player_name,
        team_tricode,
        points,
        rebounds,
        assists,
        pra,
        minutes,
        oncourt,
        starter,
        game_id,
        game_date,
        field_goals_made,
        field_goals_attempted,
        three_pointers_made,
        steals,
        blocks,
        plus_minus,
        turnovers,
        nba_games!inner (
          game_id,
          away_team_tricode,
          home_team_tricode,
          game_status,
          game_status_text,
          period,
          game_clock
        )
      `)
      .eq('game_date', targetDate)
      .neq('minutes', '')
      .gte('pra', minPRA);

    // Apply view filters
    if (view === 'live-only') {
      // Filter by game_status through the join - need to do this client-side after fetch
    } else if (view === 'oncourt') {
      query = query.eq('oncourt', true);
    }

    query = query.order('pra', { ascending: false }).limit(limit);

    const { data: stats, error } = await query;

    if (error) {
      console.error('[NBA Live Stats] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch live stats', details: error.message },
        { status: 500 }
      );
    }

    // Transform and filter the data
    let leaderboard = (stats || []).map((stat: any, index: number) => {
      const game = stat.nba_games;
      const matchup = `${game.away_team_tricode} @ ${game.home_team_tricode}`;
      
      // Format game time
      const game_time = game.game_status === 3 
        ? 'Final' 
        : game.game_status === 2 
          ? `Q${game.period} ${game.game_clock?.trim() || ''}` 
          : 'Scheduled';
      
      // Calculate FG%
      const fg_pct = stat.field_goals_attempted > 0
        ? Math.round((stat.field_goals_made / stat.field_goals_attempted) * 1000) / 10
        : 0;

      return {
        rank: index + 1,
        player_name: stat.player_name,
        team_tricode: stat.team_tricode,
        points: stat.points,
        rebounds: stat.rebounds,
        assists: stat.assists,
        pra: stat.pra,
        minutes: stat.minutes,
        oncourt: stat.oncourt,
        starter: stat.starter,
        game_id: stat.game_id,
        game_date: stat.game_date,
        matchup,
        game_status: game.game_status,
        game_time,
        field_goals_made: stat.field_goals_made,
        field_goals_attempted: stat.field_goals_attempted,
        fg_pct,
        three_pointers_made: stat.three_pointers_made,
        steals: stat.steals,
        blocks: stat.blocks,
        plus_minus: stat.plus_minus,
        turnovers: stat.turnovers,
      };
    });

    // Apply live-only filter if needed (client-side filtering)
    if (view === 'live-only') {
      leaderboard = leaderboard.filter(p => p.game_status === 2);
    }

    // Re-rank after filtering
    leaderboard = leaderboard.map((p, i) => ({ ...p, rank: i + 1 }));

    // Get game summary
    const { data: games } = await supabase
      .from('nba_games')
      .select('game_status')
      .eq('game_date', targetDate);

    const gamesLive = games?.filter(g => g.game_status === 2).length || 0;
    const gamesFinal = games?.filter(g => g.game_status === 3).length || 0;
    const gamesScheduled = games?.filter(g => g.game_status === 1).length || 0;

    const response = {
      leaderboard,
      lastUpdated: new Date().toISOString(),
      metadata: {
        total: leaderboard.length,
        view,
        date: targetDate,
        gamesLive,
        gamesFinal,
        gamesScheduled,
      },
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=15, s-maxage=15', // 15 second cache
      },
    });
  } catch (error: any) {
    console.error('[NBA Live Stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || '' },
      { status: 500 }
    );
  }
}