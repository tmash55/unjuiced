"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/libs/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";

// ============================================================================
// TYPES
// ============================================================================

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
  
  // Books snapshot
  books_snapshot: Record<string, {
    price: number;
    u?: string;
    m?: string;
    sgp?: string | null;
  }> | null;
  
  best_price_at_save: number | null;
  best_book_at_save: string | null;
  
  // Source tracking
  source: string | null;
  
  // Notes
  notes: string | null;
  
  // Timestamps
  created_at: string;
}

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
  
  // Books snapshot
  books_snapshot?: Record<string, any> | null;
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
  
  // ─────────────────────────────────────────────────────────────────────────
  // QUERY: Get all favorites for the current user
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
        // Note: Removed start_time filter - we'll handle cleanup separately
        // since start_time is often null when saving from cheat sheets
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Favorite[];
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
  });
  
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
    
    // Mutation states
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
    isToggling: toggleMutation.isPending,
    
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

