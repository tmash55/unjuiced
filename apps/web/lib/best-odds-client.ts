import type { BestOddsDeal, BestOddsResponse, EnrichmentResponse } from './best-odds-schema';

/**
 * Fetch best odds deals
 * 
 * Note: Enrichment data (player names, teams, events) is now embedded in the response!
 * No need to call enrichBestOdds() anymore.
 */
export async function fetchBestOdds(params: {
  leagues?: string[];
  markets?: string[];
  books?: string[];
  scope?: 'all' | 'pregame' | 'live';
  sortBy?: 'improvement' | 'odds';
  limit?: number;
  offset?: number;
  minImprovement?: number;
  maxOdds?: number;
  minOdds?: number;
}): Promise<BestOddsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('sport', 'all'); // Currently only 'all' is supported
  
  if (params.leagues && params.leagues.length > 0) {
    searchParams.set('leagues', params.leagues.join(','));
  }
  if (params.markets && params.markets.length > 0) {
    searchParams.set('markets', params.markets.join(','));
  }
  if (params.books && params.books.length > 0) {
    searchParams.set('books', params.books.join(','));
  }
  if (params.scope) searchParams.set('scope', params.scope);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));
  if (params.minImprovement) searchParams.set('minImprovement', String(params.minImprovement));
  if (params.maxOdds !== undefined) searchParams.set('maxOdds', String(params.maxOdds));
  if (params.minOdds !== undefined) searchParams.set('minOdds', String(params.minOdds));
  
  const response = await fetch(`/api/best-odds?${searchParams.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch best odds: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * @deprecated enrichBestOdds() is NO LONGER NEEDED!
 * 
 * Enrichment data (player names, teams, events) is now embedded directly
 * in the deals returned from the API. Just use fetchBestOdds() and the
 * data will already include playerName, team, position, homeTeam, etc.
 * 
 * This function is kept for backward compatibility but does nothing.
 */
export async function enrichBestOdds(deals: BestOddsDeal[]): Promise<BestOddsDeal[]> {
  console.warn('[enrichBestOdds] This function is deprecated and does nothing. Enrichment is now embedded in the API response.');
  return deals;
}

