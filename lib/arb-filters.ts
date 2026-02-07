import type { ArbRow } from "@/lib/arb-schema";
import { formatMarketLabel } from "@/lib/data/markets";
import { isMarketSelected } from "@/lib/utils";

export type MarketType = 'player' | 'game';
export type ArbMarketOption = {
  key: string;
  label: string;
  sports: string[];
};

export type ArbPrefs = {
  selectedBooks: string[];
  selectedSports: string[];
  selectedLeagues: string[];
  selectedMarketTypes: MarketType[];
  selectedMarkets: string[];
  minArb: number;
  maxArb: number;
  searchQuery: string;
  minLiquidity?: number;
};

const SPORT_NAME_TO_KEY: Record<string, string> = {
  football: "football",
  basketball: "basketball",
  baseball: "baseball",
  hockey: "hockey",
  soccer: "soccer",
};

export function normalizeArbMarketKey(market: string): string {
  return (market || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_");
}

export function getArbSportKey(row: ArbRow): string {
  const leagueId = String(row.lg?.id || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  if (leagueId) return leagueId;

  const sport = String(row.lg?.sport || "")
    .toLowerCase()
    .trim();
  if (!sport) return "other";

  return SPORT_NAME_TO_KEY[sport] || sport.replace(/\s+/g, "_");
}

function fallbackMarketLabel(market: string): string {
  return market
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getArbMarketLabel(market: string): string {
  const normalized = normalizeArbMarketKey(market);
  const fromCatalog = formatMarketLabel(normalized);
  if (fromCatalog && fromCatalog.toLowerCase() !== normalized) return fromCatalog;
  return fallbackMarketLabel(normalized);
}

export function buildArbMarketOptions(rows: ArbRow[]): ArbMarketOption[] {
  const byMarket = new Map<string, { label: string; sports: Set<string> }>();

  for (const row of rows) {
    const marketKey = normalizeArbMarketKey(row.mkt || "");
    if (!marketKey) continue;

    const sportKey = getArbSportKey(row);
    const existing = byMarket.get(marketKey);

    if (existing) {
      existing.sports.add(sportKey);
      continue;
    }

    byMarket.set(marketKey, {
      label: getArbMarketLabel(marketKey),
      sports: new Set([sportKey]),
    });
  }

  return Array.from(byMarket.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      sports: Array.from(value.sports).sort(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

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
  
  // Sportsbooks filter: empty array means ALL books are included
  if (prefs.selectedBooks.length > 0) {
    const books = new Set(prefs.selectedBooks.map((b) => normalize(b)));
    const overOk = books.has(normalize(String(row.o?.bk || "")));
    const underOk = books.has(normalize(String(row.u?.bk || "")));
    if (!(overOk && underOk)) return false;
  }

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

  // Filter by specific markets per sport/league.
  if (prefs.selectedMarkets && prefs.selectedMarkets.length > 0) {
    const sport = getArbSportKey(row);
    const market = normalizeArbMarketKey(row.mkt || "");
    if (!isMarketSelected(prefs.selectedMarkets, sport, market)) return false;
  }

  // Filter by leagues only (not sports) - leagues are more granular
  // Empty array means "all leagues selected", non-empty means "only these leagues"
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
