import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { type ArbRow } from "@/lib/arb-schema";
import { trackArbs } from "@/lib/metrics/dashboard-metrics";
import { zrevrangeCompat } from "@/lib/redis-zset";

/**
 * Dashboard Arbitrage API
 * 
 * Returns top arbitrage opportunities for the Today dashboard.
 * Reads directly from Redis for optimal performance.
 */

const H_ROWS = "arbs:rows";
const Z_ROI_PREGAME = "arbs:sort:roi:pregame";
const Z_ROI_ALL = "arbs:sort:roi";

interface BookInfo {
  id: string;
  odds: number;
  oddsFormatted: string;
}

interface ArbOpportunity {
  id: string;
  event: string;
  market: string;
  marketDisplay: string;
  player: string | null;
  line: number | null;
  overBook: BookInfo;
  underBook: BookInfo;
  roiPercent: number;
  sport: string;
  league: string | null;
  startTime: string | null;
  isLive: boolean;
}

interface ArbitrageResponse {
  arbs: ArbOpportunity[];
  timestamp: number;
}

// Market display name mapping
const MARKET_DISPLAY: Record<string, string> = {
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_threes_made: "3PM",
  player_steals: "Steals",
  player_blocks: "Blocks",
  player_turnovers: "Turnovers",
  player_points_rebounds_assists: "PRA",
  player_points_rebounds: "P+R",
  player_points_assists: "P+A",
  player_rebounds_assists: "R+A",
  spread: "Spread",
  totals: "Total",
  moneyline: "Moneyline",
  h2h: "Moneyline",
};

function getMarketDisplay(market: string): string {
  return MARKET_DISPLAY[market] || market.replace(/_/g, " ").replace(/player /i, "");
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : String(odds);
}

function extractPlayer(name?: string): string | null {
  if (!name) return null;
  // Remove "Over" or "Under" suffix
  return name.replace(/\s+(Over|Under).*$/i, "").trim() || null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

function humanizeMarket(mkt?: string): string {
  const s = String(mkt || "")
    .replace(/_/g, " ")
    .replace(/\bplayer\b\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return titleCase(s);
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const params = new URL(req.url).searchParams;
    const limit = Math.min(parseInt(params.get("limit") || "5"), 10);

    // Fetch top arbs by ROI (prefer pregame, fallback to all)
    let ids = await zrevrangeCompat(redis as any, Z_ROI_PREGAME, 0, limit - 1);
    
    if (ids.length === 0) {
      ids = await zrevrangeCompat(redis as any, Z_ROI_ALL, 0, limit - 1);
    }

    if (ids.length === 0) {
      return NextResponse.json(
        { arbs: [], timestamp: Date.now() },
        { headers: { "Cache-Control": "public, max-age=15, s-maxage=15, stale-while-revalidate=30" } }
      );
    }

    // Fetch row data from hash
    const rawUnknown = (await (redis as any).hmget(H_ROWS, ...ids)) as unknown;
    let rawArr = Array.isArray(rawUnknown) ? (rawUnknown as any[]) : [];
    
    // Fallback to individual HGET if hmget returns empty
    if (rawArr.length === 0) {
      rawArr = await Promise.all(ids.map((id) => (redis as any).hget(H_ROWS, id)));
    }
    
    // Parse rows — keep ids and rows aligned
    const pairs: Array<{ id: string; row: ArbRow }> = [];
    for (let i = 0; i < ids.length; i++) {
      const r = rawArr[i];
      if (!r) continue;
      const parsed: ArbRow = typeof r === "string" ? JSON.parse(r) : r;
      if (parsed) pairs.push({ id: ids[i], row: parsed });
    }

    // Transform to dashboard format
    const arbs: ArbOpportunity[] = pairs.map(({ id, row }) => {
      // Build event name from teams
      let event = "Unknown Event";
      if (row.ev?.away?.abbr && row.ev?.home?.abbr) {
        event = `${row.ev.away.abbr} @ ${row.ev.home.abbr}`;
      } else if (row.ev?.away?.name && row.ev?.home?.name) {
        event = `${row.ev.away.name} @ ${row.ev.home.name}`;
      }

      // Extract player name from leg names
      const player = extractPlayer(row.o?.name) || extractPlayer(row.u?.name);

      // Build book info
      const overBook: BookInfo = {
        id: row.o?.bk || "unknown",
        odds: row.o?.od || 0,
        oddsFormatted: formatOdds(row.o?.od || 0),
      };

      const underBook: BookInfo = {
        id: row.u?.bk || "unknown",
        odds: row.u?.od || 0,
        oddsFormatted: formatOdds(row.u?.od || 0),
      };

      return {
        id: id || `arb-${Date.now()}`,
        event,
        market: row.mkt || "unknown",
        marketDisplay: getMarketDisplay(row.mkt || "unknown"),
        player,
        line: row.ln ?? null,
        overBook,
        underBook,
        roiPercent: row.roi_bps ? Math.round((row.roi_bps / 100) * 100) / 100 : 0,
        sport: row.lg?.sport || "unknown",
        league: row.lg?.name || null,
        startTime: row.ev?.dt || null,
        isLive: row.ev?.live || false,
      };
    });

    // Track arb metrics for the Market Pulse
    if (arbs.length > 0) {
      const arbMetrics = arbs.map(arb => ({
        id: arb.id,
        roiPercent: arb.roiPercent,
        bookIds: [arb.overBook.id, arb.underBook.id],
      }));
      
      // Fire and forget - don't block response
      trackArbs(arbMetrics).catch(err => 
        console.error("[Dashboard Arbitrage] Metrics tracking error:", err)
      );
    }

    const result: ArbitrageResponse = {
      arbs,
      timestamp: Date.now(),
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, max-age=15, s-maxage=15, stale-while-revalidate=30",
        "X-Response-Time": `${Date.now() - startTime}ms`,
      },
    });
  } catch (error) {
    console.error("[Dashboard Arbitrage] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch arbitrage", arbs: [], timestamp: Date.now() },
      { status: 500, headers: { "X-Response-Time": `${Date.now() - startTime}ms` } }
    );
  }
}
