import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";
import { buildSeasonRange, getCurrentMlbSeason } from "@/lib/mlb/current-season";
import {
  deriveLean,
  calculateGradeScore,
  scoreToGrade,
  NRFI_LEANS,
  YRFI_LEANS,
  type GameCard,
  type GameWeather,
  type NrfiResponse,
  type Pitcher,
  type TeamOffense,
  type RecentStart,
} from "@/lib/nrfi-data";

// ── Helpers ─────────────────────────────────────────────────────────────────

function getETDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function getETTime(dateTime: string | null): string {
  if (!dateTime) return "TBD";
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function derivePressure(scoringPct: number | null): "Low" | "Medium" | "High" {
  if (scoringPct == null) return "Medium";
  if (scoringPct >= 35) return "High";
  if (scoringPct <= 22) return "Low";
  return "Medium";
}

function deriveL30Trend(
  l30ScoringPct: number | null,
  seasonScoringPct: number | null
): "up" | "down" | "flat" {
  if (l30ScoringPct == null || seasonScoringPct == null) return "flat";
  const diff = l30ScoringPct - seasonScoringPct;
  if (diff > 5) return "up";
  if (diff < -5) return "down";
  return "flat";
}

function buildWeatherFlag(w: GameWeather): string | undefined {
  if (w.roofType === "dome") return "Dome";
  const parts: string[] = [];
  if (w.temperatureF != null) parts.push(`${Math.round(w.temperatureF)}°F`);
  if (w.windSpeedMph != null && w.windSpeedMph >= 8 && w.windLabel) {
    parts.push(`Wind ${w.windLabel} ${Math.round(w.windSpeedMph)}mph`);
  }
  if (w.precipProbability != null && w.precipProbability >= 30) {
    parts.push(`${Math.round(w.precipProbability)}% rain`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function computeEnvScore(
  parkFactor: number | null,
  weather: GameWeather | null
): number {
  if (weather?.roofType === "dome") {
    return parkFactor != null ? Math.round(clamp((1.2 - parkFactor) * 200, 0, 100)) : 50;
  }
  const parkComponent = parkFactor != null ? (1.2 - parkFactor) * 200 : 50;
  let windComponent = 50;
  if (weather?.windSpeedMph != null && weather.windSpeedMph >= 5) {
    if (weather.windImpact === "favorable") windComponent = 30;
    else if (weather.windImpact === "unfavorable") windComponent = 70;
  }
  let tempComponent = 50;
  if (weather?.temperatureF != null) {
    tempComponent = clamp(100 - (weather.temperatureF - 55) * 1.5, 0, 100);
  }
  return Math.round(clamp(parkComponent * 0.4 + windComponent * 0.35 + tempComponent * 0.25, 0, 100));
}

function generateReasonTags(
  awayP: Pitcher,
  homeP: Pitcher,
  awayOff: TeamOffense,
  homeOff: TeamOffense,
  parkFactor: number | null,
  weather: GameWeather | null
): string[] {
  const tags: string[] = [];
  const aPct = parseFloat(awayP.scorelessPct);
  const hPct = parseFloat(homeP.scorelessPct);
  if (aPct >= 75 && hPct >= 75) tags.push("Both pitchers 75%+ scoreless");
  else if (aPct >= 75) tags.push(`${awayP.name} ${aPct}% scoreless`);
  else if (hPct >= 75) tags.push(`${homeP.name} ${hPct}% scoreless`);
  if (aPct < 50) tags.push(`${awayP.name} struggles (${aPct}%)`);
  if (hPct < 50) tags.push(`${homeP.name} struggles (${hPct}%)`);
  if (awayOff.pressure === "High") tags.push(`${awayOff.team} offense active`);
  if (homeOff.pressure === "High") tags.push(`${homeOff.team} offense active`);
  if (awayOff.pressure === "Low" && homeOff.pressure === "Low") tags.push("Both offenses quiet 1st inn");
  if (parkFactor != null && parkFactor >= 1.1) tags.push("Hitter-friendly park");
  if (parkFactor != null && parkFactor <= 0.9) tags.push("Pitcher-friendly park");
  if (weather) {
    if (weather.roofType === "dome") {
      tags.push("Dome — no weather impact");
    } else {
      if (weather.windSpeedMph != null && weather.windSpeedMph >= 12 && weather.windImpact === "favorable") {
        tags.push(`Wind out ${Math.round(weather.windSpeedMph)}mph — YRFI boost`);
      } else if (weather.windSpeedMph != null && weather.windSpeedMph >= 12 && weather.windImpact === "unfavorable") {
        tags.push(`Wind in ${Math.round(weather.windSpeedMph)}mph — NRFI boost`);
      }
      if (weather.temperatureF != null && weather.temperatureF >= 90) {
        tags.push(`${Math.round(weather.temperatureF)}°F — hot, favors hitters`);
      } else if (weather.temperatureF != null && weather.temperatureF <= 50) {
        tags.push(`${Math.round(weather.temperatureF)}°F — cold, favors pitchers`);
      }
      if (weather.precipProbability != null && weather.precipProbability >= 40) {
        tags.push(`${Math.round(weather.precipProbability)}% rain risk`);
      }
    }
  }
  return tags.slice(0, 5);
}

function generateExplanation(
  grade: string,
  awayP: Pitcher,
  homeP: Pitcher,
  awayOff: TeamOffense,
  homeOff: TeamOffense
): string {
  const parts: string[] = [];
  parts.push(`Grade ${grade}.`);
  parts.push(
    `${awayP.name} is ${awayP.scorelessRecord} scoreless (${awayP.scorelessPct}%), ${homeP.name} is ${homeP.scorelessRecord} (${homeP.scorelessPct}%).`
  );
  if (awayOff.pressure === "Low" || homeOff.pressure === "Low") {
    const quiet = [
      awayOff.pressure === "Low" ? awayOff.team : null,
      homeOff.pressure === "Low" ? homeOff.team : null,
    ].filter(Boolean);
    if (quiet.length) parts.push(`${quiet.join(" and ")} rank low in 1st-inning scoring.`);
  }
  if (awayOff.pressure === "High" || homeOff.pressure === "High") {
    const active = [
      awayOff.pressure === "High" ? awayOff.team : null,
      homeOff.pressure === "High" ? homeOff.team : null,
    ].filter(Boolean);
    if (active.length) parts.push(`Watch: ${active.join(" and ")} score frequently in the 1st.`);
  }
  return parts.join(" ");
}

interface Sportsbook {
  name: string;
  nrfiOdds: string;
  yrfiOdds: string;
  link: string;
}

// ── RPC row shape from get_nrfi_cheatsheet(p_game_date) ────────────────────

interface RpcRow {
  game_id: number;
  game_date: string;
  game_datetime: string | null;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  venue_id: number | null;
  venue_name: string | null;
  // Home SP
  home_sp_id: number | null;
  home_sp_name: string | null;
  home_sp_games_started: number;
  home_sp_nrfi_count: number;
  home_sp_yrfi_count: number;
  home_sp_nrfi_pct: number | null;
  home_sp_k_pct: number | null;
  home_sp_bb_pct: number | null;
  home_sp_whip: number | null;
  home_sp_first_inning_hr: number;
  home_sp_first_inning_hits: number;
  home_sp_first_inning_runs: number;
  home_sp_last_starts: any[];
  // Away SP
  away_sp_id: number | null;
  away_sp_name: string | null;
  away_sp_games_started: number;
  away_sp_nrfi_count: number;
  away_sp_yrfi_count: number;
  away_sp_nrfi_pct: number | null;
  away_sp_k_pct: number | null;
  away_sp_bb_pct: number | null;
  away_sp_whip: number | null;
  away_sp_first_inning_hr: number;
  away_sp_first_inning_hits: number;
  away_sp_first_inning_runs: number;
  away_sp_last_starts: any[];
  // Team offense
  home_team_scoring_pct: number | null;
  home_team_avg_1st_runs: number | null;
  home_team_l30_scoring_pct: number | null;
  away_team_scoring_pct: number | null;
  away_team_avg_1st_runs: number | null;
  away_team_l30_scoring_pct: number | null;
  home_team_offense_rank: number | null;
  away_team_offense_rank: number | null;
  // Park
  park_factor_hr: number | null;
  park_factor_basic: number | null;
  // Grades (empty until populated)
  grade_record: Record<string, unknown>;
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date");
    const seasonsParam = url.searchParams.get("seasons"); // "2025" or "2023-2025"
    const lastStartsParam = url.searchParams.get("last_starts");
    const targetDate = dateParam || getETDate();

    const currentSeason = getCurrentMlbSeason();

    // Build seasons array: "2026" → [2026], "2024-2026" → [2024,2025,2026]
    let seasonsArray: number[] = [currentSeason];
    if (seasonsParam && /^\d{4}-\d{4}$/.test(seasonsParam)) {
      const [startSeason, endSeason] = seasonsParam.split("-").map(Number);
      if (Number.isFinite(startSeason) && Number.isFinite(endSeason) && endSeason >= startSeason) {
        seasonsArray = buildSeasonRange(endSeason, endSeason - startSeason + 1);
      }
    } else if (seasonsParam) {
      const parsedSeason = parseInt(seasonsParam, 10);
      if (Number.isFinite(parsedSeason)) {
        seasonsArray = [parsedSeason];
      }
    }
    const lastStarts = lastStartsParam ? parseInt(lastStartsParam, 10) : 5;

    const sb = createServerSupabaseClient();

    // 0. Fetch available game dates (today through 14 days out)
    const today = getETDate();
    const maxDate = new Date(new Date(today + "T00:00:00").getTime() + 14 * 86400000).toISOString().slice(0, 10);
    const datesRes = await sb
      .from("mlb_games")
      .select("game_date")
      .gte("game_date", today)
      .lte("game_date", maxDate)
      .order("game_date", { ascending: true });

    const availableDates = [
      ...new Set((datesRes.data ?? []).map((r: any) => r.game_date as string)),
    ];

    // 1. RPC call — returns one row per game with all pitcher/team/park data
    const { data: rpcData, error: rpcError } = await sb.rpc("get_nrfi_cheatsheet_v2", {
      p_game_date: targetDate,
      p_seasons: seasonsArray,
      p_last_starts: lastStarts,
    });

    if (rpcError) {
      console.error("[NRFI API] RPC error:", rpcError);
      return NextResponse.json(
        { error: "Failed to fetch NRFI data", details: rpcError.message },
        { status: 500 }
      );
    }

    const rows = (rpcData ?? []) as RpcRow[];

    if (rows.length === 0) {
      return NextResponse.json({
        games: [],
        meta: { date: targetDate, totalGames: 0, nrfiLeans: 0, yrfiLeans: 0, lastUpdated: new Date().toISOString(), availableDates },
      } satisfies NrfiResponse);
    }

    // 2. Fetch team abbreviations + weather in parallel (not in RPC)
    const teamIds = [...new Set(rows.flatMap((r) => [r.home_team_id, r.away_team_id]))];
    const gameIds = rows.map((r) => r.game_id);

    const [teamsRes, weatherRes] = await Promise.all([
      sb.from("mlb_teams").select("team_id, abbreviation").in("team_id", teamIds),
      sb
        .from("mlb_game_weather")
        .select(
          "game_id, temperature_f, feels_like_f, wind_speed_mph, wind_gust_mph, " +
          "wind_label, wind_impact, humidity_pct, precip_probability, roof_type, hr_impact_score"
        )
        .in("game_id", gameIds),
    ]);

    const teamAbbrMap = new Map<number, string>();
    for (const t of (teamsRes.data ?? []) as { team_id: number; abbreviation: string }[]) {
      teamAbbrMap.set(t.team_id, t.abbreviation);
    }

    const weatherMap = new Map<number, GameWeather>();
    for (const w of (weatherRes.data ?? []) as any[]) {
      weatherMap.set(w.game_id, {
        temperatureF: w.temperature_f,
        feelsLikeF: w.feels_like_f,
        windSpeedMph: w.wind_speed_mph,
        windGustMph: w.wind_gust_mph,
        windLabel: w.wind_label,
        windImpact: w.wind_impact,
        humidityPct: w.humidity_pct,
        precipProbability: w.precip_probability,
        roofType: w.roof_type,
        hrImpactScore: w.hr_impact_score,
      });
    }

    // 2b. Fetch 1st inning total runs odds from Redis ────────────────
    // Redis key: odds:mlb:{oddsblaze_event_id}:1st_inning_total_runs:{book}
    // Selections: "game_total|over|0.5" (YRFI) and "game_total|under|0.5" (NRFI)

    const NRFI_BOOKS = [
      "draftkings", "fanduel", "betmgm", "caesars", "bet365",
      "fanatics", "hard-rock", "fliff", "betrivers", "espnbet",
      "betparx", "bally-bet", "thescore", "superbook", "circa",
    ] as const;
    const NRFI_SHARP_BOOKS = ["pinnacle", "novig", "prophetx"] as const;
    const ALL_NRFI_BOOKS = [...NRFI_BOOKS, ...NRFI_SHARP_BOOKS];

    // Get odds_game_id for each game
    const { data: oddsGameRows } = await sb
      .from("mlb_games")
      .select("game_id, odds_game_id")
      .in("game_id", gameIds);

    const gameToEvent = new Map<number, string>();
    for (const g of oddsGameRows ?? []) {
      if (g.odds_game_id) gameToEvent.set(g.game_id, g.odds_game_id);
    }

    // Build Redis keys for all event+book combos
    const uniqueEventIds = [...new Set(gameToEvent.values())];
    const nrfiRedisKeys: string[] = [];
    const nrfiKeyMeta: { eventId: string; book: string }[] = [];
    for (const eid of uniqueEventIds) {
      for (const book of ALL_NRFI_BOOKS) {
        nrfiRedisKeys.push(`odds:mlb:${eid}:1st_inning_total_runs:${book}`);
        nrfiKeyMeta.push({ eventId: eid, book });
      }
    }

    // Batch fetch from Redis
    type OddsVal = Record<string, any> | string | null;
    let nrfiRedisValues: OddsVal[] = [];
    if (nrfiRedisKeys.length > 0) {
      try {
        const CHUNK = 50;
        for (let i = 0; i < nrfiRedisKeys.length; i += CHUNK) {
          const chunk = nrfiRedisKeys.slice(i, i + CHUNK);
          const vals = await redis.mget<OddsVal[]>(...chunk);
          nrfiRedisValues.push(...vals);
        }
      } catch (e) {
        console.error("[NRFI] Redis mget error:", e);
      }
    }

    // Parse into: eventId → book → { nrfi, yrfi } odds objects
    interface InningOdds {
      nrfi: { price: string; price_decimal: number; link?: string; mobile_link?: string } | null;
      yrfi: { price: string; price_decimal: number; link?: string; mobile_link?: string } | null;
    }
    const inningOddsIndex = new Map<string, Map<string, InningOdds>>();
    for (let i = 0; i < nrfiRedisValues.length; i++) {
      const raw = nrfiRedisValues[i];
      if (!raw) continue;
      const { eventId, book } = nrfiKeyMeta[i];
      try {
        const parsed: Record<string, any> = typeof raw === "string" ? JSON.parse(raw) : raw;
        const nrfiSel = parsed["game_total|under|0.5"] ?? null;
        const yrfiSel = parsed["game_total|over|0.5"] ?? null;
        if (!nrfiSel && !yrfiSel) continue;

        if (!inningOddsIndex.has(eventId)) inningOddsIndex.set(eventId, new Map());
        inningOddsIndex.get(eventId)!.set(book, { nrfi: nrfiSel, yrfi: yrfiSel });
      } catch {
        // skip
      }
    }

    console.log(
      `[NRFI] 1st inning odds: ${inningOddsIndex.size}/${uniqueEventIds.length} events with odds data`
    );

    // 3. Assemble game cards
    const cards: GameCard[] = rows.map((r) => {
      const homeAbbr = teamAbbrMap.get(r.home_team_id) ?? "???";
      const awayAbbr = teamAbbrMap.get(r.away_team_id) ?? "???";
      const weatherObj = weatherMap.get(r.game_id) ?? null;

      // ── Build pitchers ──
      const buildPitcher = (prefix: "home" | "away"): Pitcher => {
        const gs = r[`${prefix}_sp_games_started`] ?? 0;
        const nrfi = r[`${prefix}_sp_nrfi_count`] ?? 0;
        const scorelessPct = gs > 0 ? (nrfi / gs) * 100 : 0;

        // Recent starts from RPC JSON array
        const rawStarts: any[] = r[`${prefix}_sp_last_starts`] ?? [];
        const recentStarts: RecentStart[] = (Array.isArray(rawStarts) ? rawStarts : [])
          .slice(0, 5)
          .map((s: any) => ({
            date: s.game_date ?? "",
            scoreless: s.scoreless ?? (s.runs === 0),
            opponent: s.opponent_abbr ?? teamAbbrMap.get(s.opponent_id) ?? "???",
            isHome: s.is_home ?? true,
            detail: `${s.runs ?? 0} R, ${s.strikeouts ?? 0} K, ${s.bf ?? 0} BF`,
          }));

        return {
          playerId: r[`${prefix}_sp_id`] ?? 0,
          name: r[`${prefix}_sp_name`] ?? "TBD",
          team: prefix === "home" ? homeAbbr : awayAbbr,
          scorelessRecord: `${nrfi}/${gs}`,
          scorelessPct: scorelessPct.toFixed(1),
          k_pct: r[`${prefix}_sp_k_pct`] != null ? `${Number(r[`${prefix}_sp_k_pct`]).toFixed(1)}%` : "-",
          bb_pct: r[`${prefix}_sp_bb_pct`] != null ? `${Number(r[`${prefix}_sp_bb_pct`]).toFixed(1)}%` : "-",
          whip: r[`${prefix}_sp_whip`] != null ? Number(r[`${prefix}_sp_whip`]).toFixed(3) : "-",
          era_1st: gs > 0 ? ((r[`${prefix}_sp_first_inning_runs`] / gs) * 9).toFixed(2) : null,
          homeNrfiPct: null, // Not in current RPC
          awayNrfiPct: null,
          recentStarts,
        };
      };

      // ── Build team offense ──
      const buildTeamOffense = (prefix: "home" | "away"): TeamOffense => {
        const scoringPct = r[`${prefix}_team_scoring_pct`] ?? null;
        const l30ScoringPct = r[`${prefix}_team_l30_scoring_pct`] ?? null;

        return {
          teamId: r[`${prefix}_team_id`],
          team: prefix === "home" ? homeAbbr : awayAbbr,
          pressure: derivePressure(scoringPct),
          scoringPct: scoringPct != null ? `${Number(scoringPct).toFixed(1)}%` : "-",
          offenseRank: r[`${prefix}_team_offense_rank`] ?? null,
          ops: "-", // Not in current RPC
          homePct: "-",
          awayPct: "-",
          l30Trend: deriveL30Trend(l30ScoringPct, scoringPct),
          l30ScoringPct: l30ScoringPct != null ? `${Number(l30ScoringPct).toFixed(1)}%` : "-",
        };
      };

      const homePitcher = buildPitcher("home");
      const awayPitcher = buildPitcher("away");
      const homeOffense = buildTeamOffense("home");
      const awayOffense = buildTeamOffense("away");

      // ── Park factor ──
      const parkFactorVal = r.park_factor_hr != null ? Number(r.park_factor_hr) / 100 : null; // RPC returns 100 = neutral

      // ── Grade calculation (frontend-side, using defined weights) ──
      const homeSPScoreless = parseFloat(homePitcher.scorelessPct);
      const awaySPScoreless = parseFloat(awayPitcher.scorelessPct);
      const homeTeamScoring = r.home_team_scoring_pct ?? 25;
      const awayTeamScoring = r.away_team_scoring_pct ?? 25;
      const weatherScore = computeEnvScore(parkFactorVal, weatherObj);

      const gradeScore = calculateGradeScore({
        homeSPScorelessPct: homeSPScoreless,
        awaySPScorelessPct: awaySPScoreless,
        homeTeamScoringPct: homeTeamScoring,
        awayTeamScoringPct: awayTeamScoring,
        parkFactor: parkFactorVal,
        weatherScore,
      });
      const grade = scoreToGrade(gradeScore);
      const lean = deriveLean(grade, gradeScore);

      // ── Component scores ──
      const pitchingScore = Math.round((homeSPScoreless + awaySPScoreless) / 2 * 0.9 + 10);
      const offenseScore = Math.round(100 - (homeTeamScoring + awayTeamScoring) / 2 * 1.5);

      const reasonTags = generateReasonTags(awayPitcher, homePitcher, awayOffense, homeOffense, parkFactorVal, weatherObj);
      const explanation = generateExplanation(grade, awayPitcher, homePitcher, awayOffense, homeOffense);

      // ── 1st inning odds enrichment ──
      const eventId = gameToEvent.get(r.game_id);
      const eventOdds = eventId ? inningOddsIndex.get(eventId) : undefined;

      let bestNrfi: { price: string; decimal: number; book: string; link?: string } | null = null;
      let bestYrfi: { price: string; decimal: number; book: string; link?: string } | null = null;
      const sportsbooks: Sportsbook[] = [];

      if (eventOdds) {
        for (const [book, odds] of eventOdds) {
          const isSharp = (["pinnacle", "novig", "prophetx"] as string[]).includes(book);

          // Build sportsbook entry
          if (odds.nrfi || odds.yrfi) {
            sportsbooks.push({
              name: book,
              nrfiOdds: odds.nrfi?.price ?? "-",
              yrfiOdds: odds.yrfi?.price ?? "-",
              link: odds.nrfi?.link ?? odds.yrfi?.link ?? "",
            });
          }

          // Track best consumer odds (exclude sharp books for display)
          if (!isSharp) {
            if (odds.nrfi?.price_decimal && (!bestNrfi || odds.nrfi.price_decimal > bestNrfi.decimal)) {
              bestNrfi = { price: odds.nrfi.price, decimal: odds.nrfi.price_decimal, book, link: odds.nrfi.link };
            }
            if (odds.yrfi?.price_decimal && (!bestYrfi || odds.yrfi.price_decimal > bestYrfi.decimal)) {
              bestYrfi = { price: odds.yrfi.price, decimal: odds.yrfi.price_decimal, book, link: odds.yrfi.link };
            }
          }
        }
      }

      return {
        gameId: r.game_id,
        gameDate: r.game_date,
        gameTime: getETTime(r.game_datetime),
        lean,
        grade,
        gradeScore,
        awayTeam: r.away_team_name,
        homeTeam: r.home_team_name,
        awayTricode: awayAbbr,
        homeTricode: homeAbbr,
        awayPitcher,
        homePitcher,
        awayOffense,
        homeOffense,
        reasonTags,
        gradeExplanation: explanation,
        componentScores: {
          pitching: clamp(pitchingScore, 0, 100),
          offense: clamp(offenseScore, 0, 100),
          environment: clamp(weatherScore, 0, 100),
          price: 50,
        },
        bestNrfiOdds: bestNrfi?.price ?? "-",
        bestYrfiOdds: bestYrfi?.price ?? "-",
        parkFactor: parkFactorVal != null ? `Park Factor: ${parkFactorVal.toFixed(2)}` : "Park Factor: N/A",
        weather: weatherObj,
        weatherFlag: weatherObj ? buildWeatherFlag(weatherObj) : undefined,
        lineupStatus: "Pending",
        sportsbooks,
        nrfiResult: null,
        home1stRuns: null,
        away1stRuns: null,
      } satisfies GameCard;
    });

    const nrfiLeans = cards.filter((c) => NRFI_LEANS.includes(c.lean)).length;
    const yrfiLeans = cards.filter((c) => YRFI_LEANS.includes(c.lean)).length;

    const response: NrfiResponse = {
      games: cards,
      meta: {
        date: targetDate,
        totalGames: cards.length,
        nrfiLeans,
        yrfiLeans,
        lastUpdated: new Date().toISOString(),
        availableDates,
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (err: any) {
    console.error("[NRFI API]", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
