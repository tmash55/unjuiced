import type { BestOddsDeal, BestOddsPrefs } from "@/lib/best-odds-schema";

/**
 * Default preferences for Best Odds filtering
 * All filters start empty (= show all)
 */
export const DEFAULT_BEST_ODDS_PREFS: BestOddsPrefs = {
  selectedBooks: [],
  selectedSports: [],
  selectedLeagues: [],
  selectedMarkets: [],
  marketLines: {},
  minImprovement: 0,
  maxOdds: undefined,
  minOdds: undefined,
  scope: 'pregame',
  sortBy: 'improvement',
  searchQuery: '',
  hideCollegePlayerProps: false,
  comparisonMode: 'average',
  comparisonBook: null,
  showHidden: false,
  columnOrder: ['edge', 'league', 'time', 'selection', 'line', 'market', 'best-book', 'reference', 'fair', 'stake', 'filter', 'action'],
  minLiquidity: 0,
};

/**
 * Normalize strings for comparison (lowercase, alphanumeric only)
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/**
 * Normalize sportsbook names for comparison
 * Maps common variations to canonical IDs (with hyphens as in sportsbooks.ts)
 */
export function normalizeSportsbookName(name: string): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Common variations mapping (matches sportsbooks.ts IDs which use hyphens)
  const bookMappings: Record<string, string> = {
    'hardrockbet': 'hard-rock',
    'hardrock': 'hard-rock',
    'hardrockindiana': 'hard-rock-indiana',
    'ballybet': 'bally-bet',
    'sportsinteraction': 'sports-interaction',
    'espnbet': 'espn',
    'espn': 'espn',
    'betmgm': 'betmgm',
    'mgm': 'betmgm',
    'draftkings': 'draftkings',
    'fanduel': 'fanduel',
    'caesars': 'caesars',
    'betrivers': 'betrivers',
    'pointsbet': 'pointsbet',
    'wynnbet': 'wynnbet',
    'unibet': 'unibet',
    'betparx': 'betparx',
    'betonline': 'betonline',
    'bovada': 'bovada',
    'pinnacle': 'pinnacle',
    'circa': 'circa',
    'superbook': 'superbook',
    'williamhill': 'williamhill',
    'sisportsbook': 'sisportsbook',
    'thescore': 'thescore',
    'fanatics': 'fanatics',
    'fliff': 'fliff',
    'novig': 'novig',
    'bwin': 'bwin',
    'prophetx': 'prophetx',
    'bet365': 'bet365',
    'bodog': 'bodog',
  };
  
  return bookMappings[normalized] || normalized;
}

/**
 * Check if a deal matches the user's filter preferences
 */
export function matchesBestOddsDeal(deal: BestOddsDeal, prefs: BestOddsPrefs): boolean {
  // TEMPORARY: Filter out moneyline, spread, and specific player prop markets
  const excludedMarkets = [
    // Moneylines
    'moneyline',
    'h2h',
    '1q_moneyline',
    '2q_moneyline',
    '3q_moneyline',
    '4q_moneyline',
    '1h_moneyline',
    '2h_moneyline',
    'first_half_moneyline',
    'second_half_moneyline',
    '1st_quarter_moneyline',
    '2nd_quarter_moneyline',
    '3rd_quarter_moneyline',
    '4th_quarter_moneyline',
    // Spreads
    'spread',
    'handicap',
    'point_spread',
    'puck_line',
    'run_line',
    '1q_spread',
    '2q_spread',
    '3q_spread',
    '4q_spread',
    '1h_spread',
    '2h_spread',
    'first_half_spread',
    'second_half_spread',
    '1st_quarter_spread',
    '2nd_quarter_spread',
    '3rd_quarter_spread',
    '4th_quarter_spread',
    // Specialty props to hide (backend issue)
    'triple_double',
    'triple-doubles',
    'tripledouble',
    'player_triple_double',
  ];
  
  const marketLower = deal.mkt.toLowerCase();
  if (excludedMarkets.some(m => marketLower.includes(m))) {
    return false;
  }

  // Filter by improvement %
  const improvement = Number(deal.priceImprovement || 0);
  if (improvement < prefs.minImprovement) return false;

  // Filter by odds range
  if (prefs.maxOdds !== undefined && deal.bestPrice > prefs.maxOdds) return false;
  if (prefs.minOdds !== undefined && deal.bestPrice < prefs.minOdds) return false;

  // Filter by market-specific lines (e.g., {"touchdowns": [0.5, 1.5, 2.5]})
  // Empty object or empty array for a market = all lines for that market
  const marketKey = normalize(deal.mkt);
  const selectedLinesForMarket = prefs.marketLines[marketKey];
  if (selectedLinesForMarket && selectedLinesForMarket.length > 0) {
    if (!selectedLinesForMarket.includes(deal.ln)) return false;
  }

  // Filter by scope (pregame/live)
  if (prefs.scope !== 'all' && deal.scope !== prefs.scope) return false;

  // Filter by sportsbooks
  // Empty array = all selected (show all)
  // Array with IDs = those books are DESELECTED (hide them)
  if (prefs.selectedBooks.length > 0) {
    const normalizedDeselectedBooks = prefs.selectedBooks.map(b => normalizeSportsbookName(b));
    const booksWithBestPrice = deal.allBooks?.filter(book => book.price === deal.bestPrice) || [];
    const normalizedBestBooks =
      booksWithBestPrice.length > 0
        ? booksWithBestPrice.map(book => normalizeSportsbookName(book.book))
        : [normalizeSportsbookName(deal.bestBook)];
    
    const allDeselected = normalizedBestBooks.every(book =>
      normalizedDeselectedBooks.includes(book)
    );

    if (allDeselected) {
      return false;
    }
  }

  // Filter by leagues (sport)
  if (prefs.selectedLeagues.length > 0) {
    const normalizedSelectedLeagues = prefs.selectedLeagues.map(l => normalize(l));
    if (!normalizedSelectedLeagues.includes(normalize(deal.sport))) return false;
  }

  // Filter by markets
  if (prefs.selectedMarkets.length > 0) {
    const normalizedSelectedMarkets = prefs.selectedMarkets.map(m => normalize(m));
    if (!normalizedSelectedMarkets.includes(normalize(deal.mkt))) return false;
  }

  // Filter by search query
  const q = prefs.searchQuery?.trim().toLowerCase();
  if (q) {
    const hay = [
      deal.playerName,
      deal.team,
      deal.position,
      deal.homeTeam,
      deal.awayTeam,
      deal.mkt,
      deal.sport,
      deal.bestBook,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!hay.includes(q)) return false;
  }

  return true;
}

/**
 * Sort deals by improvement % (descending)
 */
export function sortDealsByImprovement(deals: BestOddsDeal[]): BestOddsDeal[] {
  return [...deals].sort((a, b) => {
    const impA = Number(a.priceImprovement || 0);
    const impB = Number(b.priceImprovement || 0);
    return impB - impA; // Descending (best first)
  });
}

/**
 * Sort deals by odds value (best odds first)
 */
export function sortDealsByOdds(deals: BestOddsDeal[]): BestOddsDeal[] {
  return [...deals].sort((a, b) => {
    return b.bestPrice - a.bestPrice; // Descending (higher odds first)
  });
}

/**
 * Apply sorting based on preferences
 */
export function sortDeals(deals: BestOddsDeal[], sortBy: 'improvement' | 'odds'): BestOddsDeal[] {
  if (sortBy === 'odds') {
    return sortDealsByOdds(deals);
  }
  return sortDealsByImprovement(deals);
}

/**
 * Get unique leagues from deals
 */
export function getUniqueLeagues(deals: BestOddsDeal[]): string[] {
  const leagues = new Set<string>();
  deals.forEach(d => leagues.add(d.sport));
  return Array.from(leagues).sort();
}

/**
 * Get unique markets from deals
 */
export function getUniqueMarkets(deals: BestOddsDeal[]): string[] {
  const markets = new Set<string>();
  deals.forEach(d => markets.add(d.mkt));
  return Array.from(markets).sort();
}

/**
 * Get unique sportsbooks from deals
 */
export function getUniqueSportsbooks(deals: BestOddsDeal[]): string[] {
  const books = new Set<string>();
  deals.forEach(d => {
    d.allBooks.forEach(b => books.add(b.book));
  });
  return Array.from(books).sort();
}

/**
 * Group markets by sport type for organized filtering
 */
export function groupMarketsBySport(markets: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {
    basketball: [],
    football: [],
    hockey: [],
    baseball: [],
  };

  markets.forEach(market => {
    const m = market.toLowerCase();
    
    // Check for explicit sport markers first (highest priority)
    if (m.includes('hockey')) {
      groups.hockey.push(market);
    }
    // Hockey-specific markets (check before basketball to avoid "block" overlap)
    // "shot" catches "Blocked Shots" before basketball's "block" check
    else if (m.includes('goal') || m.includes('save') || m.includes('shot') || 
             m.includes('power_play') || m.includes('puck')) {
      groups.hockey.push(market);
    }
    // Baseball markets (check before football to catch pitcher/batter stats)
    else if (m.includes('hit') || m.includes('rbi') || m.includes('strikeout') ||
             m.includes('base') || m.includes('home_run') || m.includes('walk') ||
             m.includes('out') || m.includes('pitch') || m.includes('batter') ||
             m.includes('pitcher') || m.includes('earned')) {
      groups.baseball.push(market);
    }
    // Basketball markets
    else if (m.includes('point') || m.includes('rebound') || m.includes('assist') || 
             m.includes('three') || m.includes('block') || m.includes('steal') ||
             m.includes('pra') || m.includes('double') || m.includes('turnover')) {
      groups.basketball.push(market);
    }
    // Football markets
    else if (m.includes('pass') || m.includes('rush') || m.includes('reception') || 
             m.includes('receiving') || m.includes('touchdown') || m.includes('yard') ||
             m.includes('sack') || m.includes('interception')) {
      groups.football.push(market);
    }
    // Default to football if unclear
    else {
      groups.football.push(market);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}

