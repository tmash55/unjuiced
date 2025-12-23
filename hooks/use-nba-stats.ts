import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  GamesResponse,
  LiveStatsResponse,
  PropsResponse,
  HistoricalResponse, 
  AdvancedStatsResponse,
  LeaderboardView,
  AdvancedStatType 
} from '@/types/nba';

/**
 * Hook to fetch today's NBA game schedule
 * Polls every 20 seconds
 * Transforms flat API response to nested NBAGame format
 */
export function useTodaysGames(enabled: boolean = true) {
  return useQuery<GamesResponse>({
    queryKey: ['nba', 'games', 'today'],
    queryFn: async () => {
      const response = await fetch('/api/nba/games');
      if (!response.ok) {
        throw new Error('Failed to fetch games');
      }
      const data = await response.json();
      
      // Transform flat API response to nested NBAGame format
      const games = (data.games || []).map((game: any) => {
        const gameStatus = game.game_status || '';
        const isLive = gameStatus.toLowerCase().includes('q') || 
                       gameStatus.toLowerCase().includes('half') ||
                       gameStatus.toLowerCase().includes('ot');
        const isFinal = gameStatus.toLowerCase().includes('final');
        
        return {
          game_id: game.game_id,
          matchup: `${game.away_team_tricode || ''} @ ${game.home_team_tricode || ''}`,
          full_matchup: `${game.away_team_name || ''} @ ${game.home_team_name || ''}`,
          away_team: {
            tricode: game.away_team_tricode || '',
            name: game.away_team_name || '',
            score: game.away_team_score || 0,
            record: '', // Not available from current API
          },
          home_team: {
            tricode: game.home_team_tricode || '',
            name: game.home_team_name || '',
            score: game.home_team_score || 0,
            record: '', // Not available from current API
          },
          status: isFinal ? 3 : isLive ? 2 : 1,
          status_text: gameStatus,
          display_time: gameStatus,
          period: 0,
          game_clock: '',
          start_time: game.game_date || '',
          is_live: isLive,
          is_final: isFinal,
        };
      });
      
      // Calculate summary
      const live = games.filter((g: any) => g.is_live).length;
      const final = games.filter((g: any) => g.is_final).length;
      const scheduled = games.length - live - final;
      
      return {
        date: data.primaryDate || new Date().toISOString().split('T')[0],
        games,
        summary: {
          total: games.length,
          live,
          scheduled,
          final,
        },
        grouped: {
          live: games.filter((g: any) => g.is_live),
          scheduled: games.filter((g: any) => !g.is_live && !g.is_final),
          final: games.filter((g: any) => g.is_final),
        },
        lastUpdated: new Date().toISOString(),
      };
    },
    refetchInterval: 20000, // Poll every 20 seconds
    enabled,
  });
}

/**
 * Hook to fetch live NBA PRA leaderboard
 * Polls every 20 seconds
 */
export function useLiveLeaderboard(
  view: LeaderboardView = 'leaderboard',
  limit: number = 50,
  minPRA: number = 0,
  enabled: boolean = true
) {
  return useQuery<LiveStatsResponse>({
    queryKey: ['nba', 'live-stats', view, limit, minPRA],
    queryFn: async () => {
      const params = new URLSearchParams({
        view,
        limit: limit.toString(),
        minPRA: minPRA.toString(),
      });
      
      const response = await fetch(`/api/nba/live-stats?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch live stats');
      }
      return response.json();
    },
    refetchInterval: 20000, // Poll every 20 seconds
    enabled,
  });
}

/**
 * Hook to fetch NBA PRA props/odds using the existing props table API
 * Fetches ALL available props in one request, sorted by highest PRA line
 * Manual refresh only (no auto-polling)
 */
export function useNBAProps(
  market: string = 'player_points_rebounds_assists',
  scope: 'live' | 'pregame' = 'pregame',
  enabled: boolean = true
) {
  return useQuery<PropsResponse>({
    queryKey: ['nba', 'props', market, scope],
    queryFn: async () => {
      // Fetch ALL available props (up to 300)
      const params = new URLSearchParams({
        sport: 'nba',
        market,
        scope,
        limit: '300', // Get all available props
      });
      
      const response = await fetch(`/api/props/table?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch props');
      }
      
      const data = await response.json();
      const props = transformPropsData(data, market);
      
      // Sort by PRA line (highest first)
      const sortedProps = props.sort((a: any, b: any) => b.line - a.line);
      
      return {
        props: sortedProps,
        metadata: {
          market,
          scope,
          total: sortedProps.length,
        },
        lastUpdated: new Date().toISOString(),
      };
    },
    // SWR-like behavior
    staleTime: 2 * 60 * 1000, // Fresh for 2 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on window focus (manual only)
    refetchOnReconnect: false, // Don't refetch on reconnect
    refetchInterval: false, // Manual refresh only
    retry: 1, // Only retry once on failure
    // Return stale data while fetching
    placeholderData: (previousData) => previousData,
    enabled,
  });
}

// Helper function to transform props data
function transformPropsData(data: any, market: string) {
  return (data.rows || []).map((row: any, index: number) => {
    const sid = data.sids?.[index] || `${row.ent}-${row.mkt}-${index}`;
    
    // Parse matchup properly - handle both string and object formats
    let matchup = 'Unknown';
    if (typeof row.ev?.matchup === 'string') {
      matchup = row.ev.matchup;
    } else if (row.ev?.away && row.ev?.home) {
      // If away/home are objects with team info
      const awayTeam = typeof row.ev.away === 'string' ? row.ev.away : row.ev.away?.abbr || row.ev.away?.name || 'Unknown';
      const homeTeam = typeof row.ev.home === 'string' ? row.ev.home : row.ev.home?.abbr || row.ev.home?.name || 'Unknown';
      matchup = `${awayTeam} @ ${homeTeam}`;
    }
    
    return {
      sid,
      player: row.player || row.ent || 'Unknown',
      team: row.team || '',
      market: row.mkt || market,
      line: row.ln || 0,
      event: matchup,
      books: row.books || [],
      best_over: row.best?.over || null,
      best_under: row.best?.under || null,
      avg_over: row.avg?.over || null,
      avg_under: row.avg?.under || null,
      is_live: row.scope === 'live',
      updated_at: row.ts || new Date().toISOString(),
      // Pass through the entire ev block so we can access dt, live status, etc
      ev: row.ev ? {
        dt: row.ev.dt,
        live: row.ev.live || false,
        home: row.ev.home,
        away: row.ev.away,
      } : undefined,
    };
  });
}

/**
 * Hook to fetch historical NBA stats for a specific date
 */
export function useHistoricalStats(date: string | null, gameId?: string) {
  return useQuery<HistoricalResponse>({
    queryKey: ['nba', 'historical', date, gameId],
    queryFn: async () => {
      if (!date) throw new Error('Date required');
      
      const params = new URLSearchParams({ date });
      if (gameId) params.append('gameId', gameId);
      
      const response = await fetch(`/api/nba/historical?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch historical stats');
      }
      return response.json();
    },
    enabled: !!date,
    staleTime: 60000, // Historical data is stable, cache for 1 minute
  });
}

/**
 * Hook to fetch advanced NBA stats
 */
export function useAdvancedStats(
  statType: AdvancedStatType = 'pra_per_min',
  date: string = 'latest',
  minMinutes: number = 20
) {
  return useQuery<AdvancedStatsResponse>({
    queryKey: ['nba', 'advanced-stats', statType, date, minMinutes],
    queryFn: async () => {
      const params = new URLSearchParams({
        stat: statType,
        date,
        minMinutes: minMinutes.toString(),
      });
      
      const response = await fetch(`/api/nba/advanced-stats?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch advanced stats');
      }
      return response.json();
    },
    staleTime: 30000, // Cache for 30 seconds
  });
}

