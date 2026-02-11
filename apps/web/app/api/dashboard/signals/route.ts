import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Dashboard Data Signals API
 * 
 * Returns:
 * 1. Top Hit Rates - Players with highest L10 hit rates and live odds
 * 2. Injury Boosts - Players benefiting from teammate injuries
 */

const HITRATE_KEY = "hitrate:nba:v2";

interface HitRateSignal {
  playerId: number;
  playerName: string;
  team: string;
  market: string;
  marketDisplay: string;
  line: number;
  l10Pct: number;
  l5Pct: number | null;
  avg: number | null;
  streak: number | null;
  profileUrl: string;
}

interface InjuryBoost {
  playerId: number;
  playerName: string;
  team: string;
  market: string;
  marketDisplay: string;
  boostReason: string;
  avgWithout: number;
  avgWith: number;
  usageDelta: number;
  profileUrl: string;
}

interface SignalsResponse {
  hitRates: HitRateSignal[];
  injuryBoosts: InjuryBoost[];
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
};

function getMarketDisplay(market: string): string {
  return MARKET_DISPLAY[market] || market.replace(/_/g, " ").replace(/player /i, "");
}

// Get current ET date
function getETDate(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export async function GET(req: NextRequest) {
  try {
    const hitRates: HitRateSignal[] = [];
    const injuryBoosts: InjuryBoost[] = [];
    
    // Fetch hit rate data from Redis
    try {
      // Get all entries from the hitrate hash
      const allEntries = await redis.hgetall(HITRATE_KEY) as Record<string, string> | null;
      
      if (allEntries) {
        const entries = Object.values(allEntries);
        const processedPlayers = new Set<string>(); // Track player+market combos
        
        for (const raw of entries) {
          try {
            const data = typeof raw === "string" ? JSON.parse(raw) : raw;
            
            // Skip if no primary line or no player info
            if (!data.primary_ln || !data.player) continue;
            
            // Skip duplicates (same player + market)
            const playerMarketKey = `${data.player_id}-${data.mkt}`;
            if (processedPlayers.has(playerMarketKey)) continue;
            processedPlayers.add(playerMarketKey);
            
            // We need to get hit rate data from lines or calculate from the profile
            // For now, we'll use the Redis data structure
            const lines = data.lines || [];
            const primaryLine = lines.find((l: any) => l.ln === data.primary_ln) || lines[0];
            
            if (!primaryLine) continue;
            
            // For hit rates, we need L10% - this might be in the profile data or need calculation
            // The hitrate:nba:v2 key structure may not have calculated hit rates
            // We'll need to fetch from the database for accurate hit rates
            
          } catch (e) {
            continue;
          }
        }
      }
    } catch (e) {
      console.error("[Dashboard Signals] Error fetching from Redis:", e);
    }
    
    // Fetch hit rates from database for more accurate data
    try {
      const supabase = createServerSupabaseClient();
      const today = getETDate();
      
      // Fetch top hit rates from the database
      const { data: profiles, error } = await supabase
        .from("nba_hit_rate_profiles")
        .select(`
          id,
          player_id,
          player_name,
          team_abbr,
          market,
          line,
          last_10_pct,
          last_5_pct,
          last_10_avg,
          hit_streak,
          has_live_odds
        `)
        .eq("game_date", today)
        .eq("has_live_odds", true)
        .gte("last_10_pct", 80)
        .order("last_10_pct", { ascending: false })
        .limit(10);
      
      if (!error && profiles) {
        for (const profile of profiles) {
          // Avoid duplicates
          const exists = hitRates.some(h => 
            h.playerId === profile.player_id && h.market === profile.market
          );
          if (exists) continue;
          
          hitRates.push({
            playerId: profile.player_id,
            playerName: profile.player_name || "Unknown",
            team: profile.team_abbr || "",
            market: profile.market,
            marketDisplay: getMarketDisplay(profile.market),
            line: profile.line,
            l10Pct: profile.last_10_pct,
            l5Pct: profile.last_5_pct,
            avg: profile.last_10_avg,
            streak: profile.hit_streak,
            profileUrl: `/hit-rates/nba/player/${profile.player_id}?market=${profile.market}`,
          });
        }
      }
      
      // Fetch injury impact data
      const { data: injuryData, error: injuryError } = await supabase
        .rpc("get_top_injury_impacts", {
          p_game_date: today,
          p_limit: 5,
        });
      
      if (!injuryError && injuryData) {
        for (const impact of injuryData) {
          injuryBoosts.push({
            playerId: impact.player_id,
            playerName: impact.player_name || "Unknown",
            team: impact.team_abbr || "",
            market: impact.market || "player_points",
            marketDisplay: getMarketDisplay(impact.market || "player_points"),
            boostReason: impact.players_out?.join(", ") || "Teammate out",
            avgWithout: impact.avg_without || 0,
            avgWith: impact.avg_with || 0,
            usageDelta: (impact.avg_without || 0) - (impact.avg_with || 0),
            profileUrl: `/hit-rates/nba/player/${impact.player_id}?market=${impact.market || "player_points"}`,
          });
        }
      }
    } catch (e) {
      console.error("[Dashboard Signals] Database error:", e);
    }
    
    // Sort hit rates by L10%
    hitRates.sort((a, b) => b.l10Pct - a.l10Pct);
    
    // Sort injury boosts by usage delta
    injuryBoosts.sort((a, b) => b.usageDelta - a.usageDelta);
    
    const response: SignalsResponse = {
      hitRates: hitRates.slice(0, 5),
      injuryBoosts: injuryBoosts.slice(0, 5),
      timestamp: Date.now(),
    };
    
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("[Dashboard Signals] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch signals", hitRates: [], injuryBoosts: [] },
      { status: 500 }
    );
  }
}
