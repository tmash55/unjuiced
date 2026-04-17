import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";
import { getStandardAbbreviation } from "@/lib/data/team-mappings";
import { Ratelimit } from "@upstash/ratelimit";

const GAMES_CACHE_KEY = "mlb:games:today";
const GAMES_CACHE_TTL = 300;
const GAMES_CACHE_TTL_LIVE = 30;
const RECORDS_CACHE_TTL = 3600; // 1 hour — W/L records don't change often

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "30 s"),
  prefix: "rl:mlb:games",
});

function parseGameTimeToMinutes(gameStatus: string): number {
  const timeMatch = gameStatus.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*ET$/i);
  if (!timeMatch) {
    if (gameStatus.toLowerCase().includes("final")) return 9999;
    return 5000;
  }

  const [, hours, minutes, period] = timeMatch;
  let hour = parseInt(hours, 10);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  return hour * 60 + parseInt(minutes, 10);
}

function sortGamesByDateTime(games: any[]): any[] {
  return [...games].sort((a, b) => {
    const dateCompare = a.game_date.localeCompare(b.game_date);
    if (dateCompare !== 0) return dateCompare;
    return parseGameTimeToMinutes(a.game_status || "") - parseGameTimeToMinutes(b.game_status || "");
  });
}

function formatScheduledStatus(gameDateTime: string | null): string {
  if (!gameDateTime) return "TBD";
  const date = new Date(gameDateTime);
  if (Number.isNaN(date.getTime())) return "TBD";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace("AM", "am")
    .replace("PM", "pm")
    .concat(" ET");
}

function getDisplayStatus(statusDetailed: string | null, gameDateTime: string | null): string {
  const status = statusDetailed?.toLowerCase() ?? "";
  if (status.includes("final")) return "Final";
  if (status.includes("delayed")) return statusDetailed || "Delayed";
  if (status.includes("suspended")) return statusDetailed || "Suspended";
  if (status.includes("postponed")) return "Postponed";
  if (status.includes("in progress") || status.includes("manager challenge")) {
    return "In Progress";
  }
  return formatScheduledStatus(gameDateTime);
}

function toGameRow(row: any) {
  const homeAbbr =
    row.home_team?.abbreviation ||
    getStandardAbbreviation(row.home_name || "", "mlb");
  const awayAbbr =
    row.away_team?.abbreviation ||
    getStandardAbbreviation(row.away_name || "", "mlb");

  const statusDetailed = row.status_detailed_state || row.status;
  const isLive = (statusDetailed || "").toLowerCase().includes("in progress") ||
                 (statusDetailed || "").toLowerCase().includes("manager challenge");

  const live = isLive && row.current_pitcher_id != null ? {
    current_pitcher_id: row.current_pitcher_id ?? null,
    current_pitcher_name: row.current_pitcher_name ?? null,
    current_batter_id: row.current_batter_id ?? null,
    current_batter_name: row.current_batter_name ?? null,
    current_inning: row.current_inning ?? null,
    current_inning_half: row.current_inning_half ?? null,
    current_outs: row.current_outs ?? null,
    current_balls: row.current_balls ?? null,
    current_strikes: row.current_strikes ?? null,
    runners_on_base: row.runners_on_base ?? null,
    last_play_description: row.last_play_description ?? null,
    live_feed_updated_at: row.live_feed_updated_at ?? null,
  } : null;

  return {
    game_id: String(row.game_id),
    game_date: row.game_date,
    home_team_name: row.home_name,
    away_team_name: row.away_name,
    home_team_tricode: homeAbbr,
    away_team_tricode: awayAbbr,
    home_team_score: row.home_score ?? null,
    away_team_score: row.away_score ?? null,
    game_status: getDisplayStatus(statusDetailed, row.game_datetime),
    venue_id: row.venue_id ?? null,
    home_probable_pitcher: row.home_probable_pitcher ?? null,
    away_probable_pitcher: row.away_probable_pitcher ?? null,
    is_primetime: null,
    national_broadcast: null,
    neutral_site: false,
    season_type: row.game_type ?? null,
    odds_game_id: row.odds_game_id ?? null,
    home_team_record: null as string | null,
    away_team_record: null as string | null,
    live,
    weather: null as {
      temperature_f: number | null;
      wind_speed_mph: number | null;
      wind_label: string | null;
      wind_impact: string | null;
      hr_impact_score: number | null;
      roof_type: string | null;
      venue_name: string | null;
    } | null,
    park_factor: null as number | null,
    odds: null as {
      home_ml: string | null;
      away_ml: string | null;
      total: number | null;
      total_over_price: string | null;
      total_under_price: string | null;
      spread: number | null;
      spread_home_price: string | null;
      spread_away_price: string | null;
      home_total: number | null;
      home_total_over_price: string | null;
      home_total_under_price: string | null;
      away_total: number | null;
      away_total_over_price: string | null;
      away_total_under_price: string | null;
    } | null,
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Rate limit: 10 requests per 30s per IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const { success: rateLimitOk } = await ratelimit.limit(ip);
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": "30", "Cache-Control": "no-store" } }
    );
  }

  try {
    const now = new Date();
    const etFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const today = etFormatter.format(now);
    const dayAfter = (offset: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      return etFormatter.format(d);
    };
    const tomorrow = dayAfter(1);
    const dayAfterTomorrow = dayAfter(2);

    const cacheKey = `${GAMES_CACHE_KEY}:${today}`;
    const mutexKey = `${cacheKey}:mutex`;

    // ── Cache read ──────────────────────────────────────────────────────────
    try {
      const cached = await redis.get<{ games: any[]; dates: string[]; primaryDate: string; ts?: number }>(cacheKey);
      if (cached?.games) {
        const anyLiveCached = cached.games.some((g: any) =>
          (g.game_status || "").toLowerCase().includes("progress")
        );
        const cacheAgeMs = cached.ts ? Date.now() - cached.ts : 0;
        if (!anyLiveCached || cacheAgeMs < GAMES_CACHE_TTL_LIVE * 1000) {
          const cacheControl = anyLiveCached
            ? "public, max-age=15, s-maxage=15, stale-while-revalidate=30"
            : "public, max-age=60, s-maxage=60, stale-while-revalidate=120";
          return NextResponse.json(
            { games: cached.games, dates: cached.dates, primaryDate: cached.primaryDate, cached: true },
            { headers: { "Cache-Control": cacheControl } }
          );
        }
      }
    } catch (cacheError) {
      console.error("[/api/mlb/games] Cache read error:", cacheError);
    }

    // ── Thundering herd protection: SET NX mutex ────────────────────────────
    // Only one request rebuilds the cache; others wait briefly then serve stale.
    const mutexAcquired = await redis.set(mutexKey, "1", { nx: true, ex: 15 }).catch(() => null);
    if (!mutexAcquired) {
      // Another request is already rebuilding. Wait up to 2s for it to finish.
      for (let i = 0; i < 4; i++) {
        await new Promise<void>((r) => setTimeout(r, 500));
        const fresh = await redis.get<{ games: any[]; dates: string[]; primaryDate: string }>(cacheKey).catch(() => null);
        if (fresh?.games) {
          return NextResponse.json(
            { games: fresh.games, dates: fresh.dates, primaryDate: fresh.primaryDate, cached: true },
            { headers: { "Cache-Control": "public, max-age=15, s-maxage=15, stale-while-revalidate=30" } }
          );
        }
      }
      // Safety valve: let this request proceed if mutex holder hasn't written yet
    }

    // ── DB fetch ────────────────────────────────────────────────────────────
    const supabase = createServerSupabaseClient();
    const selectFields = `
      game_id,
      game_date,
      game_datetime,
      game_type,
      status,
      status_detailed_state,
      home_name,
      away_name,
      home_score,
      away_score,
      home_id,
      away_id,
      venue_id,
      odds_game_id,
      home_probable_pitcher,
      away_probable_pitcher,
      current_pitcher_id,
      current_pitcher_name,
      current_batter_id,
      current_batter_name,
      current_inning,
      current_inning_half,
      current_outs,
      current_balls,
      current_strikes,
      runners_on_base,
      last_play_description,
      live_feed_updated_at,
      home_team:mlb_teams!mlb_games_home_id_fkey (abbreviation, team_id),
      away_team:mlb_teams!mlb_games_away_id_fkey (abbreviation, team_id)
    `;

    const { data: nearGames, error: nearError } = await supabase
      .from("mlb_games")
      .select(selectFields)
      .in("game_date", [today, tomorrow, dayAfterTomorrow]);

    if (nearError) {
      redis.del(mutexKey).catch(() => {});
      return NextResponse.json(
        { error: "Failed to fetch games", details: nearError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    let allGames = nearGames || [];
    const currentDates = [...new Set(allGames.map((g: any) => g.game_date))];

    if (currentDates.length < 2) {
      const lastDate = currentDates.length > 0 ? currentDates[currentDates.length - 1] : today;
      const nextDay = new Date(lastDate + "T12:00:00");
      nextDay.setDate(nextDay.getDate() + 1);
      const searchFrom = etFormatter.format(nextDay);

      const { data: futureGames, error: futureError } = await supabase
        .from("mlb_games")
        .select(selectFields)
        .gte("game_date", searchFrom)
        .order("game_date", { ascending: true })
        .limit(60);

      if (!futureError && futureGames && futureGames.length > 0) {
        const needed = 2 - currentDates.length;
        const futureDates = [...new Set(futureGames.map((g: any) => g.game_date))].slice(0, needed);
        const extraGames = futureGames.filter((g: any) => futureDates.includes(g.game_date));
        allGames = [...allGames, ...extraGames];
      }
    }

    const normalized = allGames.map(toGameRow);
    const sortedGames = sortGamesByDateTime(normalized);
    const dates = [...new Set(sortedGames.map((g) => g.game_date))];

    // ── Team records (cached in Redis for 1 hour) ───────────────────────────
    try {
      const currentYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(new Date()));
      const recordsCacheKey = `mlb:team-records:${currentYear}`;

      let abbrToRecord: Record<string, string> | null = await redis.get<Record<string, string>>(recordsCacheKey).catch(() => null);

      if (!abbrToRecord) {
        const seasonStart = `${currentYear}-01-01`;
        const { data: finalGames } = await supabase
          .from("mlb_games")
          .select("home_id, away_id, home_score, away_score, status_detailed_state")
          .gte("game_date", seasonStart)
          .eq("game_type", "R")
          .or("status_detailed_state.ilike.%final%,status.ilike.%final%");

        if (finalGames && finalGames.length > 0) {
          const records = new Map<number, { wins: number; losses: number }>();
          const ensureRecord = (id: number) => {
            if (!records.has(id)) records.set(id, { wins: 0, losses: 0 });
            return records.get(id)!;
          };
          for (const fg of finalGames) {
            if (fg.home_score == null || fg.away_score == null) continue;
            const homeRec = ensureRecord(fg.home_id);
            const awayRec = ensureRecord(fg.away_id);
            if (fg.home_score > fg.away_score) {
              homeRec.wins++;
              awayRec.losses++;
            } else if (fg.away_score > fg.home_score) {
              awayRec.wins++;
              homeRec.losses++;
            }
          }

          const idToAbbr = new Map<number, string>();
          for (const g of allGames as any[]) {
            const ht = g.home_team;
            const at = g.away_team;
            const homeAbbr = Array.isArray(ht) ? ht[0]?.abbreviation : ht?.abbreviation;
            const awayAbbr = Array.isArray(at) ? at[0]?.abbreviation : at?.abbreviation;
            if (g.home_id && homeAbbr) idToAbbr.set(g.home_id, homeAbbr);
            if (g.away_id && awayAbbr) idToAbbr.set(g.away_id, awayAbbr);
          }

          abbrToRecord = {};
          for (const [id, rec] of records) {
            const abbr = idToAbbr.get(id);
            if (abbr) abbrToRecord[abbr] = `${rec.wins}-${rec.losses}`;
          }

          redis.set(recordsCacheKey, abbrToRecord, { ex: RECORDS_CACHE_TTL }).catch(() => {});
        }
      }

      if (abbrToRecord) {
        for (const g of sortedGames) {
          (g as any).home_team_record = abbrToRecord[g.home_team_tricode] ?? null;
          (g as any).away_team_record = abbrToRecord[g.away_team_tricode] ?? null;
        }
      }
    } catch (recordErr) {
      console.error("[/api/mlb/games] Team records enrichment error:", recordErr);
    }

    // ── Weather + park factors ──────────────────────────────────────────────
    try {
      const gameIds = sortedGames.map((g) => Number(g.game_id)).filter(Boolean);
      const venueIds = [...new Set(sortedGames.map((g) => g.venue_id).filter(Boolean))] as number[];

      const currentYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(new Date()));

      const [weatherResult, parkResult] = await Promise.all([
        gameIds.length > 0
          ? supabase
              .from("mlb_game_weather")
              .select("game_id, temperature_f, wind_speed_mph, wind_label, wind_impact, hr_impact_score, roof_type, venue_name")
              .in("game_id", gameIds)
          : Promise.resolve({ data: null, error: null }),
        venueIds.length > 0
          ? supabase
              .from("mlb_ballpark_factors")
              .select("venue_id, factor_overall")
              .in("venue_id", venueIds)
              .eq("factor_type", "hr")
              .in("season", [currentYear, currentYear - 1])
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (weatherResult.data) {
        const weatherMap = new Map(weatherResult.data.map((w: any) => [String(w.game_id), w]));
        for (const g of sortedGames) {
          const w = weatherMap.get(g.game_id);
          if (w) {
            g.weather = {
              temperature_f: w.temperature_f ?? null,
              wind_speed_mph: w.wind_speed_mph ?? null,
              wind_label: w.wind_label ?? null,
              wind_impact: w.wind_impact ?? null,
              hr_impact_score: w.hr_impact_score ?? null,
              roof_type: w.roof_type ?? null,
              venue_name: w.venue_name ?? null,
            };
          }
        }
      }

      if (parkResult.data && parkResult.data.length > 0) {
        const parkMap = new Map<number, number>();
        for (const p of parkResult.data as any[]) {
          if (!parkMap.has(p.venue_id)) parkMap.set(p.venue_id, p.factor_overall);
        }
        for (const g of sortedGames) {
          if (g.venue_id && parkMap.has(g.venue_id)) {
            g.park_factor = parkMap.get(g.venue_id)!;
          }
        }
      }
    } catch (enrichErr) {
      console.error("[/api/mlb/games] Weather/park enrichment error:", enrichErr);
    }

    // ── Odds enrichment via batched mget ────────────────────────────────────
    try {
      const gamesWithOdds = sortedGames.filter((g) => g.odds_game_id);
      if (gamesWithOdds.length > 0) {
        const ODDS_BOOK = "fanduel";
        const MARKETS_PER_GAME = 4;

        const oddsKeys = gamesWithOdds.flatMap((g) => [
          `odds:mlb:${g.odds_game_id}:game_moneyline:${ODDS_BOOK}`,
          `odds:mlb:${g.odds_game_id}:total_runs:${ODDS_BOOK}`,
          `odds:mlb:${g.odds_game_id}:run_line:${ODDS_BOOK}`,
          `odds:mlb:${g.odds_game_id}:team_total_runs:${ODDS_BOOK}`,
        ]);

        const oddsResults: (string | null)[] = await redis.mget<string[]>(...oddsKeys).catch(() => oddsKeys.map(() => null));

        for (let i = 0; i < gamesWithOdds.length; i++) {
          const g = gamesWithOdds[i];
          const mlRaw = oddsResults[i * MARKETS_PER_GAME];
          const totalRaw = oddsResults[i * MARKETS_PER_GAME + 1];
          const rlRaw = oddsResults[i * MARKETS_PER_GAME + 2];
          const ttRaw = oddsResults[i * MARKETS_PER_GAME + 3];

          const odds: NonNullable<typeof g.odds> = {
            home_ml: null, away_ml: null,
            total: null, total_over_price: null, total_under_price: null,
            spread: null, spread_home_price: null, spread_away_price: null,
            home_total: null, home_total_over_price: null, home_total_under_price: null,
            away_total: null, away_total_over_price: null, away_total_under_price: null,
          };

          if (mlRaw) {
            try {
              const mlData = typeof mlRaw === "string" ? JSON.parse(mlRaw) : mlRaw;
              for (const [, valStr] of Object.entries(mlData)) {
                const sel = typeof valStr === "string" ? JSON.parse(valStr) : valStr;
                if (!sel?.price || sel.side !== "ml") continue;
                const name = (sel.player || "").toLowerCase();
                const homeName = (g.home_team_name || "").toLowerCase();
                const awayName = (g.away_team_name || "").toLowerCase();
                if (name.includes(homeName.split(" ").pop()!) || homeName.includes(name.split(" ").pop()!)) {
                  odds.home_ml = sel.price;
                } else if (name.includes(awayName.split(" ").pop()!) || awayName.includes(name.split(" ").pop()!)) {
                  odds.away_ml = sel.price;
                }
              }
            } catch (_) { /* skip malformed */ }
          }

          if (totalRaw) {
            try {
              const totalData = typeof totalRaw === "string" ? JSON.parse(totalRaw) : totalRaw;
              for (const [key, valStr] of Object.entries(totalData)) {
                const sel = typeof valStr === "string" ? JSON.parse(valStr) : valStr;
                if (!sel?.main) continue;
                if (key.includes("|over|")) {
                  odds.total = sel.line;
                  odds.total_over_price = sel.price;
                } else if (key.includes("|under|")) {
                  odds.total_under_price = sel.price;
                }
              }
            } catch (_) { /* skip malformed */ }
          }

          if (rlRaw) {
            try {
              const rlData = typeof rlRaw === "string" ? JSON.parse(rlRaw) : rlRaw;
              for (const [, valStr] of Object.entries(rlData)) {
                const sel = typeof valStr === "string" ? JSON.parse(valStr) : valStr;
                if (!sel?.main || !sel?.price) continue;
                const line = Number(sel.line);
                const name = (sel.player || "").toLowerCase();
                const homeName = (g.home_team_name || "").toLowerCase();
                if (name.includes(homeName.split(" ").pop()!) || homeName.includes(name.split(" ").pop()!)) {
                  odds.spread = line;
                  odds.spread_home_price = sel.price;
                } else {
                  odds.spread_away_price = sel.price;
                }
              }
            } catch (_) { /* skip malformed */ }
          }

          if (ttRaw) {
            try {
              const ttData = typeof ttRaw === "string" ? JSON.parse(ttRaw) : ttRaw;
              const homeLast = (g.home_team_name || "").toLowerCase().split(" ").pop()!;
              const awayLast = (g.away_team_name || "").toLowerCase().split(" ").pop()!;
              for (const [key, valStr] of Object.entries(ttData)) {
                const sel = typeof valStr === "string" ? JSON.parse(valStr) : valStr;
                if (!sel?.main) continue;
                const selName = (sel.player || "").toLowerCase();
                const isHome = selName.includes(homeLast);
                const isAway = selName.includes(awayLast);
                if (isHome && key.includes("|over|")) {
                  odds.home_total = sel.line;
                  odds.home_total_over_price = sel.price;
                } else if (isHome && key.includes("|under|")) {
                  odds.home_total_under_price = sel.price;
                } else if (isAway && key.includes("|over|")) {
                  odds.away_total = sel.line;
                  odds.away_total_over_price = sel.price;
                } else if (isAway && key.includes("|under|")) {
                  odds.away_total_under_price = sel.price;
                }
              }
            } catch (_) { /* skip malformed */ }
          }

          if (odds.home_ml || odds.total || odds.spread != null || odds.home_total != null) {
            g.odds = odds;
          }
        }
        console.log(`[/api/mlb/games] Odds enriched for ${gamesWithOdds.filter(g => g.odds).length}/${gamesWithOdds.length} games`);
      }
    } catch (oddsErr) {
      console.error("[/api/mlb/games] Odds enrichment error:", oddsErr);
    }

    const response = {
      games: sortedGames,
      dates,
      primaryDate: dates[0] || today,
    };

    const anyLive = sortedGames.some((g) =>
      (g.game_status || "").toLowerCase().includes("progress")
    );
    const cacheTtl = anyLive ? GAMES_CACHE_TTL_LIVE : GAMES_CACHE_TTL;
    const cacheControl = anyLive
      ? "public, max-age=15, s-maxage=15, stale-while-revalidate=30"
      : "public, max-age=60, s-maxage=60, stale-while-revalidate=120";

    redis
      .set(cacheKey, { ...response, ts: Date.now() }, { ex: cacheTtl })
      .catch((e) => console.error("[/api/mlb/games] Cache write error:", e));

    // Release mutex after writing cache
    redis.del(mutexKey).catch(() => {});

    console.log(`[/api/mlb/games] DB fetch in ${Date.now() - startTime}ms (TTL=${cacheTtl}s, live=${anyLive})`);

    return NextResponse.json(response, {
      headers: { "Cache-Control": cacheControl },
    });
  } catch (error: any) {
    console.error("[/api/mlb/games] Error:", error);
    redis.del(`${GAMES_CACHE_KEY}:${new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())}:mutex`).catch(() => {});
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
