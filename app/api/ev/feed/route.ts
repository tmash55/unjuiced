import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/libs/supabase/server";
import { PLAN_LIMITS, hasSharpAccess, normalizePlanName, type UserPlan } from "@/lib/plans";
import { Redis } from "@upstash/redis";
import type { EVRow } from "@/lib/ev-schema";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * GET /api/ev/feed
 * 
 * Returns EV opportunities for all sports.
 * 
 * Query params:
 * - scope: "pregame" | "live" (default: "pregame")
 * - limit: number (default: 200, max: 500)
 * 
 * Access control:
 * - Free users: Can access, but EV > 3% is filtered out
 * - Sharp users: Full access to all EV opportunities
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get user and plan
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
    
    // Parse query params
    const sp = req.nextUrl.searchParams;
    const scope = (sp.get('scope') || 'pregame') as 'pregame' | 'live';
    const limit = Math.min(parseInt(sp.get('limit') || '200'), 500);
    
    // Step 1: Get top SEIDs from sorted set
    const sortKey = `ev:all:sort:${scope}:best`;
    
    // Debug: Check total count in sorted set
    const totalCount = await redis.zcard(sortKey);
    console.log(`[EV Feed] Total items in ${sortKey}: ${totalCount}`);
    
    // Get top items with scores to see EV values
    const seidsWithScores = await redis.zrange(sortKey, 0, limit - 1, { 
      rev: true, 
      withScores: true 
    }) as (string | number)[];
    
    // Extract SEIDs and log score distribution
    const seids: string[] = [];
    let maxScore = 0;
    let minScore = Infinity;
    
    for (let i = 0; i < seidsWithScores.length; i += 2) {
      const seid = seidsWithScores[i] as string;
      const score = seidsWithScores[i + 1] as number;
      seids.push(seid);
      maxScore = Math.max(maxScore, score);
      minScore = Math.min(minScore, score);
    }
    
    console.log(`[EV Feed] Fetched ${seids.length} SEIDs from ${sortKey}`);
    console.log(`[EV Feed] Score range: ${minScore.toFixed(2)}% to ${maxScore.toFixed(2)}%`);
    console.log(`[EV Feed] Sample SEIDs:`, seids.slice(0, 5));
    
    if (!seids || seids.length === 0) {
      return NextResponse.json({
        rows: [],
        count: 0,
        scope,
        isPro,
        filtered: false,
      });
    }
    
    // Step 2: Group SEIDs by sport for batch fetching
    const sportGroups: Record<string, string[]> = {};
    for (const seid of seids) {
      const sport = seid.split(':')[0];
      if (!sportGroups[sport]) sportGroups[sport] = [];
      sportGroups[sport].push(seid);
    }
    
    // Step 3: Batch fetch rows from Redis (HMGET for each sport)
    const allRows: EVRow[] = [];
    let filteredCount = 0;
    
    console.log(`[EV Feed] Sport groups:`, Object.keys(sportGroups).map(s => `${s}:${sportGroups[s].length}`).join(', '));
    
    for (const [sport, sportSeids] of Object.entries(sportGroups)) {
      const rowsKey = `ev:${sport}:rows`;
      
      try {
        // HMGET returns an array in Upstash SDK
        const rawRows = await redis.hmget(rowsKey, ...sportSeids);
        
        // Convert to array if it's an object
        const rowsArray = Array.isArray(rawRows) ? rawRows : (rawRows ? Object.values(rawRows) : []);
        
        console.log(`[EV Feed] ${sport}: Fetched ${rowsArray.length} rows from ${rowsKey}`);
        
        for (let i = 0; i < rowsArray.length; i++) {
          const raw = rowsArray[i];
          if (!raw) continue;
          
          try {
            const row = typeof raw === 'string' ? JSON.parse(raw) : raw as EVRow;
            
            // Filter for free users: hide EV > 3%
            if (!isPro && row.rollup.best_case > 3.0) {
              filteredCount++;
              continue;
            }
            
            allRows.push(row);
          } catch (parseError) {
            console.error(`[EV Feed] Failed to parse row for ${sportSeids[i]}:`, parseError);
          }
        }
      } catch (error) {
        console.error(`[EV Feed] Failed to fetch rows for ${sport}:`, error);
      }
    }
    
    console.log(`[EV Feed] Total rows after filtering: ${allRows.length}`);
    if (!isPro && filteredCount > 0) {
      console.log(`[EV Feed] Filtered out ${filteredCount} rows with EV > 3% (free user)`);
    }
    
    // Step 4: Sort by best EV (descending)
    allRows.sort((a, b) => b.rollup.best_case - a.rollup.best_case);
    
    return NextResponse.json({
      rows: allRows,
      count: allRows.length,
      scope,
      isPro,
      filtered: !isPro, // Free users see filtered results
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
    
  } catch (error) {
    console.error('[EV Feed] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
