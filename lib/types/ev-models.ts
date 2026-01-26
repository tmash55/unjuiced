/**
 * EV Models - Custom user-defined models for the Positive EV tool
 * 
 * Similar to Edge Finder Filter Presets - defines which sharp books to devig against
 * and which markets to apply the model to. Devig methods and EV thresholds
 * come from global settings.
 */

/**
 * User-created custom model for the Positive EV tool
 */
export interface EvModel {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  
  // Sport/Market filtering
  sport: string;                                // Comma-separated sports (e.g., "nba,nfl") or single sport
  markets: string[] | null;                     // Specific markets, null = all markets
  market_type: "all" | "player" | "game";       // Market type filter
  
  // Sharp reference configuration
  sharp_books: string[];                        // ["pinnacle", "circa"]
  book_weights: Record<string, number> | null;  // {"pinnacle": 60, "circa": 40}, null = equal
  
  // Fallback configuration (when reference books missing)
  fallback_mode: "hide" | "use_fallback";
  fallback_weights: Record<string, number> | null;
  
  // Filters
  min_books_reference: number;                  // Minimum reference books needed
  
  // State
  is_active: boolean;
  is_favorite: boolean;
  sort_order: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a new EV model
 */
export interface EvModelCreate {
  name: string;
  notes?: string | null;
  
  // Sport/Market filtering
  sport: string;
  markets?: string[] | null;
  market_type?: "all" | "player" | "game";
  
  // Sharp reference
  sharp_books: string[];
  book_weights?: Record<string, number> | null;
  
  // Fallback
  fallback_mode?: "hide" | "use_fallback";
  fallback_weights?: Record<string, number> | null;
  
  // Filters
  min_books_reference?: number;
  
  // Metadata
  is_favorite?: boolean;
}

/**
 * Input for updating an existing EV model
 */
export interface EvModelUpdate extends Partial<EvModelCreate> {
  is_active?: boolean;
  is_favorite?: boolean;
  sort_order?: number;
}

/**
 * API response for EV models
 */
export interface EvModelsResponse {
  models: EvModel[];
  count: number;
}

// Maximum character length for notes field
export const EV_MODEL_NOTES_MAX_LENGTH = 500;

/**
 * Sports available for EV models
 */
export const EV_MODEL_SPORTS = [
  { value: "nba", label: "NBA", icon: "🏀" },
  { value: "nfl", label: "NFL", icon: "🏈" },
  { value: "nhl", label: "NHL", icon: "🏒" },
  { value: "mlb", label: "MLB", icon: "⚾" },
  { value: "ncaab", label: "NCAAB", icon: "🏀" },
  { value: "ncaaf", label: "NCAAF", icon: "🏈" },
  { value: "wnba", label: "WNBA", icon: "🏀" },
  { value: "soccer_epl", label: "EPL", icon: "⚽" },
] as const;

/**
 * Sharp book presets for quick selection
 */
export const EV_SHARP_BOOK_PRESETS = {
  pinnacle: {
    label: "Pinnacle Only",
    books: ["pinnacle"],
    description: "The sharpest book - gold standard for EV",
  },
  pinnacle_circa: {
    label: "Pinnacle + Circa",
    books: ["pinnacle", "circa"],
    description: "Blend of two sharp books",
  },
  sharp_consensus: {
    label: "Sharp Consensus",
    books: ["pinnacle", "circa", "fanduel", "draftkings"],
    description: "Blend of sharp and liquid books",
  },
} as const;

/**
 * Quick templates for creating common EV models
 */
export const EV_MODEL_TEMPLATES = {
  pinnacle_all: {
    name: "Pinnacle (All)",
    description: "Pinnacle reference for all markets",
    sport: "",
    markets: null,
    market_type: "all" as const,
    sharp_books: ["pinnacle"],
    book_weights: null,
    min_books_reference: 1,
  },
  pinnacle_player_props: {
    name: "Pinnacle Player Props",
    description: "Pinnacle reference for player props only",
    sport: "",
    markets: null,
    market_type: "player" as const,
    sharp_books: ["pinnacle"],
    book_weights: null,
    min_books_reference: 1,
  },
  sharp_blend: {
    name: "Sharp Blend",
    description: "Weighted blend of Pinnacle and Circa",
    sport: "",
    markets: null,
    market_type: "all" as const,
    sharp_books: ["pinnacle", "circa"],
    book_weights: { pinnacle: 70, circa: 30 },
    min_books_reference: 2,
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse sports from comma-separated string
 */
export function parseEvSports(sport: string): string[] {
  if (!sport) return [];
  return sport.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * Format sports for storage
 */
export function formatEvSportsForStorage(sports: string[]): string {
  return sports.join(",");
}

/**
 * Format sharp books for display
 */
export function formatEvSharpBooks(books: string[]): string {
  if (books.length === 0) return "None selected";
  if (books.length === 1) return capitalizeBook(books[0]);
  if (books.length <= 3) {
    return books.map(capitalizeBook).join(", ");
  }
  return `${books.slice(0, 2).map(capitalizeBook).join(", ")} +${books.length - 2} more`;
}

/**
 * Get sport label from value
 */
export function getEvSportLabel(sport: string): string {
  const sports = parseEvSports(sport);
  if (sports.length === 0) return sport.toUpperCase();
  if (sports.length === 1) {
    const found = EV_MODEL_SPORTS.find((s) => s.value === sports[0]);
    return found?.label || sports[0].toUpperCase();
  }
  return sports
    .map((s) => {
      const found = EV_MODEL_SPORTS.find((sp) => sp.value === s);
      return found?.label || s.toUpperCase();
    })
    .join(", ");
}

/**
 * Get sport icon from value
 */
export function getEvSportIcon(sport: string): string {
  const sports = parseEvSports(sport);
  if (sports.length === 0) return "🎯";
  if (sports.length === 1) {
    const found = EV_MODEL_SPORTS.find((s) => s.value === sports[0]);
    return found?.icon || "🎯";
  }
  if (sports.length === EV_MODEL_SPORTS.length) return "🌐";
  const found = EV_MODEL_SPORTS.find((s) => s.value === sports[0]);
  return found?.icon || "🎯";
}

/**
 * Format sports array for display
 */
export function formatEvSports(sport: string): string {
  const sports = parseEvSports(sport);
  if (sports.length === 0) return "All Sports";
  if (sports.length === EV_MODEL_SPORTS.length) return "All Sports";
  if (sports.length <= 3) {
    return sports.map((s) => {
      const found = EV_MODEL_SPORTS.find((sp) => sp.value === s);
      return found?.label || s.toUpperCase();
    }).join(", ");
  }
  return `${sports.slice(0, 2).map((s) => {
    const found = EV_MODEL_SPORTS.find((sp) => sp.value === s);
    return found?.label || s.toUpperCase();
  }).join(", ")} +${sports.length - 2} more`;
}

/**
 * Format weights for display
 */
export function formatEvWeights(
  weights: Record<string, number> | null,
  books: string[]
): string {
  if (!weights || books.length === 0) return "Equal weighting";
  const parts = books
    .filter((b) => weights[b])
    .map((b) => `${capitalizeBook(b)} ${weights[b]}%`);
  return parts.join(", ") || "Equal weighting";
}

/**
 * Calculate equal weights for books
 */
export function getEvEqualWeights(books: string[]): Record<string, number> {
  if (books.length === 0) return {};
  const weight = Math.round(100 / books.length);
  const weights: Record<string, number> = {};
  books.forEach((book, i) => {
    // Last book gets remainder to ensure 100% total
    weights[book] =
      i === books.length - 1 ? 100 - weight * (books.length - 1) : weight;
  });
  return weights;
}

/**
 * Validate weights sum to 100
 */
export function validateEvWeights(weights: Record<string, number>): boolean {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  return Math.abs(total - 100) < 0.01; // Allow tiny floating point errors
}

/**
 * Format market type for display
 */
export function formatEvMarketType(type: "all" | "player" | "game"): string {
  switch (type) {
    case "player":
      return "Player Props";
    case "game":
      return "Game Lines";
    default:
      return "All Markets";
  }
}

// Helper to capitalize book name
function capitalizeBook(book: string): string {
  return book.charAt(0).toUpperCase() + book.slice(1);
}
