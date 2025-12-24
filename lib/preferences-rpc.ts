import { createClient } from "@/libs/supabase/client";

// Helper to check if error is a network error
function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && error.message === "Failed to fetch";
}

// Retry helper for transient network failures
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // Only retry on network errors
      if (!isNetworkError(error) || attempt === maxRetries) {
        throw error;
      }
      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

// Types for user preferences
export interface UserPreferences {
  id: string;
  favorite_sports?: string[];
  betting_style?: string;
  experience_level?: string;
  sportsbooks?: string[];
  state_code?: string;
  onboarding_completed?: boolean;
  preferred_sportsbooks?: string[];
  theme?: string;
  notifications_enabled?: boolean;
  public_profile?: boolean;
  
  // Tool-specific preferences
  arbitrage_selected_books?: string[];
  arbitrage_selected_sports?: string[];
  arbitrage_selected_leagues?: string[];
  arbitrage_min_arb?: number;
  arbitrage_max_arb?: number;
  arbitrage_total_bet_amount?: number;
  arbitrage_search_query?: string;
  
  ev_selected_books?: string[];
  ev_min_odds?: number;
  ev_max_odds?: number;
  ev_bankroll?: number;
  ev_kelly_percent?: number;
  ev_search_query?: string;

  include_alternates?: boolean;
  odds_selected_books?: string[];
  odds_column_order?: string[];
  odds_sportsbook_order?: string[];
  odds_column_highlighting?: boolean;
  odds_show_best_line?: boolean;
  odds_show_average_line?: boolean;
  
  ladder_selected_books?: string[];
  
  // Best Odds preferences
  best_odds_selected_books?: string[];
  best_odds_selected_sports?: string[];
  best_odds_selected_leagues?: string[];
  best_odds_selected_markets?: string[];
  best_odds_market_lines?: Record<string, number[]>;
  best_odds_min_improvement?: number;
  best_odds_max_odds?: number;
  best_odds_min_odds?: number;
  best_odds_scope?: string;
  best_odds_sort_by?: string;
  best_odds_search_query?: string;
  best_odds_hide_college_player_props?: boolean;
  best_odds_comparison_mode?: 'average' | 'book' | 'next_best';
  best_odds_comparison_book?: string | null;
  best_odds_show_hidden?: boolean;
  
  // Model templates preference
  hide_model_templates?: boolean;
  
  created_at?: string;
  updated_at?: string;
}

// Partial type for updates
export type UserPreferencesUpdate = Partial<Omit<UserPreferences, 'id' | 'created_at' | 'updated_at'>>;

export class PreferencesRPC {
  private supabase = createClient();

  /**
   * Get user preferences with default values
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = null;
    
    try {
      const result = await withRetry(async () => {
        return await this.supabase
          .from("user_preferences")
          .select("*")
          .eq("id", userId)
          .single();
      });
      
      data = result.data;
      const error = result.error;
      
      if (error && error.code !== "PGRST116") {
        throw new Error(`Failed to fetch preferences: ${error.message}`);
      }
    } catch (err) {
      // On network failure, return defaults instead of crashing
      if (isNetworkError(err)) {
        console.warn("[PreferencesRPC] Network error fetching preferences, using defaults");
        data = null;
      } else {
        throw err;
      }
    }

    // Return preferences with default values
    return {
      id: userId,
      favorite_sports: data?.favorite_sports || [],
      betting_style: data?.betting_style || null,
      experience_level: data?.experience_level || null,
      sportsbooks: data?.sportsbooks || [],
      state_code: data?.state_code || null,
      onboarding_completed: data?.onboarding_completed || false,
      preferred_sportsbooks: data?.preferred_sportsbooks || [],
      theme: data?.theme || "system",
      notifications_enabled: data?.notifications_enabled || false,
      public_profile: data?.public_profile || true,
      
      // Tool preferences with defaults
      arbitrage_selected_books: data?.arbitrage_selected_books || [],
      // Return undefined only if column doesn't exist (NULL in DB), otherwise return the array (even if empty)
      arbitrage_selected_sports: data?.arbitrage_selected_sports !== null ? data?.arbitrage_selected_sports : undefined,
      arbitrage_selected_leagues: data?.arbitrage_selected_leagues !== null ? data?.arbitrage_selected_leagues : undefined,
      arbitrage_min_arb: data?.arbitrage_min_arb ?? 0,
      arbitrage_max_arb: data?.arbitrage_max_arb ?? 20,
      arbitrage_total_bet_amount: typeof data?.arbitrage_total_bet_amount === 'number' ? data!.arbitrage_total_bet_amount : (data?.arbitrage_total_bet_amount ? Number(data?.arbitrage_total_bet_amount) : undefined),
      arbitrage_search_query: data?.arbitrage_search_query || "",
      
      ev_selected_books: data?.ev_selected_books || [],
      ev_min_odds: data?.ev_min_odds ?? -200,
      ev_max_odds: data?.ev_max_odds ?? 200,
      ev_bankroll: data?.ev_bankroll ?? 1000,
      ev_kelly_percent: data?.ev_kelly_percent ?? 50,
      ev_search_query: data?.ev_search_query || "",

      include_alternates: data?.include_alternates ?? false,
      odds_selected_books: data?.odds_selected_books || [],
      odds_column_order: data?.odds_column_order || ['entity', 'event', 'best-line'],
      odds_sportsbook_order: data?.odds_sportsbook_order || [],
      odds_column_highlighting: data?.odds_column_highlighting ?? true,
      
      ladder_selected_books: data?.ladder_selected_books || [],
      best_odds_selected_books: data?.best_odds_selected_books || [],
      best_odds_selected_sports: data?.best_odds_selected_sports !== null ? data?.best_odds_selected_sports : undefined,
      best_odds_selected_leagues: data?.best_odds_selected_leagues || [],
      best_odds_selected_markets: data?.best_odds_selected_markets || [],
      best_odds_market_lines: data?.best_odds_market_lines || {},
      best_odds_min_improvement: data?.best_odds_min_improvement ?? 0,
      best_odds_max_odds: data?.best_odds_max_odds,
      best_odds_min_odds: data?.best_odds_min_odds,
      best_odds_scope: data?.best_odds_scope || 'pregame',
      best_odds_sort_by: data?.best_odds_sort_by || 'improvement',
      best_odds_search_query: data?.best_odds_search_query || '',
      best_odds_hide_college_player_props: data?.best_odds_hide_college_player_props ?? false,
      best_odds_comparison_mode: data?.best_odds_comparison_mode ?? 'average',
      best_odds_comparison_book: data?.best_odds_comparison_book ?? null,
      best_odds_show_hidden: data?.best_odds_show_hidden ?? false,
      
      created_at: data?.created_at,
      updated_at: data?.updated_at,
    };
  }

  /**
   * Update specific preference fields
   */
  async updatePreferences(userId: string, updates: UserPreferencesUpdate): Promise<UserPreferences> {
    try {
      const { data, error } = await withRetry(async () => {
        return await this.supabase
          .from("user_preferences")
          .upsert({
            id: userId,
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
      });

      if (error) {
        throw new Error(`Failed to update preferences: ${error.message}`);
      }

      return data;
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn("[PreferencesRPC] Network error updating preferences, will retry on next save");
        // Return a mock response so the UI doesn't break
        return { id: userId, ...updates } as UserPreferences;
      }
      throw err;
    }
  }

  /**
   * Update a single preference field
   */
  async updatePreference<K extends keyof UserPreferencesUpdate>(
    userId: string, 
    key: K, 
    value: UserPreferencesUpdate[K]
  ): Promise<void> {
    const updateData = {
      id: userId,
      [key]: value,
      updated_at: new Date().toISOString(),
    };

    try {
      // Use upsert with explicit conflict resolution
      const { error } = await withRetry(async () => {
        return await this.supabase
          .from("user_preferences")
          .upsert(updateData, {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select();
      });

      if (error) {
        throw new Error(`Failed to update ${String(key)}: ${error.message}`);
      }
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn(`[PreferencesRPC] Network error updating ${String(key)}, will retry on next save`);
        return; // Fail silently for network errors
      }
      throw err;
    }
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(userId: string): Promise<UserPreferences> {
    const { data, error } = await this.supabase
      .from("user_preferences")
      .upsert({
        id: userId,
        favorite_sports: [],
        betting_style: null,
        experience_level: null,
        sportsbooks: [],
        state_code: null,
        onboarding_completed: false,
        preferred_sportsbooks: [],
        theme: "system",
        notifications_enabled: false,
        public_profile: true,
        arbitrage_selected_books: [],
        arbitrage_selected_sports: [],
        arbitrage_selected_leagues: [],
        arbitrage_min_arb: 0,
        arbitrage_search_query: "",
        ev_selected_books: [],
        ev_min_odds: -200,
        ev_max_odds: 200,
        ev_bankroll: 1000,
        ev_kelly_percent: 50,
        ev_search_query: "",
        include_alternates: false,
        odds_selected_books: [],
        odds_column_order: ['entity', 'event', 'best-line'],
        odds_sportsbook_order: [],
        odds_column_highlighting: true,
        ladder_selected_books: [],
        best_odds_selected_books: [],
        best_odds_selected_sports: [],
        best_odds_selected_leagues: [],
        best_odds_selected_markets: [],
        best_odds_min_improvement: 0,
        best_odds_max_odds: null,
        best_odds_min_odds: null,
        best_odds_scope: 'pregame',
        best_odds_sort_by: 'improvement',
        best_odds_search_query: '',
        best_odds_hide_college_player_props: false,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reset preferences: ${error.message}`);
    }

    return data;
  }

  /**
   * Batch update multiple preferences atomically
   */
     async batchUpdatePreferences<
      K extends keyof UserPreferencesUpdate
    >(
      userId: string,
      updates: Array<{ key: K; value: UserPreferencesUpdate[K] }>
    ): Promise<UserPreferences> {
      const updateObject = updates.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {} as UserPreferencesUpdate);

  return this.updatePreferences(userId, updateObject);
}
}

// Singleton instance
export const preferencesRPC = new PreferencesRPC();