import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import type { BestOddsDeal, BestOddsResponse, BestOddsSport } from "@/lib/best-odds-schema";

/**
 * GET /api/best-odds/preview-teasers
 * 
 * Returns a small set of premium best odds deals (>= 10% improvement) for teaser display.
 * Bypasses free user filtering to show what they're missing.
 * 
 * Query params:
 * - scope: "all" | "pregame" | "live" (default: "all")
 * - sortBy: "improvement" | "odds" (default: "improvement")
 * - limit: number (default: 10, max: 20)
 */

const FREE_USER_IMPROVEMENT_LIMIT = 10; // Show deals >= 10% improvement
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const VALID_BEST_ODDS_SPORTS: BestOddsSport[] = [
  "nfl",
  "nba",
  "nhl",
  "ncaaf",
  "ncaab",
  "mlb",
  "ncaabaseball",
  "wnba",
  "soccer_epl",
  "soccer_laliga",
  "soccer_mls",
  "soccer_ucl",
  "soccer_uel",
  "tennis_atp",
  "tennis_challenger",
  "tennis_itf_men",
  "tennis_itf_women",
  "tennis_utr_men",
  "tennis_utr_women",
  "tennis_wta",
  "ufc",
];

export async function GET(req: NextRequest) {
  try {
    // Parse query parameters
    const sp = req.nextUrl.searchParams;
    const scope = (sp.get('scope') || 'all') as 'all' | 'pregame' | 'live';
    const sortBy = (sp.get('sortBy') || 'improvement') as 'improvement' | 'odds';
    const limit = Math.min(parseInt(sp.get('limit') || String(DEFAULT_LIMIT)), MAX_LIMIT);
    
    console.log('[/api/best-odds/preview-teasers] Query:', { scope, sortBy, limit });
    
    // Determine which ZSET to query based on sortBy and scope
    let sortKey: string;
    if (sortBy === 'odds') {
      sortKey = scope === 'live' ? 'best_odds:all:sort:odds:live'
              : scope === 'pregame' ? 'best_odds:all:sort:odds:pregame'
              : 'best_odds:all:sort:odds';
    } else {
      sortKey = scope === 'live' ? 'best_odds:all:sort:live'
              : scope === 'pregame' ? 'best_odds:all:sort:pregame'
              : 'best_odds:all:sort:improvement';
    }
    
    console.log('[/api/best-odds/preview-teasers] ZSET key:', sortKey);
    
    // Get keys with scores from ZSET (descending order, highest improvement first)
    // Fetch more than needed to filter for premium deals
    const results = await redis.zrange(sortKey, 0, limit * 5 - 1, {
      rev: true,
      withScores: true
    }) as (string | number)[];
    
    console.log('[/api/best-odds/preview-teasers] Raw ZSET results:', results.length, 'items');
    
    // Parse results and filter for premium deals (>= 10% improvement)
    const premiumEntries: Array<{key: string, score: number}> = [];
    for (let i = 0; i < results.length; i += 2) {
      const key = results[i] as string;
      const score = results[i + 1] as number;
      
      // Only include deals with improvement >= threshold
      if (score >= FREE_USER_IMPROVEMENT_LIMIT) {
        premiumEntries.push({key, score});
        if (premiumEntries.length >= limit) break; // Stop once we have enough
      }
    }
    
    console.log('[/api/best-odds/preview-teasers] Premium entries found:', premiumEntries.length);
    
    // Fetch full data from per-sport HASHes
    const entriesBySport = premiumEntries.reduce((acc, entry) => {
      const parts = entry.key.split(':');
      const sport = parts[0];
      
      // Support all active sports (mlb/wnba temporarily removed - no active feeds)
      if (!VALID_BEST_ODDS_SPORTS.includes(sport as BestOddsSport)) {
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
    
    const deals: BestOddsDeal[] = [];
    
    // Batch fetch per sport
    for (const [sport, sportEntries] of Object.entries(entriesBySport)) {
      const rowsKey = `props:${sport}:best_odds:rows`;
      const fieldKeys = sportEntries.map(e => e.fieldKey);
      
      const hashExists = await redis.exists(rowsKey);
      if (hashExists === 0) {
        console.log(`[/api/best-odds/preview-teasers] ⚠️ HASH ${rowsKey} does NOT exist!`);
        continue;
      }
      
      const rawDataResult = await redis.hmget(rowsKey, ...fieldKeys);
      const rawDataArray = Array.isArray(rawDataResult) ? rawDataResult : Object.values(rawDataResult || {});
      
      // Process results
      for (let i = 0; i < sportEntries.length; i++) {
        const rawData = rawDataArray[i];
        
        if (!rawData) {
          continue;
        }
        
        const deal = typeof rawData === 'string' 
          ? JSON.parse(rawData) 
          : rawData;
        
        const { originalKey, score } = sportEntries[i];
        
        // Filter out games that have already started
        const gameStartTime = deal.game_start || deal.start_time || deal.startTime;
        if (gameStartTime) {
          const gameTime = new Date(gameStartTime).getTime();
          const now = Date.now();
          const BUFFER_MS = 5 * 60 * 1000; // 5 minutes
          const timeDiff = now - gameTime;
          
          if (gameTime < (now - BUFFER_MS)) {
            continue; // Skip this deal - game already started
          }
        }
        
        // Normalize field names to camelCase and add metadata
        const normalizedAllBooks = (deal.all_books || deal.allBooks || []).map((book: any) => ({
          book: book.book,
          price: book.price,
          link: book.link,
          mobileLink: book.mobile_link ?? book.mobileLink ?? book.m ?? null,
          limit_max: book.limit_max ?? book.limitMax ?? book.max_limit ?? null,
        }));

        const normalizedDeal: BestOddsDeal = {
          key: originalKey,
          sport: sport as BestOddsSport,
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
          _isTeaser: true, // Mark as teaser
        };
        
        deals.push(normalizedDeal);
      }
    }
    
    console.log('[/api/best-odds/preview-teasers] Deals fetched:', deals.length);
    
    // Get version
    const versionKey = 'best_odds:all:v';
    const version = await redis.get(versionKey) || 0;
    
    // Return response
    const response: BestOddsResponse = {
      version: parseInt(String(version)),
      total: deals.length,
      deals,
      hasMore: false
    };
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=120'
      }
    });
    
  } catch (error) {
    console.error('[/api/best-odds/preview-teasers] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
