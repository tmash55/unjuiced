import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { AdvancedStatsResponse, AdvancedStatType } from '@/types/nba';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statType = (searchParams.get('stat') || 'pra_per_min') as AdvancedStatType;
    const dateParam = searchParams.get('date') || 'latest';
    const minMinutes = parseInt(searchParams.get('minMinutes') || '20', 10);

    const supabase = createServerSupabaseClient();

    let players: any[] = [];
    let description = '';

    // Determine date filter
    const dateFilter = dateParam === 'latest' 
      ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : dateParam;

    switch (statType) {
      case 'pra_per_min': {
        description = 'Most efficient PRA producers (minimum 20 minutes played)';
        
        const { data: stats, error } = await supabase
          .from('nba_player_game_stats')
          .select(`
            player_name,
            team_tricode,
            points,
            rebounds,
            assists,
            pra,
            minutes,
            game_id,
            nba_games!inner (
              away_team_tricode,
              home_team_tricode
            )
          `)
          .gte('game_date', dateFilter)
          .neq('minutes', '')
          .order('pra', { ascending: false })
          .limit(100);

        if (error) throw error;

        // Calculate PRA per minute and filter
        players = (stats || [])
          .map((stat: any) => {
            const minutesNum = parseFloat(stat.minutes) || 0;
            if (minutesNum < minMinutes) return null;

            const praPerMin = minutesNum > 0 ? stat.pra / minutesNum : 0;
            const game = stat.nba_games;
            
            return {
              ...stat,
              matchup: `${game.away_team_tricode} @ ${game.home_team_tricode}`,
              stat_line: `${stat.points}/${stat.rebounds}/${stat.assists}`,
              pra_per_minute: Math.round(praPerMin * 100) / 100,
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => b.pra_per_minute - a.pra_per_minute)
          .slice(0, 20);

        break;
      }

      case 'elite_club': {
        description = 'Elite performances (40+ PRA since Nov 3, 2025)';
        
        const { data: stats, error } = await supabase
          .from('nba_player_game_stats')
          .select(`
            player_name,
            team_tricode,
            points,
            rebounds,
            assists,
            pra,
            minutes,
            game_date,
            game_id
          `)
          .gte('game_date', '2025-11-03')
          .gte('pra', 40)
          .order('pra', { ascending: false })
          .limit(50);

        if (error) throw error;

        players = (stats || []).map((stat: any) => ({
          ...stat,
          stat_line: `${stat.points}p / ${stat.rebounds}r / ${stat.assists}a`,
          tier: stat.pra >= 60 ? 'Legendary' : stat.pra >= 50 ? 'Elite' : 'Great',
        }));

        break;
      }

      case 'efficiency': {
        description = 'High-efficiency scorers (50%+ FG, 15+ PRA)';
        
        const { data: stats, error } = await supabase
          .from('nba_player_game_stats')
          .select(`
            player_name,
            team_tricode,
            points,
            rebounds,
            assists,
            pra,
            field_goals_made,
            field_goals_attempted,
            three_pointers_made,
            plus_minus,
            game_id,
            nba_games!inner (
              away_team_tricode,
              home_team_tricode
            )
          `)
          .gte('game_date', dateFilter)
          .gte('pra', 15)
          .gte('field_goals_attempted', 10)
          .order('pra', { ascending: false })
          .limit(100);

        if (error) throw error;

        // Filter by FG%
        players = (stats || [])
          .map((stat: any) => {
            const fgPct = stat.field_goals_attempted > 0
              ? (stat.field_goals_made / stat.field_goals_attempted) * 100
              : 0;

            if (fgPct < 50) return null;

            const game = stat.nba_games;

            return {
              ...stat,
              matchup: `${game.away_team_tricode} @ ${game.home_team_tricode}`,
              stat_line: `${stat.field_goals_made}-${stat.field_goals_attempted} FG`,
              fg_pct: Math.round(fgPct * 10) / 10,
            };
          })
          .filter(Boolean)
          .slice(0, 20);

        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid stat type' },
          { status: 400 }
        );
    }

    const response: AdvancedStatsResponse = {
      stat: statType,
      description,
      players,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      },
    });
  } catch (error: any) {
    console.error('[NBA Advanced Stats] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || '' },
      { status: 500 }
    );
  }
}

