import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";
import { getStandardAbbreviation } from "@/lib/data/team-mappings";
import { supabaseBreaker, redisBreaker } from "@/lib/circuit-breaker";
import { matchOddsTeamSide } from "@/lib/mlb/odds-team-mapping";

// --- Cache key prefixes ---
// Fix #4: split static metadata (1h) from live game state (30s)
const STATIC_CACHE_PREFIX = "mlb:games:static";
const LIVE_CACHE_PREFIX = "mlb:games:live";
const STATIC_CACHE_TTL = 3600; // team names, records, weather, park factors
const LIVE_CACHE_TTL_ACTIVE = 90; // stored 90s; considered fresh for 30s
const LIVE_CACHE_TTL_IDLE = 900; // stored 15m; considered fresh for 5m
const LIVE_FRESH_MS_ACTIVE = 30_000;
const LIVE_FRESH_MS_IDLE = 300_000;

// --- Cache types ---
type WeatherData = {
  temperature_f: number | null;
  wind_speed_mph: number | null;
  wind_label: string | null;
  wind_impact: string | null;
  hr_impact_score: number | null;
  roof_type: string | null;
  venue_name: string | null;
};

type LiveState = {
  current_pitcher_id: number | null;
  current_pitcher_name: string | null;
  current_batter_id: number | null;
  current_batter_name: string | null;
  current_inning: number | null;
  current_inning_half: string | null;
  current_outs: number | null;
  current_balls: number | null;
  current_strikes: number | null;
  runners_on_base: unknown;
  last_play_description: string | null;
  live_feed_updated_at: string | null;
};

type OddsData = {
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
};

type StaticGameEntry = {
  game_id: string;
  game_date: string;
  home_team_name: string;
  away_team_name: string;
  home_team_tricode: string;
  away_team_tricode: string;
  venue_id: number | null;
  home_probable_pitcher: string | null;
  away_probable_pitcher: string | null;
  odds_game_id: string | null;
  season_type: string | null;
  home_team_record: string | null;
  away_team_record: string | null;
  weather: WeatherData | null;
  park_factor: number | null;
};

type LiveGameEntry = {
  home_team_score: number | null;
  away_team_score: number | null;
  game_status: string;
  live: LiveState | null;
  odds: OddsData | null;
};

type StaticCache = {
  games: StaticGameEntry[];
  dates: string[];
  primaryDate: string;
  ts: number;
};

type LiveCache = {
  games: Record<string, LiveGameEntry>;
  anyLive: boolean;
  ts: number;
};

// --- Helper functions ---

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
    return (
      parseGameTimeToMinutes(a.game_status || "") -
      parseGameTimeToMinutes(b.game_status || "")
    );
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
  if (status.includes("in progress") || status.includes("manager challenge")) return "In Progress";
  return formatScheduledStatus(gameDateTime);
}

function isLiveStatus(statusDetailed: string | null, currentPitcherId: number | null): boolean {
  const s = (statusDetailed || "").toLowerCase();
  return (
    s.includes("progress") ||
    s.includes("challenge") ||
    s.includes("review") ||
    s.includes("warmup") ||
    s.includes("delayed") ||
    (!s.includes("final") &&
      !s.includes("scheduled") &&
      !s.includes("postponed") &&
      !s.includes("cancelled") &&
      !s.includes("pre-game") &&
      currentPitcherId != null)
  );
}

function buildLiveState(row: any): LiveState | null {
  if (!row.current_pitcher_id) return null;
  return {
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
    current_batting_order: row.current_batting_order ?? null,
    on_deck_name: row.on_deck_name ?? null,
    in_hole_name: row.in_hole_name ?? null,
    last_play_description: row.last_play_description ?? null,
    live_feed_updated_at: row.live_feed_updated_at ?? null,
  };
}

// Fix #5: parse odds using the robust team-matching utility instead of fragile last-word heuristic
function parseOddsForGame(
  mlRaw: any,
  totalRaw: any,
  rlRaw: any,
  ttRaw: any,
  game: {
    home_team_name: string;
    home_team_tricode: string;
    away_team_name: string;
    away_team_tricode: string;
  },
): OddsData | null {
  const odds: OddsData = {
    home_ml: null, away_ml: null,
    total: null, total_over_price: null, total_under_price: null,
    spread: null, spread_home_price: null, spread_away_price: null,
    home_total: null, home_total_over_price: null, home_total_under_price: null,
    away_total: null, away_total_over_price: null, away_total_under_price: null,
  };

  try {
    if (mlRaw) {
      const mlData = typeof mlRaw === "string" ? JSON.parse(mlRaw) : mlRaw;
      for (const [, valStr] of Object.entries(mlData)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sel: any = typeof valStr === "string" ? JSON.parse(valStr) : valStr;
        if (!sel?.price || sel.side !== "ml") continue;
        const side = matchOddsTeamSide(sel.player || "", game);
        if (side === "home") odds.home_ml = sel.price;
        else if (side === "away") odds.away_ml = sel.price;
      }
    }
  } catch (_) { /* skip malformed */ }

  try {
    if (totalRaw) {
      const totalData = typeof totalRaw === "string" ? JSON.parse(totalRaw) : totalRaw;
      for (const [key, valStr] of Object.entries(totalData)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sel: any = typeof valStr === "string" ? JSON.parse(valStr) : valStr;
        if (!sel?.main) continue;
        if (key.includes("|over|")) { odds.total = sel.line; odds.total_over_price = sel.price; }
        else if (key.includes("|under|")) { odds.total_under_price = sel.price; }
      }
    }
  } catch (_) { /* skip malformed */ }

  try {
    if (rlRaw) {
      const rlData = typeof rlRaw === "string" ? JSON.parse(rlRaw) : rlRaw;
      for (const [, valStr] of Object.entries(rlData)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sel: any = typeof valStr === "string" ? JSON.parse(valStr) : valStr;
        if (!sel?.main || !sel?.price) continue;
        const side = matchOddsTeamSide(sel.player || "", game);
        if (side === "home") { odds.spread = Number(sel.line); odds.spread_home_price = sel.price; }
        else if (side === "away") { odds.spread_away_price = sel.price; }
      }
    }
  } catch (_) { /* skip malformed */ }

  try {
    if (ttRaw) {
      const ttData = typeof ttRaw === "string" ? JSON.parse(ttRaw) : ttRaw;
      for (const [key, valStr] of Object.entries(ttData)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sel: any = typeof valStr === "string" ? JSON.parse(valStr) : valStr;
        if (!sel?.main) continue;
        const side = matchOddsTeamSide(sel.player || "", game);
        const isOver = key.includes("|over|");
        const isUnder = key.includes("|under|");
        if (side === "home" && isOver) { odds.home_total = sel.line; odds.home_total_over_price = sel.price; }
        else if (side === "home" && isUnder) { odds.home_total_under_price = sel.price; }
        else if (side === "away" && isOver) { odds.away_total = sel.line; odds.away_total_over_price = sel.price; }
        else if (side === "away" && isUnder) { odds.away_total_under_price = sel.price; }
      }
    }
  } catch (_) { /* skip malformed */ }

  const hasData = odds.home_ml || odds.total || odds.spread != null || odds.home_total != null;
  return hasData ? odds : null;
}

async function fetchOddsForGames(
  gamesWithOdds: StaticGameEntry[],
): Promise<Map<string, OddsData | null>> {
  const ODDS_BOOK = "fanduel";
  const MARKETS = 4;

  const allPromises = gamesWithOdds.flatMap((g) => [
    redis.get<string>(`odds:mlb:${g.odds_game_id}:game_moneyline:${ODDS_BOOK}`),
    redis.get<string>(`odds:mlb:${g.odds_game_id}:total_runs:${ODDS_BOOK}`),
    redis.get<string>(`odds:mlb:${g.odds_game_id}:run_line:${ODDS_BOOK}`),
    redis.get<string>(`odds:mlb:${g.odds_game_id}:team_total_runs:${ODDS_BOOK}`),
  ]);

  const results = await Promise.all(allPromises.map((p) => p.catch(() => null)));
  const oddsMap = new Map<string, OddsData | null>();

  for (let i = 0; i < gamesWithOdds.length; i++) {
    const g = gamesWithOdds[i];
    oddsMap.set(
      g.game_id,
      parseOddsForGame(
        results[i * MARKETS],
        results[i * MARKETS + 1],
        results[i * MARKETS + 2],
        results[i * MARKETS + 3],
        g,
      ),
    );
  }
  return oddsMap;
}

// Fix #2: merge static + live caches into the full game shape
function assembleGames(
  staticGames: StaticGameEntry[],
  liveMap: Record<string, LiveGameEntry> | null,
): any[] {
  return staticGames.map((sg) => {
    const live = liveMap?.[sg.game_id];
    return {
      ...sg,
      home_team_score: live?.home_team_score ?? null,
      away_team_score: live?.away_team_score ?? null,
      game_status: live?.game_status ?? "TBD",
      live: live?.live ?? null,
      odds: live?.odds ?? null,
      is_primetime: null,
      national_broadcast: null,
      neutral_site: false,
    };
  });
}

// Fix #2: background live refresh — fetches only live-changing fields, non-blocking.
// Uses a Redis NX lock to prevent concurrent stampedes from parallel requests.
async function refreshLiveCache(
  liveKey: string,
  today: string,
  tomorrow: string,
  dayAfterTomorrow: string,
  staticGames: StaticGameEntry[],
) {
  const lockKey = `${liveKey}:lock`;
  try {
    const acquired = await redis.set(lockKey, "1", { ex: 20, nx: true });
    if (!acquired) return;

    const supabase = createServerSupabaseClient();
    const queryResult = await supabaseBreaker.call(async () =>
      supabase
        .from("mlb_games")
        .select(
          `game_id, home_score, away_score, status, status_detailed_state, game_datetime,
          current_pitcher_id, current_pitcher_name, current_batter_id, current_batter_name,
          current_inning, current_inning_half, current_outs, current_balls, current_strikes,
          runners_on_base, last_play_description, live_feed_updated_at`,
        )
        .in("game_date", [today, tomorrow, dayAfterTomorrow]),
    );

    const data = queryResult.data;
    if (!data) return;

    const liveGamesMap: Record<string, LiveGameEntry> = {};
    let anyLive = false;

    for (const row of data) {
      const game_id = String(row.game_id);
      const statusDetailed = row.status_detailed_state || row.status;
      const live = isLiveStatus(statusDetailed, row.current_pitcher_id) ? buildLiveState(row) : null;
      if (live) anyLive = true;
      liveGamesMap[game_id] = {
        home_team_score: row.home_score ?? null,
        away_team_score: row.away_score ?? null,
        game_status: getDisplayStatus(statusDetailed, row.game_datetime),
        live,
        odds: null,
      };
    }

    const gamesWithOdds = staticGames.filter((sg) => sg.odds_game_id && liveGamesMap[sg.game_id]);
    if (gamesWithOdds.length > 0) {
      const oddsMap = await fetchOddsForGames(gamesWithOdds).catch(() => new Map());
      for (const sg of gamesWithOdds) {
        const entry = liveGamesMap[sg.game_id];
        if (entry) entry.odds = oddsMap.get(sg.game_id) ?? null;
      }
    }

    const liveCache: LiveCache = { games: liveGamesMap, anyLive, ts: Date.now() };
    await redis.set(liveKey, liveCache, {
      ex: anyLive ? LIVE_CACHE_TTL_ACTIVE : LIVE_CACHE_TTL_IDLE,
    });
    console.log(`[/api/mlb/games] Background live refresh complete (anyLive=${anyLive})`);
  } catch (err) {
    console.error("[/api/mlb/games] Background live refresh error:", err);
  } finally {
    redis.del(lockKey).catch(() => {});
  }
}

export async function GET() {
  const startTime = Date.now();

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

    const staticKey = `${STATIC_CACHE_PREFIX}:${today}`;
    const liveKey = `${LIVE_CACHE_PREFIX}:${today}`;

    // Fix #1 (circuit breaker) + Fix #2 (stale-while-revalidate) + Fix #4 (cache split):
    // read both caches in parallel via circuit-breaker-protected Redis calls.
    let staticCached: StaticCache | null = null;
    let liveCached: LiveCache | null = null;
    try {
      [staticCached, liveCached] = await Promise.all([
        redisBreaker.call(() => redis.get<StaticCache>(staticKey)),
        redisBreaker.call(() => redis.get<LiveCache>(liveKey)),
      ]);
    } catch (cacheErr) {
      console.error("[/api/mlb/games] Cache read error:", cacheErr);
    }

    if (staticCached?.games) {
      const liveAge = Date.now() - (liveCached?.ts ?? 0);
      const freshThreshold = liveCached?.anyLive ? LIVE_FRESH_MS_ACTIVE : LIVE_FRESH_MS_IDLE;
      const liveStale = !liveCached || liveAge > freshThreshold;

      // Fire-and-forget background live refresh when stale
      if (liveStale) {
        refreshLiveCache(
          liveKey, today, tomorrow, dayAfterTomorrow, staticCached.games,
        ).catch(() => {});
      }

      const games = assembleGames(staticCached.games, liveCached?.games ?? null);
      const anyLive = liveCached?.anyLive ?? false;
      const cacheControl = anyLive
        ? "public, max-age=15, s-maxage=15, stale-while-revalidate=30"
        : "public, max-age=60, s-maxage=60, stale-while-revalidate=120";

      return NextResponse.json(
        {
          games,
          dates: staticCached.dates,
          primaryDate: staticCached.primaryDate,
          cached: true,
          stale: liveStale,
        },
        { headers: { "Cache-Control": cacheControl } },
      );
    }

    // --- Full fresh fetch ---

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
      current_batting_order,
      on_deck_name,
      in_hole_name,
      last_play_description,
      live_feed_updated_at,
      winning_pitcher,
      losing_pitcher,
      save_pitcher,
      home_team:mlb_teams!mlb_games_home_id_fkey (abbreviation, team_id),
      away_team:mlb_teams!mlb_games_away_id_fkey (abbreviation, team_id)
    `;

    const supabase = createServerSupabaseClient();

    // Fix #1: circuit breaker around primary Supabase fetch
    let nearGames: any[];
    try {
      const result = await supabaseBreaker.call(async () =>
        supabase
          .from("mlb_games")
          .select(selectFields)
          .in("game_date", [today, tomorrow, dayAfterTomorrow]),
      );
      if (result.error) {
        return NextResponse.json(
          { error: "Failed to fetch games", details: result.error.message },
          { status: 500, headers: { "Cache-Control": "no-store" } },
        );
      }
      nearGames = result.data || [];
    } catch (sbErr: any) {
      return NextResponse.json(
        { error: "upstream_unavailable", message: sbErr?.message || "" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    let allGames = nearGames;
    const currentDates = [...new Set(allGames.map((g: any) => g.game_date))];

    if (currentDates.length < 2) {
      const lastDate = currentDates.length > 0 ? currentDates[currentDates.length - 1] : today;
      const nextDay = new Date(lastDate + "T12:00:00");
      nextDay.setDate(nextDay.getDate() + 1);
      const searchFrom = etFormatter.format(nextDay);

      try {
        const futureResult = await supabaseBreaker.call(async () =>
          supabase
            .from("mlb_games")
            .select(selectFields)
            .gte("game_date", searchFrom)
            .order("game_date", { ascending: true })
            .limit(60),
        );
        if (!futureResult.error && futureResult.data && futureResult.data.length > 0) {
          const needed = 2 - currentDates.length;
          const futureDates = [
            ...new Set(futureResult.data.map((g: any) => g.game_date)),
          ].slice(0, needed);
          allGames = [
            ...allGames,
            ...futureResult.data.filter((g: any) => futureDates.includes(g.game_date)),
          ];
        }
      } catch (_) { /* non-critical */ }
    }

    // Build normalized game list
    const normalized = allGames.map((row: any) => {
      const homeAbbr =
        row.home_team?.abbreviation || getStandardAbbreviation(row.home_name || "", "mlb");
      const awayAbbr =
        row.away_team?.abbreviation || getStandardAbbreviation(row.away_name || "", "mlb");
      const statusDetailed = row.status_detailed_state || row.status;
      const live = isLiveStatus(statusDetailed, row.current_pitcher_id)
        ? buildLiveState(row)
        : null;

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
        winning_pitcher: row.winning_pitcher ?? null,
        losing_pitcher: row.losing_pitcher ?? null,
        save_pitcher: row.save_pitcher ?? null,
        live,
        weather: null as WeatherData | null,
        park_factor: null as number | null,
        odds: null as OddsData | null,
        _home_id: row.home_id as number,
        _away_id: row.away_id as number,
      };
    });

    const sortedGames = sortGamesByDateTime(normalized);
    const dates = [...new Set(sortedGames.map((g) => g.game_date))];

    // Team records (best-effort)
    try {
      const currentYear = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          year: "numeric",
        }).format(new Date()),
      );
      const recordsResult = await supabaseBreaker.call(async () =>
        supabase
          .from("mlb_games")
          .select("home_id, away_id, home_score, away_score, status_detailed_state")
          .gte("game_date", `${currentYear}-01-01`)
          .eq("game_type", "R")
          .or("status_detailed_state.ilike.%final%,status.ilike.%final%"),
      );
      const finalGames = recordsResult.data;

      if (finalGames && finalGames.length > 0) {
        const records = new Map<number, { wins: number; losses: number }>();
        const ensure = (id: number) => {
          if (!records.has(id)) records.set(id, { wins: 0, losses: 0 });
          return records.get(id)!;
        };
        for (const fg of finalGames) {
          if (fg.home_score == null || fg.away_score == null) continue;
          const hr = ensure(fg.home_id);
          const ar = ensure(fg.away_id);
          if (fg.home_score > fg.away_score) { hr.wins++; ar.losses++; }
          else if (fg.away_score > fg.home_score) { ar.wins++; hr.losses++; }
        }
        const idToAbbr = new Map<number, string>();
        for (const g of allGames as any[]) {
          const ha = Array.isArray(g.home_team) ? g.home_team[0]?.abbreviation : g.home_team?.abbreviation;
          const aa = Array.isArray(g.away_team) ? g.away_team[0]?.abbreviation : g.away_team?.abbreviation;
          if (g.home_id && ha) idToAbbr.set(g.home_id, ha);
          if (g.away_id && aa) idToAbbr.set(g.away_id, aa);
        }
        const abbrToRecord = new Map<string, string>();
        for (const [id, rec] of records) {
          const abbr = idToAbbr.get(id);
          if (abbr) abbrToRecord.set(abbr, `${rec.wins}-${rec.losses}`);
        }
        for (const g of sortedGames) {
          g.home_team_record = abbrToRecord.get(g.home_team_tricode) ?? null;
          g.away_team_record = abbrToRecord.get(g.away_team_tricode) ?? null;
        }
      }
    } catch (recordErr) {
      console.error("[/api/mlb/games] Team records enrichment error:", recordErr);
    }

    // Weather + park factors (best-effort, parallel)
    try {
      const gameIds = sortedGames.map((g) => Number(g.game_id)).filter(Boolean);
      const venueIds = [
        ...new Set(sortedGames.map((g) => g.venue_id).filter(Boolean)),
      ] as number[];
      const currentYear = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          year: "numeric",
        }).format(new Date()),
      );

      let weatherData: any[] | null = null;
      let parkData: any[] | null = null;

      await Promise.all([
        gameIds.length > 0
          ? supabaseBreaker
              .call(async () =>
                supabase
                  .from("mlb_game_weather")
                  .select(
                    "game_id, temperature_f, wind_speed_mph, wind_label, wind_impact, hr_impact_score, roof_type, venue_name",
                  )
                  .in("game_id", gameIds),
              )
              .then((r) => { weatherData = r.data ?? null; })
              .catch(() => {})
          : Promise.resolve(),
        venueIds.length > 0
          ? supabaseBreaker
              .call(async () =>
                supabase
                  .from("mlb_ballpark_factors")
                  .select("venue_id, factor_overall")
                  .in("venue_id", venueIds)
                  .eq("factor_type", "hr")
                  .in("season", [currentYear, currentYear - 1]),
              )
              .then((r) => { parkData = r.data ?? null; })
              .catch(() => {})
          : Promise.resolve(),
      ]);

      if (weatherData) {
        const weatherMap = new Map(
          (weatherData as any[]).map((w: any) => [String(w.game_id), w]),
        );
        for (const g of sortedGames) {
          const w = weatherMap.get(g.game_id) as any;
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

      if (parkData && (parkData as any[]).length > 0) {
        const parkMap = new Map<number, number>();
        for (const p of parkData as any[]) {
          if (!parkMap.has(p.venue_id)) parkMap.set(p.venue_id, p.factor_overall);
        }
        for (const g of sortedGames) {
          if (g.venue_id && parkMap.has(g.venue_id)) g.park_factor = parkMap.get(g.venue_id)!;
        }
      }
    } catch (enrichErr) {
      console.error("[/api/mlb/games] Weather/park enrichment error:", enrichErr);
    }

    // Fix #1 (circuit breaker) + Fix #5 (odds team matching): enrich odds from Redis
    try {
      const gamesWithOdds = sortedGames.filter((g) => g.odds_game_id);
      if (gamesWithOdds.length > 0) {
        const oddsMap = await redisBreaker
          .call(() => fetchOddsForGames(gamesWithOdds))
          .catch(() => new Map());
        for (const g of gamesWithOdds) g.odds = oddsMap.get(g.game_id) ?? null;
        console.log(
          `[/api/mlb/games] Odds enriched for ${gamesWithOdds.filter((g) => g.odds).length}/${gamesWithOdds.length} games`,
        );
      }
    } catch (oddsErr) {
      console.error("[/api/mlb/games] Odds enrichment error:", oddsErr);
    }

    // Fix #4: write static and live caches separately with different TTLs
    const anyLive = sortedGames.some((g) => g.game_status.toLowerCase().includes("progress"));

    const staticGames: StaticGameEntry[] = sortedGames.map((g) => ({
      game_id: g.game_id,
      game_date: g.game_date,
      home_team_name: g.home_team_name,
      away_team_name: g.away_team_name,
      home_team_tricode: g.home_team_tricode,
      away_team_tricode: g.away_team_tricode,
      venue_id: g.venue_id,
      home_probable_pitcher: g.home_probable_pitcher,
      away_probable_pitcher: g.away_probable_pitcher,
      odds_game_id: g.odds_game_id,
      season_type: g.season_type,
      home_team_record: g.home_team_record,
      away_team_record: g.away_team_record,
      weather: g.weather,
      park_factor: g.park_factor,
    }));

    const liveGamesMap: Record<string, LiveGameEntry> = {};
    for (const g of sortedGames) {
      liveGamesMap[g.game_id] = {
        home_team_score: g.home_team_score,
        away_team_score: g.away_team_score,
        game_status: g.game_status,
        live: g.live,
        odds: g.odds,
      };
    }

    const newStaticCache: StaticCache = {
      games: staticGames,
      dates,
      primaryDate: dates[0] || today,
      ts: Date.now(),
    };
    const newLiveCache: LiveCache = { games: liveGamesMap, anyLive, ts: Date.now() };

    // Non-blocking cache writes — don't delay the response
    Promise.all([
      redisBreaker
        .call(() => redis.set(staticKey, newStaticCache, { ex: STATIC_CACHE_TTL }))
        .catch((e) => console.error("[/api/mlb/games] Static cache write error:", e)),
      redisBreaker
        .call(() =>
          redis.set(liveKey, newLiveCache, {
            ex: anyLive ? LIVE_CACHE_TTL_ACTIVE : LIVE_CACHE_TTL_IDLE,
          }),
        )
        .catch((e) => console.error("[/api/mlb/games] Live cache write error:", e)),
    ]);

    const cacheControl = anyLive
      ? "public, max-age=15, s-maxage=15, stale-while-revalidate=30"
      : "public, max-age=60, s-maxage=60, stale-while-revalidate=120";

    // Strip internal tracking fields before sending to client
    const clientGames = sortedGames.map(({ _home_id: _h, _away_id: _a, ...g }) => g);

    console.log(
      `[/api/mlb/games] DB fetch in ${Date.now() - startTime}ms (anyLive=${anyLive}, games=${sortedGames.length})`,
    );

    return NextResponse.json(
      { games: clientGames, dates, primaryDate: dates[0] || today },
      { headers: { "Cache-Control": cacheControl } },
    );
  } catch (error: any) {
    console.error("[/api/mlb/games] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
