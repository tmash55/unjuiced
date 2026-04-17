import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get the most recent WNBA game date in the database
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('wnba_games_hr')
      .select('game_date')
      .order('game_date', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[WNBA Latest Date] Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch latest date', details: error.message },
        { status: 500 }
      );
    }

    const latestDate = data?.[0]?.game_date || null;

    return NextResponse.json(
      { latestDate },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
      }
    );
  } catch (error: any) {
    console.error('[WNBA Latest Date] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || '' },
      { status: 500 }
    );
  }
}
