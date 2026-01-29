"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/libs/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Snapshot of a single book's odds for a saved bet.
 * Uses short keys to minimize storage: u=url/link, m=mobile link, sgp=SGP token
 */
export interface BookSnapshot {
  price: number;           // American odds as number
  u?: string | null;       // Desktop bet link (short key for storage)
  m?: string | null;       // Mobile deep link (short key for storage)
  sgp?: string | null;     // SGP token for same-game parlay API calls
}

/**
 * Live odds data returned from refresh-odds API
 */
export interface RefreshedOdds {
  favorite_id: string;
  odds_key: string;
  current_best_price: number | null;
  current_best_book: string | null;
  current_best_link: string | null;
  current_sgp: string | null;
  all_books: Array<{
    book: string;
    price: number;
    decimal: number;
    link: string | null;
    sgp: string | null;
  }>;
  is_available: boolean;
  line: number | null;
}

/**
 * Response from refresh-odds API
 */
export interface RefreshOddsResponse {
  refreshed: RefreshedOdds[];
  count: number;
  available: number;
}

/**
 * Database schema for user_favorites table.
 * Only includes fields that actually exist in the database.
 */
export interface Favorite {
  id: string;
  user_id: string;
  
  // Type: 'player' or 'game'
  type: "player" | "game";
  
  // Event context
  sport: string;
  event_id: string;
  game_date: string | null;
  home_team: string | null;
  away_team: string | null;
  start_time: string | null;
  
  // Player fields (null for game type)
  player_id: string | null;
  player_name: string | null;
  player_team: string | null;
  player_position: string | null;
  
  // Market details
  market: string;
  line: number | null;
  side: string;
  
  // Odds lookup
  odds_key: string | null;
  odds_selection_id: string | null;
  
  // Books snapshot - all sportsbooks' odds at time of save
  // Format: { book_id: { price, u?, m?, sgp? } }
  books_snapshot: Record<string, BookSnapshot> | null;
  
  best_price_at_save: number | null;
  best_book_at_save: string | null;
  
  // Source tracking
  source: string | null;
  
  // Notes
  notes: string | null;
  
  // Timestamps
  created_at: string;
  
  // Expiry status
  status: "active" | "expired";
  expired_at: string | null;
  expire_reason: "live" | "start_time" | "manual" | null;
}

/**
 * Parameters for adding a favorite.
 * Only includes fields that exist in the database table.
 */
export interface AddFavoriteParams {
  // Type
  type: "player" | "game";
  
  // Event context
  sport: string;
  event_id: string;
  game_date?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  start_time?: string | null;
  
  // Player fields
  player_id?: string | null;
  player_name?: string | null;
  player_team?: string | null;
  player_position?: string | null;
  
  // Market details
  market: string;
  line?: number | null;
  side: string;
  
  // Odds lookup
  odds_key?: string | null;
  odds_selection_id?: string | null;
  
  // Books snapshot - all sportsbooks' odds including SGP tokens
  books_snapshot?: Record<string, BookSnapshot> | null;
  best_price_at_save?: number | null;
  best_book_at_save?: string | null;
  
  // Source
  source?: string | null;
  
  // Notes
  notes?: string | null;
}

// ============================================================================
// HELPER: Create a unique key for a favorite (for checking if already exists)
// ============================================================================

export function createFavoriteKey(params: {
  event_id: string;
  type: "player" | "game";
  player_id?: string | null;
  market: string;
  line?: number | null;
  side: string;
}): string {
  // Normalize line to 1 decimal place to avoid floating point precision issues
  const normalizedLine = params.line != null 
    ? Number(params.line).toFixed(1) 
    : "null";
  // Normalize player_id to string for consistent comparison
  const normalizedPlayerId = params.player_id ? String(params.player_id) : "game";
  
  return `${params.event_id}:${params.type}:${normalizedPlayerId}:${params.market}:${normalizedLine}:${params.side}`;
}

// ============================================================================
// HOOK: useFavorites
// ============================================================================

export function useFavorites() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { user } = useAuth();
  
  // Track previous favorite IDs to detect expirations (excludes temp IDs from optimistic updates)
  const prevFavoriteIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  // Track IDs that were manually deleted so we don't show "expired" toast for them
  const manuallyDeletedIdsRef = useRef<Set<string>>(new Set());
  
  // ─────────────────────────────────────────────────────────────────────────
  // QUERY: Get all active favorites for the current user
  // ─────────────────────────────────────────────────────────────────────────
  const {
    data: favorites = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_favorites")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active") // Only fetch active favorites
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Favorite[];
    },
    enabled: !!user?.id,
    staleTime: 15 * 1000, // 15 seconds - faster detection of expired favorites
    refetchInterval: 60 * 1000, // Poll every 60 seconds to detect expirations
  });
  
  // ─────────────────────────────────────────────────────────────────────────
  // EFFECT: Detect expired favorites and show toast
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    
    // Only track real IDs (not temp- IDs from optimistic updates)
    const currentIds = new Set(
      favorites
        .filter(f => !f.id.startsWith("temp-"))
        .map(f => f.id)
    );
    
    // Skip on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      prevFavoriteIdsRef.current = currentIds;
      return;
    }
    
    // Count how many favorites disappeared that weren't manually deleted
    const expiredIds = [...prevFavoriteIdsRef.current].filter(
      id => !currentIds.has(id) && !manuallyDeletedIdsRef.current.has(id)
    );
    const expiredCount = expiredIds.length;
    
    // Clear any manually deleted IDs that are no longer relevant
    manuallyDeletedIdsRef.current.clear();
    
    // Show toast if any favorites expired (and we had previous favorites)
    if (expiredCount > 0 && prevFavoriteIdsRef.current.size > 0) {
      toast.info(
        `${expiredCount} favorite${expiredCount > 1 ? "s" : ""} expired (game started)`,
        { duration: 4000 }
      );
    }
    
    prevFavoriteIdsRef.current = currentIds;
  }, [favorites, isLoading]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // Create a Set of favorite keys for fast lookup
  // ─────────────────────────────────────────────────────────────────────────
  const favoriteKeys = new Set(
    favorites.map((f) =>
      createFavoriteKey({
        event_id: f.event_id,
        type: f.type,
        player_id: f.player_id,
        market: f.market,
        line: f.line,
        side: f.side,
      })
    )
  );
  
  // Create a map from key to favorite for quick lookup
  const favoritesByKey = new Map<string, Favorite>();
  favorites.forEach((f) => {
    const key = createFavoriteKey({
      event_id: f.event_id,
      type: f.type,
      player_id: f.player_id,
      market: f.market,
      line: f.line,
      side: f.side,
    });
    favoritesByKey.set(key, f);
  });
  
  // ─────────────────────────────────────────────────────────────────────────
  // MUTATION: Add a favorite
  // ─────────────────────────────────────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: async (params: AddFavoriteParams) => {
      if (!user?.id) throw new Error("Must be logged in to add favorites");
      
      const { data, error } = await supabase
        .from("user_favorites")
        .insert({
          user_id: user.id,
          ...params,
        })
        .select()
        .single();
      
      if (error) {
        // Handle unique constraint violation (already favorited)
        if (error.code === "23505") {
          throw new Error("Already in favorites");
        }
        throw error;
      }
      
      return data as Favorite;
    },
    onSuccess: () => {
      // Invalidate and refetch favorites
      queryClient.invalidateQueries({ queryKey: ["favorites", user?.id] });
    },
  });
  
  // ─────────────────────────────────────────────────────────────────────────
  // MUTATION: Remove a favorite by ID
  // ─────────────────────────────────────────────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: async (favoriteId: string) => {
      if (!user?.id) throw new Error("Must be logged in to remove favorites");
      
      // Track this ID as manually deleted so we don't show "expired" toast
      manuallyDeletedIdsRef.current.add(favoriteId);
      
      const { error } = await supabase
        .from("user_favorites")
        .delete()
        .eq("id", favoriteId)
        .eq("user_id", user.id); // RLS should handle this, but be explicit
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites", user?.id] });
    },
  });
  
  // ─────────────────────────────────────────────────────────────────────────
  // MUTATION: Toggle a favorite (add if not exists, remove if exists)
  // Uses database check to avoid race conditions with stale cache
  // Includes optimistic updates for instant UI feedback
  // ─────────────────────────────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async (params: AddFavoriteParams) => {
      if (!user?.id) throw new Error("Must be logged in to toggle favorites");
      
      // Check database directly to avoid race conditions with stale cache
      let query = supabase
        .from("user_favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", params.event_id)
        .eq("type", params.type)
        .eq("market", params.market)
        .eq("side", params.side);
      
      // Handle nullable fields properly
      if (params.player_id) {
        query = query.eq("player_id", params.player_id);
      } else {
        query = query.is("player_id", null);
      }
      
      if (params.line !== null && params.line !== undefined) {
        query = query.eq("line", params.line);
      } else {
        query = query.is("line", null);
      }
      
      const { data: existingData } = await query.maybeSingle();
      
      if (existingData) {
        // Remove - it already exists
        // Track this ID as manually deleted so we don't show "expired" toast
        manuallyDeletedIdsRef.current.add(existingData.id);
        
        const { error } = await supabase
          .from("user_favorites")
          .delete()
          .eq("id", existingData.id);
        
        if (error) throw error;
        return { action: "removed" as const, favoriteId: existingData.id, params };
      } else {
        // Add - it doesn't exist
        const { data, error } = await supabase
          .from("user_favorites")
          .insert({
            user_id: user.id,
            ...params,
          })
          .select()
          .single();
        
        // Handle race condition: if duplicate key error, it was just added by another request
        if (error) {
          if (error.code === "23505") {
            // Already exists - treat as success, just refetch
            return { action: "already_exists" as const, params };
          }
          throw error;
        }
        return { action: "added" as const, favorite: data as Favorite, params };
      }
    },
    // Optimistic update: immediately update cache before server responds
    onMutate: async (params) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["favorites", user?.id] });
      
      // Snapshot the previous value
      const previousFavorites = queryClient.getQueryData<Favorite[]>(["favorites", user?.id]);
      
      // Check if this item is currently favorited
      const key = createFavoriteKey({
        event_id: params.event_id,
        type: params.type,
        player_id: params.player_id,
        market: params.market,
        line: params.line,
        side: params.side,
      });
      
      const isCurrentlyFavorited = previousFavorites?.some(f => 
        createFavoriteKey({
          event_id: f.event_id,
          type: f.type,
          player_id: f.player_id,
          market: f.market,
          line: f.line,
          side: f.side,
        }) === key
      );
      
      // Optimistically update the cache
      if (isCurrentlyFavorited) {
        // Remove from cache
        queryClient.setQueryData<Favorite[]>(
          ["favorites", user?.id],
          (old) => old?.filter(f => 
            createFavoriteKey({
              event_id: f.event_id,
              type: f.type,
              player_id: f.player_id,
              market: f.market,
              line: f.line,
              side: f.side,
            }) !== key
          ) ?? []
        );
      } else {
        // Add to cache (with temporary ID)
        const tempFavorite: Favorite = {
          id: `temp-${Date.now()}`,
          user_id: user?.id ?? "",
          type: params.type,
          sport: params.sport,
          event_id: params.event_id,
          game_date: params.game_date ?? null,
          home_team: params.home_team ?? null,
          away_team: params.away_team ?? null,
          start_time: params.start_time ?? null,
          player_id: params.player_id ?? null,
          player_name: params.player_name ?? null,
          player_team: params.player_team ?? null,
          player_position: params.player_position ?? null,
          market: params.market,
          line: params.line ?? null,
          side: params.side,
          odds_key: params.odds_key ?? null,
          odds_selection_id: params.odds_selection_id ?? null,
          books_snapshot: params.books_snapshot ?? null,
          best_price_at_save: params.best_price_at_save ?? null,
          best_book_at_save: params.best_book_at_save ?? null,
          source: params.source ?? null,
          notes: params.notes ?? null,
          created_at: new Date().toISOString(),
          status: "active",
          expired_at: null,
          expire_reason: null,
        };
        queryClient.setQueryData<Favorite[]>(
          ["favorites", user?.id],
          (old) => [tempFavorite, ...(old ?? [])]
        );
      }
      
      // Return context with the snapshotted value
      return { previousFavorites };
    },
    // If mutation fails, rollback to the previous value
    onError: (err, params, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(["favorites", user?.id], context.previousFavorites);
      }
    },
    // Always refetch after error or success to sync with server
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites", user?.id] });
    },
  });
  
  // ─────────────────────────────────────────────────────────────────────────
  // MUTATION: Refresh live odds for favorites
  // ─────────────────────────────────────────────────────────────────────────
  const refreshOddsMutation = useMutation({
    mutationFn: async (favoriteIds?: string[]) => {
      // Get favorites to refresh (all or specific ones)
      const toRefresh = favoriteIds 
        ? favorites.filter(f => favoriteIds.includes(f.id))
        : favorites;
      
      if (toRefresh.length === 0) return { refreshed: [], count: 0, available: 0 };
      
      const response = await fetch("/api/v2/favorites/refresh-odds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          favorites: toRefresh.map(f => ({
            id: f.id,
            odds_key: f.odds_key,
            player_name: f.player_name,
            line: f.line,
            side: f.side,
          })),
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to refresh odds");
      }
      
      return response.json();
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Check if a specific item is favorited
  // ─────────────────────────────────────────────────────────────────────────
  const isFavorited = (params: {
    event_id: string;
    type: "player" | "game";
    player_id?: string | null;
    market: string;
    line?: number | null;
    side: string;
  }): boolean => {
    const key = createFavoriteKey(params);
    return favoriteKeys.has(key);
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // HELPER: Get a favorite by key
  // ─────────────────────────────────────────────────────────────────────────
  const getFavorite = (params: {
    event_id: string;
    type: "player" | "game";
    player_id?: string | null;
    market: string;
    line?: number | null;
    side: string;
  }): Favorite | undefined => {
    const key = createFavoriteKey(params);
    return favoritesByKey.get(key);
  };
  
  return {
    // Data
    favorites,
    favoriteKeys,
    isLoading,
    error,
    
    // Mutations
    addFavorite: addMutation.mutateAsync,
    removeFavorite: removeMutation.mutateAsync,
    toggleFavorite: toggleMutation.mutateAsync,
    refreshOdds: refreshOddsMutation.mutateAsync,
    
    // Mutation states
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
    isToggling: toggleMutation.isPending,
    isRefreshingOdds: refreshOddsMutation.isPending,
    
    // Helpers
    isFavorited,
    getFavorite,
    refetch,
    
    // Auth state
    isLoggedIn: !!user?.id,
  };
}

// ============================================================================
// HOOK: useFavoriteButton
// Simplified hook for use in table rows - handles the toggle logic
// ============================================================================

export function useFavoriteButton(params: {
  event_id: string;
  type: "player" | "game";
  player_id?: string | null;
  market: string;
  line?: number | null;
  side: string;
}) {
  const { isFavorited, toggleFavorite, isToggling, isLoggedIn } = useFavorites();
  
  const favorited = isFavorited(params);
  
  return {
    isFavorited: favorited,
    isToggling,
    isLoggedIn,
    toggle: async (additionalParams: Omit<AddFavoriteParams, keyof typeof params>) => {
      return toggleFavorite({
        ...params,
        ...additionalParams,
      });
    },
  };
}

