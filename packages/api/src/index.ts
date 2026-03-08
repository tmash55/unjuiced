import { normalizePlanName } from "@unjuiced/types";
import type { Entitlements } from "@unjuiced/types";
import type { ArbMode, GetArbsResponse } from "@unjuiced/types";
import type {
  DevigMethod,
  EVMode,
  GetSharpPresetsResponse,
  Opportunity,
  OpportunityDevigInfo,
  OpportunitiesResponse,
  PlayerBoxScoresResponse,
  HitRateSortField,
  HitRatesV2Response,
  PositiveEVResponse,
  SharpPreset
} from "@unjuiced/types";

export interface ApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
}

export interface GetMePlanOptions {
  accessToken?: string;
}

export interface GetArbsOptions {
  accessToken?: string;
  v?: number;
  limit?: number;
  cursor?: number;
  eventId?: string;
  mode?: ArbMode;
}

export interface GetPositiveEVOptions {
  accessToken?: string;
  sports?: string[];
  markets?: string[];
  books?: string[];
  sharpPreset?: SharpPreset;
  devigMethods?: DevigMethod[];
  marketType?: "player" | "game" | "all";
  mode?: EVMode;
  minEV?: number;
  maxEV?: number;
  minBooksPerSide?: number;
  limit?: number;
}

export interface GetOpportunitiesOptions {
  accessToken?: string;
  sports?: string[];
  markets?: string[];
  preset?: string;
  marketType?: "player" | "game" | "all";
  minEdge?: number;
  minEV?: number;
  minOdds?: number;
  maxOdds?: number;
  minBooksPerSide?: number;
  requireTwoWay?: boolean;
  requireFullBlend?: boolean;
  limit?: number;
  sort?: "edge" | "ev";
  marketLines?: Record<string, number[]>;
}

export interface GetSharpPresetsOptions {
  accessToken?: string;
}

export interface GetNbaHitRatesV2Options {
  accessToken?: string;
  date?: string;
  market?: string;
  minHitRate?: number;
  limit?: number;
  offset?: number;
  search?: string;
  playerId?: number;
  sort?: HitRateSortField;
  sortDir?: "asc" | "desc";
  hasOdds?: boolean;
  evFilter?: "positive" | "strong";
}

export interface HitRateOddsSelection {
  stableKey: string;
  line?: number;
}

export interface HitRateOddsResponse {
  odds: Record<
    string,
    {
      stableKey: string;
      eventId?: string | null;
      market?: string | null;
      primaryLine?: number | null;
      bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
      bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
      currentLine: number | null;
      allLines?: Array<{
        line: number;
        bestOver: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
        bestUnder: { book: string; price: number; url: string | null; mobileUrl: string | null; sgp: string | null } | null;
        books: Record<
          string,
          {
            over?: { price: number; url: string | null; mobileUrl: string | null; sgp: string | null };
            under?: { price: number; url: string | null; mobileUrl: string | null; sgp: string | null };
          }
        >;
      }>;
      live: boolean;
      timestamp: number | null;
    }
  >;
}

export interface GetNbaHitRateOddsOptions {
  accessToken?: string;
  selections: HitRateOddsSelection[];
}

export interface GetNbaPlayerBoxScoresOptions {
  accessToken?: string;
  playerId: number;
  season?: string;
  limit?: number;
}

export interface GetPlayerGamesWithInjuriesOptions {
  accessToken?: string;
  playerId: number;
  season?: string;
}

function formatAmericanOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

function parseOpportunity(raw: Record<string, unknown>): Opportunity {
  const eventData = raw.event as Record<string, unknown> | null;
  const allBooksRaw = Array.isArray(raw.all_books) ? (raw.all_books as Array<Record<string, unknown>>) : [];
  const oppositeSideRaw = raw.opposite_side as Record<string, unknown> | null;

  return {
    id: `${String(raw.sport || "")}:${String(raw.event_id || "")}:${String(raw.player || "")}:${String(raw.market || "")}:${String(raw.line || "")}:${String(raw.side || "")}`,
    sport: String(raw.sport || "nba") as Opportunity["sport"],
    eventId: String(raw.event_id || ""),
    player: String(raw.player || ""),
    playerId: (raw.player_id as string) || null,
    team: (raw.team as string) || null,
    position: (raw.position as string) || null,
    market: String(raw.market || ""),
    marketDisplay: String(raw.market_display || raw.market || ""),
    line: Number(raw.line || 0),
    side: String(raw.side || "over") as Opportunity["side"],
    homeTeam: (eventData?.home_team as string) || (raw.home_team as string) || "",
    awayTeam: (eventData?.away_team as string) || (raw.away_team as string) || "",
    gameStart: (eventData?.start_time as string) || (raw.game_start as string) || "",
    timestamp: Number(raw.timestamp || 0),
    bestBook: String(raw.best_book || ""),
    bestPrice: String(raw.best_price || ""),
    bestDecimal: Number(raw.best_decimal || 0),
    bestLink: (raw.best_link as string) || null,
    bestMobileLink: (raw.best_mobile_link as string) || null,
    nBooks: Number(raw.n_books || 0),
    allBooks: allBooksRaw.map((book) => ({
      book: String(book.book || ""),
      price: Number(book.price || 0),
      priceFormatted: formatAmericanOdds(Number(book.price || 0)),
      decimal: Number(book.decimal || 0),
      link: (book.link as string) || null,
      mobileLink: (book.mobile_link as string) || null,
      sgp: (book.sgp as string) || null,
      limits: (book.limits as { max: number } | null) || null,
      includedInAverage: (book.included_in_average as boolean | undefined) ?? true,
      averageExclusionReason: (book.average_exclusion_reason as string | null | undefined) ?? null,
      oddId: (book.odd_id as string | undefined) || undefined,
    })),
    sharpPrice: (raw.sharp_price as string) || null,
    sharpDecimal: raw.sharp_decimal == null ? null : Number(raw.sharp_decimal),
    sharpBooks: Array.isArray(raw.sharp_books) ? (raw.sharp_books as string[]) : [],
    blendComplete: Boolean(raw.blend_complete),
    blendWeight: Number(raw.blend_weight_available || 0),
    avgBookCount: Number(raw.avg_book_count || 0),
    edge: raw.edge == null ? null : Number(raw.edge),
    edgePct: raw.edge_pct == null ? null : Number(raw.edge_pct),
    bestImplied: raw.best_implied == null ? null : Number(raw.best_implied),
    sharpImplied: raw.sharp_implied == null ? null : Number(raw.sharp_implied),
    trueProbability: raw.true_probability == null ? null : Number(raw.true_probability),
    fairDecimal: raw.fair_decimal == null ? null : Number(raw.fair_decimal),
    fairAmerican: (raw.fair_american as string) || null,
    impliedEdge: raw.implied_edge == null ? null : Number(raw.implied_edge),
    ev: raw.ev == null ? null : Number(raw.ev),
    evPct: raw.ev_pct == null ? null : Number(raw.ev_pct),
    kellyFraction: raw.kelly_fraction == null ? null : Number(raw.kelly_fraction),
    devigMethod: (raw.devig_method as Opportunity["devigMethod"]) || null,
    overround: raw.overround == null ? null : Number(raw.overround),
    marketCoverage: raw.market_coverage
      ? {
          nBooksOver: Number((raw.market_coverage as Record<string, unknown>).n_books_over || 0),
          nBooksUnder: Number((raw.market_coverage as Record<string, unknown>).n_books_under || 0),
          twoWayDevigReady: Boolean((raw.market_coverage as Record<string, unknown>).two_way_devig_ready),
        }
      : null,
    devigInfo: raw.devig_inputs
      ? {
          source: String((raw.devig_inputs as Record<string, unknown>).source || "market_average") as OpportunityDevigInfo["source"],
          aggregation: String((raw.devig_inputs as Record<string, unknown>).aggregation || "single") as OpportunityDevigInfo["aggregation"],
          overBooks: Array.isArray((raw.devig_inputs as Record<string, unknown>).over_books)
            ? (((raw.devig_inputs as Record<string, unknown>).over_books as string[]) || [])
            : [],
          underBooks: Array.isArray((raw.devig_inputs as Record<string, unknown>).under_books)
            ? (((raw.devig_inputs as Record<string, unknown>).under_books as string[]) || [])
            : [],
        }
      : null,
    oppositeSide: oppositeSideRaw
      ? {
          side: String(oppositeSideRaw.side || "under") as Opportunity["side"],
          sharpPrice: (oppositeSideRaw.sharp_price as string) || null,
          sharpDecimal: oppositeSideRaw.sharp_decimal == null ? null : Number(oppositeSideRaw.sharp_decimal),
          bestBook: (oppositeSideRaw.best_book as string) || null,
          bestPrice: (oppositeSideRaw.best_price as string) || null,
          bestDecimal: oppositeSideRaw.best_decimal == null ? null : Number(oppositeSideRaw.best_decimal),
          allBooks: Array.isArray(oppositeSideRaw.all_books)
            ? (oppositeSideRaw.all_books as Array<Record<string, unknown>>).map((book) => ({
                book: String(book.book || ""),
                price: Number(book.price || 0),
                priceFormatted: formatAmericanOdds(Number(book.price || 0)),
                decimal: Number(book.decimal || 0),
                link: (book.link as string) || null,
                mobileLink: (book.mobile_link as string) || null,
                sgp: (book.sgp as string) || null,
                limits: (book.limits as { max: number } | null) || null,
                includedInAverage: (book.included_in_average as boolean | undefined) ?? true,
                averageExclusionReason: (book.average_exclusion_reason as string | null | undefined) ?? null,
                oddId: (book.odd_id as string | undefined) || undefined,
              }))
            : [],
        }
      : null,
    filterId: (raw.filter_id as string) || null,
    filterName: (raw.filter_name as string) || null,
    filterIcon: (raw.filter_icon as string) || null,
    filterColor: (raw.filter_color as string) || null,
  };
}

/* ── Play Type Matchup ── */

export interface GetPlayTypeMatchupOptions {
  accessToken?: string;
  playerId: number;
  opponentTeamId: number;
  season?: string;
}

export interface PlayTypeData {
  play_type: string;
  display_name: string;
  player_ppg: number;
  player_pct_of_total: number;
  player_ppp: number;
  player_possessions: number;
  player_total_points: number;
  player_percentile: number | null;
  player_fg_pct: number;
  opponent_def_rank: number | null;
  opponent_ppp_allowed: number | null;
  opponent_possessions: number | null;
  opponent_fg_pct_allowed: number | null;
  matchup_rating: "tough" | "neutral" | "favorable";
  matchup_color: "red" | "yellow" | "green";
  is_free_throws: boolean;
  ft_pct: number | null;
  opponent_fta_per_game: number | null;
}

export interface PlayTypeMatchupResponse {
  player: {
    id: number;
    name: string;
    team_id: number;
    team_name: string;
    team_abbr: string;
    games_played: number;
    season: string;
  };
  opponent: {
    team_id: number;
    team_name: string;
    team_abbr: string;
  };
  play_types: PlayTypeData[];
  summary: {
    total_play_types: number;
    favorable_matchups: number;
    tough_matchups: number;
    favorable_pct_of_points: number | null;
  };
}

/* ── Shot Zone Matchup ── */

export interface GetShotZoneMatchupOptions {
  accessToken?: string;
  playerId: number;
  opponentTeamId: number;
  season?: string;
}

export interface ShotZone {
  zone: string;
  display_name: string;
  player_fgm: number;
  player_fga: number;
  player_fg_pct: number;
  player_points: number;
  player_pct_of_total: number;
  opponent_def_rank: number | null;
  opponent_opp_fg_pct: number | null;
  matchup_rating: "favorable" | "neutral" | "tough" | "N/A";
  matchup_color: "green" | "yellow" | "red" | "gray";
}

export interface ShotZoneMatchupResponse {
  player: {
    id: number;
    name: string;
    team_id: number;
    team_name: string;
    team_abbr: string;
    total_points: number;
    season: string;
  };
  opponent: {
    team_id: number;
    team_name: string;
    team_abbr: string;
  };
  zones: ShotZone[];
  summary: {
    total_zones_shown: number;
    favorable_zones: number;
    neutral_zones: number;
    tough_zones: number;
    favorable_pct_of_points: number;
    neutral_pct_of_points: number;
    tough_pct_of_points: number;
  };
}

/* ── Team Defense Ranks ── */

export interface GetTeamDefenseRanksOptions {
  accessToken?: string;
  opponentTeamId: number;
  season?: string;
}

export interface TeamDefenseRanksResponse {
  opponentTeamId: number;
  positions: {
    [position: string]: {
      [market: string]: {
        rank: number | null;
        avgAllowed: number | null;
      };
    };
  };
}

/* ── Team Roster ── */

export interface GetTeamRosterOptions {
  accessToken?: string;
  teamId: number;
  season?: string;
}

export interface TeamRosterPlayer {
  playerId: number;
  name: string;
  position: string;
  jerseyNumber: number | null;
  gamesPlayed: number;
  avgMinutes: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  avgPra: number;
  avgThrees: number;
  avgSteals: number;
  avgBlocks: number;
  avgUsage: number;
  injuryStatus: string | null;
  injuryNotes: string | null;
}

export interface TeamRosterResponse {
  players: TeamRosterPlayer[];
  teamId: number;
  teamAbbr: string;
  teamName: string;
  playerCount: number;
  season: string;
}

/* ── Player Correlations ── */

export interface GetPlayerCorrelationsOptions {
  accessToken?: string;
  playerId: number;
  market: string;
  line: number;
  gameId?: number;
  lastNGames?: number;
  season?: string;
}

export interface StatCorrelation {
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
  };
}

export interface TeammateCorrelation {
  playerId: number;
  playerName: string;
  position: string;
  minutesAvg: number | null;
  injuryStatus?: string | null;
  injuryNotes?: string | null;
  sample: {
    totalGames: number;
    whenAnchorHits: number;
    whenAnchorMisses: number;
  };
  points: StatCorrelation;
  rebounds: StatCorrelation;
  assists: StatCorrelation;
  threes: StatCorrelation;
  steals: StatCorrelation;
  blocks: StatCorrelation;
  turnovers: StatCorrelation;
  pra: StatCorrelation;
  pointsRebounds: StatCorrelation;
  pointsAssists: StatCorrelation;
  reboundsAssists: StatCorrelation;
  blocksSteals: StatCorrelation;
}

export interface PlayerCorrelationsData {
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
  };
  teammateCorrelations: TeammateCorrelation[];
  headline: {
    anchor: string;
    topTeammate: string | null;
  };
}

// Position vs Team
export interface GetPositionVsTeamOptions {
  accessToken?: string;
  position: string;
  opponentTeamId: number;
  market: string;
  season?: string;
  limit?: number;
  minMinutes?: number;
}

export interface PositionVsTeamPlayer {
  playerId: number;
  playerName: string;
  teamAbbr: string;
  position: string;
  stat: number;
  closingLine: number | null;
  hitOver: boolean | null;
  gameDate: string;
  minutes: number;
}

export interface PositionVsTeamResponse {
  players: PositionVsTeamPlayer[];
  avgStat: number;
  overHitRate: number | null;
  totalGames: number;
  playerCount: number;
  position: string;
  opponentTeamAbbr: string;
  market: string;
}

export interface TeammateOut {
  player_id: number;
  name: string;
  position: string | null;
  reason: string | null;
}

export interface GameWithInjuries {
  game_id: string;
  game_date: string;
  opponent_team_id: number;
  home_away: "H" | "A";
  result: "W" | "L";
  pts: number;
  reb: number;
  ast: number;
  fg3m: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  minutes: number;
  pra: number;
  pr: number;
  pa: number;
  ra: number;
  bs: number;
  teammates_out: TeammateOut[];
  opponents_out: TeammateOut[];
}

export interface PlayerGamesWithInjuriesResponse {
  player_id: number;
  team_id: number;
  season: string;
  filter_player_id: number | null;
  total_games: number;
  games: GameWithInjuries[];
}

/* ── Cheat Sheet Types ── */

export interface CheatSheetRow {
  playerId: number;
  playerName: string;
  teamAbbr: string;
  teamName: string;
  opponentAbbr: string;
  opponentName: string;
  playerPosition: string;
  gameDate: string;
  gameId: number;
  homeAway: string;
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  homeTeamName: string;
  awayTeamName: string;
  gameStatus: string;
  market: string;
  line: number;
  overOdds: string;
  overOddsDecimal: number;
  hitRate: number;
  last5Pct: number;
  last10Pct: number;
  last20Pct: number;
  seasonPct: number;
  hitStreak: number;
  avgStat: number;
  edge: number;
  edgePct: number;
  dvpRank: number | null;
  dvpAvg: number | null;
  matchupQuality: "favorable" | "neutral" | "unfavorable";
  confidenceGrade: "A+" | "A" | "B+" | "B" | "C";
  confidenceScore: number;
  trend: "hot" | "improving" | "stable" | "declining" | "cold";
  oddsSelectionId: string | null;
  selKey: string | null;
  eventId: string | null;
  bestOdds: { book: string; price: number; updated_at: number } | null;
  books: number;
  isBackToBack: boolean;
  injuryStatus: string | null;
  injuryNotes: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface CheatSheetResponse {
  rows: CheatSheetRow[];
  count: number;
}

export interface GetCheatSheetOptions {
  accessToken?: string;
  timeWindow?: string;
  minHitRate?: number;
  oddsFloor?: number;
  oddsCeiling?: number;
  markets?: string[];
  dates?: string[];
}

export interface InjuryImpactRow {
  playerId: number;
  playerName: string;
  teamAbbr: string;
  teamId: number;
  playerPosition: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  gameDate: string;
  gameId: number;
  opponentAbbr: string;
  opponentId: number;
  homeAway: string;
  startTime?: string | null;
  market: string;
  line: number;
  overOdds: string | null;
  overOddsDecimal: number | null;
  oddsSelectionId: string | null;
  eventId: string | null;
  defaultTeammateId: number;
  defaultTeammateName: string;
  defaultTeammatePosition: string;
  defaultTeammateInjuryStatus: string;
  defaultTeammateInjuryNotes: string | null;
  defaultTeammateAvgMinutes: number;
  defaultTeammateAvgPts: number;
  defaultTeammateAvgReb: number;
  defaultTeammateAvgAst: number;
  gamesWithTeammateOut: number;
  hits: number;
  hitRate: number | null;
  avgStatWhenOut: number;
  avgStatOverall: number;
  statBoost: number;
  statBoostPct: number | null;
  avgMinutesWhenOut: number;
  avgMinutesOverall: number;
  minutesBoost: number;
  usageWhenOut: number;
  usageOverall: number;
  usageBoost: number;
  fgaWhenOut: number;
  fgaOverall: number;
  fgaBoost: number;
  fg3aWhenOut: number;
  fg3aOverall: number;
  fg3aBoost: number;
  orebWhenOut: number;
  orebOverall: number;
  orebBoost: number;
  drebWhenOut: number;
  drebOverall: number;
  drebBoost: number;
  rebWhenOut: number;
  rebOverall: number;
  rebBoost: number;
  passesWhenOut: number;
  passesOverall: number;
  passesBoost: number;
  potentialAstWhenOut: number;
  potentialAstOverall: number;
  potentialAstBoost: number;
  otherInjuredTeammatesCount: number;
  opportunityGrade: string;
  confidenceScore: number;
  bestOdds: { book: string; price: number; updated_at: number } | null;
  books: number;
  selKey: string | null;
}

export interface InjuryImpactResponse {
  rows: InjuryImpactRow[];
  markets: string[];
}

export interface GetInjuryImpactOptions {
  accessToken?: string;
  dates?: string[];
  markets?: string[];
  minGames?: number;
  minTeammateMinutes?: number;
}

export interface DvpTeamRanking {
  teamId: number;
  teamAbbr: string;
  teamName: string | null;
  position: string;
  season: string;
  games: number;
  ptsAvg: number | null;
  rebAvg: number | null;
  astAvg: number | null;
  fg3mAvg: number | null;
  stlAvg: number | null;
  blkAvg: number | null;
  tovAvg: number | null;
  ptsRank: number | null;
  rebRank: number | null;
  astRank: number | null;
  fg3mRank: number | null;
  stlRank: number | null;
  blkRank: number | null;
  tovRank: number | null;
  praAvg: number | null;
  prAvg: number | null;
  paAvg: number | null;
  raAvg: number | null;
  bsAvg: number | null;
  praRank: number | null;
  prRank: number | null;
  paRank: number | null;
  raRank: number | null;
  bsRank: number | null;
  [key: string]: unknown;
}

export interface DvpRankingsResponse {
  teams: DvpTeamRanking[];
  position: string;
  season: string;
  meta?: { gamesAnalyzed: number };
}

export interface GetDvpRankingsOptions {
  accessToken?: string;
  position: string;
  season?: string;
}

export interface ThresholdData {
  line: number;
  actualLine: number | null;
  hitRate: number | null;
  hits: number;
  games: number;
  bestOdds: number | null;
  bestDecimal: number | null;
  bestBook: string | null;
  oddsLink: string | null;
  avgDecimal: number | null;
  edgePct: number | null;
  bookCount: number;
  isBestCell: boolean;
}

export interface HitRateMatrixRow {
  playerId: number;
  playerName: string;
  teamAbbr: string;
  position: string;
  eventId: string;
  gameId: number | null;
  selKey: string;
  gameDate: string;
  opponentAbbr: string;
  homeAway: string;
  dvpRank: number | null;
  dvpQuality: "favorable" | "neutral" | "unfavorable" | null;
  primaryLine: number | null;
  thresholds: ThresholdData[];
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface HitRateMatrixResponse {
  rows: HitRateMatrixRow[];
  market: string;
  timeWindow: string;
  thresholdLines: number[];
  count: number;
}

export interface GetHitRateMatrixOptions {
  accessToken?: string;
  market?: string;
  gameDate?: string;
  timeWindow?: string;
  positions?: string[];
}

export interface TripleDoubleBestPrice {
  book: string;
  price: number;
  priceFormatted: string;
  link: string | null;
  mobileLink: string | null;
  source?: string;
  fromCache?: boolean;
  stale?: boolean;
}

export interface TripleDoubleSheetRow {
  id: string;
  playerId: string;
  player: string;
  team: string | null;
  matchup: string;
  eventId: string;
  startTime: string;
  sgp_ra: TripleDoubleBestPrice | null;
  sgp_pra: TripleDoubleBestPrice | null;
  td: TripleDoubleBestPrice | null;
  allSgpRa: TripleDoubleBestPrice[];
  allSgpPra: TripleDoubleBestPrice[];
  allTd: TripleDoubleBestPrice[];
  hasAllThreeLegs: boolean;
  booksWithRa: number;
  booksWithPra: number;
}

export interface TripleDoubleSheetData {
  rows: TripleDoubleSheetRow[];
  generatedAt: number;
  generatedAtIso: string;
  meta: {
    sport: string;
    targetLine: number;
    candidateCount: number;
    rowCount: number;
    books: string[];
    quoteStats: {
      totalRequests: number;
      vendorCalls: number;
      cacheHits: number;
      staleServed: number;
      errors: number;
    };
  };
}

export interface TripleDoubleSheetResponse {
  data: TripleDoubleSheetData | null;
  source: "l1_cache" | "redis_cache" | "computed" | "empty";
  timestamp: number;
  message?: string;
}

export interface GetTripleDoubleSheetOptions {
  accessToken?: string;
}

export interface DoubleDoubleBestPrice {
  book: string;
  price: number;
  priceFormatted: string;
  link: string | null;
  mobileLink: string | null;
  source?: string;
  fromCache?: boolean;
  stale?: boolean;
}

export interface DoubleDoubleSheetRow {
  id: string;
  playerId: string;
  player: string;
  team: string | null;
  matchup: string;
  eventId: string;
  startTime: string;
  sgp_pr: DoubleDoubleBestPrice | null;
  sgp_pa: DoubleDoubleBestPrice | null;
  dd: DoubleDoubleBestPrice | null;
  allSgpPr: DoubleDoubleBestPrice[];
  allSgpPa: DoubleDoubleBestPrice[];
  allDd: DoubleDoubleBestPrice[];
  hasAllThreeLegs: boolean;
  booksWithPr: number;
  booksWithPa: number;
}

export interface DoubleDoubleSheetData {
  rows: DoubleDoubleSheetRow[];
  generatedAt: number;
  generatedAtIso: string;
  meta: { sport: string; targetLine: number; candidateCount: number; rowCount: number; books: string[]; quoteStats: { totalRequests: number; vendorCalls: number; cacheHits: number; staleServed: number; errors: number; }; };
}

export interface DoubleDoubleSheetResponse {
  data: DoubleDoubleSheetData | null;
  source: "l1_cache" | "redis_cache" | "computed" | "empty";
  timestamp: number;
  message?: string;
}

export interface GetDoubleDoubleSheetOptions {
  accessToken?: string;
}

export function createApiClient(options: ApiClientOptions) {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl.trim().replace(/\/$/, "");

  return {
    async getMePlan(requestOptions?: GetMePlanOptions): Promise<Entitlements> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const response = await fetcher(`${baseUrl}/api/me/plan`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return { plan: "free", authenticated: false };
        }
        throw new Error(`Failed to fetch entitlements: ${response.status}`);
      }

      const payload = (await response.json()) as Entitlements;
      return {
        ...payload,
        plan: normalizePlanName(payload.plan)
      };
    },
    async getArbs(requestOptions?: GetArbsOptions): Promise<GetArbsResponse | null> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const params = new URLSearchParams();
      if (requestOptions?.v != null) params.set("v", String(requestOptions.v));
      if (requestOptions?.limit != null) params.set("limit", String(requestOptions.limit));
      if (requestOptions?.cursor != null) params.set("cursor", String(requestOptions.cursor));
      if (requestOptions?.eventId) params.set("event_id", requestOptions.eventId);
      if (requestOptions?.mode) params.set("mode", requestOptions.mode);

      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/arbs${query ? `?${query}` : ""}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (response.status === 304) return null;

      if (!response.ok) {
        throw new Error(`Failed to fetch arbitrage rows: ${response.status}`);
      }

      const payload = (await response.json()) as GetArbsResponse;
      return {
        ...payload,
        plan: normalizePlanName(String(payload.plan))
      };
    },
    async getPositiveEV(requestOptions?: GetPositiveEVOptions): Promise<PositiveEVResponse> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const params = new URLSearchParams();
      if (requestOptions?.sports?.length) params.set("sports", requestOptions.sports.join(","));
      if (requestOptions?.markets?.length) params.set("markets", requestOptions.markets.join(","));
      if (requestOptions?.books?.length) params.set("books", requestOptions.books.join(","));
      if (requestOptions?.sharpPreset) params.set("sharpPreset", requestOptions.sharpPreset);
      if (requestOptions?.devigMethods?.length) params.set("devigMethods", requestOptions.devigMethods.join(","));
      if (requestOptions?.marketType && requestOptions.marketType !== "all") params.set("marketType", requestOptions.marketType);
      if (requestOptions?.mode) params.set("mode", requestOptions.mode);
      if (requestOptions?.minEV != null) params.set("minEV", String(requestOptions.minEV));
      if (requestOptions?.maxEV != null) params.set("maxEV", String(requestOptions.maxEV));
      if (requestOptions?.minBooksPerSide != null) {
        params.set("minBooksPerSide", String(requestOptions.minBooksPerSide));
      }
      if (requestOptions?.limit != null) params.set("limit", String(requestOptions.limit));

      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/v2/positive-ev${query ? `?${query}` : ""}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch positive EV rows: ${response.status}`);
      }

      return (await response.json()) as PositiveEVResponse;
    },
    async getOpportunities(requestOptions?: GetOpportunitiesOptions): Promise<OpportunitiesResponse> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const params = new URLSearchParams();
      if (requestOptions?.sports?.length) params.set("sports", requestOptions.sports.join(","));
      if (requestOptions?.markets?.length) params.set("markets", requestOptions.markets.join(","));
      if (requestOptions?.preset) params.set("preset", requestOptions.preset);
      if (requestOptions?.marketType && requestOptions.marketType !== "all") params.set("marketType", requestOptions.marketType);
      if (requestOptions?.minEdge != null) params.set("minEdge", String(requestOptions.minEdge));
      if (requestOptions?.minEV != null) params.set("minEV", String(requestOptions.minEV));
      if (requestOptions?.minOdds != null) params.set("minOdds", String(requestOptions.minOdds));
      if (requestOptions?.maxOdds != null) params.set("maxOdds", String(requestOptions.maxOdds));
      if (requestOptions?.minBooksPerSide != null) params.set("minBooksPerSide", String(requestOptions.minBooksPerSide));
      if (requestOptions?.requireTwoWay) params.set("requireTwoWay", "true");
      if (requestOptions?.requireFullBlend) params.set("requireFullBlend", "true");
      if (requestOptions?.limit != null) params.set("limit", String(requestOptions.limit));
      if (requestOptions?.sort) params.set("sort", requestOptions.sort);
      if (requestOptions?.marketLines && Object.keys(requestOptions.marketLines).length > 0) {
        params.set("marketLines", JSON.stringify(requestOptions.marketLines));
      }

      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/v2/opportunities${query ? `?${query}` : ""}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch opportunities: ${response.status}`);
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const rawOpportunities = Array.isArray(payload.opportunities)
        ? (payload.opportunities as Array<Record<string, unknown>>)
        : [];

      return {
        opportunities: rawOpportunities.map(parseOpportunity),
        count: Number(payload.count || rawOpportunities.length || 0),
        totalScanned: Number(payload.total_scanned || 0),
        totalAfterFilters: Number(payload.total_after_filters || rawOpportunities.length || 0),
        timingMs: Number(payload.timing_ms || 0),
      };
    },
    async getSharpPresets(requestOptions?: GetSharpPresetsOptions): Promise<GetSharpPresetsResponse> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const response = await fetcher(`${baseUrl}/api/v2/presets`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sharp presets: ${response.status}`);
      }

      return (await response.json()) as GetSharpPresetsResponse;
    },
    async getNbaHitRatesV2(requestOptions?: GetNbaHitRatesV2Options): Promise<HitRatesV2Response> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const params = new URLSearchParams();
      if (requestOptions?.date) params.set("date", requestOptions.date);
      if (requestOptions?.market) params.set("market", requestOptions.market);
      if (requestOptions?.minHitRate != null) params.set("minHitRate", String(requestOptions.minHitRate));
      if (requestOptions?.limit != null) params.set("limit", String(requestOptions.limit));
      if (requestOptions?.offset != null) params.set("offset", String(requestOptions.offset));
      if (requestOptions?.search) params.set("search", requestOptions.search);
      if (requestOptions?.playerId != null) params.set("playerId", String(requestOptions.playerId));
      if (requestOptions?.sort) params.set("sort", requestOptions.sort);
      if (requestOptions?.sortDir) params.set("sortDir", requestOptions.sortDir);
      if (requestOptions?.hasOdds != null) params.set("hasOdds", String(requestOptions.hasOdds));
      if (requestOptions?.evFilter) params.set("evFilter", requestOptions.evFilter);

      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/nba/hit-rates/v2${query ? `?${query}` : ""}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch hit rates: ${response.status}`);
      }

      return (await response.json()) as HitRatesV2Response;
    },
    async getNbaPlayerBoxScores(requestOptions: GetNbaPlayerBoxScoresOptions): Promise<PlayerBoxScoresResponse> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const params = new URLSearchParams();
      params.set("playerId", String(requestOptions.playerId));
      if (requestOptions?.season) params.set("season", requestOptions.season);
      if (requestOptions?.limit != null) params.set("limit", String(requestOptions.limit));

      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/nba/player-box-scores?${query}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch player box scores: ${response.status}`);
      }

      return (await response.json()) as PlayerBoxScoresResponse;
    },
    async getPlayerGamesWithInjuries(requestOptions: GetPlayerGamesWithInjuriesOptions): Promise<PlayerGamesWithInjuriesResponse> {
      const headers: Record<string, string> = {};

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const params = new URLSearchParams();
      params.set("playerId", String(requestOptions.playerId));
      if (requestOptions?.season) params.set("season", requestOptions.season);

      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/nba/player-games-with-injuries?${query}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch player games with injuries: ${response.status}`);
      }

      return (await response.json()) as PlayerGamesWithInjuriesResponse;
    },
    async getPlayTypeMatchup(requestOptions: GetPlayTypeMatchupOptions): Promise<PlayTypeMatchupResponse> {
      const headers: Record<string, string> = {};
      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      const params = new URLSearchParams();
      params.set("playerId", String(requestOptions.playerId));
      params.set("opponentTeamId", String(requestOptions.opponentTeamId));
      if (requestOptions?.season) params.set("season", requestOptions.season);
      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/nba/play-type-matchup?${query}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch play type matchup: ${response.status}`);
      }
      return (await response.json()) as PlayTypeMatchupResponse;
    },
    async getShotZoneMatchup(requestOptions: GetShotZoneMatchupOptions): Promise<ShotZoneMatchupResponse> {
      const headers: Record<string, string> = {};
      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      const params = new URLSearchParams();
      params.set("playerId", String(requestOptions.playerId));
      params.set("opponentTeamId", String(requestOptions.opponentTeamId));
      if (requestOptions?.season) params.set("season", requestOptions.season);
      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/nba/shot-zone-matchup?${query}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch shot zone matchup: ${response.status}`);
      }
      return (await response.json()) as ShotZoneMatchupResponse;
    },
    async getTeamDefenseRanks(requestOptions: GetTeamDefenseRanksOptions): Promise<TeamDefenseRanksResponse> {
      const headers: Record<string, string> = {};
      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      const params = new URLSearchParams();
      params.set("opponentTeamId", String(requestOptions.opponentTeamId));
      if (requestOptions?.season) params.set("season", requestOptions.season);
      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/nba/team-defense-ranks?${query}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch team defense ranks: ${response.status}`);
      }
      return (await response.json()) as TeamDefenseRanksResponse;
    },
    async getTeamRoster(requestOptions: GetTeamRosterOptions): Promise<TeamRosterResponse> {
      const headers: Record<string, string> = {};
      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      const params = new URLSearchParams();
      params.set("teamId", String(requestOptions.teamId));
      if (requestOptions?.season) params.set("season", requestOptions.season);
      const query = params.toString();
      const response = await fetcher(`${baseUrl}/api/nba/team-roster?${query}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch team roster: ${response.status}`);
      }
      return (await response.json()) as TeamRosterResponse;
    },
    async getPlayerCorrelations(requestOptions: GetPlayerCorrelationsOptions): Promise<PlayerCorrelationsData> {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      const body: Record<string, unknown> = {
        playerId: requestOptions.playerId,
        market: requestOptions.market,
        line: requestOptions.line
      };
      if (requestOptions?.gameId != null) body.gameId = requestOptions.gameId;
      if (requestOptions?.lastNGames != null) body.lastNGames = requestOptions.lastNGames;
      if (requestOptions?.season) body.season = requestOptions.season;
      const response = await fetcher(`${baseUrl}/api/nba/player-correlations`, {
        method: "POST",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch player correlations: ${response.status}`);
      }
      return (await response.json()) as PlayerCorrelationsData;
    },
    async getPositionVsTeam(requestOptions: GetPositionVsTeamOptions): Promise<PositionVsTeamResponse> {
      const headers: Record<string, string> = {};
      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      const params = new URLSearchParams({
        position: requestOptions.position,
        opponentTeamId: String(requestOptions.opponentTeamId),
        market: requestOptions.market
      });
      if (requestOptions?.season) params.set("season", requestOptions.season);
      if (requestOptions?.limit) params.set("limit", String(requestOptions.limit));
      if (requestOptions?.minMinutes) params.set("minMinutes", String(requestOptions.minMinutes));
      const response = await fetcher(`${baseUrl}/api/nba/position-vs-team?${params}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch position vs team: ${response.status}`);
      }
      return (await response.json()) as PositionVsTeamResponse;
    },
    async getNbaHitRateOdds(requestOptions: GetNbaHitRateOddsOptions): Promise<HitRateOddsResponse> {
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }

      const response = await fetcher(`${baseUrl}/api/nba/hit-rates/odds`, {
        method: "POST",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers,
        body: JSON.stringify({ selections: requestOptions.selections })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch hit rate odds: ${response.status}`);
      }

      return (await response.json()) as HitRateOddsResponse;
    },
    async getCheatSheet(requestOptions?: GetCheatSheetOptions): Promise<CheatSheetResponse> {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      const body: Record<string, unknown> = {};
      if (requestOptions?.timeWindow) body.timeWindow = requestOptions.timeWindow;
      if (requestOptions?.minHitRate != null) body.minHitRate = requestOptions.minHitRate;
      if (requestOptions?.oddsFloor != null) body.oddsFloor = requestOptions.oddsFloor;
      if (requestOptions?.oddsCeiling != null) body.oddsCeiling = requestOptions.oddsCeiling;
      if (requestOptions?.markets?.length) body.markets = requestOptions.markets;
      if (requestOptions?.dates?.length) body.dates = requestOptions.dates;
      const response = await fetcher(`${baseUrl}/api/nba/cheat-sheet`, {
        method: "POST",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch cheat sheet: ${response.status}`);
      }
      return (await response.json()) as CheatSheetResponse;
    },
    async getInjuryImpact(requestOptions?: GetInjuryImpactOptions): Promise<InjuryImpactResponse> {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      const body: Record<string, unknown> = {};
      if (requestOptions?.dates?.length) body.dates = requestOptions.dates;
      if (requestOptions?.markets?.length) body.markets = requestOptions.markets;
      if (requestOptions?.minGames != null) body.minGames = requestOptions.minGames;
      if (requestOptions?.minTeammateMinutes != null) body.minTeammateMinutes = requestOptions.minTeammateMinutes;
      const response = await fetcher(`${baseUrl}/api/nba/injury-impact`, {
        method: "POST",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch injury impact: ${response.status}`);
      }
      return (await response.json()) as InjuryImpactResponse;
    },
    async getDvpRankings(requestOptions: GetDvpRankingsOptions): Promise<DvpRankingsResponse> {
      const headers: Record<string, string> = {};
      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      const params = new URLSearchParams();
      params.set("position", requestOptions.position);
      if (requestOptions?.season) params.set("season", requestOptions.season);
      const response = await fetcher(`${baseUrl}/api/nba/dvp-rankings?${params}`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch DVP rankings: ${response.status}`);
      }
      return (await response.json()) as DvpRankingsResponse;
    },
    async getHitRateMatrix(requestOptions?: GetHitRateMatrixOptions): Promise<HitRateMatrixResponse> {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      const body: Record<string, unknown> = {};
      if (requestOptions?.market) body.market = requestOptions.market;
      if (requestOptions?.gameDate) body.gameDate = requestOptions.gameDate;
      if (requestOptions?.timeWindow) body.timeWindow = requestOptions.timeWindow;
      if (requestOptions?.positions?.length) body.positions = requestOptions.positions;
      const response = await fetcher(`${baseUrl}/api/nba/hit-rate-matrix`, {
        method: "POST",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch hit rate matrix: ${response.status}`);
      }
      return (await response.json()) as HitRateMatrixResponse;
    },
    async getTripleDoubleSheet(requestOptions?: GetTripleDoubleSheetOptions): Promise<TripleDoubleSheetResponse> {
      const headers: Record<string, string> = {};
      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      const response = await fetcher(`${baseUrl}/api/dashboard/triple-double-sheet`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch triple double sheet: ${response.status}`);
      }
      return (await response.json()) as TripleDoubleSheetResponse;
    },
    async getDoubleDoubleSheet(requestOptions?: GetDoubleDoubleSheetOptions): Promise<DoubleDoubleSheetResponse> {
      const headers: Record<string, string> = {};
      if (requestOptions?.accessToken) {
        headers.Authorization = `Bearer ${requestOptions.accessToken}`;
      }
      const response = await fetcher(`${baseUrl}/api/dashboard/double-double-sheet`, {
        method: "GET",
        credentials: requestOptions?.accessToken ? "omit" : "include",
        headers
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch double double sheet: ${response.status}`);
      }
      return (await response.json()) as DoubleDoubleSheetResponse;
    }
  };
}
