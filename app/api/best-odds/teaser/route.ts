import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { BestOddsDeal, BestOddsResponse } from "@/lib/best-odds-schema";

/**
 * GET /api/best-odds/teaser
 * 
 * Returns a preview of top best odds deals for non-pro users.
 * Shows 8-10 deals with highest edge % to demonstrate value.
 * 
 * Query params:
 * - limit: number (default: 10, max: 20)
 * 
 * Access: Public (no auth required)
 */

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(parseInt(sp.get('limit') || String(DEFAULT_LIMIT)), MAX_LIMIT);
    
    console.log('[/api/best-odds/teaser] Fetching preview with limit:', limit);
    
    // Use the pregame improvement ZSET (same as main endpoint)
    const sortKey = 'best_odds:all:sort:pregame';
    
    // Get top deals from ZSET (descending order, highest improvement first)
    const results = await redis.zrange(sortKey, 0, limit - 1, {
      rev: true,
      withScores: true
    }) as (string | number)[];
    
    console.log('[/api/best-odds/teaser] Raw ZSET results:', results.length, 'items');
    
    if (results.length === 0) {
      return NextResponse.json(
        { version: 0, total: 0, deals: [] } as BestOddsResponse,
        { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } }
      );
    }
    
    // Parse results (alternating key/score)
    const entries: Array<{key: string, score: number}> = [];
    for (let i = 0; i < results.length; i += 2) {
      const key = results[i] as string;
      const score = results[i + 1] as number;
      entries.push({key, score});
    }
    
    console.log('[/api/best-odds/teaser] Found entries:', entries.length);
    
    // Group entries by sport for batch fetching
    const entriesBySport = entries.reduce((acc, entry) => {
      const parts = entry.key.split(':');
      const sport = parts[0];
      
      // Support all active sports (mlb/wnba temporarily removed - no active feeds)
      const validSports = ['nfl', 'nba', 'nhl', 'ncaaf', 'ncaab', 'soccer_epl'];
      if (!validSports.includes(sport)) {
        console.log('[/api/best-odds/teaser] Unknown sport prefix:', sport);
        return acc;
      }
      
      if (!acc[sport]) acc[sport] = [];
      acc[sport].push({
        originalKey: entry.key,
        fieldKey: parts.slice(1).join(':'),
        score: entry.score
      });
      
      return acc;
    }, {} as Record<string, Array<{originalKey: string, fieldKey: string, score: number}>>);
    
    // Fetch data from HASHes
    const deals: BestOddsDeal[] = [];
    
    for (const [sport, sportEntries] of Object.entries(entriesBySport)) {
      const rowsKey = `props:${sport}:best_odds:rows`;
      const fieldKeys = sportEntries.map(e => e.fieldKey);
      
      console.log('[/api/best-odds/teaser] Fetching from hash:', rowsKey, 'fields:', fieldKeys.length);
      
      if (fieldKeys.length === 0) {
        console.log('[/api/best-odds/teaser] No field keys for sport:', sport);
        continue;
      }
      
      const rawDataResult = await redis.hmget(rowsKey, ...fieldKeys);
      const rawDataArray = Array.isArray(rawDataResult) ? rawDataResult : Object.values(rawDataResult || {});
      
      if (!rawDataArray || rawDataArray.length === 0) {
        console.log('[/api/best-odds/teaser] No values returned from hash:', rowsKey);
        continue;
      }
      
      for (let i = 0; i < sportEntries.length; i++) {
        const rawData = rawDataArray[i];
        
        if (!rawData) {
          console.log('[/api/best-odds/teaser] Missing value for key:', sportEntries[i].fieldKey);
          continue;
        }
        
        try {
          const deal = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
          const { originalKey, score } = sportEntries[i];
          
          // Filter out games that have already started
          const gameStartTime = deal.game_start || deal.start_time || deal.startTime;
          if (gameStartTime) {
            const gameTime = new Date(gameStartTime).getTime();
            const now = Date.now();
            // Only show games that haven't started yet (or started very recently)
            // 5 minute buffer for games that just started
            const BUFFER_MS = 5 * 60 * 1000; // 5 minutes
            if (gameTime < (now - BUFFER_MS)) {
              continue; // Skip this deal - game already started
            }
          }
          
          // Normalize field names to camelCase (matching main API)
        const normalizedAllBooks = (deal.all_books || deal.allBooks || []).map((book: any) => ({
          book: book.book,
          price: book.price,
          link: book.link,
          mobileLink: book.mobile_link ?? book.mobileLink ?? book.m ?? null,
          limit_max: book.limit_max ?? book.limitMax ?? book.max_limit ?? null,
        }));

        const normalizedDeal: BestOddsDeal = {
            key: originalKey,
            sport: sport as 'nfl' | 'nba' | 'nhl' | 'ncaaf' | 'ncaab' | 'soccer_epl',
            eid: deal.eid || '',
            ent: deal.ent || '',
            mkt: deal.mkt || '',
            ln: deal.ln || 0,
            side: deal.side || 'o',
          bestBook: deal.best_book || deal.bestBook || '',
          bestPrice: deal.best_price || deal.bestPrice || 0,
          bestLink: deal.best_link || deal.bestLink || '',
          bestLinkMobile: deal.best_link_mobile || deal.bestLinkMobile || null,
            numBooks: deal.num_books || deal.numBooks || 0,
            avgPrice: deal.avg_price || deal.avgPrice || 0,
            priceImprovement: deal.price_improvement || deal.priceImprovement || score,
          allBooks: normalizedAllBooks,
            scope: deal.scope || 'pregame',
            lastUpdated: deal.last_updated || deal.lastUpdated || Date.now(),
            playerName: deal.player_name || deal.playerName,
            team: deal.team,
            position: deal.position,
            homeTeam: deal.home_team || deal.homeTeam,
            awayTeam: deal.away_team || deal.awayTeam,
            startTime: deal.game_start || deal.start_time || deal.startTime,
          };
          
          deals.push(normalizedDeal);
        } catch (parseError) {
          console.error('[/api/best-odds/teaser] Failed to parse deal:', parseError);
        }
      }
    }
    
    console.log('[/api/best-odds/teaser] Returning deals:', deals.length);
    
    // If no deals found, return empty array (not an error)
    if (deals.length === 0) {
      console.log('[/api/best-odds/teaser] No deals found in Redis');
    }
    
    return NextResponse.json(
      {
        version: Date.now(),
        total: deals.length,
        deals: deals,
      } as BestOddsResponse,
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } }
    );
  } catch (e: any) {
    console.error("Error in /api/best-odds/teaser:", e);
    console.error("Stack trace:", e?.stack);
    return NextResponse.json(
      { error: "internal_error", message: e?.message || "Failed to fetch preview" },
      { status: 500 }
    );
  }
}

