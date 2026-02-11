import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Request validation
const RequestSchema = z.object({
  playerId: z.coerce.number().int().positive(),
  market: z.string(),
  line: z.coerce.number(),
  gameId: z.coerce.number().int().positive().nullish().transform(v => v ?? null),
  lastNGames: z.coerce.number().int().positive().nullish().transform(v => v ?? null),
  season: z.string().nullish().transform(v => v ?? "2025-26"),
});

// Response types
interface SplitData {
  games: number;
  hits: number;
  hit_rate: number | null;
  display: string;
}

interface HitRateData {
  line_used: number;
  times_hit: number;
  games: number;
  pct: number | null;
  display: string;
  // Odds/selection fields from correlation RPCs (v4 preferred)
  selection_id?: string | null;
  sel_key?: string | null;
  event_id?: string | null;
  over_price?: number | null;
  under_price?: number | null;
  over_price_decimal?: number | null;
  under_price_decimal?: number | null;
  line?: number | null;
  home_away?: string | null;
  is_back_to_back?: boolean | null;
  hits_when_anchor_hits?: number | null;
}

interface StatCorrelation {
  avg_overall: number | null;
  avg_when_hit: number | null;
  avg_when_miss: number | null;
  diff: number | null;
  strength?: "strong" | "moderate" | "weak";
  hit_rate_when_anchor_hits?: HitRateData;
}

// Game log from RPC
interface GameLog {
  game_id: string;
  game_date: string;
  anchor_hit: boolean;
  home_away: "home" | "away";
  is_back_to_back: boolean;
  stats: {
    pts: number;
    reb: number;
    ast: number;
    fg3m: number;
    stl: number;
    blk: number;
    tov: number;
    pra: number;
    pr: number;
    pa: number;
    ra: number;
    bs: number;
    minutes: number;
  };
}

interface TeammateCorrelation {
  player_id: number;
  player_name: string;
  position: string;
  minutes_avg: number | null;
  sample: {
    total_games: number;
    when_anchor_hits: number;
    when_anchor_misses: number;
  };
  // Core stats
  points: StatCorrelation;
  rebounds: StatCorrelation;
  assists: StatCorrelation;
  // Extra stats
  threes: StatCorrelation;
  steals: StatCorrelation;
  blocks: StatCorrelation;
  turnovers: StatCorrelation & { direction?: string };
  // Combo stats
  pra: StatCorrelation;
  points_rebounds: StatCorrelation;
  points_assists: StatCorrelation;
  rebounds_assists: StatCorrelation;
  blocks_steals: StatCorrelation;
  // Game logs
  game_logs: GameLog[];
}

interface RpcResponse {
  version: string;
  filters: {
    last_n_games: number | null;
    season: string;
    is_filtered: boolean;
  };
  anchor_player: {
    player_id: number;
    player_name: string;
    position: string;
    team_id: number;
    market: string;
    line: number;
  };
  anchor_performance: {
    games_analyzed: number;
    times_hit: number;
    times_missed: number;
    hit_rate: number | null;
    avg_stat: number | null;
    display: string;
    splits: {
      home: SplitData;
      away: SplitData;
      back_to_back: SplitData;
      rested: SplitData;
    };
  };
  teammate_correlations: TeammateCorrelation[];
  headline: {
    anchor: string;
    top_teammate: string | null;
  };
  // Self-correlations: how anchor's OTHER markets behave when they hit
  anchor_self_correlations?: {
    points: {
      avg_when_hit: number | null;
      avg_when_miss: number | null;
      diff: number | null;
      hit_rate_when_anchor_hits?: {
        line_used: number;
        times_hit: number;
        games: number;
        pct: number | null;
      };
    };
    rebounds: {
      avg_when_hit: number | null;
      avg_when_miss: number | null;
      diff: number | null;
      hit_rate_when_anchor_hits?: {
        line_used: number;
        times_hit: number;
        games: number;
        pct: number | null;
      };
    };
    assists: {
      avg_when_hit: number | null;
      avg_when_miss: number | null;
      diff: number | null;
      hit_rate_when_anchor_hits?: {
        line_used: number;
        times_hit: number;
        games: number;
        pct: number | null;
      };
    };
    threes: {
      avg_when_hit: number | null;
      avg_when_miss: number | null;
      diff: number | null;
      hit_rate_when_anchor_hits?: {
        line_used: number;
        times_hit: number;
        games: number;
        pct: number | null;
      };
    };
    pra: {
      avg_when_hit: number | null;
      avg_when_miss: number | null;
      diff: number | null;
      hit_rate_when_anchor_hits?: {
        line_used: number;
        times_hit: number;
        games: number;
        pct: number | null;
      };
    };
  };
}

// Stat correlation type for frontend (camelCase)
interface StatCorrelationFrontend {
  avgOverall: number | null;
  avgWhenHit: number | null;
  avgWhenMiss: number | null;
  diff: number | null;
  strength?: "strong" | "moderate" | "weak";
  hitRateWhenAnchorHits?: {
    lineUsed: number;
    timesHit: number;
    games: number;
    pct: number | null;
    display: string;
    // Odds data
    selectionId?: string | null;
    selKey?: string | null;
    eventId?: string | null;
    overPrice?: number | null;
    underPrice?: number | null;
    overPriceDecimal?: number | null;
    underPriceDecimal?: number | null;
  };
}

// Frontend response (camelCase)
export interface PlayerCorrelationsResponse {
  version: string;
  filters: {
    lastNGames: number | null;
    season: string;
    isFiltered: boolean;
  };
  anchorPlayer: {
    playerId: number;
    playerName: string;
    position: string;
    teamId: number;
    market: string;
    line: number;
  };
  anchorPerformance: {
    gamesAnalyzed: number;
    timesHit: number;
    timesMissed: number;
    hitRate: number | null;
    avgStat: number | null;
    display: string;
    splits: {
      home: { games: number; hits: number; hitRate: number | null; display: string };
      away: { games: number; hits: number; hitRate: number | null; display: string };
      backToBack: { games: number; hits: number; hitRate: number | null; display: string };
      rested: { games: number; hits: number; hitRate: number | null; display: string };
    };
  };
  teammateCorrelations: Array<{
    playerId: number;
    playerName: string;
    position: string;
    minutesAvg: number | null;
    sample: {
      totalGames: number;
      whenAnchorHits: number;
      whenAnchorMisses: number;
    };
    // Core stats
    points: StatCorrelationFrontend;
    rebounds: StatCorrelationFrontend;
    assists: StatCorrelationFrontend;
    // Extra stats
    threes: StatCorrelationFrontend;
    steals: StatCorrelationFrontend;
    blocks: StatCorrelationFrontend;
    turnovers: StatCorrelationFrontend;
    // Combo stats
    pra: StatCorrelationFrontend;
    pointsRebounds: StatCorrelationFrontend;
    pointsAssists: StatCorrelationFrontend;
    reboundsAssists: StatCorrelationFrontend;
    blocksSteals: StatCorrelationFrontend;
    // Game logs for accurate charts
    gameLogs: Array<{
      gameId: string;
      gameDate: string;
      anchorHit: boolean;
      homeAway: "home" | "away";
      isBackToBack: boolean;
      stats: {
        pts: number;
        reb: number;
        ast: number;
        fg3m: number;
        stl: number;
        blk: number;
        tov: number;
        pra: number;
        pr: number;
        pa: number;
        ra: number;
        bs: number;
        minutes: number;
      };
    }>;
  }>;
  headline: {
    anchor: string;
    topTeammate: string | null;
  };
  anchorSelfCorrelations?: {
    points: SelfCorrelationStat;
    rebounds: SelfCorrelationStat;
    assists: SelfCorrelationStat;
    threes: SelfCorrelationStat;
    pra: SelfCorrelationStat;
  };
}

// Self-correlation stat structure
interface SelfCorrelationStat {
  avgWhenHit: number | null;
  avgWhenMiss: number | null;
  diff: number | null;
  hitRateWhenAnchorHits?: {
    lineUsed: number;
    timesHit: number;
    games: number;
    pct: number | null;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { playerId, market, line, gameId, lastNGames, season } = parsed.data;

    const supabase = createServerSupabaseClient();

    const isTimeoutError = (err: any): boolean => {
      const msg = typeof err?.message === "string" ? err.message.toLowerCase() : "";
      return err?.code === "57014" || msg.includes("statement timeout");
    };

    // Use v5 only, with adaptive retry on DB timeout.
    const attempts: Array<{ lastNGames: number | null; gameLogLimit: number; label: string }> =
      lastNGames === null
        ? [
            // "Season" can exceed DB statement timeout on heavy slates; cap sample for responsiveness.
            { lastNGames: 40, gameLogLimit: 12, label: "season_cap_40" },
            { lastNGames: 25, gameLogLimit: 8, label: "season_cap_25" },
          ]
        : [
            { lastNGames, gameLogLimit: 15, label: "primary" },
            { lastNGames, gameLogLimit: 10, label: "retry_light" },
          ];

    let rpcResult: unknown = null;
    let error: any = null;
    let fallbackApplied = false;
    let fallbackMeta: { lastNGames: number | null; gameLogLimit: number; label: string } | null = null;

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      const v5Result = await supabase.rpc("get_player_correlations_v5", {
        p_player_id: playerId,
        p_market: market,
        p_line: line,
        p_last_n_games: attempt.lastNGames,
        p_season: season,
        p_game_id: gameId,
        p_game_log_limit: attempt.gameLogLimit,
      });

      rpcResult = v5Result.data;
      error = v5Result.error;

      if (!error) {
        fallbackApplied =
          attempt.lastNGames !== lastNGames ||
          attempt.gameLogLimit !== 15 ||
          i > 0;
        fallbackMeta = fallbackApplied ? attempt : null;
        break;
      }

      if (!isTimeoutError(error)) {
        break;
      }

      console.warn(
        `[Player Correlations] RPC timeout on ${attempt.label}; retrying with smaller sample if available`
      );
    }

    if (error && !rpcResult) {
      console.error("[Player Correlations] RPC error:", error);
      const isTimeout = isTimeoutError(error);
      return NextResponse.json(
        {
          error: isTimeout ? "correlations_timeout" : "Failed to fetch correlations",
          details: error.message,
          version: "4.0",
        },
        { status: isTimeout ? 504 : 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Handle null result
    if (!rpcResult) {
      return NextResponse.json({
        version: "4.0",
        filters: { lastNGames, season, isFiltered: lastNGames !== null },
        anchorPlayer: null,
        anchorPerformance: null,
        teammateCorrelations: [],
        headline: { anchor: "", topTeammate: null },
      });
    }

    const data = rpcResult as RpcResponse;

    // Guard against stale teammates after trades: keep only players currently on anchor's team.
    let teammateCorrelationsFiltered = data.teammate_correlations || [];
    if (data.anchor_player?.team_id && teammateCorrelationsFiltered.length > 0) {
      const { data: rosterRows, error: rosterError } = await supabase
        .from("nba_players_hr")
        .select("nba_player_id")
        .eq("team_id", data.anchor_player.team_id);

      if (rosterError) {
        console.warn("[Player Correlations] Roster filter lookup failed:", rosterError.message);
      } else {
        const rosterIds = new Set((rosterRows || []).map((r: any) => Number(r.nba_player_id)));
        teammateCorrelationsFiltered = teammateCorrelationsFiltered.filter((tc) =>
          rosterIds.has(Number(tc.player_id))
        );
      }
    }

    // Transform to camelCase for frontend
    const response: PlayerCorrelationsResponse = {
      version: data.version,
      filters: {
        lastNGames: data.filters.last_n_games,
        season: data.filters.season,
        isFiltered: data.filters.is_filtered,
      },
      anchorPlayer: {
        playerId: data.anchor_player.player_id,
        playerName: data.anchor_player.player_name,
        position: data.anchor_player.position,
        teamId: data.anchor_player.team_id,
        market: data.anchor_player.market,
        line: data.anchor_player.line,
      },
      anchorPerformance: {
        gamesAnalyzed: data.anchor_performance.games_analyzed,
        timesHit: data.anchor_performance.times_hit,
        timesMissed: data.anchor_performance.times_missed,
        hitRate: data.anchor_performance.hit_rate,
        avgStat: data.anchor_performance.avg_stat,
        display: data.anchor_performance.display,
        splits: {
          home: {
            games: data.anchor_performance.splits.home.games,
            hits: data.anchor_performance.splits.home.hits,
            hitRate: data.anchor_performance.splits.home.hit_rate,
            display: data.anchor_performance.splits.home.display,
          },
          away: {
            games: data.anchor_performance.splits.away.games,
            hits: data.anchor_performance.splits.away.hits,
            hitRate: data.anchor_performance.splits.away.hit_rate,
            display: data.anchor_performance.splits.away.display,
          },
          backToBack: {
            games: data.anchor_performance.splits.back_to_back.games,
            hits: data.anchor_performance.splits.back_to_back.hits,
            hitRate: data.anchor_performance.splits.back_to_back.hit_rate,
            display: data.anchor_performance.splits.back_to_back.display,
          },
          rested: {
            games: data.anchor_performance.splits.rested.games,
            hits: data.anchor_performance.splits.rested.hits,
            hitRate: data.anchor_performance.splits.rested.hit_rate,
            display: data.anchor_performance.splits.rested.display,
          },
        },
      },
      teammateCorrelations: teammateCorrelationsFiltered.map((tc) => {
        // Helper to transform stat correlation
        const transformStat = (stat: StatCorrelation | undefined): StatCorrelationFrontend => {
          if (!stat) {
            return {
              avgOverall: null,
              avgWhenHit: null,
              avgWhenMiss: null,
              diff: null,
            };
          }
          const hr = stat.hit_rate_when_anchor_hits;
          return {
            avgOverall: stat.avg_overall,
            avgWhenHit: stat.avg_when_hit,
            avgWhenMiss: stat.avg_when_miss,
            diff: stat.diff,
            strength: stat.strength,
            hitRateWhenAnchorHits: hr ? {
              lineUsed: hr.line_used ?? hr.line ?? 0,
              timesHit: hr.times_hit ?? hr.hits_when_anchor_hits ?? 0,
              games: hr.games,
              pct: hr.pct,
              display: hr.display ?? `${hr.times_hit ?? hr.hits_when_anchor_hits ?? 0}/${hr.games}`,
              // Include odds data
              selectionId: hr.selection_id,
              selKey: hr.sel_key,
              eventId: hr.event_id,
              overPrice: hr.over_price,
              underPrice: hr.under_price,
              overPriceDecimal: hr.over_price_decimal,
              underPriceDecimal: hr.under_price_decimal,
            } : undefined,
          };
        };

        return {
          playerId: tc.player_id,
          playerName: tc.player_name,
          position: tc.position,
          minutesAvg: tc.minutes_avg,
          sample: {
            totalGames: tc.sample.total_games,
            whenAnchorHits: tc.sample.when_anchor_hits,
            whenAnchorMisses: tc.sample.when_anchor_misses,
          },
          // Core stats
          points: transformStat(tc.points),
          rebounds: transformStat(tc.rebounds),
          assists: transformStat(tc.assists),
          // Extra stats
          threes: transformStat(tc.threes),
          steals: transformStat(tc.steals),
          blocks: transformStat(tc.blocks),
          turnovers: transformStat(tc.turnovers),
          // Combo stats
          pra: transformStat(tc.pra),
          pointsRebounds: transformStat(tc.points_rebounds),
          pointsAssists: transformStat(tc.points_assists),
          reboundsAssists: transformStat(tc.rebounds_assists),
          blocksSteals: transformStat(tc.blocks_steals),
          // Game logs for accurate charts
          gameLogs: (tc.game_logs || []).map((gl: GameLog) => ({
            gameId: gl.game_id,
            gameDate: gl.game_date,
            anchorHit: gl.anchor_hit,
            homeAway: gl.home_away,
            isBackToBack: gl.is_back_to_back,
            stats: gl.stats,
          })),
        };
      }),
      headline: {
        anchor: data.headline.anchor,
        topTeammate: data.headline.top_teammate,
      },
      // Transform anchor self-correlations if present
      anchorSelfCorrelations: data.anchor_self_correlations ? {
        points: {
          avgWhenHit: data.anchor_self_correlations.points?.avg_when_hit ?? null,
          avgWhenMiss: data.anchor_self_correlations.points?.avg_when_miss ?? null,
          diff: data.anchor_self_correlations.points?.diff ?? null,
          hitRateWhenAnchorHits: data.anchor_self_correlations.points?.hit_rate_when_anchor_hits ? {
            lineUsed: data.anchor_self_correlations.points.hit_rate_when_anchor_hits.line_used,
            timesHit: data.anchor_self_correlations.points.hit_rate_when_anchor_hits.times_hit,
            games: data.anchor_self_correlations.points.hit_rate_when_anchor_hits.games,
            pct: data.anchor_self_correlations.points.hit_rate_when_anchor_hits.pct,
          } : undefined,
        },
        rebounds: {
          avgWhenHit: data.anchor_self_correlations.rebounds?.avg_when_hit ?? null,
          avgWhenMiss: data.anchor_self_correlations.rebounds?.avg_when_miss ?? null,
          diff: data.anchor_self_correlations.rebounds?.diff ?? null,
          hitRateWhenAnchorHits: data.anchor_self_correlations.rebounds?.hit_rate_when_anchor_hits ? {
            lineUsed: data.anchor_self_correlations.rebounds.hit_rate_when_anchor_hits.line_used,
            timesHit: data.anchor_self_correlations.rebounds.hit_rate_when_anchor_hits.times_hit,
            games: data.anchor_self_correlations.rebounds.hit_rate_when_anchor_hits.games,
            pct: data.anchor_self_correlations.rebounds.hit_rate_when_anchor_hits.pct,
          } : undefined,
        },
        assists: {
          avgWhenHit: data.anchor_self_correlations.assists?.avg_when_hit ?? null,
          avgWhenMiss: data.anchor_self_correlations.assists?.avg_when_miss ?? null,
          diff: data.anchor_self_correlations.assists?.diff ?? null,
          hitRateWhenAnchorHits: data.anchor_self_correlations.assists?.hit_rate_when_anchor_hits ? {
            lineUsed: data.anchor_self_correlations.assists.hit_rate_when_anchor_hits.line_used,
            timesHit: data.anchor_self_correlations.assists.hit_rate_when_anchor_hits.times_hit,
            games: data.anchor_self_correlations.assists.hit_rate_when_anchor_hits.games,
            pct: data.anchor_self_correlations.assists.hit_rate_when_anchor_hits.pct,
          } : undefined,
        },
        threes: {
          avgWhenHit: data.anchor_self_correlations.threes?.avg_when_hit ?? null,
          avgWhenMiss: data.anchor_self_correlations.threes?.avg_when_miss ?? null,
          diff: data.anchor_self_correlations.threes?.diff ?? null,
          hitRateWhenAnchorHits: data.anchor_self_correlations.threes?.hit_rate_when_anchor_hits ? {
            lineUsed: data.anchor_self_correlations.threes.hit_rate_when_anchor_hits.line_used,
            timesHit: data.anchor_self_correlations.threes.hit_rate_when_anchor_hits.times_hit,
            games: data.anchor_self_correlations.threes.hit_rate_when_anchor_hits.games,
            pct: data.anchor_self_correlations.threes.hit_rate_when_anchor_hits.pct,
          } : undefined,
        },
        pra: {
          avgWhenHit: data.anchor_self_correlations.pra?.avg_when_hit ?? null,
          avgWhenMiss: data.anchor_self_correlations.pra?.avg_when_miss ?? null,
          diff: data.anchor_self_correlations.pra?.diff ?? null,
          hitRateWhenAnchorHits: data.anchor_self_correlations.pra?.hit_rate_when_anchor_hits ? {
            lineUsed: data.anchor_self_correlations.pra.hit_rate_when_anchor_hits.line_used,
            timesHit: data.anchor_self_correlations.pra.hit_rate_when_anchor_hits.times_hit,
            games: data.anchor_self_correlations.pra.hit_rate_when_anchor_hits.games,
            pct: data.anchor_self_correlations.pra.hit_rate_when_anchor_hits.pct,
          } : undefined,
        },
      } : undefined,
    };

    const headers: Record<string, string> = {
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
    };
    if (fallbackApplied && fallbackMeta) {
      headers["X-Correlations-Fallback"] = `${fallbackMeta.label}`;
      headers["X-Correlations-Last-N-Games"] = String(fallbackMeta.lastNGames ?? "season");
      headers["X-Correlations-Game-Log-Limit"] = String(fallbackMeta.gameLogLimit);
    }

    return NextResponse.json(response, { headers });
  } catch (error: any) {
    console.error("[/api/nba/player-correlations] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
