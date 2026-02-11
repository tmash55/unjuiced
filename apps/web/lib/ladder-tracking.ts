/**
 * Client-side utility for tracking ladder usage
 */

export interface LadderUsageEvent {
  sport: 'nfl' | 'nba' | 'nhl' | 'mlb' | 'ncaaf' | 'ncaab';
  market: string;
  playerEntity?: string;
  playerName?: string;
  side?: 'over' | 'under';
  scope?: 'pregame' | 'live';
  selectedBooks?: string[];
}

/**
 * Track ladder usage event
 * Non-blocking - fires and forgets, doesn't throw errors
 */
export async function trackLadderUsage(event: LadderUsageEvent): Promise<void> {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 [Ladder Tracking] Client-side tracking initiated:', {
        sport: event.sport,
        market: event.market,
        playerEntity: event.playerEntity,
        playerName: event.playerName,
        side: event.side,
        scope: event.scope,
        selectedBooksCount: event.selectedBooks?.length || 0,
      });
    }
    
    const response = await fetch('/api/ladders/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn('⚠️ [Ladder Tracking] API returned error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData.error,
        details: errorData.details,
        code: errorData.code,
      });
      return;
    }
    
    const data = await response.json();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [Ladder Tracking] Successfully tracked:', {
        success: data.success,
        id: data.id,
        sport: event.sport,
        market: event.market,
        playerName: event.playerName,
      });
    }
  } catch (error) {
    // Silently fail - tracking shouldn't break the app
    console.debug('❌ [Ladder Tracking] Failed to track ladder usage:', error);
  }
}

/**
 * Get ladder usage analytics
 */
export async function getLadderAnalytics(params?: {
  startDate?: string;
  endDate?: string;
  sport?: string;
}): Promise<{
  stats: {
    total: number;
    bySport: Record<string, number>;
    byMarket: Record<string, number>;
    topPlayers: Record<string, number>;
    topMarkets: Array<{ market: string; count: number }>;
  };
  records: Array<{
    sport: string;
    market: string;
    player_name: string | null;
    side: string | null;
    created_at: string;
  }>;
}> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.sport) searchParams.set('sport', params.sport);
  
  const response = await fetch(`/api/ladders/track?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch ladder analytics');
  }
  
  return response.json();
}

