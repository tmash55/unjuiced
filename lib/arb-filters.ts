
import type { ArbRow } from "@/lib/arb-schema";

export type MarketType = 'player' | 'game';

export type ArbPrefs = {
  selectedBooks: string[];
  selectedSports: string[];
  selectedLeagues: string[];
  selectedMarketTypes: MarketType[];
  minArb: number;
  maxArb: number;
  searchQuery: string;
  minLiquidity?: number;
};

// Determine if a market is a player prop or game prop
export function getMarketType(market: string): MarketType {
  const mkt = market.toLowerCase();
  
  // Game prop patterns - check these FIRST to avoid false positives
  const gamePatterns = [
    'spread',
    'handicap',
    'moneyline',
    'money_line',
    'h2h',
    'head_to_head',
    'total',
    'over_under',
    'puck_line',
    'run_line',
    'race_to',
    'first_to',
    'btts',
    'both_teams',
    'odd_even',
    'team_total',
    'game_total',
    'quarter',
    'half',
    'period',
    'inning',
  ];
  
  // If it matches a game pattern, it's a game prop
  if (gamePatterns.some(pattern => mkt.includes(pattern))) {
    return 'game';
  }
  
  // Player prop patterns - more specific to avoid false positives
  const playerPatterns = [
    'player_',
    '_player',
    'points',
    'assists',
    'rebounds',
    'steals',
    'blocks',
    'turnovers',
    'three_pointers',
    'threes_made',
    '3pt_made',
    '3pm',
    'passing_yards',
    'rushing_yards',
    'receiving_yards',
    'touchdown',
    'completions',
    'interceptions',
    'receptions',
    'goals_',
    '_goals',
    'anytime_goal',
    'shots_on',
    'sog',
    'saves',
    'hits',
    'strikeouts',
    'home_runs',
    'bases',
    'pitcher_',
    'batter_',
    'anytime_scorer',
    'first_scorer',
    'last_scorer',
    'pts_reb_ast',
    'pts_reb',
    'pts_ast',
    'reb_ast',
    'double_double',
    'triple_double',
    'fantasy',
    'fpts',
  ];
  
  // Check if it matches any player pattern
  if (playerPatterns.some(pattern => mkt.includes(pattern))) {
    return 'player';
  }
  
  // Default to game prop for unknown markets
  return 'game';
}

export function matchesArbRow(row: ArbRow, prefs: ArbPrefs): boolean {
  const pct = (row.roi_bps ?? 0) / 100;
  if (pct < prefs.minArb || pct > prefs.maxArb) return false;

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const books = new Set(prefs.selectedBooks.map((b) => normalize(b)));
  const overOk = books.has(normalize(String(row.o?.bk || "")));
  const underOk = books.has(normalize(String(row.u?.bk || "")));
  if (!(overOk && underOk)) return false;

  // Filter by min liquidity - if either leg has a known max below threshold, exclude
  const minLiq = prefs.minLiquidity ?? 0;
  if (minLiq > 0) {
    const overMax = row.o?.max;
    const underMax = row.u?.max;
    if (overMax != null && overMax < minLiq) return false;
    if (underMax != null && underMax < minLiq) return false;
  }

  // Filter by market types (player props vs game props)
  if (prefs.selectedMarketTypes && prefs.selectedMarketTypes.length > 0 && prefs.selectedMarketTypes.length < 2) {
    const marketType = getMarketType(row.mkt || '');
    if (!prefs.selectedMarketTypes.includes(marketType)) return false;
  }

  // Filter by sports
  if (prefs.selectedSports.length > 0 && row.lg?.sport) {
    const sport = normalize(row.lg.sport);
    const selectedSportsNormalized = prefs.selectedSports.map((s) => normalize(s));
    if (!selectedSportsNormalized.includes(sport)) return false;
  }

  // Filter by leagues
  if (prefs.selectedLeagues.length > 0 && row.lg?.id) {
    const league = normalize(row.lg.id);
    const selectedLeaguesNormalized = prefs.selectedLeagues.map((l) => normalize(l));
    if (!selectedLeaguesNormalized.includes(league)) return false;
  }

  const q = prefs.searchQuery?.trim().toLowerCase();
  if (!q) return true;

  const hay = [
    row.o?.name,
    row.u?.name,
    row.mkt,
    row.ev?.home?.name,
    row.ev?.home?.abbr,
    row.ev?.away?.name,
    row.ev?.away?.abbr,
    row.lg?.name,
    row.lg?.sport,
    row.lg?.id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(q);
}
