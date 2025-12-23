/**
 * Filter Presets - Custom user-defined filters for the Edge Finder
 */

export interface FilterPreset {
  id: string;
  user_id: string;
  name: string;
  sport: string; // Comma-separated list of sports (e.g., "nba,nfl,nhl") or single sport
  markets: string[] | null; // null = all markets
  market_type: "all" | "player" | "game"; // Market type filter
  
  // Reference books (used to calculate fair odds)
  sharp_books: string[];
  book_weights: Record<string, number> | null; // Custom weights, null = equal weighting
  
  // Fallback configuration
  fallback_mode: "hide" | "use_fallback"; // What to do when reference books missing
  fallback_weights: Record<string, number> | null; // Weights for fallback calculation
  
  // Filters
  min_books_reference: number;
  min_odds: number;
  max_odds: number;
  
  // Metadata
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FilterPresetCreate {
  name: string;
  sport: string;
  markets: string[] | null;
  market_type?: "all" | "player" | "game";
  sharp_books: string[];
  book_weights?: Record<string, number> | null;
  fallback_mode?: "hide" | "use_fallback";
  fallback_weights?: Record<string, number> | null;
  min_books_reference: number;
  min_odds: number;
  max_odds: number;
  is_default?: boolean;
}

export interface FilterPresetUpdate extends Partial<FilterPresetCreate> {
  is_active?: boolean;
  sort_order?: number;
}

// For the API response
export interface FilterPresetsResponse {
  presets: FilterPreset[];
  count: number;
}

// Sport options
export const PRESET_SPORTS = [
  { value: 'nba', label: 'NBA', icon: '🏀' },
  { value: 'nfl', label: 'NFL', icon: '🏈' },
  { value: 'nhl', label: 'NHL', icon: '🏒' },
  { value: 'mlb', label: 'MLB', icon: '⚾' },
  { value: 'ncaab', label: 'NCAAB', icon: '🏀' },
  { value: 'ncaaf', label: 'NCAAF', icon: '🏈' },
  { value: 'wnba', label: 'WNBA', icon: '🏀' },
] as const;

// Common sharp book presets for quick selection
export const SHARP_BOOK_PRESETS = {
  'pinnacle': {
    label: 'Pinnacle Only',
    books: ['pinnacle'],
    description: 'The sharpest book'
  },
  'consensus': {
    label: 'Sharp Consensus',
    books: ['fanduel', 'caesars', 'bet365', 'betmgm'],
    description: 'FanDuel, Caesars, Bet365, BetMGM'
  },
  'us-sharps': {
    label: 'US Sharps',
    books: ['fanduel', 'draftkings', 'caesars'],
    description: 'FanDuel, DraftKings, Caesars'
  },
} as const;

// Helper to parse sports from the stored string format
// Always returns lowercase sport IDs for consistent matching
export function parseSports(sport: string): string[] {
  if (!sport) return [];
  return sport.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

// Helper to format sports for storage
export function formatSportsForStorage(sports: string[]): string {
  return sports.join(',');
}

// Helper to get sport label
export function getSportLabel(sport: string): string {
  const sports = parseSports(sport);
  if (sports.length === 0) return sport.toUpperCase();
  if (sports.length === 1) {
    const found = PRESET_SPORTS.find(s => s.value === sports[0]);
    return found?.label || sports[0].toUpperCase();
  }
  return sports.map(s => {
    const found = PRESET_SPORTS.find(sp => sp.value === s);
    return found?.label || s.toUpperCase();
  }).join(', ');
}

// Helper to get sport icon(s)
export function getSportIcon(sport: string): string {
  const sports = parseSports(sport);
  if (sports.length === 0) return '🎯';
  if (sports.length === 1) {
    const found = PRESET_SPORTS.find(s => s.value === sports[0]);
    return found?.icon || '🎯';
  }
  if (sports.length === PRESET_SPORTS.length) return '🌐';
  const found = PRESET_SPORTS.find(s => s.value === sports[0]);
  return found?.icon || '🎯';
}

// Helper to get sport icons as array
export function getSportIcons(sport: string): string[] {
  const sports = parseSports(sport);
  return sports.map(s => {
    const found = PRESET_SPORTS.find(sp => sp.value === s);
    return found?.icon || '🎯';
  });
}

// Format sharp books for display
export function formatSharpBooks(books: string[]): string {
  if (books.length === 0) return 'None selected';
  if (books.length <= 3) {
    return books.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(', ');
  }
  return `${books.slice(0, 2).map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(', ')} +${books.length - 2} more`;
}

// Format odds for display
export function formatOddsRange(min: number, max: number): string {
  const formatOdd = (n: number) => n > 0 ? `+${n}` : `${n}`;
  return `${formatOdd(min)} to ${formatOdd(max)}`;
}

// Format weights for display
export function formatWeights(weights: Record<string, number> | null, books: string[]): string {
  if (!weights) return 'Equal weighting';
  const parts = books
    .filter(b => weights[b])
    .map(b => `${b.charAt(0).toUpperCase() + b.slice(1)} ${weights[b]}%`);
  return parts.join(', ') || 'Equal weighting';
}

// Calculate equal weights for books
export function getEqualWeights(books: string[]): Record<string, number> {
  if (books.length === 0) return {};
  const weight = Math.round(100 / books.length);
  const weights: Record<string, number> = {};
  books.forEach((book, i) => {
    // Last book gets remainder to ensure 100% total
    weights[book] = i === books.length - 1 
      ? 100 - (weight * (books.length - 1))
      : weight;
  });
  return weights;
}

// Validate weights sum to 100
export function validateWeights(weights: Record<string, number>): boolean {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  return Math.abs(total - 100) < 0.01; // Allow tiny floating point errors
}
