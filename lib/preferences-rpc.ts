import { createClient } from "@/libs/supabase/client";

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
    console.log('🔍 PreferencesRPC: Fetching preferences for user:', userId);
    
    const { data, error } = await this.supabase
      .from("user_preferences")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error('❌ PreferencesRPC: Database error:', error);
      throw new Error(`Failed to fetch preferences: ${error.message}`);
    }

    console.log('📊 PreferencesRPC: Raw database data:', {
      found: !!data,
      preferred_sportsbooks: data?.preferred_sportsbooks,
      error: error?.code
    });

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
      arbitrage_min_arb: data?.arbitrage_min_arb ?? 0,
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
      
      created_at: data?.created_at,
      updated_at: data?.updated_at,
    };
  }

  /**
   * Update specific preference fields
   */
  async updatePreferences(userId: string, updates: UserPreferencesUpdate): Promise<UserPreferences> {
    const { data, error } = await this.supabase
      .from("user_preferences")
      .upsert({
        id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update preferences: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a single preference field
   */
  async updatePreference<K extends keyof UserPreferencesUpdate>(
    userId: string, 
    key: K, 
    value: UserPreferencesUpdate[K]
  ): Promise<void> {
    const stackTrace = new Error().stack?.split('\n').slice(1, 5).join('\n') || 'No stack trace'
    
    console.log('💾 PreferencesRPC: Updating single preference', {
      userId,
      key,
      value,
      valueType: typeof value,
      isArray: Array.isArray(value),
      caller: stackTrace
    });

    const updateData = {
      id: userId,
      [key]: value,
      updated_at: new Date().toISOString(),
    };

    console.log('💾 PreferencesRPC: Update data:', updateData);

    // Use upsert with explicit conflict resolution
    const { data, error } = await this.supabase
      .from("user_preferences")
      .upsert(updateData, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('❌ PreferencesRPC: Update failed:', error);
      throw new Error(`Failed to update ${String(key)}: ${error.message}`);
    }

    console.log('✅ PreferencesRPC: Update completed successfully');
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