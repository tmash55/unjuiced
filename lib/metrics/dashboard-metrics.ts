/**
 * Dashboard Metrics Tracking
 * 
 * Utility functions to track and update daily metrics in Redis.
 * Used by compute workers (best-bets, arbitrage) to record statistics.
 */

import { Redis } from "@upstash/redis";

// Lazy initialize Redis to avoid issues when imported
let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

// Get today's date key in UTC (YYYY-MM-DD)
function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

// Redis key patterns (duplicated here to avoid circular imports)
const METRICS_KEYS = {
  uniqueEdgeIds: (date: string) => `metrics:${date}:unique_edges`,
  uniqueArbIds: (date: string) => `metrics:${date}:unique_arbs`,
  highestEvToday: (date: string) => `metrics:${date}:highest_ev`,
  highestArbToday: (date: string) => `metrics:${date}:highest_arb`,
  activeSportsbooks: (date: string) => `metrics:${date}:active_books`,
  lineMovements: (date: string) => `metrics:${date}:line_movements`,
  lastUpdated: () => `metrics:last_updated`,
};

// TTL for daily metrics (48 hours)
const METRICS_TTL = 48 * 60 * 60;

export interface EdgeMetricInput {
  id: string;           // Unique ID for the edge
  evPercent: number;    // EV percentage
  bookId: string;       // Sportsbook ID
}

export interface ArbMetricInput {
  id: string;           // Unique ID for the arb
  roiPercent: number;   // ROI percentage
  bookIds: string[];    // Sportsbook IDs involved
}

/**
 * Track edges found during computation
 * - Adds edge IDs to a set (for unique count)
 * - Updates high watermark for EV %
 * - Tracks active sportsbooks
 */
export async function trackEdges(edges: EdgeMetricInput[]): Promise<void> {
  if (edges.length === 0) return;
  
  try {
    const redis = getRedis();
    const today = getTodayKey();
    const pipeline = redis.pipeline();
    
    // Get current highest EV
    const currentHighest = await redis.get<number>(METRICS_KEYS.highestEvToday(today)) || 0;
    let newHighest = currentHighest;
    
    // Track each edge
    for (const edge of edges) {
      // Add to unique edges set
      pipeline.sadd(METRICS_KEYS.uniqueEdgeIds(today), edge.id);
      
      // Track sportsbook
      pipeline.sadd(METRICS_KEYS.activeSportsbooks(today), edge.bookId);
      
      // Check for new high watermark
      if (edge.evPercent > newHighest) {
        newHighest = edge.evPercent;
      }
    }
    
    // Update high watermark if changed
    if (newHighest > currentHighest) {
      pipeline.set(METRICS_KEYS.highestEvToday(today), newHighest, { ex: METRICS_TTL });
    }
    
    // Set TTLs for sets
    pipeline.expire(METRICS_KEYS.uniqueEdgeIds(today), METRICS_TTL);
    pipeline.expire(METRICS_KEYS.activeSportsbooks(today), METRICS_TTL);
    
    // Update timestamp
    pipeline.set(METRICS_KEYS.lastUpdated(), Date.now());
    
    await pipeline.exec();
    
    console.log(`[Metrics] Tracked ${edges.length} edges, highest EV: ${newHighest}%`);
  } catch (error) {
    console.error("[Metrics] Error tracking edges:", error);
    // Don't throw - metrics tracking shouldn't break main functionality
  }
}

/**
 * Track arbitrage opportunities found
 * - Adds arb IDs to a set (for unique count)
 * - Updates high watermark for ROI %
 * - Tracks active sportsbooks
 */
export async function trackArbs(arbs: ArbMetricInput[]): Promise<void> {
  if (arbs.length === 0) return;
  
  try {
    const redis = getRedis();
    const today = getTodayKey();
    const pipeline = redis.pipeline();
    
    // Get current highest arb ROI
    const currentHighest = await redis.get<number>(METRICS_KEYS.highestArbToday(today)) || 0;
    let newHighest = currentHighest;
    
    // Track each arb
    for (const arb of arbs) {
      // Add to unique arbs set
      pipeline.sadd(METRICS_KEYS.uniqueArbIds(today), arb.id);
      
      // Track sportsbooks
      for (const bookId of arb.bookIds) {
        pipeline.sadd(METRICS_KEYS.activeSportsbooks(today), bookId);
      }
      
      // Check for new high watermark
      if (arb.roiPercent > newHighest) {
        newHighest = arb.roiPercent;
      }
    }
    
    // Update high watermark if changed
    if (newHighest > currentHighest) {
      pipeline.set(METRICS_KEYS.highestArbToday(today), newHighest, { ex: METRICS_TTL });
    }
    
    // Set TTLs for sets
    pipeline.expire(METRICS_KEYS.uniqueArbIds(today), METRICS_TTL);
    pipeline.expire(METRICS_KEYS.activeSportsbooks(today), METRICS_TTL);
    
    // Update timestamp
    pipeline.set(METRICS_KEYS.lastUpdated(), Date.now());
    
    await pipeline.exec();
    
    console.log(`[Metrics] Tracked ${arbs.length} arbs, highest ROI: ${newHighest}%`);
  } catch (error) {
    console.error("[Metrics] Error tracking arbs:", error);
  }
}

/**
 * Track line movements detected
 */
export async function trackLineMovements(count: number): Promise<void> {
  if (count <= 0) return;
  
  try {
    const redis = getRedis();
    const today = getTodayKey();
    
    await redis.incrby(METRICS_KEYS.lineMovements(today), count);
    await redis.expire(METRICS_KEYS.lineMovements(today), METRICS_TTL);
    await redis.set(METRICS_KEYS.lastUpdated(), Date.now());
  } catch (error) {
    console.error("[Metrics] Error tracking line movements:", error);
  }
}

/**
 * Bulk track sportsbooks that are active
 */
export async function trackActiveSportsbooks(bookIds: string[]): Promise<void> {
  if (bookIds.length === 0) return;
  
  try {
    const redis = getRedis();
    const today = getTodayKey();
    const key = METRICS_KEYS.activeSportsbooks(today);
    
    // Use pipeline for atomic operations and avoid spread issues
    const pipeline = redis.pipeline();
    for (const bookId of bookIds) {
      pipeline.sadd(key, bookId);
    }
    pipeline.expire(key, METRICS_TTL);
    await pipeline.exec();
  } catch (error) {
    console.error("[Metrics] Error tracking sportsbooks:", error);
  }
}
