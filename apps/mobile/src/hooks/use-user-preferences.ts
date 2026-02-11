import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SharpPreset } from "@unjuiced/types";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/auth-provider";

type RawUserPreferences = {
  arbitrage_selected_books?: string[] | null;
  arbitrage_min_arb?: number | null;
  arbitrage_max_arb?: number | null;
  arbitrage_min_liquidity?: number | null;
  positive_ev_selected_books?: string[] | null;
  positive_ev_selected_sports?: string[] | null;
  positive_ev_sharp_preset?: string | null;
  positive_ev_min_ev?: number | null;
  positive_ev_max_ev?: number | null;
  positive_ev_min_books_per_side?: number | null;
};

export type UserPreferencesState = {
  arbitrageSelectedBooks: string[];
  arbitrageMinArb: number;
  arbitrageMaxArb: number;
  arbitrageMinLiquidity: number;
  positiveEvSelectedBooks: string[];
  positiveEvSelectedSports: string[];
  positiveEvSharpPreset: SharpPreset;
  positiveEvMinEv: number;
  positiveEvMaxEv?: number;
  positiveEvMinBooksPerSide: number;
};

type PreferenceUpdates = Partial<{
  arbitrage_selected_books: string[];
  arbitrage_min_arb: number;
  arbitrage_max_arb: number;
  arbitrage_min_liquidity: number;
  positive_ev_selected_books: string[];
  positive_ev_selected_sports: string[];
  positive_ev_sharp_preset: SharpPreset;
  positive_ev_min_ev: number;
  positive_ev_max_ev: number | null;
  positive_ev_min_books_per_side: number;
}>;

const QUERY_KEY = ["user-preferences-mobile"];

function toNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toArray(value: string[] | null | undefined, fallback: string[]): string[] {
  return Array.isArray(value) ? value : fallback;
}

function normalizePreferences(raw: RawUserPreferences | null | undefined): UserPreferencesState {
  return {
    arbitrageSelectedBooks: toArray(raw?.arbitrage_selected_books, []),
    arbitrageMinArb: toNumber(raw?.arbitrage_min_arb, 0),
    arbitrageMaxArb: toNumber(raw?.arbitrage_max_arb, 20),
    arbitrageMinLiquidity: toNumber(raw?.arbitrage_min_liquidity, 50),
    positiveEvSelectedBooks: toArray(raw?.positive_ev_selected_books, []),
    positiveEvSelectedSports: toArray(raw?.positive_ev_selected_sports, ["nba", "nfl"]),
    positiveEvSharpPreset: (raw?.positive_ev_sharp_preset || "pinnacle") as SharpPreset,
    positiveEvMinEv: toNumber(raw?.positive_ev_min_ev, 2),
    positiveEvMaxEv:
      typeof raw?.positive_ev_max_ev === "number" && Number.isFinite(raw.positive_ev_max_ev)
        ? raw.positive_ev_max_ev
        : undefined,
    positiveEvMinBooksPerSide: toNumber(raw?.positive_ev_min_books_per_side, 2)
  };
}

const SELECT_COLUMNS = [
  "arbitrage_selected_books",
  "arbitrage_min_arb",
  "arbitrage_max_arb",
  "arbitrage_min_liquidity",
  "positive_ev_selected_books",
  "positive_ev_selected_sports",
  "positive_ev_sharp_preset",
  "positive_ev_min_ev",
  "positive_ev_max_ev",
  "positive_ev_min_books_per_side"
].join(",");

export function useUserPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: [...QUERY_KEY, userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_preferences")
        .select(SELECT_COLUMNS)
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as RawUserPreferences | null) ?? null;
    }
  });

  const mutation = useMutation({
    mutationFn: async (updates: PreferenceUpdates) => {
      if (!userId) return null;
      const payload = {
        id: userId,
        ...updates,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from("user_preferences")
        .upsert(payload, { onConflict: "id", ignoreDuplicates: false })
        .select(SELECT_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      return (data as RawUserPreferences | null) ?? null;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([...QUERY_KEY, userId], data);
    }
  });

  const preferences = useMemo(() => normalizePreferences(query.data), [query.data]);

  return {
    preferences,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isSaving: mutation.isPending,
    error: query.error ?? mutation.error ?? null,
    savePreferences: mutation.mutateAsync
  };
}
