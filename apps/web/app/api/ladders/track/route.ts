import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/libs/supabase/server';

/**
 * API endpoint to track ladder usage for marketing/analytics
 * POST /api/ladders/track
 * 
 * Body:
 * {
 *   sport: string,
 *   market: string,
 *   playerEntity?: string,
 *   playerName?: string,
 *   side?: 'over' | 'under',
 *   scope?: 'pregame' | 'live',
 *   selectedBooks?: string[]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();
    
    console.log('📊 [Ladder Tracking] Received tracking request:', {
      sport: body.sport,
      market: body.market,
      playerEntity: body.playerEntity,
      playerName: body.playerName,
      side: body.side,
      scope: body.scope,
      selectedBooksCount: body.selectedBooks?.length || 0,
    });
    
    // Get user if authenticated (optional - can track anonymous usage)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.warn('⚠️ [Ladder Tracking] Auth error (non-fatal):', authError.message);
    }
    
    console.log('📊 [Ladder Tracking] User context:', {
      userId: user?.id || 'anonymous',
      isAuthenticated: !!user,
      authError: authError?.message || null,
    });
    
    // Validate required fields
    if (!body.sport || !body.market) {
      console.warn('⚠️ [Ladder Tracking] Validation failed - missing required fields:', {
        hasSport: !!body.sport,
        hasMarket: !!body.market,
      });
      return NextResponse.json(
        { error: 'sport and market are required' },
        { status: 400 }
      );
    }
    
    // Validate sport
    const validSports = ['nfl', 'nba', 'nhl', 'mlb', 'ncaaf', 'ncaab'];
    if (!validSports.includes(body.sport)) {
      console.warn('⚠️ [Ladder Tracking] Validation failed - invalid sport:', body.sport);
      return NextResponse.json(
        { error: `sport must be one of: ${validSports.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Get user agent and referrer from headers
    const userAgent = req.headers.get('user-agent') || null;
    const referrer = req.headers.get('referer') || null;
    
    const insertData = {
      user_id: user?.id || null,
      sport: body.sport,
      market: body.market,
      player_entity: body.playerEntity || null,
      player_name: body.playerName || null,
      side: body.side || null,
      scope: body.scope || null,
      selected_books: body.selectedBooks || null,
      user_agent: userAgent,
      referrer: referrer,
    };
    
    console.log('📊 [Ladder Tracking] Inserting data:', {
      ...insertData,
      user_agent: userAgent ? `${userAgent.substring(0, 50)}...` : null,
      selected_books: insertData.selected_books ? `${insertData.selected_books.length} books` : null,
    });
    
    // Insert usage record
    const { data: insertedData, error } = await supabase
      .from('ladder_usage')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('❌ [Ladder Tracking] Failed to insert ladder usage:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        fullError: JSON.stringify(error, null, 2),
      });
      
      // Log the exact data we tried to insert for debugging
      console.error('❌ [Ladder Tracking] Failed insert data:', JSON.stringify(insertData, null, 2));
      
      // Additional check: verify table exists
      const { error: tableCheckError } = await supabase
        .from('ladder_usage')
        .select('id')
        .limit(1);
      
      if (tableCheckError) {
        console.error('❌ [Ladder Tracking] Table may not exist or RLS is blocking:', {
          tableError: tableCheckError.message,
          tableCode: tableCheckError.code,
        });
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to track usage',
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }
    
    console.log('✅ [Ladder Tracking] Successfully saved ladder usage:', {
      id: insertedData?.id,
      sport: insertedData?.sport,
      market: insertedData?.market,
      playerName: insertedData?.player_name,
      createdAt: insertedData?.created_at,
    });
    
    return NextResponse.json({ 
      success: true,
      id: insertedData?.id,
    });
  } catch (error) {
    console.error('❌ [Ladder Tracking] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve ladder usage analytics
 * GET /api/ladders/track?startDate=...&endDate=...&sport=...
 * 
 * Returns aggregate stats for marketing/analytics
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    
    // Get query parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sport = searchParams.get('sport');
    
    // Build query
    let query = supabase
      .from('ladder_usage')
      .select('sport, market, player_name, side, created_at');
    
    // Apply filters
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    if (sport) {
      query = query.eq('sport', sport);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);
    
    if (error) {
      console.error('❌ [Ladder Analytics] Failed to fetch ladder usage:', error);
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      );
    }
    
    console.log('📊 [Ladder Analytics] Fetched records:', {
      count: data?.length || 0,
      filters: { startDate, endDate, sport },
    });
    
    // Aggregate stats
    const stats = {
      total: data?.length || 0,
      bySport: {} as Record<string, number>,
      byMarket: {} as Record<string, number>,
      topPlayers: {} as Record<string, number>,
      topMarkets: [] as Array<{ market: string; count: number }>,
    };
    
    if (data) {
      data.forEach((record) => {
        // Count by sport
        stats.bySport[record.sport] = (stats.bySport[record.sport] || 0) + 1;
        
        // Count by market
        const marketKey = `${record.sport}:${record.market}`;
        stats.byMarket[marketKey] = (stats.byMarket[marketKey] || 0) + 1;
        
        // Count by player
        if (record.player_name) {
          stats.topPlayers[record.player_name] = (stats.topPlayers[record.player_name] || 0) + 1;
        }
      });
      
      // Get top markets
      const marketCounts = Object.entries(stats.byMarket)
        .map(([market, count]) => ({ market, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      stats.topMarkets = marketCounts;
    }
    
    return NextResponse.json({
      stats,
      records: data?.slice(0, 100) || [], // Return first 100 records
    });
  } catch (error) {
    console.error('Ladder analytics error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}

