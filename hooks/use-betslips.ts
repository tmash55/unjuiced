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
  price: string; // American odds string e.g., "+425"
  links?: {
    desktop: string;
    mobile: string;
  };
  limits?: {
    max?: number;
    min?: number;
  };
  error?: string; // Error message if this book doesn't support the combo
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

  // Add favorites to a betslip
  const addItemsMutation = useMutation({
    mutationFn: async (params: AddToBetslipParams): Promise<void> => {
      if (!user) throw new Error("Not authenticated");

      // Get current max position
      const { data: existing } = await supabase
        .from("user_betslip_items")
        .select("position")
        .eq("betslip_id", params.betslip_id)
        .order("position", { ascending: false })
        .limit(1);

      const startPosition = existing?.[0]?.position ?? -1;

      const items = params.favorite_ids.map((fav_id, index) => ({
        betslip_id: params.betslip_id,
        favorite_id: fav_id,
        position: startPosition + 1 + index,
      }));

      const { error } = await supabase
        .from("user_betslip_items")
        .upsert(items, { onConflict: "betslip_id,favorite_id" });

      if (error) throw error;
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
    }): Promise<{
      odds: SgpOddsCache;
      bet_type: BetType;
      updated_at: string | null;
      from_cache: boolean;
    }> => {
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
