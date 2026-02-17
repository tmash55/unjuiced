import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { PLAN_LIMITS, hasSharpAccess, normalizePlanName, type UserPlan } from "@/lib/plans";
import { redis } from "@/lib/redis";
import type { BestOddsDeal, BestOddsResponse, BestOddsSport } from "@/lib/best-odds-schema";

/**
 * GET /api/best-odds
 * 
 * Returns best odds deals across sportsbooks for player props.
 * 
 * Query params:
 * - sport: "all" | "nfl" | "nba" | "nhl" | "ncaaf" | "ncaab" | "soccer_epl" (default: "all")
 * - leagues: comma-separated list of leagues (e.g., "nba,nfl,ncaaf")
 * - markets: comma-separated list of markets (e.g., "player_points,passing_yards,pra")
 * - books: comma-separated list of sportsbooks (e.g., "draftkings,fanduel,mgm")
 * - scope: "all" | "pregame" | "live" (default: "all")
 * - sortBy: "improvement" | "odds" (default: "improvement")
 * - limit: number (default: 500, max: 2000)
 * - offset: number (default: 0)
 * - minImprovement: number (default: 0)
 * - maxOdds: number (optional) - Filter deals with odds <= this value
 * - minOdds: number (optional) - Filter deals with odds >= this value
 * 
 * Access control:
 * - Free users: Limited to improvements < 10%
 * - Sharp users: Full access to all deals
 * 
 * Note: Enrichment data (player names, teams, events) is now EMBEDDED in the response!
 */

const FREE_USER_IMPROVEMENT_LIMIT = 10; // Free users can only see <10% improvements
const MAX_LIMIT = 2000; // Increased from 200 to match Redis key capacity
const DEFAULT_LIMIT = 500;
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
    // 1. Auth check - determine if user is Pro
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let isPro = false;
    if (user) {
      const { data: ent } = await supabase
        .from('current_entitlements')
        .select('current_plan')
        .eq('user_id', user.id)
        .single();
      const normalized = normalizePlanName(String(ent?.current_plan || "free"));
      const plan: UserPlan = normalized in PLAN_LIMITS ? (normalized as UserPlan) : "free";
      isPro = hasSharpAccess(plan);
    }
    
    // 2. Parse query parameters
    const sp = req.nextUrl.searchParams;
    const sport = sp.get('sport') || 'all'; // Note: Currently only 'all' is supported
    const leagues = sp.get('leagues')?.split(',').filter(Boolean) || [];
    const markets = sp.get('markets')?.split(',').filter(Boolean) || [];
    const books = sp.get('books')?.split(',').filter(Boolean) || [];
    const scope = (sp.get('scope') || 'all') as 'all' | 'pregame' | 'live';
    const sortBy = (sp.get('sortBy') || 'improvement') as 'improvement' | 'odds';
    // For free users, fetch more to account for filtering
    const requestedLimit = parseInt(sp.get('limit') || String(DEFAULT_LIMIT));
    const limit = !isPro ? Math.min(requestedLimit * 3, MAX_LIMIT) : Math.min(requestedLimit, MAX_LIMIT);
    const offset = parseInt(sp.get('offset') || '0');
    const minImprovement = parseFloat(sp.get('minImprovement') || '0');
    const maxOdds = sp.get('maxOdds') ? parseFloat(sp.get('maxOdds')!) : undefined;
    const minOdds = sp.get('minOdds') ? parseFloat(sp.get('minOdds')!) : undefined;
    
    console.log('[/api/best-odds] Query:', { 
      sport, leagues, markets, books, scope, sortBy, requestedLimit, actualLimit: limit, offset, isPro, 
      minImprovement, maxOdds, minOdds 
    });
    
    // 3. Determine which ZSET to query based on sortBy and scope
    // sortBy=improvement: Use improvement % sorted ZSETs
    // sortBy=odds: Use odds value sorted ZSETs
    let sortKey: string;
    if (sortBy === 'odds') {
      // Sort by raw odds value (best for short odds/parlays)
      sortKey = scope === 'live' ? 'best_odds:all:sort:odds:live'
              : scope === 'pregame' ? 'best_odds:all:sort:odds:pregame'
              : 'best_odds:all:sort:odds';
    } else {
      // Sort by improvement % (best for value hunting)
      sortKey = scope === 'live' ? 'best_odds:all:sort:live'
              : scope === 'pregame' ? 'best_odds:all:sort:pregame'
              : 'best_odds:all:sort:improvement';
    }
    
    console.log('[/api/best-odds] ZSET key:', sortKey);
    
    // 4. Get keys with scores from ZSET (descending order, highest improvement first)
    const results = await redis.zrange(sortKey, offset, offset + limit - 1, {
      rev: true,
      withScores: true
    }) as (string | number)[];
    
    console.log('[/api/best-odds] Raw ZSET results:', results.length, 'items');
    if (results.length > 0) {
      console.log('[/api/best-odds] Sample ZSET member:', results[0]);
      console.log('[/api/best-odds] Sample score:', results[1]);
    }
    
    // 5. Parse results (alternating key/score)
    const entries: Array<{key: string, score: number}> = [];
    
    for (let i = 0; i < results.length; i += 2) {
      const key = results[i] as string;
      const score = results[i + 1] as number;
      
      // Apply minImprovement filter
      if (score < minImprovement) continue;
      
      // For free users: collect ALL entries (we'll sample later)
      // For pro users: collect ALL entries
      entries.push({key, score});
    }
    
    console.log('[/api/best-odds] Found entries after filtering:', entries.length);
    
    // 6. Fetch full data from per-sport HASHes in batches
    // Group entries by sport for batch fetching
    const entriesBySport = entries.reduce((acc, entry) => {
      const parts = entry.key.split(':');
      const sport = parts[0];
      
      if (!VALID_BEST_ODDS_SPORTS.includes(sport as BestOddsSport)) {
        console.log('[/api/best-odds] Unknown sport prefix:', sport);
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
    
    console.log('[/api/best-odds] Batching by sport:', Object.keys(entriesBySport).map(s => `${s}:${entriesBySport[s].length}`).join(', '));
    
    const deals: BestOddsDeal[] = [];
    let gamesFilteredOut = 0;
    
    // Batch fetch per sport
    for (const [sport, sportEntries] of Object.entries(entriesBySport)) {
      const rowsKey = `props:${sport}:best_odds:rows`;
      const fieldKeys = sportEntries.map(e => e.fieldKey);
      
      console.log(`[/api/best-odds] Batch fetching ${fieldKeys.length} deals from ${rowsKey}`);
      
      // DEBUG: Check if HASH exists and get sample fields
      const hashExists = await redis.exists(rowsKey);
      if (hashExists === 0) {
        console.log(`[/api/best-odds] ⚠️ HASH ${rowsKey} does NOT exist!`);
        continue;
      }
      
      const hashLen = await redis.hlen(rowsKey);
      console.log(`[/api/best-odds] HASH ${rowsKey} has ${hashLen} fields`);
      
      if (hashLen > 0) {
        // Get a few sample field names from the HASH
        const sampleFields = await redis.hkeys(rowsKey);
        if (Array.isArray(sampleFields) && sampleFields.length > 0) {
          console.log(`[/api/best-odds] Sample HASH fields (first 3):`, sampleFields.slice(0, 3));
          console.log(`[/api/best-odds] What we're looking for (first 3):`, fieldKeys.slice(0, 3));
        }
      }
      
      // Batch fetch all fields for this sport
      const batchStart = performance.now();
      const rawDataResult = await redis.hmget(rowsKey, ...fieldKeys);
      const rawDataArray = Array.isArray(rawDataResult) ? rawDataResult : Object.values(rawDataResult || {});
      const batchTime = performance.now() - batchStart;
      
      const foundCount = rawDataArray.filter(d => d !== null && d !== undefined).length;
      console.log(`[/api/best-odds] ✓ Batch fetch took ${batchTime.toFixed(0)}ms, found ${foundCount}/${fieldKeys.length}`);
      
      // Process results
      for (let i = 0; i < sportEntries.length; i++) {
        const rawData = rawDataArray[i];
        
        if (!rawData) {
          console.log('[/api/best-odds] No data for:', sportEntries[i].fieldKey);
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
          // Only show games that haven't started yet (or started very recently)
          // 5 minute buffer for games that just started
          const BUFFER_MS = 5 * 60 * 1000; // 5 minutes
          const timeDiff = now - gameTime;
          
          if (gameTime < (now - BUFFER_MS)) {
            gamesFilteredOut++;
            continue; // Skip this deal - game already started
          }
        }
        
        // Apply odds filters (deal uses snake_case from backend)
        const dealPrice = deal.best_price || deal.bestPrice || 0;
        if (maxOdds !== undefined && dealPrice > maxOdds) continue;
        if (minOdds !== undefined && dealPrice < minOdds) continue;
        
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
          bestLimit: deal.best_limit_max ?? deal.bestLimit ?? null,
          scope: deal.scope || 'pregame',
          lastUpdated: deal.last_updated || deal.lastUpdated || Date.now(),
          // Optional enriched fields (now embedded in backend data)
          playerName: deal.player_name || deal.playerName,
          team: deal.team,
          position: deal.position,
          homeTeam: deal.home_team || deal.homeTeam,
          awayTeam: deal.away_team || deal.awayTeam,
          startTime: deal.game_start || deal.start_time || deal.startTime,
        };
        
        // Apply client-side filters for leagues, markets, and books
        // (These are not in Redis keys, so we filter after fetching)
        
        // Filter by leagues
        if (leagues.length > 0 && !leagues.includes(normalizedDeal.sport)) {
          continue;
        }
        
        // Filter by markets
        if (markets.length > 0 && !markets.includes(normalizedDeal.mkt)) {
          continue;
        }
        
        // Filter by books (deal must have odds from at least one selected book)
        if (books.length > 0) {
          const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
          const normalizedBooks = books.map(b => normalize(b));
          const hasBook = normalizedDeal.allBooks.some(b => 
            normalizedBooks.includes(normalize(b.book))
          );
          if (!hasBook) {
            continue;
          }
        }
        
        deals.push(normalizedDeal);
      }
    }
    
    console.log('[/api/best-odds] Deals after filtering:', deals.length);
    console.log('[/api/best-odds] Games filtered out (already started):', gamesFilteredOut);
    
    // 6.5. For free users: Sample 2 deals per sport as preview
    let finalDeals = deals;
    let premiumCount = 0;
    
    if (!isPro && deals.length > 0) {
      // Group deals by sport
      const dealsBySport = deals.reduce((acc, deal) => {
        const sport = deal.sport;
        if (!acc[sport]) acc[sport] = [];
        acc[sport].push(deal);
        return acc;
      }, {} as Record<string, BestOddsDeal[]>);
      
      console.log('[/api/best-odds] Deals by sport:', Object.entries(dealsBySport).map(([sport, deals]) => `${sport}: ${deals.length}`).join(', '));
      
      // Sample exactly 2 deals per sport for preview (consistent, not random)
      const sampledDeals: BestOddsDeal[] = [];
      for (const [sport, sportDeals] of Object.entries(dealsBySport)) {
        // Take first 2 deals from each sport (already sorted by improvement)
        const sample = sportDeals.slice(0, 2);
        sampledDeals.push(...sample);
        // Count the rest as premium
        premiumCount += Math.max(0, sportDeals.length - 2);
      }
      
      console.log(`[/api/best-odds] Free user preview: ${sampledDeals.length} deals (2 per sport) from ${Object.keys(dealsBySport).length} sports, ${premiumCount} premium hidden`);
      finalDeals = sampledDeals;
    } else if (!isPro) {
      console.log('[/api/best-odds] ⚠️ No deals found for free user!');
    }
    
    // 7. Get version
    const versionKey = 'best_odds:all:v';
    const version = await redis.get(versionKey) || 0;
    
    console.log('[/api/best-odds] Version:', version);
    
    // 8. Return response
    const response: BestOddsResponse = {
      version: parseInt(String(version)),
      total: entries.length,
      deals: finalDeals,
      hasMore: deals.length === limit,
      premiumCount: !isPro ? premiumCount : undefined, // Include premium count for free users
    };
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=60'
      }
    });
    
  } catch (error) {
    console.error('[/api/best-odds] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
