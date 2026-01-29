/**
 * Cron Job: Expire Favorites
 * 
 * Runs every 60 seconds via Vercel Cron to mark favorites as expired
 * when their games start (is_live) or when start_time + 10 minutes has passed.
 * 
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/expire-favorites",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

// Grace period in minutes after start_time before expiring (fallback)
const GRACE_PERIOD_MINUTES = 10;

// =============================================================================
// Types
// =============================================================================

interface ActiveFavorite {
  id: string;
  event_id: string;
  sport: string;
  start_time: string | null;
}

interface RedisEvent {
  is_live?: boolean;
  commence_time?: string;
  start_time?: string;
}

// =============================================================================
// API Handler
// =============================================================================

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret (if configured)
  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const supabase = createServerSupabaseClient();
    const now = new Date();
    
    // Calculate time windows for efficient querying
    // Only look at favorites with start_time in the past 24h or next 4h
    const pastWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const futureWindow = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    
    console.log(`[cron/expire-favorites] Starting expiry check...`);

    // Query active favorites with start_time in our window
    // Note: We also need to handle favorites without start_time (null)
    const { data: activeFavorites, error: queryError } = await supabase
      .from("user_favorites")
      .select("id, event_id, sport, start_time")
      .eq("status", "active")
      .or(`start_time.gte.${pastWindow},start_time.is.null`)
      .limit(1000); // Process in batches if needed

    if (queryError) {
      console.error("[cron/expire-favorites] Query error:", queryError);
      return NextResponse.json(
        { error: "Failed to query favorites", details: queryError.message },
        { status: 500 }
      );
    }

    if (!activeFavorites || activeFavorites.length === 0) {
      console.log("[cron/expire-favorites] No active favorites to check");
      return NextResponse.json({
        success: true,
        checked: 0,
        expired: 0,
        duration: Date.now() - startTime,
      });
    }

    console.log(`[cron/expire-favorites] Checking ${activeFavorites.length} active favorites`);

    // Group favorites by event to minimize Redis lookups
    const eventGroups = new Map<string, ActiveFavorite[]>();
    for (const fav of activeFavorites as ActiveFavorite[]) {
      const key = `${fav.sport}:${fav.event_id}`;
      if (!eventGroups.has(key)) {
        eventGroups.set(key, []);
      }
      eventGroups.get(key)!.push(fav);
    }

    console.log(`[cron/expire-favorites] Grouped into ${eventGroups.size} unique events`);

    // Fetch event status from Redis for each unique event
    const favoriteIdsToExpire: { id: string; reason: "live" | "start_time" }[] = [];

    for (const [eventKey, favorites] of eventGroups) {
      const [sport, eventId] = eventKey.split(":");
      const redisKey = `events:${sport}:${eventId}`;
      
      try {
        const eventData = await redis.get<RedisEvent>(redisKey);
        
        // Check if event is live
        if (eventData?.is_live === true) {
          // Event is live - expire all favorites for this event
          for (const fav of favorites) {
            favoriteIdsToExpire.push({ id: fav.id, reason: "live" });
          }
          continue;
        }

        // Fallback: Check start_time + grace period
        for (const fav of favorites) {
          if (!fav.start_time) continue; // Skip if no start_time
          
          const startTimeDate = new Date(fav.start_time);
          if (isNaN(startTimeDate.getTime())) continue; // Skip invalid dates
          
          const expireTime = new Date(startTimeDate.getTime() + GRACE_PERIOD_MINUTES * 60 * 1000);
          
          if (now >= expireTime) {
            favoriteIdsToExpire.push({ id: fav.id, reason: "start_time" });
          }
        }
      } catch (redisError) {
        console.error(`[cron/expire-favorites] Redis error for ${eventKey}:`, redisError);
        // Continue with fallback for this event
        for (const fav of favorites) {
          if (!fav.start_time) continue;
          
          const startTimeDate = new Date(fav.start_time);
          if (isNaN(startTimeDate.getTime())) continue;
          
          const expireTime = new Date(startTimeDate.getTime() + GRACE_PERIOD_MINUTES * 60 * 1000);
          
          if (now >= expireTime) {
            favoriteIdsToExpire.push({ id: fav.id, reason: "start_time" });
          }
        }
      }
    }

    if (favoriteIdsToExpire.length === 0) {
      console.log("[cron/expire-favorites] No favorites to expire");
      return NextResponse.json({
        success: true,
        checked: activeFavorites.length,
        expired: 0,
        duration: Date.now() - startTime,
      });
    }

    console.log(`[cron/expire-favorites] Expiring ${favoriteIdsToExpire.length} favorites`);

    // Batch update favorites to expired status
    // Group by reason for more efficient updates
    const liveIds = favoriteIdsToExpire.filter(f => f.reason === "live").map(f => f.id);
    const startTimeIds = favoriteIdsToExpire.filter(f => f.reason === "start_time").map(f => f.id);

    const updateResults = [];

    if (liveIds.length > 0) {
      updateResults.push(
        await supabase
          .from("user_favorites")
          .update({
            status: "expired",
            expired_at: now.toISOString(),
            expire_reason: "live",
          })
          .in("id", liveIds)
      );
    }

    if (startTimeIds.length > 0) {
      updateResults.push(
        await supabase
          .from("user_favorites")
          .update({
            status: "expired",
            expired_at: now.toISOString(),
            expire_reason: "start_time",
          })
          .in("id", startTimeIds)
      );
    }
    
    // Check for errors
    for (const result of updateResults) {
      if (result.error) {
        console.error("[cron/expire-favorites] Update error:", result.error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[cron/expire-favorites] Completed in ${duration}ms - expired ${favoriteIdsToExpire.length} favorites (${liveIds.length} live, ${startTimeIds.length} start_time)`);

    return NextResponse.json({
      success: true,
      checked: activeFavorites.length,
      expired: favoriteIdsToExpire.length,
      byReason: {
        live: liveIds.length,
        start_time: startTimeIds.length,
      },
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/expire-favorites] Error:", error);
    return NextResponse.json(
      { error: "Failed to expire favorites", duration: Date.now() - startTime },
      { status: 500 }
    );
  }
}
