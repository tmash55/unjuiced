import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { HistoricalResponse } from '@/types/nba';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const gameId = searchParams.get('gameId');

    if (!dateParam) {
      return NextResponse.json(
        { error: 'Date parameter required (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Fetch game summaries for the date
    const { data: gameSummaries, error: gamesError } = await supabase
      .from('nba_games')
      .select(`
        game_id,
        away_team_tricode,
        home_team_tricode,
        away_team_score,
        home_team_score,
        game_status_text,
        start_time_utc
      `)
      .eq('game_date', dateParam)
      .order('start_time_utc', { ascending: true });

    if (gamesError) {
      console.error('[NBA Historical] Games query error:', gamesError);
      return NextResponse.json(
        { error: 'Failed to fetch games', details: gamesError.message },
        { status: 500 }
      );
    }

    // Process game summaries to include player counts and top performers
    const games = await Promise.all(
      (gameSummaries || []).map(async (game) => {
        const { data: playerStats } = await supabase
          .from('nba_player_game_stats')
          .select('person_id, player_name, pra')
          .eq('game_id', game.game_id)
          .neq('minutes', '')
          .order('pra', { ascending: false })
          .limit(1);

        const topPerformer = playerStats?.[0]
          ? `${playerStats[0].player_name} (${playerStats[0].pra} PRA)`
          : 'N/A';

        const { count } = await supabase
          .from('nba_player_game_stats')
          .select('person_id', { count: 'exact', head: true })
          .eq('game_id', game.game_id)
          .neq('minutes', '');

        return {
          game_id: game.game_id,
          matchup: `${game.away_team_tricode} @ ${game.home_team_tricode}`,
          final_score: `${game.away_team_score}-${game.home_team_score}`,
          game_status_text: game.game_status_text,
          players_tracked: count || 0,
          top_performer: topPerformer,
        };
      })
    );

    // Fetch leaderboard for the date (or specific game)
    let leaderboardQuery = supabase
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
          away_team_score,
          home_team_score
        )
      `)
      .eq('game_date', dateParam)
      .neq('minutes', '')
      .order('pra', { ascending: false })
      .limit(100);

    if (gameId) {
      leaderboardQuery = leaderboardQuery.eq('game_id', gameId);
    }

    const { data: stats, error: statsError } = await leaderboardQuery;

    if (statsError) {
      console.error('[NBA Historical] Stats query error:', statsError);
      return NextResponse.json(
        { error: 'Failed to fetch stats', details: statsError.message },
        { status: 500 }
      );
    }

    // Transform leaderboard data
    const leaderboard = stats?.map((stat: any, index: number) => {
      const game = stat.nba_games;
      const matchup = `${game.away_team_tricode} @ ${game.home_team_tricode}`;
      const final_score = `${game.away_team_score}-${game.home_team_score}`;
      
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
        matchup,
        final_score,
        game_status: game.game_status,
        game_time: 'Final',
        field_goals_made: stat.field_goals_made,
        field_goals_attempted: stat.field_goals_attempted,
        fg_pct,
        three_pointers_made: stat.three_pointers_made,
        steals: stat.steals,
        blocks: stat.blocks,
        plus_minus: stat.plus_minus,
        turnovers: stat.turnovers,
      };
    }) || [];

    const response: HistoricalResponse = {
      date: dateParam,
      games,
      leaderboard,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour (historical data)
      },
    });
  } catch (error: any) {
    console.error('[NBA Historical] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || '' },
      { status: 500 }
    );
  }
}

