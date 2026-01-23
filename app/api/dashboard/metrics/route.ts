/**
 * Dashboard Metrics API
 * 
 * Serves daily statistics for the Market Pulse section:
 * - Total edges found today (Positive EV)
 * - Total arbs found today
 * - Highest EV % seen today
 * - Highest arb ROI % seen today
 * - Active sportsbooks tracked
 * - Line movements detected
 * 
 * Data is tracked in Redis with daily keys that auto-expire.
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Get today's date key in UTC (YYYY-MM-DD)
function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

// Redis key patterns for daily metrics (internal to this route)
const METRICS_KEYS = {
  // Counters - increment throughout the day
  edgesFoundToday: (date: string) => `metrics:${date}:edges_found`,
  arbsFoundToday: (date: string) => `metrics:${date}:arbs_found`,
  lineMovements: (date: string) => `metrics:${date}:line_movements`,
  
  // High watermarks - track the best values seen
  highestEvToday: (date: string) => `metrics:${date}:highest_ev`,
  highestArbToday: (date: string) => `metrics:${date}:highest_arb`,
  
  // Sets for unique tracking (deduplication)
  uniqueEdgeIds: (date: string) => `metrics:${date}:unique_edges`,
  uniqueArbIds: (date: string) => `metrics:${date}:unique_arbs`,
  activeSportsbooks: (date: string) => `metrics:${date}:active_books`,
  
  // Timestamps
  lastUpdated: () => `metrics:last_updated`,
};

interface DashboardMetrics {
  edgesFoundToday: number;
  arbsFoundToday: number;
  highestEvToday: number;
  highestArbToday: number;
  activeSportsbooks: number;
  lineMovements: number;
  lastUpdated: string;
  date: string;
}

export async function GET(req: NextRequest) {
  try {
    const today = getTodayKey();
    
    // Fetch all metrics in parallel
    const [
      edgesFound,
      arbsFound,
      highestEv,
      highestArb,
      activeBooksSet,
      lineMovements,
      lastUpdated,
    ] = await Promise.all([
      redis.scard(METRICS_KEYS.uniqueEdgeIds(today)),
      redis.scard(METRICS_KEYS.uniqueArbIds(today)),
      redis.get<number>(METRICS_KEYS.highestEvToday(today)),
      redis.get<number>(METRICS_KEYS.highestArbToday(today)),
      redis.scard(METRICS_KEYS.activeSportsbooks(today)),
      redis.get<number>(METRICS_KEYS.lineMovements(today)),
      redis.get<number>(METRICS_KEYS.lastUpdated()),
    ]);
    
    const metrics: DashboardMetrics = {
      edgesFoundToday: edgesFound || 0,
      arbsFoundToday: arbsFound || 0,
      highestEvToday: highestEv || 0,
      highestArbToday: highestArb || 0,
      activeSportsbooks: activeBooksSet || 0,
      lineMovements: lineMovements || 0,
      lastUpdated: lastUpdated 
        ? new Date(lastUpdated).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      date: today,
    };
    
    return NextResponse.json(metrics, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[Metrics API] Error:", error);
    
    // Return fallback data on error
    return NextResponse.json({
      edgesFoundToday: 0,
      arbsFoundToday: 0,
      highestEvToday: 0,
      highestArbToday: 0,
      activeSportsbooks: 17,
      lineMovements: 0,
      lastUpdated: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      date: getTodayKey(),
    } as DashboardMetrics);
  }
}
