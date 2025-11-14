/**
 * Best Odds Feature - Type Definitions
 * 
 * This schema defines the structure for the "Line Shopping" / "Best Odds Comparison" feature
 * that finds the best available prices across sportsbooks for the same line.
 */

export interface BestOddsDeal {
  // Core identifiers
  key: string                    // Full key: {sport}:evt_{eid}:{ent}:{mkt}:{ln}:{side}
  sport: 'nfl' | 'nba' | 'nhl' | 'ncaaf' | 'ncaab' | 'mlb' | 'wnba'
  eid: string                    // Event ID
  ent: string                    // Entity (player ID or 'game')
  mkt: string                    // Market code (e.g., 'passing_yards', 'points')
  ln: number                     // Line value
  side: 'o' | 'u' | 'a' | 'h'   // Over/under OR Away/home (for spreads/moneylines)
  
  // Odds data
  bestBook: string              // Book with best price
  bestPrice: number             // Best American odds (e.g., -110, +150)
  bestLink: string              // Deep link to book
  numBooks: number              // Number of books offering this line
  avgPrice: number              // Average odds across all books
  priceImprovement: number      // % improvement over average
  
  // All available books for this line
  allBooks: Array<{
    book: string
    price: number
    link: string
  }>
  
  scope: 'pregame' | 'live'
  lastUpdated: number           // Unix timestamp
  
  // Enriched metadata (NOW EMBEDDED IN BACKEND!)
  playerName?: string           // "Patrick Mahomes"
  player_name?: string          // Alternative snake_case field name
  team?: string                 // "KC"
  position?: string             // "QB"
  homeTeam?: string             // "KC"
  home_team?: string            // Alternative snake_case field name
  awayTeam?: string             // "LV"
  away_team?: string            // Alternative snake_case field name
  startTime?: string            // ISO timestamp (camelCase)
  game_start?: string           // ISO timestamp (snake_case from API)
  sid?: string                  // For drilldown to full ladder (optional)
  _isTeaser?: boolean           // Flag for teaser rows (free user preview)
}

export interface BestOddsResponse {
  version: number               // Incremental version for cache busting
  total: number                 // Total number of deals returned
  deals: BestOddsDeal[]
  hasMore?: boolean            // For pagination
  premiumCount?: number        // Number of premium deals hidden (free users only)
}

export interface BestOddsFilters {
  sport?: string                // Currently only 'all' is supported (client-side filtering)
  leagues?: string[]           // Filter by specific leagues: ['nba', 'nfl', 'ncaaf', 'ncaab', 'nhl', 'mlb', 'wnba']
  markets?: string[]           // Filter by specific markets: ['player_points', 'passing_yards', 'pra']
  books?: string[]             // Filter by sportsbooks: ['draftkings', 'fanduel', 'mgm']
  scope?: 'all' | 'pregame' | 'live'
  sortBy?: 'improvement' | 'odds'  // Sort by improvement % or raw odds value
  limit?: number
  offset?: number
  minImprovement?: number      // Filter deals with improvement >= this %
  maxOdds?: number            // Filter deals with odds <= this value
  minOdds?: number            // Filter deals with odds >= this value
}

/**
 * User preferences for Best Odds filtering
 * Saved to database for authenticated users
 */
export interface BestOddsPrefs {
  selectedBooks: string[]       // User's preferred sportsbooks (empty = all)
  selectedSports: string[]      // User's preferred sports (empty = all)
  selectedLeagues: string[]     // User's preferred leagues (empty = all)
  selectedMarkets: string[]     // User's preferred markets (empty = all)
  marketLines: Record<string, number[]>  // Line values per market (e.g., {"touchdowns": [0.5, 1.5, 2.5]}). Empty object or empty array for a market = all lines
  minImprovement: number        // Minimum improvement % to show
  maxOdds?: number             // Maximum odds value
  minOdds?: number             // Minimum odds value
  scope: 'all' | 'pregame' | 'live'
  sortBy: 'improvement' | 'odds'
  searchQuery: string
  hideCollegePlayerProps: boolean  // Hide NCAAF/NCAAB player props (for restricted states)
}

/**
 * SSE Event types for real-time updates
 */
export interface BestOddsSSEHelloEvent {
  sport: string  // Currently only 'all' is supported
  isPro: boolean
}

export interface BestOddsSSEUpdateEvent {
  version: number
  deals: BestOddsDeal[]
  action: 'add' | 'update' | 'remove'
}

/**
 * @deprecated Enrichment API types - NO LONGER NEEDED!
 * Enrichment data is now embedded in the deals from the backend.
 * Keeping these types for backward compatibility but they should not be used.
 */
export interface EnrichmentPlayerRequest {
  sport: 'nfl' | 'nba' | 'nhl' | 'ncaaf' | 'ncaab' | 'mlb' | 'wnba'
  ent: string  // e.g., "pid:00-0038809"
}

export interface EnrichmentEventRequest {
  sport: 'nfl' | 'nba' | 'nhl' | 'ncaaf' | 'ncaab' | 'mlb' | 'wnba'
  eid: string  // e.g., "f2617c37-9050-5fc6-982e-6476a4ec5da0"
}

export interface EnrichmentRequest {
  players: EnrichmentPlayerRequest[]
  events: EnrichmentEventRequest[]
}

export interface EnrichedPlayerData {
  name: string
  team: string
  position: string
}

export interface EnrichedEventData {
  home: string      // Team abbreviation
  away: string      // Team abbreviation
  start: string     // ISO timestamp
  live: boolean
}

export interface EnrichmentResponse {
  players: {
    [key: string]: EnrichedPlayerData  // Key format: "{sport}:{ent}"
  }
  events: {
    [key: string]: EnrichedEventData   // Key format: "{sport}:{eid}"
  }
}

