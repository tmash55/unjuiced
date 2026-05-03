import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";
import type { PlayerCorrelationsResponse } from "@/app/api/nba/player-correlations/route";

const WNBA_CORRELATIONS_VERSION = "wnba-1.1";

const RequestSchema = z.object({
  playerId: z.coerce.number().int().positive(),
  market: z.string(),
  line: z.coerce.number(),
  gameId: z.coerce.number().int().positive().nullish().transform((v) => v ?? null),
  lastNGames: z.coerce.number().int().positive().nullish().transform((v) => v ?? null),
  season: z.string().nullish().transform((v) => v ?? "2025"),
});

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

    const { playerId, market, line, lastNGames, season } = parsed.data;
    const supabase = createServerSupabaseClient();
    const requestedLastNGames = lastNGames;
    const effectiveLastNGames = requestedLastNGames === null ? 40 : Math.min(requestedLastNGames, 40);
    const gameLogLimit = requestedLastNGames === null ? 12 : 15;
    const lastNGamesKey = requestedLastNGames ?? -1;

    const { data: playerRow, error: playerError } = await supabase
      .from("wnba_players_hr")
      .select("team_id")
      .eq("wnba_player_id", playerId)
      .maybeSingle();

    if (playerError) {
      console.warn("[/api/wnba/player-correlations] Player metadata lookup failed:", playerError.message);
    }

    const sourceTeamId = playerRow?.team_id ?? null;
    let sourceUpdatedAt: string | null = null;

    if (sourceTeamId !== null) {
      const { data: sourceRow, error: sourceError } = await supabase
        .from("wnba_player_box_scores")
        .select("updated_at")
        .eq("team_id", sourceTeamId)
        .eq("season", season)
        .neq("season_type", "Preseason")
        .gt("minutes", 0)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sourceError) {
        console.warn("[/api/wnba/player-correlations] Source freshness lookup failed:", sourceError.message);
      } else {
        sourceUpdatedAt = sourceRow?.updated_at ?? null;
      }
    }

    const { data: cachedRow, error: cacheError } = await supabase
      .from("wnba_player_correlations_cache")
      .select("payload, source_updated_at, computed_at, expires_at")
      .eq("player_id", playerId)
      .eq("market", market)
      .eq("line", line)
      .eq("season", season)
      .eq("last_n_games_key", lastNGamesKey)
      .maybeSingle();

    if (cacheError) {
      console.warn("[/api/wnba/player-correlations] Cache lookup failed:", cacheError.message);
    }

    const now = Date.now();
    const cacheExpiresAt = cachedRow?.expires_at ? new Date(cachedRow.expires_at).getTime() : 0;
    const cachedSourceAt = cachedRow?.source_updated_at ? new Date(cachedRow.source_updated_at).getTime() : 0;
    const currentSourceAt = sourceUpdatedAt ? new Date(sourceUpdatedAt).getTime() : 0;
    const isCacheFresh =
      !!cachedRow?.payload &&
      typeof cachedRow.payload === "object" &&
      !Array.isArray(cachedRow.payload) &&
      (cachedRow.payload as { version?: string }).version === WNBA_CORRELATIONS_VERSION &&
      cacheExpiresAt > now &&
      (!currentSourceAt || cachedSourceAt >= currentSourceAt);

    if (isCacheFresh) {
      const headers: Record<string, string> = {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        "X-Correlations-Cache": "hit",
      };
      if (cachedRow.computed_at) headers["X-Correlations-Computed-At"] = cachedRow.computed_at;
      if (requestedLastNGames === null) {
        headers["X-Correlations-Fallback"] = "season_cap_40";
        headers["X-Correlations-Last-N-Games"] = String(effectiveLastNGames);
        headers["X-Correlations-Game-Log-Limit"] = String(gameLogLimit);
      }

      return NextResponse.json(cachedRow.payload as PlayerCorrelationsResponse, { headers });
    }

    const { data, error } = await supabase.rpc("get_wnba_player_correlations", {
      p_player_id: playerId,
      p_market: market,
      p_line: line,
      p_last_n_games: effectiveLastNGames,
      p_season: season,
      p_game_log_limit: gameLogLimit,
    });

    if (error) {
      console.error("[/api/wnba/player-correlations] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch WNBA correlations", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!data) {
      const emptyResponse = {
        version: WNBA_CORRELATIONS_VERSION,
        filters: { lastNGames: requestedLastNGames, season, isFiltered: requestedLastNGames !== null },
        anchorPlayer: null,
        anchorPerformance: null,
        teammateCorrelations: [],
        headline: { anchor: "", topTeammate: null },
      };

      const { error: emptyCacheWriteError } = await supabase.from("wnba_player_correlations_cache").upsert({
        player_id: playerId,
        market,
        line,
        season,
        last_n_games_key: lastNGamesKey,
        requested_last_n_games: requestedLastNGames,
        effective_last_n_games: effectiveLastNGames,
        game_log_limit: gameLogLimit,
        source_team_id: sourceTeamId,
        source_updated_at: sourceUpdatedAt,
        payload: emptyResponse,
        computed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "player_id,market,line,season,last_n_games_key",
      });
      if (emptyCacheWriteError) {
        console.warn("[/api/wnba/player-correlations] Empty cache write failed:", emptyCacheWriteError.message);
      }

      return NextResponse.json(emptyResponse, {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
          "X-Correlations-Cache": cachedRow ? "stale" : "miss",
        },
      });
    }

    const response = data as PlayerCorrelationsResponse;
    response.version = WNBA_CORRELATIONS_VERSION;
    response.filters = {
      ...response.filters,
      lastNGames: requestedLastNGames,
      isFiltered: requestedLastNGames !== null,
    };

    const headers: Record<string, string> = {
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        "X-Correlations-Cache": cachedRow ? "stale" : "miss",
    };
    if (requestedLastNGames === null) {
      headers["X-Correlations-Fallback"] = "season_cap_40";
      headers["X-Correlations-Last-N-Games"] = String(effectiveLastNGames);
      headers["X-Correlations-Game-Log-Limit"] = String(gameLogLimit);
    }

    const computedAt = new Date().toISOString();
    const { error: cacheWriteError } = await supabase.from("wnba_player_correlations_cache").upsert({
      player_id: playerId,
      market,
      line,
      season,
      last_n_games_key: lastNGamesKey,
      requested_last_n_games: requestedLastNGames,
      effective_last_n_games: effectiveLastNGames,
      game_log_limit: gameLogLimit,
      source_team_id: sourceTeamId,
      source_updated_at: sourceUpdatedAt,
      payload: response,
      computed_at: computedAt,
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      updated_at: computedAt,
    }, {
      onConflict: "player_id,market,line,season,last_n_games_key",
    });
    if (cacheWriteError) {
      console.warn("[/api/wnba/player-correlations] Cache write failed:", cacheWriteError.message);
    }

    headers["X-Correlations-Computed-At"] = computedAt;

    return NextResponse.json(response, { headers });
  } catch (error: any) {
    console.error("[/api/wnba/player-correlations] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
