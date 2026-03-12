export type UserPlan = "anonymous" | "free" | "scout" | "sharp" | "elite";

export type EntitlementSource = "subscription" | "trial" | "none" | "grant";

export interface TrialInfo {
  trial_used?: boolean;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  is_trial_active?: boolean;
}

export interface Entitlements {
  plan: UserPlan | string;
  authenticated: boolean;
  entitlement_source?: EntitlementSource | string;
  trial?: TrialInfo | null;
}

export function normalizePlanName(plan: string | undefined): UserPlan {
  if (plan === "hit_rate") return "sharp";
  if (plan === "pro") return "elite";
  if (plan === "admin") return "elite";
  if (plan === "edge") return "elite";
  if (plan === "unlimited") return "elite";

  if (plan === "scout" || plan === "sharp" || plan === "elite" || plan === "free" || plan === "anonymous") {
    return plan;
  }

  return "free";
}

const PLAN_ORDER: Record<UserPlan, number> = {
  anonymous: 0,
  free: 1,
  scout: 2,
  sharp: 3,
  elite: 4
};

export function hasPlanAccess(plan: string | undefined, minimumPlan: UserPlan): boolean {
  const normalized = normalizePlanName(plan);
  return PLAN_ORDER[normalized] >= PLAN_ORDER[minimumPlan];
}

export type ArbMode = "all" | "live" | "pregame";

export interface ArbLeg {
  bk: string;
  name?: string;
  od: number;
  id?: string;
  u?: string;
  m?: string | null;
  max?: number | null;
}

export interface ArbLeague {
  id: string;
  name: string;
  sport: string;
}

export interface ArbEvent {
  dt: string;
  live: boolean;
  home: { abbr?: string; name?: string };
  away: { abbr?: string; name?: string };
}

export interface ArbRow {
  eid: string;
  mkt: string;
  ln: number;
  roi_bps: number;
  ts: number;
  max_bet?: number | null;
  lg?: ArbLeague;
  ev: ArbEvent;
  o: ArbLeg;
  u: ArbLeg;
}

export interface ArbitrageLimits {
  maxResults: number;
  applied: number;
  canFilter: boolean;
  canExport: boolean;
}

export interface GetArbsResponse {
  format: number;
  v: number;
  mode: ArbMode;
  ids: string[];
  rows: ArbRow[];
  plan: UserPlan | string;
  limits: ArbitrageLimits;
  filteredCount?: number;
  filteredReason?: string;
}

export type DevigMethod = "power" | "multiplicative" | "additive" | "probit";

export type SharpPreset =
  | "pinnacle"
  | "circa"
  | "betonline"
  | "prophetx"
  | "pinnacle_circa"
  | "hardrock_thescore"
  | "market_average"
  | "draftkings"
  | "fanduel"
  | "betmgm"
  | "caesars"
  | "hardrock"
  | "bet365"
  | "thescore"
  | "ballybet"
  | "betrivers"
  | "fanatics"
  | "polymarket"
  | "kalshi"
  | "novig"
  | "custom";

export type EVMode = "pregame" | "live" | "all";

export interface BookLimits {
  max: number;
}

export interface BookOffer {
  bookId: string;
  bookName: string;
  price: number;
  priceDecimal: number;
  link?: string | null;
  mobileLink?: string | null;
  sgp?: string | null;
  limits?: BookLimits | null;
  updated?: string;
  evPercent?: number;
  isSharpRef?: boolean;
}

export interface SharpReference {
  preset: SharpPreset;
  overOdds: number;
  underOdds: number;
  overDecimal: number;
  underDecimal: number;
  source: string;
  blendedFrom?: string[];
}

export interface DevigResult {
  method: DevigMethod;
  fairProbOver: number;
  fairProbUnder: number;
  margin: number;
  success: boolean;
  error?: string;
}

export interface MultiDevigResult {
  power?: DevigResult;
  multiplicative?: DevigResult;
  additive?: DevigResult;
  probit?: DevigResult;
}

export interface EVCalculation {
  method: DevigMethod;
  fairProb: number;
  bookProb: number;
  bookDecimal: number;
  ev: number;
  evPercent: number;
  edge: number;
  kellyFraction?: number;
}

export interface MultiEVCalculation {
  power?: EVCalculation;
  multiplicative?: EVCalculation;
  additive?: EVCalculation;
  probit?: EVCalculation;
  evWorst: number;
  evBest: number;
  evDisplay: number;
  kellyWorst?: number;
}

export interface PositiveEVOpportunity {
  id: string;
  sport: string;
  eventId: string;
  market: string;
  marketDisplay: string;
  homeTeam?: string;
  awayTeam?: string;
  startTime?: string;
  playerId?: string;
  playerName?: string;
  playerTeam?: string;
  playerPosition?: string;
  line: number;
  side: "over" | "under" | "yes" | "no";
  sharpPreset: SharpPreset;
  sharpReference: SharpReference;
  devigResults: MultiDevigResult;
  book: BookOffer;
  evCalculations: MultiEVCalculation;
  allBooks: BookOffer[];
  oppositeBooks?: BookOffer[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomSharpConfig {
  books: string[];
  weights: Record<string, number> | null;
}

export interface PositiveEVResponse {
  opportunities: PositiveEVOpportunity[];
  meta: {
    totalFound: number;
    returned: number;
    sharpPreset: SharpPreset;
    customSharpConfig?: CustomSharpConfig;
    devigMethods: DevigMethod[];
    minEV: number;
    minBooksPerSide?: number;
    mode: EVMode;
    timestamp: string;
  };
}

export type OpportunitySport =
  | "nba"
  | "nfl"
  | "nhl"
  | "ncaaf"
  | "ncaab"
  | "mlb"
  | "ncaabaseball"
  | "wnba"
  | "soccer_epl"
  | "soccer_laliga"
  | "soccer_mls"
  | "soccer_ucl"
  | "soccer_uel"
  | "tennis_atp"
  | "tennis_challenger"
  | "tennis_itf_men"
  | "tennis_itf_women"
  | "tennis_utr_men"
  | "tennis_utr_women"
  | "tennis_wta"
  | "ufc";

export type OpportunitySide = "over" | "under" | "yes" | "no";
export type OpportunityDevigMethod = "proper" | "estimated";
export type OpportunityDevigSource = "sharp_book" | "sharp_blend" | "market_average";

export interface OpportunityBookOdds {
  book: string;
  price: number;
  priceFormatted: string;
  decimal: number;
  link: string | null;
  mobileLink: string | null;
  sgp: string | null;
  limits: BookLimits | null;
  includedInAverage?: boolean;
  averageExclusionReason?: string | null;
  oddId?: string;
}

export interface OpportunityMarketCoverage {
  nBooksOver: number;
  nBooksUnder: number;
  twoWayDevigReady: boolean;
}

export interface OpportunityDevigInfo {
  source: OpportunityDevigSource;
  aggregation: "single" | "mean" | "weighted";
  overBooks: string[];
  underBooks: string[];
}

export interface OpportunityOppositeSide {
  side: OpportunitySide;
  sharpPrice: string | null;
  sharpDecimal: number | null;
  bestBook: string | null;
  bestPrice: string | null;
  bestDecimal: number | null;
  allBooks: OpportunityBookOdds[];
}

export interface Opportunity {
  id: string;
  sport: OpportunitySport;
  eventId: string;
  player: string;
  playerId: string | null;
  team: string | null;
  position: string | null;
  market: string;
  marketDisplay: string;
  line: number;
  side: OpportunitySide;
  homeTeam: string;
  awayTeam: string;
  gameStart: string;
  timestamp: number;
  bestBook: string;
  bestPrice: string;
  bestDecimal: number;
  bestLink: string | null;
  bestMobileLink: string | null;
  nBooks: number;
  allBooks: OpportunityBookOdds[];
  sharpPrice: string | null;
  sharpDecimal: number | null;
  sharpBooks: string[];
  blendComplete: boolean;
  blendWeight: number;
  avgBookCount: number;
  edge: number | null;
  edgePct: number | null;
  bestImplied: number | null;
  sharpImplied: number | null;
  trueProbability: number | null;
  fairDecimal: number | null;
  fairAmerican: string | null;
  impliedEdge: number | null;
  ev: number | null;
  evPct: number | null;
  kellyFraction: number | null;
  devigMethod: OpportunityDevigMethod | null;
  overround: number | null;
  marketCoverage: OpportunityMarketCoverage | null;
  devigInfo: OpportunityDevigInfo | null;
  oppositeSide: OpportunityOppositeSide | null;
  filterId: string | null;
  filterName: string | null;
  filterIcon: string | null;
  filterColor?: string | null;
}

export interface OpportunitiesResponse {
  opportunities: Opportunity[];
  count: number;
  totalScanned: number;
  totalAfterFilters: number;
  timingMs: number;
}

export interface SharpPresetListItem {
  id: string;
  name: string;
  label?: string;
  description: string;
  books: Array<{ bookId: string; weight: number }>;
  recommended?: {
    sports?: string[];
    marketTypes?: Array<"props" | "game_lines" | "futures">;
  };
  tier: "free" | "pro";
}

export interface GetSharpPresetsResponse {
  presets: SharpPresetListItem[];
  count: number;
}

export interface HitRateBestOdds {
  book: string;
  price: number;
  updated_at: number;
}

export interface HitRateMatchup {
  matchup_rank: number | null;
  rank_label: string | null;
  avg_allowed: number | null;
  matchup_quality: "favorable" | "neutral" | "unfavorable" | null;
}

export interface HitRateProfileV2 {
  id: string;
  player_id: number;
  player_name: string | null;
  team_name?: string | null;
  team_abbr: string | null;
  opponent_team_name?: string | null;
  opponent_team_abbr: string | null;
  event_id?: string | null;
  game_id?: string | null;
  odds_selection_id?: string | null;
  sel_key?: string | null;
  market: string;
  line: number | null;
  game_date: string | null;
  game_status: string | null;
  home_away: string | null;
  last_5_pct: number | null;
  last_10_pct: number | null;
  last_20_pct: number | null;
  season_pct: number | null;
  hit_streak: number | null;
  best_odds?: HitRateBestOdds | null;
  books?: number;
  matchup?: HitRateMatchup | null;
  nba_players_hr?: {
    nba_player_id: number;
    name: string | null;
    position?: string | null;
    depth_chart_pos?: string | null;
    jersey_number?: number | null;
  } | null;
  ev_data?: {
    ev_pct: number;
    fair_odds: number;
    fair_prob: number;
    sharp_over: number;
    sharp_under: number;
    best_ev_book: string;
    best_ev_odds: number;
    edge_class: "strong" | "moderate" | "slim" | "neutral" | "negative";
  } | null;
}

export type HitRateSortField =
  | "line"
  | "l5Avg"
  | "l10Avg"
  | "seasonAvg"
  | "streak"
  | "l5Pct"
  | "l10Pct"
  | "l20Pct"
  | "seasonPct"
  | "h2hPct"
  | "matchupRank"
  | "edge"
  | "ev";

export interface HitRatesV2Meta {
  date: string;
  availableDates: string[];
  market: string | null;
  minHitRate: number | null;
  limit: number;
  offset: number;
  cacheHit?: boolean;
  responseTime?: number;
  hasMore?: boolean;
}

export interface HitRatesV2Response {
  data: HitRateProfileV2[];
  count: number;
  meta: HitRatesV2Meta;
}

export interface PlayerBoxScoreGame {
  gameId: string;
  date: string;
  seasonType: string;
  homeAway: "H" | "A";
  opponentTeamId: number;
  opponentAbbr: string;
  opponentName: string;
  result: "W" | "L";
  margin: number;
  teamScore: number;
  opponentScore: number;
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fouls: number;
  fgm: number;
  fga: number;
  fgPct: number;
  fg3m: number;
  fg3a: number;
  fg3Pct: number;
  ftm: number;
  fta: number;
  ftPct: number;
  oreb: number;
  dreb: number;
  plusMinus: number;
  usagePct: number;
  tsPct: number;
  efgPct: number;
  offRating: number;
  defRating: number;
  netRating: number;
  pace: number;
  pie: number;
  passes: number;
  potentialReb: number;
  pra: number;
  pr: number;
  pa: number;
  ra: number;
  bs: number;
}

export interface PlayerBoxScoresResponse {
  player: {
    playerId: number;
    name: string;
    firstName: string;
    lastName: string;
    position: string;
    jerseyNumber: number | null;
    teamId: number;
    teamAbbr: string;
    teamName: string;
    injuryStatus: string | null;
    injuryNotes: string | null;
  } | null;
  season: string;
  seasonSummary: {
    gamesPlayed: number;
    record: string;
    avgPoints: number;
    avgRebounds: number;
    avgAssists: number;
    avgSteals: number;
    avgBlocks: number;
    avgThrees: number;
    avgMinutes: number;
    avgPra: number;
    avgUsage: number;
    fgPct: number;
    fg3Pct: number;
    ftPct: number;
  } | null;
  games: PlayerBoxScoreGame[];
}
