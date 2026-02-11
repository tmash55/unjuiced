"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/libs/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { Favorite } from "./use-favorites";

// ============================================================================
// TYPES
// ============================================================================

export interface BetslipItem {
  id: string;
  betslip_id: string;
  favorite_id: string;
  position: number;
  odds_snapshot: Record<string, { price: number }> | null;
  created_at: string;
  // Joined favorite data
  favorite?: Favorite;
}

// SGP odds cache types
export interface SgpBookOdds {
  price?: string; // American odds string e.g., "+425" (omitted if error)
  links?: {
    desktop: string;
    mobile: string;
  };
  limits?: {
    max?: number;
    min?: number;
  };
  error?: string; // Error message if this book doesn't support the combo
  legs_supported?: number; // Number of legs this book has odds for
  total_legs?: number; // Total number of legs in the betslip
  has_all_legs?: boolean; // True if book has odds for all legs
}

export type SgpOddsCache = Record<string, SgpBookOdds>;

export type BetType = 'individual' | 'parlay' | 'sgp' | 'sgp_plus';

export interface Betslip {
  id: string;
  user_id: string;
  name: string;
  color: string;
  notes: string | null;
  best_book: string | null;
  best_odds: number | null;
  odds_by_book: Record<string, number> | null;
  legs_count: number;
  status: "draft" | "placed" | "won" | "lost" | "void";
  is_public: boolean;
  public_slug: string | null;
  placed_at: string | null;
  placed_book: string | null;
  placed_odds: number | null;
  stake_amount: number | null;
  potential_payout: number | null;
  created_at: string;
  updated_at: string;
  // SGP odds cache
  sgp_odds_cache: SgpOddsCache | null;
  sgp_odds_updated_at: string | null;
  bet_type: BetType | null;
  // Joined items
  items?: BetslipItem[];
}

// Response from SGP odds API
export interface SgpOddsResponse {
  odds: SgpOddsCache;
  bet_type: BetType;
  updated_at: string | null;
  from_cache: boolean;
  legs_hash?: string;
  cache_age_seconds?: number;
  cache_stats?: {
    redis_hits: number;
    vendor_calls: number;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a stable hash for betslip legs
 * Used to detect when legs were added/removed
 */
export function calculateLegsHash(items: BetslipItem[]): string {
  const favoriteIds = items
    .map(item => item.favorite?.id)
    .filter(Boolean)
    .sort() as string[];
  
  // Simple djb2 hash (matches backend)
  let hash = 5381;
  const str = favoriteIds.join("|");
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Check if SGP odds are stale
 * Returns time since last update in ms, or null if no cache
 */
export function getSgpOddsAge(betslip: Betslip): number | null {
  if (!betslip.sgp_odds_updated_at) return null;
  return Date.now() - new Date(betslip.sgp_odds_updated_at).getTime();
}

/**
 * Check if betslip legs changed since last SGP fetch
 * (legs added or removed)
 */
export function didLegsChange(betslip: Betslip, lastLegsHash: string | null): boolean {
  if (!lastLegsHash) return false;
  const currentHash = calculateLegsHash(betslip.items || []);
  return currentHash !== lastLegsHash;
}

export interface CreateBetslipParams {
  name: string;
  color?: string;
  notes?: string;
  favorite_ids?: string[]; // Initial favorites to add
}

export interface UpdateBetslipParams {
  id: string;
  name?: string;
  color?: string;
  notes?: string;
  status?: Betslip["status"];
  is_public?: boolean;
  placed_book?: string;
  placed_odds?: number;
  stake_amount?: number;
}

export interface AddToBetslipParams {
  betslip_id: string;
  favorite_ids: string[];
}

export interface AddToBetslipResult {
  added: string[];
  skipped: Array<{
    favoriteId: string;
    reason: string;
    conflictingFavoriteId?: string;
    playerName?: string;
    market?: string;
  }>;
  replaced: Array<{
    oldFavoriteId: string;
    newFavoriteId: string;
    playerName?: string;
    market?: string;
    reason: string;
  }>;
}

/**
 * Creates a unique key for detecting duplicate player/event/market combinations
 */
function getSelectionKey(fav: {
  player_id?: string | null;
  event_id?: string;
  market?: string;
}): string | null {
  // Only applies to player props
  if (!fav.player_id || !fav.event_id || !fav.market) return null;
  return `${fav.player_id}:${fav.event_id}:${fav.market}`;
}

// ============================================================================
// COLORS
// ============================================================================

export const BETSLIP_COLORS = [
  { id: "yellow", name: "Yellow", class: "bg-yellow-500" },
  { id: "blue", name: "Blue", class: "bg-blue-500" },
  { id: "green", name: "Green", class: "bg-emerald-500" },
  { id: "red", name: "Red", class: "bg-red-500" },
  { id: "purple", name: "Purple", class: "bg-purple-500" },
  { id: "orange", name: "Orange", class: "bg-orange-500" },
] as const;

export const getColorClass = (color: string): string => {
  return BETSLIP_COLORS.find((c) => c.id === color)?.class || "bg-yellow-500";
};

// ============================================================================
// HOOK
// ============================================================================

export function useBetslips() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const isLoggedIn = !!user;

  // Fetch all betslips with their items
  const {
    data: betslips = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["betslips", user?.id],
    queryFn: async (): Promise<Betslip[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_betslips")
        .select(`
          *,
          items:user_betslip_items(
            *,
            favorite:user_favorites(*)
          )
        `)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Betslip[];
    },
    enabled: isLoggedIn,
    staleTime: 1000 * 30, // 30 seconds
  });

  // Create a new betslip
  const createMutation = useMutation({
    mutationFn: async (params: CreateBetslipParams): Promise<Betslip> => {
      if (!user) throw new Error("Not authenticated");

      // Create the betslip
      const { data: betslip, error: betslipError } = await supabase
        .from("user_betslips")
        .insert({
          user_id: user.id,
          name: params.name,
          color: params.color || "yellow",
          notes: params.notes || null,
        })
        .select()
        .single();

      if (betslipError) throw betslipError;

      // Add initial favorites if provided
      if (params.favorite_ids && params.favorite_ids.length > 0) {
        const items = params.favorite_ids.map((fav_id, index) => ({
          betslip_id: betslip.id,
          favorite_id: fav_id,
          position: index,
        }));

        const { error: itemsError } = await supabase
          .from("user_betslip_items")
          .insert(items);

        if (itemsError) throw itemsError;
      }

      return betslip as Betslip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["betslips", user?.id] });
    },
  });

  // Update a betslip
  const updateMutation = useMutation({
    mutationFn: async (params: UpdateBetslipParams): Promise<Betslip> => {
      if (!user) throw new Error("Not authenticated");

      const { id, ...updates } = params;
      const { data, error } = await supabase
        .from("user_betslips")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data as Betslip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["betslips", user?.id] });
    },
  });

  // Delete a betslip
  const deleteMutation = useMutation({
    mutationFn: async (betslipId: string): Promise<void> => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_betslips")
        .delete()
        .eq("id", betslipId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["betslips", user?.id] });
    },
  });

  // Add favorites to a betslip with duplicate detection
  const addItemsMutation = useMutation({
    mutationFn: async (params: AddToBetslipParams): Promise<AddToBetslipResult> => {
      if (!user) throw new Error("Not authenticated");

      const result: AddToBetslipResult = {
        added: [],
        skipped: [],
        replaced: [],
      };

      // Fetch the favorites being added
      const { data: newFavorites, error: fetchError } = await supabase
        .from("user_favorites")
        .select("id, player_id, player_name, event_id, market, line, side")
        .in("id", params.favorite_ids);

      if (fetchError) throw fetchError;
      if (!newFavorites || newFavorites.length === 0) {
        return result;
      }

      // Fetch existing favorites in this betslip
      const { data: existingItems } = await supabase
        .from("user_betslip_items")
        .select(`
          id,
          favorite_id,
          position,
          favorite:user_favorites(id, player_id, player_name, event_id, market, line, side)
        `)
        .eq("betslip_id", params.betslip_id);

      // Build a map of existing selection keys -> existing favorite
      const existingSelectionMap = new Map<string, {
        favoriteId: string;
        itemId: string;
        line: number | null;
        playerName: string | null;
        market: string;
      }>();

      if (existingItems) {
        for (const item of existingItems) {
          const fav = item.favorite as any;
          if (!fav) continue;
          const key = getSelectionKey(fav);
          if (key) {
            existingSelectionMap.set(key, {
              favoriteId: fav.id,
              itemId: item.id,
              line: fav.line,
              playerName: fav.player_name,
              market: fav.market,
            });
          }
        }
      }

      // Also check for duplicates within the new favorites being added
      const newSelectionMap = new Map<string, typeof newFavorites[0]>();
      const favoritesToAdd: string[] = [];
      const favoritesToReplace: Array<{ oldFavoriteId: string; newFavoriteId: string; oldItemId: string }> = [];

      for (const fav of newFavorites) {
        const key = getSelectionKey(fav);

        // Check if this conflicts with an existing selection in the betslip
        if (key && existingSelectionMap.has(key)) {
          const existing = existingSelectionMap.get(key)!;
          const newLine = fav.line ?? 0;
          const existingLine = existing.line ?? 0;

          // Prefer higher line (e.g., 25 points over 10 points)
          if (newLine > existingLine) {
            // Replace existing with new (higher line)
            favoritesToReplace.push({
              oldFavoriteId: existing.favoriteId,
              newFavoriteId: fav.id,
              oldItemId: existing.itemId,
            });
            result.replaced.push({
              oldFavoriteId: existing.favoriteId,
              newFavoriteId: fav.id,
              playerName: fav.player_name,
              market: fav.market,
              reason: `Replaced ${existing.line} line with ${fav.line} line`,
            });
          } else {
            // Skip new, keep existing (existing has higher or equal line)
            result.skipped.push({
              favoriteId: fav.id,
              reason: existingLine === newLine 
                ? `Already in betslip` 
                : `Lower line than existing (${existingLine})`,
              conflictingFavoriteId: existing.favoriteId,
              playerName: fav.player_name,
              market: fav.market,
            });
          }
          continue;
        }

        // Check if this conflicts with another new selection being added
        if (key && newSelectionMap.has(key)) {
          const other = newSelectionMap.get(key)!;
          const newLine = fav.line ?? 0;
          const otherLine = other.line ?? 0;

          if (newLine > otherLine) {
            // Replace the other one with this one (higher line)
            const otherKey = getSelectionKey(other)!;
            // Remove the other from favoritesToAdd if it was added
            const otherIndex = favoritesToAdd.indexOf(other.id);
            if (otherIndex !== -1) {
              favoritesToAdd.splice(otherIndex, 1);
            }
            result.skipped.push({
              favoriteId: other.id,
              reason: `Lower line than ${fav.line}`,
              conflictingFavoriteId: fav.id,
              playerName: other.player_name,
              market: other.market,
            });
            newSelectionMap.set(key, fav);
            favoritesToAdd.push(fav.id);
            result.added.push(fav.id);
          } else {
            // Skip this one (other has higher or equal line)
            result.skipped.push({
              favoriteId: fav.id,
              reason: otherLine === newLine 
                ? `Duplicate selection` 
                : `Lower line than ${otherLine}`,
              conflictingFavoriteId: other.id,
              playerName: fav.player_name,
              market: fav.market,
            });
          }
          continue;
        }

        // No conflict, add it
        if (key) {
          newSelectionMap.set(key, fav);
        }
        favoritesToAdd.push(fav.id);
        result.added.push(fav.id);
      }

      // Execute replacements (delete old, add new)
      for (const replacement of favoritesToReplace) {
        await supabase
          .from("user_betslip_items")
          .delete()
          .eq("id", replacement.oldItemId);
        
        favoritesToAdd.push(replacement.newFavoriteId);
      }

      // Get current max position
      const { data: existingPositions } = await supabase
        .from("user_betslip_items")
        .select("position")
        .eq("betslip_id", params.betslip_id)
        .order("position", { ascending: false })
        .limit(1);

      const startPosition = existingPositions?.[0]?.position ?? -1;

      // Insert new items
      if (favoritesToAdd.length > 0) {
        const items = favoritesToAdd.map((fav_id, index) => ({
          betslip_id: params.betslip_id,
          favorite_id: fav_id,
          position: startPosition + 1 + index,
        }));

        const { error } = await supabase
          .from("user_betslip_items")
          .upsert(items, { onConflict: "betslip_id,favorite_id" });

        if (error) throw error;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["betslips", user?.id] });
    },
  });

  // Remove a favorite from a betslip
  const removeItemMutation = useMutation({
    mutationFn: async ({
      betslipId,
      favoriteId,
    }: {
      betslipId: string;
      favoriteId: string;
    }): Promise<void> => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_betslip_items")
        .delete()
        .eq("betslip_id", betslipId)
        .eq("favorite_id", favoriteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["betslips", user?.id] });
    },
  });

  // Fetch SGP odds from OddsBlaze API
  const fetchSgpOddsMutation = useMutation({
    mutationFn: async ({
      betslipId,
      forceRefresh = false,
      sportsbooks,
    }: {
      betslipId: string;
      forceRefresh?: boolean;
      sportsbooks?: string[];
    }): Promise<SgpOddsResponse> => {
      if (!user) throw new Error("Not authenticated");

      const response = await fetch("/api/v2/sgp-odds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betslip_id: betslipId,
          force_refresh: forceRefresh,
          sportsbooks,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch SGP odds");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate betslips query to refresh the cached odds
      queryClient.invalidateQueries({ queryKey: ["betslips", user?.id] });
    },
  });

  return {
    betslips,
    isLoading,
    error,
    isLoggedIn,

    // Mutations
    createBetslip: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateBetslip: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    deleteBetslip: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,

    addToBetslip: addItemsMutation.mutateAsync,
    isAddingItems: addItemsMutation.isPending,

    removeFromBetslip: removeItemMutation.mutateAsync,
    isRemovingItem: removeItemMutation.isPending,

    fetchSgpOdds: fetchSgpOddsMutation.mutateAsync,
    isFetchingSgpOdds: fetchSgpOddsMutation.isPending,
  };
}
