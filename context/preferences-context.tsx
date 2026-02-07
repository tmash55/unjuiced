
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { sportsbooks, getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import { preferencesRPC, UserPreferences, UserPreferencesUpdate } from "@/lib/preferences-rpc";

// Development-only logging flag
const DEV_LOGGING = process.env.NODE_ENV === "development";

interface PreferencesContextType {
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: string | null;
  
  // Core update functions
  updatePreference: <K extends keyof UserPreferencesUpdate>(
    key: K, 
    value: UserPreferencesUpdate[K],
    optimistic?: boolean
  ) => Promise<void>;
  
  updatePreferences: (updates: UserPreferencesUpdate, optimistic?: boolean) => Promise<void>;
  batchUpdate: (updates: Array<{ key: keyof UserPreferencesUpdate; value: any }>) => Promise<void>;
  resetPreferences: () => Promise<void>;
  
  // Tool-specific helpers
  updateArbitrageFilters: (filters: {
    selectedBooks?: string[];
    selectedSports?: string[];
    selectedLeagues?: string[];
    selectedMarketTypes?: ('player' | 'game')[];
    selectedMarkets?: string[];
    minArb?: number;
    maxArb?: number;
    totalBetAmount?: number;
    searchQuery?: string;
    roundBets?: boolean;
    minLiquidity?: number;
  }) => Promise<void>;
  
  getArbitrageFilters: () => {
    selectedBooks: string[];
    selectedSports: string[];
    selectedLeagues: string[];
    selectedMarketTypes: ('player' | 'game')[];
    selectedMarkets: string[];
    minArb: number;
    maxArb: number;
    totalBetAmount: number;
    searchQuery: string;
    roundBets: boolean;
    minLiquidity: number;
  };
  
  updateEvFilters: (filters: {
    selectedBooks?: string[];
    minOdds?: number;
    maxOdds?: number;
    bankroll?: number;
    kellyPercent?: number;
    searchQuery?: string;
  }) => Promise<void>;

  updateOddsPreferences: (filters: {
    selectedBooks?: string[];
    columnOrder?: string[];
    sportsbookOrder?: string[];
    includeAlternates?: boolean;
    columnHighlighting?: boolean;
    showBestLine?: boolean;
    showAverageLine?: boolean;
    tableView?: 'compact' | 'relaxed';
  }) => Promise<void>;
  
  // Getters for common data
  getActiveSportsbooks: () => string[];

  getEvFilters: () => {
    selectedBooks: string[];
    minOdds: number;
    maxOdds: number;
    bankroll: number;
    kellyPercent: number;
    searchQuery: string;
  };

  getOddsPreferences: () => {
    selectedBooks: string[];
    columnOrder: string[];
    sportsbookOrder: string[];
    includeAlternates: boolean;
    columnHighlighting: boolean;
    showBestLine: boolean;
    showAverageLine: boolean;
    tableView: 'compact' | 'relaxed';
  };
  
  updateLadderFilters: (filters: {
    selectedBooks?: string[];
  }) => Promise<void>;
  
  getLadderFilters: () => {
    selectedBooks: string[];
  };
  
  updateBestOddsFilters: (filters: {
    selectedBooks?: string[];
    selectedSports?: string[];
    selectedLeagues?: string[];
    selectedMarkets?: string[];
    marketLines?: Record<string, number[]>;
    minImprovement?: number;
    maxOdds?: number;
    minOdds?: number;
    scope?: string;
    sortBy?: string;
    searchQuery?: string;
    hideCollegePlayerProps?: boolean;
    comparisonMode?: 'average' | 'book' | 'next_best';
    comparisonBook?: string | null;
    showHidden?: boolean;
  }) => Promise<void>;
  
  getBestOddsFilters: () => {
    selectedBooks: string[];
    selectedSports: string[];
    selectedLeagues: string[];
    selectedMarkets: string[];
    marketLines: Record<string, number[]>;
    minImprovement: number;
    maxOdds?: number;
    minOdds?: number;
    scope: 'all' | 'pregame' | 'live';
    sortBy: 'improvement' | 'odds';
    searchQuery: string;
    hideCollegePlayerProps: boolean;
    comparisonMode: 'average' | 'book' | 'next_best';
    comparisonBook: string | null;
    showHidden: boolean;
  };
  
  // Positive EV Tool
  updatePositiveEvFilters: (filters: {
    selectedBooks?: string[];
    selectedSports?: string[];
    selectedMarkets?: string[];
    sharpPreset?: string;
    devigMethods?: string[];
    minEv?: number;
    maxEv?: number;
    mode?: 'pregame' | 'live' | 'all';
    minBooksPerSide?: number;
  }) => Promise<void>;
  
  getPositiveEvFilters: () => {
    selectedBooks: string[];
    selectedSports: string[];
    selectedMarkets: string[];
    sharpPreset: string;
    devigMethods: string[];
    minEv: number;
    maxEv: number | undefined;
    mode: 'pregame' | 'live' | 'all';
  };
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guest (unsigned) runtime-only overrides for odds screen
  const [guestOdds, setGuestOdds] = useState<{
    selectedBooks?: string[];
    columnOrder?: string[];
    sportsbookOrder?: string[];
    includeAlternates?: boolean;
    columnHighlighting?: boolean;
    showBestLine?: boolean;
    showAverageLine?: boolean;
    tableView?: 'compact' | 'relaxed';
  }>({});
  // Guest (unsigned) runtime-only overrides for arbitrage filters
  const [guestArb, setGuestArb] = useState<{
    selectedBooks?: string[];
    selectedSports?: string[];
    selectedLeagues?: string[];
    selectedMarketTypes?: ('player' | 'game')[];
    selectedMarkets?: string[];
    minArb?: number;
    maxArb?: number;
    totalBetAmount?: number;
    searchQuery?: string;
    roundBets?: boolean;
    minLiquidity?: number;
  }>({});
  
  // Keep track of pending updates to avoid race conditions
  const pendingUpdatesRef = useRef<Set<string>>(new Set());
  
  // Performance metrics for monitoring (dev only)
  const metricsRef = useRef({
    updatePreferenceWrites: 0,
    updatePreferencesWrites: 0,
    batchUpdateWrites: 0,
    skippedNoop: 0,
    totalLoadTime: 0,
  });

  // Track last loaded user to prevent loading state flash on auth refreshes
  const lastLoadedUserIdRef = useRef<string | null>(null);

  const publishMetrics = useCallback(() => {
    if (DEV_LOGGING && typeof window !== 'undefined') {
      (window as any).__prefsMetrics = { ...metricsRef.current };
    }
  }, []);

  // Load initial preferences
  const loadPreferences = useCallback(async () => {
    if (!user) {
      if (DEV_LOGGING) console.log('🔄 PreferencesContext: No user, clearing preferences');
      setPreferences(null);
      lastLoadedUserIdRef.current = null;
      setIsLoading(false);
      return;
    }

    const startTime = performance.now();
    const isUserSwitch = lastLoadedUserIdRef.current !== user.id;

    if (DEV_LOGGING) {
      console.log('🔄 PreferencesContext: Loading preferences for user:', user.id, isUserSwitch ? '(new user)' : '(refresh)', 'at', new Date().toISOString());
    }

    try {
      // Only show loading state if we're switching users or initial load
      // This prevents the table from reloading/flashing during background auth token refreshes
      if (isUserSwitch) {
        setIsLoading(true);
      }
      setError(null);
      const prefs = await preferencesRPC.getPreferences(user.id);
      
      const loadTime = performance.now() - startTime;
      metricsRef.current.totalLoadTime = loadTime;
      
      if (DEV_LOGGING) {
        console.log('✅ PreferencesContext: Loaded preferences in', loadTime.toFixed(2), 'ms', {
          userId: user.id,
          preferred_sportsbooks_count: prefs.preferred_sportsbooks?.length,
          hasPreferences: !!prefs
        });
      }
      
      setPreferences(prefs);
      lastLoadedUserIdRef.current = user.id;
      publishMetrics();
    } catch (err) {
      if (DEV_LOGGING) console.error("❌ Failed to load preferences:", err);
      setError(err instanceof Error ? err.message : "Failed to load preferences");
    } finally {
      setIsLoading(false);
    }
  }, [user, publishMetrics]);

  // Load preferences when user changes
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Generic preference update with optimistic updates
  const updatePreference = useCallback(async <K extends keyof UserPreferencesUpdate>(
    key: K,
    value: UserPreferencesUpdate[K],
    optimistic = true
  ) => {
    if (!user || !preferences) {
      if (DEV_LOGGING) {
        console.log('⚠️ Cannot update preference: no user or preferences', { user: !!user, preferences: !!preferences });
      }
      return;
    }

    // No-op guard to avoid redundant writes
    const currentValue = (preferences as any)[key];
    const isArray = Array.isArray(currentValue) || Array.isArray(value as any);
    const isEqual = isArray
      ? Array.isArray(currentValue) && Array.isArray(value) && currentValue.length === (value as any[]).length && currentValue.every((v: any, i: number) => v === (value as any[])[i])
      : currentValue === value;
    if (isEqual) {
      metricsRef.current.skippedNoop += 1;
      if (DEV_LOGGING) {
        console.log('⏭️ Skipping update - no change detected for key:', String(key));
      }
      publishMetrics();
      return;
    }

    const updateKey = `${key}-${JSON.stringify(value)}`;
    
    // Prevent duplicate updates (race condition guard)
    if (pendingUpdatesRef.current.has(updateKey)) {
      if (DEV_LOGGING) {
        console.log('⚠️ Duplicate update prevented for:', updateKey);
      }
      return;
    }
    pendingUpdatesRef.current.add(updateKey);

    if (DEV_LOGGING) {
      console.log('🔄 PreferencesContext: Updating preference', {
        key,
        userId: user.id,
        optimistic
      });
    }

    try {
      // Optimistic update for instant UI feedback
      if (optimistic) {
        setPreferences(prev => prev ? { ...prev, [key]: value } : null);
      }

      // Persist to database
      await preferencesRPC.updatePreference(user.id, key, value);
      metricsRef.current.updatePreferenceWrites += 1;
      publishMetrics();
      
      // Refresh from database for non-optimistic updates
      if (!optimistic) {
        const updatedPrefs = await preferencesRPC.getPreferences(user.id);
        setPreferences(updatedPrefs);
      }
    } catch (err) {
      if (DEV_LOGGING) console.error(`❌ Failed to update ${String(key)}:`, err);
      
      // Revert optimistic update on error
      if (optimistic) {
        try {
          const freshPrefs = await preferencesRPC.getPreferences(user.id);
          setPreferences(freshPrefs);
        } catch (revertErr) {
          if (DEV_LOGGING) console.error('❌ Failed to revert preferences:', revertErr);
        }
      }
      
      setError(err instanceof Error ? err.message : `Failed to update ${String(key)}`);
    } finally {
      pendingUpdatesRef.current.delete(updateKey);
    }
  }, [user, preferences, publishMetrics]);

  // Batch preferences update
  const updatePreferences = useCallback(async (
    updates: UserPreferencesUpdate,
    optimistic = true
  ) => {
    if (!user || !preferences) return;

    try {
      // Filter out no-op updates for efficiency
      const effectiveUpdates = Object.keys(updates).reduce((acc, k) => {
        const key = k as keyof UserPreferencesUpdate;
        const nextVal = updates[key] as any;
        const prevVal = (preferences as any)[key];
        const isArray = Array.isArray(nextVal) || Array.isArray(prevVal);
        
        // Special handling for null/undefined comparison
        const equal = isArray
          ? Array.isArray(nextVal) && Array.isArray(prevVal) && nextVal.length === prevVal.length && nextVal.every((v: any, i: number) => v === prevVal[i])
          : (nextVal === prevVal) || (nextVal == null && prevVal == null);
        
        if (!equal) {
          (acc as any)[key] = nextVal;
        }
        return acc;
      }, {} as UserPreferencesUpdate);

      if (Object.keys(effectiveUpdates).length === 0) {
        metricsRef.current.skippedNoop += 1;
        if (DEV_LOGGING) {
          console.log('⏭️ Skipping updatePreferences - no changes detected');
        }
        publishMetrics();
        return;
      }

      // Optimistic update for instant UI feedback
      if (optimistic) {
        setPreferences(prev => prev ? { ...prev, ...effectiveUpdates } : null);
      }

      // Persist to database
      const updatedPrefs = await preferencesRPC.updatePreferences(user.id, effectiveUpdates);
      metricsRef.current.updatePreferencesWrites += 1;
      publishMetrics();
      
      // Set final state from database response
      setPreferences(updatedPrefs);
    } catch (err) {
      if (DEV_LOGGING) console.error("❌ Failed to update preferences:", err);
      
      // Revert optimistic update on error
      if (optimistic) {
        try {
          const freshPrefs = await preferencesRPC.getPreferences(user.id);
          setPreferences(freshPrefs);
        } catch (revertErr) {
          if (DEV_LOGGING) console.error('❌ Failed to revert preferences:', revertErr);
        }
      }
      
      setError(err instanceof Error ? err.message : "Failed to update preferences");
    }
  }, [user, preferences, publishMetrics]);

  // Batch update multiple fields
  const batchUpdate = useCallback(async (
    updates: Array<{ key: keyof UserPreferencesUpdate; value: any }>
  ) => {
    if (!user || !preferences) return;

    try {
      // Remove no-op updates for efficiency
      const filtered = updates.filter(({ key, value }) => {
        const prevVal = (preferences as any)[key];
        const isArray = Array.isArray(value) || Array.isArray(prevVal);
        if (isArray) {
          return !(Array.isArray(value) && Array.isArray(prevVal) && value.length === prevVal.length && value.every((v: any, i: number) => v === prevVal[i]));
        }
        return value !== prevVal;
      });

      if (filtered.length === 0) {
        metricsRef.current.skippedNoop += 1;
        if (DEV_LOGGING) {
          console.log('⏭️ Skipping batchUpdate - no changes detected');
        }
        publishMetrics();
        return;
      }

      // Optimistic update for instant UI feedback
      const optimisticUpdates = filtered.reduce((acc, { key, value }) => {
        (acc as any)[key] = value;
        return acc;
      }, {} as UserPreferencesUpdate);
      
      setPreferences(prev => prev ? { ...prev, ...optimisticUpdates } : null);

      // Persist to database
      const updatedPrefs = await preferencesRPC.batchUpdatePreferences(user.id, filtered);
      metricsRef.current.batchUpdateWrites += 1;
      publishMetrics();
      setPreferences(updatedPrefs);
    } catch (err) {
      if (DEV_LOGGING) console.error("❌ Failed to batch update preferences:", err);
      
      // Revert optimistic update on error
      try {
        const freshPrefs = await preferencesRPC.getPreferences(user.id);
        setPreferences(freshPrefs);
      } catch (revertErr) {
        if (DEV_LOGGING) console.error('❌ Failed to revert preferences:', revertErr);
      }
      
      setError(err instanceof Error ? err.message : "Failed to update preferences");
    }
  }, [user, preferences, publishMetrics]);

  // Reset preferences
  const resetPreferences = useCallback(async () => {
    if (!user) return;

    try {
      const resetPrefs = await preferencesRPC.resetPreferences(user.id);
      setPreferences(resetPrefs);
    } catch (err) {
      if (DEV_LOGGING) console.error("Failed to reset preferences:", err);
      setError(err instanceof Error ? err.message : "Failed to reset preferences");
    }
  }, [user]);

  // Tool-specific helpers
  const updateArbitrageFilters = useCallback(async (filters: {
    selectedBooks?: string[];
    selectedSports?: string[];
    selectedLeagues?: string[];
    selectedMarketTypes?: ('player' | 'game')[];
    selectedMarkets?: string[];
    minArb?: number;
    maxArb?: number;
    searchQuery?: string;
    totalBetAmount?: number;
    roundBets?: boolean;
    minLiquidity?: number;
  }) => {
    // For anonymous users, update guest state instead of database
    if (!user) {
      setGuestArb(prev => ({ ...prev, ...filters }));
      return;
    }
    
    const updates: UserPreferencesUpdate = {};
    
    if (filters.selectedBooks !== undefined) {
      // Store tool-specific selection in arbitrage_selected_books (not global preferred)
      updates.arbitrage_selected_books = filters.selectedBooks;
    }
    if (filters.selectedSports !== undefined) {
      updates.arbitrage_selected_sports = filters.selectedSports;
    }
    if (filters.selectedLeagues !== undefined) {
      updates.arbitrage_selected_leagues = filters.selectedLeagues;
    }
    if (filters.selectedMarketTypes !== undefined) {
      (updates as any).arbitrage_selected_market_types = filters.selectedMarketTypes;
    }
    if (filters.selectedMarkets !== undefined) {
      (updates as any).arbitrage_selected_markets = filters.selectedMarkets;
    }
    if (filters.minArb !== undefined) {
      updates.arbitrage_min_arb = filters.minArb;
    }
    if (filters.maxArb !== undefined) {
      updates.arbitrage_max_arb = filters.maxArb;
    }
    if (filters.totalBetAmount !== undefined) {
      updates.arbitrage_total_bet_amount = filters.totalBetAmount;
    }
    if (filters.searchQuery !== undefined) {
      updates.arbitrage_search_query = filters.searchQuery;
    }
    if (filters.roundBets !== undefined) {
      (updates as any).arbitrage_round_bets = filters.roundBets;
    }
    if (filters.minLiquidity !== undefined) {
      updates.arbitrage_min_liquidity = filters.minLiquidity;
      console.log('[Arbitrage] Setting arbitrage_min_liquidity to:', filters.minLiquidity);
    }
    
    console.log('[Arbitrage] updateArbitrageFilters - final updates:', updates);
    await updatePreferences(updates);
  }, [user, updatePreferences, setGuestArb]);

  const updateEvFilters = useCallback(async (filters: {
    selectedBooks?: string[];
    minOdds?: number;
    maxOdds?: number;
    bankroll?: number;
    kellyPercent?: number;
    searchQuery?: string;
  }) => {
    const updates: UserPreferencesUpdate = {};
    
    if (filters.selectedBooks !== undefined) {
      updates.preferred_sportsbooks = filters.selectedBooks;
    }
    if (filters.minOdds !== undefined) {
      updates.ev_min_odds = filters.minOdds;
    }
    if (filters.maxOdds !== undefined) {
      updates.ev_max_odds = filters.maxOdds;
    }
    if (filters.bankroll !== undefined) {
      updates.ev_bankroll = filters.bankroll;
    }
    if (filters.kellyPercent !== undefined) {
      updates.ev_kelly_percent = filters.kellyPercent;
    }
    if (filters.searchQuery !== undefined) {
      updates.ev_search_query = filters.searchQuery;
    }
    
    await updatePreferences(updates);
  }, [updatePreferences]);

  const updateOddsPreferences = useCallback(async (filters: {
    selectedBooks?: string[];
    columnOrder?: string[];
    sportsbookOrder?: string[];
    includeAlternates?: boolean;
    columnHighlighting?: boolean;
    showBestLine?: boolean;
    showAverageLine?: boolean;
    tableView?: 'compact' | 'relaxed';
  }) => {
    // If no signed-in user, update guest runtime preferences so changes persist until refresh
    if (!user) {
      setGuestOdds(prev => ({
        ...prev,
        ...(filters.selectedBooks !== undefined ? { selectedBooks: filters.selectedBooks } : {}),
        ...(filters.columnOrder !== undefined ? { columnOrder: filters.columnOrder } : {}),
        ...(filters.sportsbookOrder !== undefined ? { sportsbookOrder: filters.sportsbookOrder } : {}),
        ...(filters.includeAlternates !== undefined ? { includeAlternates: filters.includeAlternates } : {}),
        ...(filters.columnHighlighting !== undefined ? { columnHighlighting: filters.columnHighlighting } : {}),
        ...(filters.showBestLine !== undefined ? { showBestLine: filters.showBestLine } : {}),
        ...(filters.showAverageLine !== undefined ? { showAverageLine: filters.showAverageLine } : {}),
        ...(filters.tableView !== undefined ? { tableView: filters.tableView } : {}),
      }));
      return;
    }
    const updates: UserPreferencesUpdate = {};

    if (filters.selectedBooks !== undefined) {
      updates.odds_selected_books = filters.selectedBooks;
    }
    if (filters.columnOrder !== undefined) {
      updates.odds_column_order = filters.columnOrder;
    }
    if (filters.sportsbookOrder !== undefined) {
      updates.odds_sportsbook_order = filters.sportsbookOrder;
    }
    if (filters.includeAlternates !== undefined) {
      updates.include_alternates = filters.includeAlternates;
    }
    if (filters.columnHighlighting !== undefined) {
      updates.odds_column_highlighting = filters.columnHighlighting;
    }
    if (filters.showBestLine !== undefined) {
      updates.odds_show_best_line = filters.showBestLine;
    }
    if (filters.showAverageLine !== undefined) {
      updates.odds_show_average_line = filters.showAverageLine;
    }
    if (filters.tableView !== undefined) {
      updates.odds_table_view = filters.tableView;
    }

    await updatePreferences(updates);
  }, [updatePreferences]);

  // Getter helpers - memoize to ensure stable reference
  const activeSportsbooks = useMemo(() => {
    return sportsbooks.filter(sb => sb.isActive).map(sb => sb.id);
  }, []);

  const getActiveSportsbooks = useCallback(() => {
    return activeSportsbooks;
  }, [activeSportsbooks]);

  const getArbitrageFilters = useCallback(() => {
    // Get all sports and leagues for defaults (matching vendor API format)
    const allSportsIds = ['Football', 'Basketball', 'Baseball', 'Hockey', 'Soccer'];
    const allLeaguesIds = ['nfl', 'ncaaf', 'nba', 'ncaab', 'wnba', 'mlb', 'nhl', 'soccer_epl'];
    const allMarketTypes: ('player' | 'game')[] = ['player', 'game'];
    
    // If logged-out user, use guest state with defaults
    if (!user) {
      return {
        selectedBooks: guestArb.selectedBooks ?? activeSportsbooks,
        selectedSports: guestArb.selectedSports ?? allSportsIds,
        selectedLeagues: guestArb.selectedLeagues ?? allLeaguesIds,
        selectedMarketTypes: guestArb.selectedMarketTypes ?? allMarketTypes,
        selectedMarkets: guestArb.selectedMarkets ?? [],
        minArb: guestArb.minArb ?? 0,
        maxArb: guestArb.maxArb ?? 20,
        totalBetAmount: guestArb.totalBetAmount ?? 200,
        searchQuery: guestArb.searchQuery ?? "",
        roundBets: guestArb.roundBets ?? false,
        minLiquidity: guestArb.minLiquidity ?? 50,
      };
    }
    
    // If preferences haven't loaded yet (logged-in user), default to all active books and all sports/leagues
    if (!preferences) {
      return {
        selectedBooks: activeSportsbooks,
        selectedSports: allSportsIds,
        selectedLeagues: allLeaguesIds,
        selectedMarketTypes: allMarketTypes,
        selectedMarkets: [],
        minArb: 0,
        maxArb: 20,
        totalBetAmount: 200,
        searchQuery: "",
        roundBets: false,
        minLiquidity: 50,
      };
    }
    
    // Use the user's preferred sportsbooks, or default to all active books for new users
    // The key insight: if preferred_sportsbooks exists in the object, use it (even if empty)
    // Only default to all books if the user has never set preferences
    const selectedBooks = (preferences as any).arbitrage_selected_books !== undefined
      ? ((preferences as any).arbitrage_selected_books as string[])
      : (preferences.preferred_sportsbooks ?? activeSportsbooks);
    
    return {
      selectedBooks,
      // If undefined (never set/NULL in DB), default to all sports/leagues selected
      // Otherwise use the value from DB (empty array = nothing selected, or specific items)
      selectedSports: preferences.arbitrage_selected_sports ?? allSportsIds,
      selectedLeagues: preferences.arbitrage_selected_leagues ?? allLeaguesIds,
      selectedMarketTypes: (preferences as any).arbitrage_selected_market_types ?? allMarketTypes,
      selectedMarkets: (preferences as any).arbitrage_selected_markets ?? [],
      minArb: preferences.arbitrage_min_arb ?? 0,
      maxArb: preferences.arbitrage_max_arb ?? 20,
      totalBetAmount: (typeof preferences.arbitrage_total_bet_amount === 'number' ? preferences.arbitrage_total_bet_amount : Number(preferences.arbitrage_total_bet_amount)) ?? 200,
      searchQuery: preferences.arbitrage_search_query || "",
      roundBets: (preferences as any).arbitrage_round_bets ?? false,
      minLiquidity: (typeof preferences.arbitrage_min_liquidity === 'number' ? preferences.arbitrage_min_liquidity : Number(preferences.arbitrage_min_liquidity)) ?? 50,
    };
  }, [preferences, activeSportsbooks, user, guestArb]);

  const getEvFilters = useCallback(() => {
    // If preferences haven't loaded yet (logged-out user), default to all active books
    if (!preferences) {
      return {
        selectedBooks: activeSportsbooks,
        minOdds: -200,
        maxOdds: 200,
        bankroll: 1000,
        kellyPercent: 25,
        searchQuery: "",
      };
    }
    
    // Use the user's preferred sportsbooks, or default to all active books for new users
    const selectedBooks = preferences.preferred_sportsbooks ?? activeSportsbooks;
    
    return {
      selectedBooks,
      minOdds: preferences.ev_min_odds ?? -200,
      maxOdds: preferences.ev_max_odds ?? 200,
      bankroll: preferences.ev_bankroll ?? 1000,
      kellyPercent: preferences.ev_kelly_percent ?? 25, // Default to quarter Kelly
      searchQuery: preferences.ev_search_query || "",
    };
  }, [preferences]);

  const getOddsPreferences = useCallback(() => {
    if (!preferences) {
      return {
        selectedBooks: guestOdds.selectedBooks ?? activeSportsbooks,
        columnOrder: guestOdds.columnOrder ?? ['entity', 'event', 'best-line', 'average-line'],
        sportsbookOrder: guestOdds.sportsbookOrder ?? ([] as string[]),
        includeAlternates: guestOdds.includeAlternates ?? true,
        columnHighlighting: guestOdds.columnHighlighting ?? true,
        showBestLine: guestOdds.showBestLine ?? true,
        showAverageLine: guestOdds.showAverageLine ?? true,
        tableView: guestOdds.tableView ?? 'relaxed',
      };
    }

    return {
      selectedBooks: (preferences.odds_selected_books?.length ? preferences.odds_selected_books : activeSportsbooks),
      columnOrder: (preferences.odds_column_order?.length ? preferences.odds_column_order : ['entity', 'event', 'best-line', 'average-line']),
      sportsbookOrder: (preferences.odds_sportsbook_order || []),
      includeAlternates: (preferences.include_alternates ?? true),
      columnHighlighting: (preferences.odds_column_highlighting ?? true),
      showBestLine: (preferences.odds_show_best_line ?? true),
      showAverageLine: (preferences.odds_show_average_line ?? true),
      tableView: (preferences.odds_table_view ?? 'relaxed') as 'compact' | 'relaxed',
    };
  }, [preferences, activeSportsbooks, guestOdds]);

  const getLadderFilters = useCallback(() => {
    // Get all active sportsbooks excluding Bodog and Bovada (same as ladders page)
    const allLadderBooks = getAllActiveSportsbooks()
      .filter(b => b.id !== 'bodog' && b.id !== 'bovada')
      .map(b => b.id);
    
    // If preferences haven't loaded yet (logged-out user), default to all ladder books
    if (!preferences) {
      return {
        selectedBooks: allLadderBooks,
      };
    }
    
    // Empty array means "select all", so use all ladder books
    // Non-empty array means specific selection
    const selectedBooks = preferences.ladder_selected_books?.length 
      ? preferences.ladder_selected_books 
      : allLadderBooks;
    
    return {
      selectedBooks,
    };
  }, [preferences]);
  
  const updateLadderFilters = useCallback(async (filters: {
    selectedBooks?: string[];
  }) => {
    if (!user) {
      if (DEV_LOGGING) console.log('⚠️ PreferencesContext: Cannot update ladder filters - no user');
      return;
    }
    
    const updates: UserPreferencesUpdate = {};
    
    if (filters.selectedBooks !== undefined) {
      updates.ladder_selected_books = filters.selectedBooks;
    }
    
    if (Object.keys(updates).length > 0) {
      await updatePreferences(updates, true);
    }
  }, [user, updatePreferences]);
  
  const getBestOddsFilters = useCallback(() => {
    // Get all available options for defaults
    const allSports = ['basketball', 'football', 'hockey', 'baseball'];
    const allLeagues = ['nba', 'nfl', 'ncaaf', 'ncaab', 'nhl', 'mlb', 'wnba'];
    const allMarkets = [
      'player_points', 'player_rebounds', 'player_assists', 'pra',
      'passing_yards', 'rushing_yards', 'receiving_yards',
      'player_shots_on_goal', 'player_blocked_shots', 'player_points_hockey',
      'batter_hits', 'batter_total_bases', 'batter_rbis', 'batter_runs_scored',
      'pitcher_strikeouts', 'pitcher_hits_allowed', 'pitcher_walks',
    ];
    
    // If preferences haven't loaded yet (logged-out user), default to all (empty arrays mean "all selected")
    const comparisonMode =
      (preferences?.best_odds_comparison_mode as 'average' | 'book' | 'next_best') ?? 'average';
    const comparisonBook = preferences?.best_odds_comparison_book ?? null;

    if (!preferences) {
      return {
        selectedBooks: [],
        selectedSports: [],
        selectedLeagues: [],
        selectedMarkets: [],
        marketLines: {},
        minImprovement: 0,
        maxOdds: undefined,
        minOdds: undefined,
        scope: 'pregame' as const,
        sortBy: 'improvement' as const,
        searchQuery: '',
        hideCollegePlayerProps: false,
        comparisonMode,
        comparisonBook,
        showHidden: false,
        columnOrder: ['edge', 'league', 'time', 'selection', 'line', 'market', 'best-book', 'reference', 'fair', 'stake', 'filter', 'action'],
      };
    }
    
    // If undefined (NULL in DB), default to ALL (empty arrays mean "all selected")
    return {
      selectedBooks: preferences.best_odds_selected_books ?? [],
      selectedSports: preferences.best_odds_selected_sports ?? [],
      selectedLeagues: preferences.best_odds_selected_leagues ?? [],
      selectedMarkets: preferences.best_odds_selected_markets ?? [],
      marketLines: preferences.best_odds_market_lines ?? {},
      minImprovement: preferences.best_odds_min_improvement ?? 0,
      maxOdds: preferences.best_odds_max_odds ?? undefined,
      minOdds: preferences.best_odds_min_odds ?? undefined,
      scope: (preferences.best_odds_scope as 'all' | 'pregame' | 'live') ?? 'pregame',
      sortBy: (preferences.best_odds_sort_by as 'improvement' | 'odds') ?? 'improvement',
      searchQuery: preferences.best_odds_search_query ?? '',
      hideCollegePlayerProps: preferences.best_odds_hide_college_player_props ?? false,
      comparisonMode,
      comparisonBook,
      showHidden: preferences.best_odds_show_hidden ?? false,
      columnOrder: preferences.edge_finder_column_order ?? ['edge', 'league', 'time', 'selection', 'line', 'market', 'best-book', 'reference', 'fair', 'stake', 'filter', 'action'],
    };
  }, [preferences]);
  
  const updateBestOddsFilters = useCallback(async (filters: {
    selectedBooks?: string[];
    selectedSports?: string[];
    selectedLeagues?: string[];
    selectedMarkets?: string[];
    marketLines?: Record<string, number[]>;
    minImprovement?: number;
    maxOdds?: number;
    minOdds?: number;
    scope?: string;
    sortBy?: string;
    searchQuery?: string;
    hideCollegePlayerProps?: boolean;
    comparisonMode?: 'average' | 'book' | 'next_best';
    comparisonBook?: string | null;
    showHidden?: boolean;
    columnOrder?: string[];
  }) => {
    if (!user) {
      if (DEV_LOGGING) console.log('⚠️ PreferencesContext: Cannot update best odds filters - no user');
      return;
    }
    
    const updates: UserPreferencesUpdate = {};
    
    if (filters.selectedBooks !== undefined) {
      updates.best_odds_selected_books = filters.selectedBooks;
    }
    if (filters.selectedSports !== undefined) {
      updates.best_odds_selected_sports = filters.selectedSports;
    }
    if (filters.selectedLeagues !== undefined) {
      updates.best_odds_selected_leagues = filters.selectedLeagues;
    }
    if (filters.selectedMarkets !== undefined) {
      updates.best_odds_selected_markets = filters.selectedMarkets;
    }
    if (filters.marketLines !== undefined) {
      updates.best_odds_market_lines = filters.marketLines;
    }
    if (filters.minImprovement !== undefined) {
      updates.best_odds_min_improvement = filters.minImprovement;
    }
    if ('maxOdds' in filters) {
      // Explicitly convert undefined to null for database
      updates.best_odds_max_odds = filters.maxOdds === undefined ? (null as any) : filters.maxOdds;
    }
    if ('minOdds' in filters) {
      // Explicitly convert undefined to null for database
      updates.best_odds_min_odds = filters.minOdds === undefined ? (null as any) : filters.minOdds;
    }
    if (filters.scope !== undefined) {
      updates.best_odds_scope = filters.scope;
    }
    if (filters.sortBy !== undefined) {
      updates.best_odds_sort_by = filters.sortBy;
    }
    if (filters.searchQuery !== undefined) {
      updates.best_odds_search_query = filters.searchQuery;
    }
    if (filters.hideCollegePlayerProps !== undefined) {
      updates.best_odds_hide_college_player_props = filters.hideCollegePlayerProps;
    }
    if (filters.comparisonMode !== undefined) {
      updates.best_odds_comparison_mode = filters.comparisonMode;
    }
    if (filters.comparisonBook !== undefined) {
      updates.best_odds_comparison_book = filters.comparisonBook;
    }
    if (filters.showHidden !== undefined) {
      updates.best_odds_show_hidden = filters.showHidden;
    }
    if (filters.columnOrder !== undefined) {
      updates.edge_finder_column_order = filters.columnOrder;
    }
    
    if (Object.keys(updates).length > 0) {
      if (DEV_LOGGING) {
        console.log('[BestOdds] Updating comparison prefs', {
          comparisonMode: filters.comparisonMode,
          comparisonBook: filters.comparisonBook,
          updates,
        });
      }
      await updatePreferences(updates, true);
    }
  }, [user, updatePreferences]);
  
  // ==========================================
  // Positive EV Tool Filters
  // ==========================================
  const getPositiveEvFilters = useCallback(() => {
    if (!preferences) {
      return {
        selectedBooks: [],
        selectedSports: ['nba', 'nfl'],
        selectedMarkets: [],
        sharpPreset: 'pinnacle',
        devigMethods: ['power', 'multiplicative'],
        minEv: 2,
        maxEv: undefined,
        mode: 'pregame' as const,
      };
    }
    
    return {
      selectedBooks: preferences.positive_ev_selected_books ?? [],
      selectedSports: preferences.positive_ev_selected_sports ?? ['nba', 'nfl'],
      selectedMarkets: preferences.positive_ev_selected_markets ?? [],
      sharpPreset: preferences.positive_ev_sharp_preset ?? 'pinnacle',
      devigMethods: preferences.positive_ev_devig_methods ?? ['power', 'multiplicative'],
      evCase: (preferences.positive_ev_case as 'worst' | 'best') ?? 'worst',
      minEv: preferences.positive_ev_min_ev ?? 2,
      maxEv: preferences.positive_ev_max_ev ?? undefined,
      mode: (preferences.positive_ev_mode as 'pregame' | 'live' | 'all') ?? 'pregame',
      showHidden: preferences.best_odds_show_hidden ?? false,
    };
  }, [preferences]);
  
  const updatePositiveEvFilters = useCallback(async (filters: {
    selectedBooks?: string[];
    selectedSports?: string[];
    selectedMarkets?: string[];
    sharpPreset?: string;
    devigMethods?: string[];
    evCase?: 'worst' | 'best';
    minEv?: number;
    maxEv?: number;
    showHidden?: boolean;
    mode?: 'pregame' | 'live' | 'all';
    minBooksPerSide?: number;
  }) => {
    if (!user) {
      if (DEV_LOGGING) console.log('⚠️ PreferencesContext: Cannot update positive EV filters - no user');
      return;
    }
    
    const updates: UserPreferencesUpdate = {};
    
    if (filters.selectedBooks !== undefined) {
      updates.positive_ev_selected_books = filters.selectedBooks;
    }
    if (filters.selectedSports !== undefined) {
      updates.positive_ev_selected_sports = filters.selectedSports;
    }
    if (filters.selectedMarkets !== undefined) {
      updates.positive_ev_selected_markets = filters.selectedMarkets;
    }
    if (filters.sharpPreset !== undefined) {
      updates.positive_ev_sharp_preset = filters.sharpPreset;
    }
    if (filters.devigMethods !== undefined) {
      updates.positive_ev_devig_methods = filters.devigMethods;
    }
    if (filters.evCase !== undefined) {
      updates.positive_ev_case = filters.evCase;
    }
    if (filters.minEv !== undefined) {
      updates.positive_ev_min_ev = filters.minEv;
    }
    if ('maxEv' in filters) {
      updates.positive_ev_max_ev = filters.maxEv === undefined ? (null as any) : filters.maxEv;
    }
    if (filters.mode !== undefined) {
      updates.positive_ev_mode = filters.mode;
    }
    if (filters.minBooksPerSide !== undefined) {
      updates.positive_ev_min_books_per_side = filters.minBooksPerSide;
    }
    if (filters.showHidden !== undefined) {
      updates.best_odds_show_hidden = filters.showHidden;
    }
    
    if (Object.keys(updates).length > 0) {
      if (DEV_LOGGING) {
        console.log('[PositiveEV] Updating filters', updates);
      }
      await updatePreferences(updates, true);
    }
  }, [user, updatePreferences]);
  
  const value: PreferencesContextType = {
    preferences,
    isLoading,
    error,
    updatePreference,
    updatePreferences,
    batchUpdate,
    resetPreferences,
    updateArbitrageFilters,
    getArbitrageFilters,
    updateEvFilters,
    updateOddsPreferences,
    getActiveSportsbooks,
    getEvFilters,
    getOddsPreferences,
    updateLadderFilters,
    getLadderFilters,
    updateBestOddsFilters,
    getBestOddsFilters,
    updatePositiveEvFilters,
    getPositiveEvFilters,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}

// Convenience hooks for specific use cases
export function useArbitragePreferences() {
  const { getArbitrageFilters, updateArbitrageFilters, isLoading } = usePreferences();
  
  // Memoize the filters to prevent infinite re-renders
  const filters = useMemo(() => getArbitrageFilters(), [getArbitrageFilters]);
  
  return {
    filters,
    updateFilters: updateArbitrageFilters,
    isLoading,
  };
}

export function useEvPreferences() {
  const { getEvFilters, updateEvFilters, isLoading } = usePreferences();
  
  // Memoize the filters to prevent infinite re-renders
  const filters = useMemo(() => getEvFilters(), [getEvFilters]);
  
  return {
    filters,
    updateFilters: updateEvFilters,
    isLoading,
  };
}

export function useOddsPreferences() {
  const { getOddsPreferences, updateOddsPreferences, isLoading } = usePreferences();
  
  // Memoize the preferences to prevent infinite re-renders
  const preferences = useMemo(() => getOddsPreferences(), [getOddsPreferences]);
  
  return {
    preferences,
    updatePreferences: updateOddsPreferences,
    isLoading,
  };
}

export function useLadderPreferences() {
  const { getLadderFilters, updateLadderFilters, isLoading } = usePreferences();
  
  // Memoize the filters to prevent infinite re-renders
  const filters = useMemo(() => getLadderFilters(), [getLadderFilters]);
  
  return {
    filters,
    updateFilters: updateLadderFilters,
    isLoading,
  };
}

export function useBestOddsPreferences() {
  const { getBestOddsFilters, updateBestOddsFilters, updateArbitrageFilters, isLoading, preferences } = usePreferences();
  
  // Get minLiquidity from shared arbitrage prefs (syncs across all tools)
  const dbMinLiquidity = preferences?.arbitrage_min_liquidity;
  
  // Memoize the filters to prevent infinite re-renders
  const filters = useMemo(() => {
    const baseFilters = getBestOddsFilters();
    return {
      ...baseFilters,
      minLiquidity: typeof dbMinLiquidity === 'string' ? Number(dbMinLiquidity) : (dbMinLiquidity ?? 0),
    };
  }, [getBestOddsFilters, dbMinLiquidity]);
  
  // Wrapper to update minLiquidity through arbitrage filters (shared across tools)
  const updateFiltersWithLiquidity = useCallback(async (updates: Parameters<typeof updateBestOddsFilters>[0] & { minLiquidity?: number }) => {
    const { minLiquidity, ...bestOddsUpdates } = updates;
    
    // Update best odds-specific filters
    if (Object.keys(bestOddsUpdates).length > 0) {
      await updateBestOddsFilters(bestOddsUpdates as Parameters<typeof updateBestOddsFilters>[0]);
    }
    
    // Update shared minLiquidity through arbitrage filters
    if (minLiquidity !== undefined) {
      await updateArbitrageFilters({ minLiquidity });
    }
  }, [updateBestOddsFilters, updateArbitrageFilters]);
  
  return {
    filters,
    updateFilters: updateFiltersWithLiquidity,
    isLoading,
  };
}

export function usePositiveEvPreferences() {
  const { getPositiveEvFilters, updatePositiveEvFilters, updateArbitrageFilters, isLoading, preferences } = usePreferences();
  
  // Extract the specific values we care about to ensure proper memoization
  const dbSharpPreset = preferences?.positive_ev_sharp_preset;
  const dbSelectedSports = preferences?.positive_ev_selected_sports;
  const dbDevigMethods = preferences?.positive_ev_devig_methods;
  const dbEvCase = preferences?.positive_ev_case;
  const dbMinEv = preferences?.positive_ev_min_ev;
  const dbMaxEv = preferences?.positive_ev_max_ev;
  const dbMode = preferences?.positive_ev_mode;
  const dbSelectedBooks = preferences?.positive_ev_selected_books;
  const dbSelectedMarkets = preferences?.positive_ev_selected_markets;
  const dbMinBooksPerSide = preferences?.positive_ev_min_books_per_side;
  const dbShowHidden = preferences?.best_odds_show_hidden;
  // Use shared min liquidity from arbitrage prefs (syncs across all tools)
  const dbMinLiquidity = preferences?.arbitrage_min_liquidity;
  
  // Compute filters from preferences (or defaults if not loaded)
  const filters = useMemo(() => {
    const f = {
      selectedBooks: dbSelectedBooks ?? [],
      selectedSports: dbSelectedSports ?? ['nba', 'nfl'],
      selectedMarkets: dbSelectedMarkets ?? [],
      sharpPreset: dbSharpPreset ?? 'pinnacle',
      devigMethods: dbDevigMethods ?? ['power', 'multiplicative'],
      evCase: (dbEvCase as 'worst' | 'best') ?? 'worst',
      minEv: typeof dbMinEv === 'string' ? Number(dbMinEv) : (dbMinEv ?? 2),
      maxEv: dbMaxEv ?? undefined,
      mode: (dbMode as 'pregame' | 'live' | 'all') ?? 'pregame',
      minBooksPerSide: typeof dbMinBooksPerSide === 'string' ? Number(dbMinBooksPerSide) : (dbMinBooksPerSide ?? 2),
      showHidden: dbShowHidden ?? false,
      minLiquidity: typeof dbMinLiquidity === 'string' ? Number(dbMinLiquidity) : (dbMinLiquidity ?? 0),
    };
    
    console.log('[usePositiveEvPreferences] Computed:', {
      isLoading,
      hasPrefs: !!preferences,
      rawSports: dbSelectedSports,
      rawPreset: dbSharpPreset,
      computedSports: f.selectedSports,
      computedPreset: f.sharpPreset
    });
    
    return f;
  }, [isLoading, preferences, dbSharpPreset, dbSelectedSports, dbDevigMethods, dbEvCase, dbMinEv, dbMaxEv, dbMode, dbSelectedBooks, dbSelectedMarkets, dbMinBooksPerSide, dbShowHidden, dbMinLiquidity]);
  
  // Wrapper to update minLiquidity through arbitrage filters (shared across tools)
  const updateFiltersWithLiquidity = useCallback(async (updates: Parameters<typeof updatePositiveEvFilters>[0] & { minLiquidity?: number }) => {
    const { minLiquidity, ...evUpdates } = updates;
    
    console.log('[PositiveEV] updateFiltersWithLiquidity called:', { updates, minLiquidity, evUpdates });
    
    // Update EV-specific filters
    if (Object.keys(evUpdates).length > 0) {
      await updatePositiveEvFilters(evUpdates);
    }
    
    // Update shared minLiquidity through arbitrage filters
    if (minLiquidity !== undefined) {
      console.log('[PositiveEV] Updating arbitrage_min_liquidity to:', minLiquidity);
      await updateArbitrageFilters({ minLiquidity });
    }
  }, [updatePositiveEvFilters, updateArbitrageFilters]);
  
  return {
    filters,
    updateFilters: updateFiltersWithLiquidity,
    isLoading,
  };
}
