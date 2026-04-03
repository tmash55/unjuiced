"use server";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  PitcherWeaknessResponse,
  PitcherWeaknessReport,
  BatterEdge,
  OddsLine,
} from "./types";

// ── Redis helper ─────────────────────────────────────────────────────────

const REDIS_PROXY = "http://72.60.64.143:6380";
const REDIS_AUTH =
  "Bearer 632258554d5134c97d4384c9e324b300c2c3f4873a3c572559e44e648bc15434";

const PROP_MARKETS = [
  "player_home_runs",
  "player_hits",
  "player_total_bases",
  "player_strikeouts",
  "player_rbi",
] as const;

const BOOKS = [
  "draftkings",
  "fanduel",
  "betmgm",
  "caesars",
  "bet365",
  "fanatics",
  "hard-rock",
  "fliff",
  "betrivers",
];

async function fetchRedisKey(key: string): Promise<string | null> {
  try {
    const res = await fetch(`${REDIS_PROXY}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: REDIS_AUTH },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data = await res.text();
    return data || null;
  } catch {
    return null;
  }
}

interface RedisOddsSelection {
  line?: number;
  price?: number;
  selection?: string;
}

async function getPlayerOdds(
  oddsGameId: string,
  playerName: string
): Promise<OddsLine[]> {
  const results: OddsLine[] = [];

  // Fetch all markets x books in parallel
  const fetches = PROP_MARKETS.flatMap((market) =>
    BOOKS.map(async (book) => {
      const key = `odds:mlb:${oddsGameId}:${market}:${book}`;
      const raw = await fetchRedisKey(key);
      if (!raw) return null;
      try {
        const selections: RedisOddsSelection[] = JSON.parse(raw);
        // Find selections matching this player name (case-insensitive)
        const nameNorm = playerName.toLowerCase().replace(/[^a-z]/g, "");
        const matching = selections.filter((s) => {
          const selNorm = (s.selection || "")
            .toLowerCase()
            .replace(/[^a-z]/g, "");
          return selNorm.includes(nameNorm) || nameNorm.includes(selNorm);
        });
        if (matching.length === 0) return null;

        // Group into over/under
        const over = matching.find(
          (s) =>
            (s.selection || "").toLowerCase().includes("over") ||
            (s.selection || "").toLowerCase().includes("+")
        );
        const under = matching.find(
          (s) =>
            (s.selection || "").toLowerCase().includes("under") ||
            (s.selection || "").toLowerCase().includes("-")
        );
        return {
          market,
          line: over?.line ?? under?.line ?? null,
          over_price: over?.price ?? null,
          under_price: under?.price ?? null,
          book,
        } as OddsLine;
      } catch {
        return null;
      }
    })
  );

  const allResults = await Promise.all(fetches);
  const valid = allResults.filter((r): r is OddsLine => r !== null);

  // For each market, find best over odds
  for (const market of PROP_MARKETS) {
    const forMarket = valid.filter((v) => v.market === market);
    if (forMarket.length === 0) continue;
    // Best over price (highest = best for bettor)
    const best = forMarket.reduce((a, b) =>
      (a.over_price ?? -Infinity) > (b.over_price ?? -Infinity) ? a : b
    );
    results.push(best);
  }

  return results;
}

// ── Main handler ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  const pitcherId = searchParams.get("pitcherId");
  const teamId = searchParams.get("teamId");

  if (!gameId || !pitcherId || !teamId) {
    return NextResponse.json(
      { error: "Missing required params: gameId, pitcherId, teamId" },
      { status: 400 }
    );
  }

  const supabase = createServerSupabaseClient();

  // Call both RPCs in parallel + get odds_game_id
  const [pitcherRes, lineupRes, gameRes] = await Promise.all([
    supabase.rpc("get_pitcher_weakness_report", {
      p_game_id: parseInt(gameId),
      p_pitcher_id: parseInt(pitcherId),
    }),
    supabase.rpc("get_lineup_matchup_edges", {
      p_game_id: parseInt(gameId),
      p_pitcher_id: parseInt(pitcherId),
      p_team_id: parseInt(teamId),
    }),
    supabase
      .from("mlb_games")
      .select("odds_game_id")
      .eq("game_id", parseInt(gameId))
      .limit(1)
      .single(),
  ]);

  if (pitcherRes.error) {
    return NextResponse.json(
      { error: "Pitcher report failed", details: pitcherRes.error.message },
      { status: 500 }
    );
  }
  if (lineupRes.error) {
    return NextResponse.json(
      { error: "Lineup edges failed", details: lineupRes.error.message },
      { status: 500 }
    );
  }

  const pitcherReport: PitcherWeaknessReport = pitcherRes.data;
  const lineupEdges: BatterEdge[] = lineupRes.data || [];
  const oddsGameId: string | null = gameRes.data?.odds_game_id ?? null;

  // Enrich with Redis odds if we have an odds_game_id
  if (oddsGameId && lineupEdges.length > 0) {
    const oddsPromises = lineupEdges.map(async (batter) => {
      const odds = await getPlayerOdds(oddsGameId, batter.player_name);
      batter.odds = odds;
    });
    await Promise.all(oddsPromises);
  }

  const response: PitcherWeaknessResponse = {
    pitcher_report: pitcherReport,
    lineup_edges: lineupEdges,
    odds_game_id: oddsGameId,
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" },
  });
}
