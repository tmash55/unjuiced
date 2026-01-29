import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format NBA minutes played (e.g., "PT32M15S" -> "32:15" or just minutes number -> "32")
 */
export function formatNBATime(minutes: string | number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '-';
  
  // If it's a number, just return it as minutes
  if (typeof minutes === 'number') {
    return `${Math.floor(minutes)}`;
  }
  
  // If it's ISO duration format (PT32M15S)
  if (minutes.startsWith('PT')) {
    const match = minutes.match(/PT(\d+)M(\d+)?S?/);
    if (match) {
      const mins = match[1] || '0';
      const secs = match[2] || '00';
      return `${mins}:${secs.padStart(2, '0')}`;
    }
  }
  
  // Otherwise return as-is
  return String(minutes);
}

/**
 * Format game time/clock (e.g., "Q3 5:42" or quarter info)
 */
export function formatGameTime(gameTime: string | null | undefined): string {
  if (!gameTime) return '-';
  return gameTime;
}

/**
 * Check if a market is selected for a specific sport.
 * Supports both composite keys (nba:player_points) and plain keys (player_points).
 * 
 * @param selectedMarkets - Array of selected market keys (can be composite or plain)
 * @param sport - The sport to check (e.g., "nba", "nfl")
 * @param market - The market key to check (e.g., "player_points")
 * @returns true if the market is selected for this sport
 */
export function isMarketSelected(
  selectedMarkets: string[],
  sport: string,
  market: string
): boolean {
  // Empty array means "all markets selected"
  if (selectedMarkets.length === 0) return true;
  
  const compositeKey = `${sport}:${market}`;
  
  // Check if composite key is selected (sport-specific)
  if (selectedMarkets.includes(compositeKey)) return true;
  
  // Check if plain key is selected (backwards compat / global)
  if (selectedMarkets.includes(market)) return true;
  
  return false;
}
