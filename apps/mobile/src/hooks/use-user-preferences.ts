import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SharpPreset } from "@unjuiced/types";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/providers/auth-provider";

type RawUserPreferences = {
  preferred_sportsbooks?: string[] | null;
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
  best_odds_selected_sports?: string[] | null;
  best_odds_selected_markets?: string[] | null;
  best_odds_market_lines?: Record<string, number[]> | null;
  best_odds_min_improvement?: number | null;
  best_odds_max_odds?: number | null;
  best_odds_min_odds?: number | null;
  best_odds_comparison_mode?: "average" | "book" | "next_best" | null;
  best_odds_comparison_book?: string | null;
  ev_bankroll?: number | null;
  ev_kelly_percent?: number | null;
};

export type UserPreferencesState = {
  preferredSportsbooks: string[];
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
  bestOddsSelectedSports?: string[];
  bestOddsSelectedMarkets: string[];
  bestOddsMarketLines: Record<string, number[]>;
  bestOddsMinImprovement: number;
  bestOddsMaxOdds?: number;
  bestOddsMinOdds?: number;
  bestOddsComparisonMode: "average" | "book" | "next_best";
  bestOddsComparisonBook?: string | null;
  evBankroll: number;
  evKellyPercent: number;
};

type PreferenceUpdates = Partial<{
  preferred_sportsbooks: string[];
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
  best_odds_selected_sports: string[] | null;
  best_odds_selected_markets: string[];
  best_odds_market_lines: Record<string, number[]>;
  best_odds_min_improvement: number;
  best_odds_max_odds: number | null;
  best_odds_min_odds: number | null;
  best_odds_comparison_mode: "average" | "book" | "next_best";
  best_odds_comparison_book: string | null;
  ev_bankroll: number;
  ev_kelly_percent: number;
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
    preferredSportsbooks: toArray(raw?.preferred_sportsbooks, []),
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
    positiveEvMinBooksPerSide: toNumber(raw?.positive_ev_min_books_per_side, 2),
    bestOddsSelectedSports:
      raw?.best_odds_selected_sports !== null && raw?.best_odds_selected_sports !== undefined
        ? toArray(raw.best_odds_selected_sports, ["nba", "nfl"])
        : undefined,
    bestOddsSelectedMarkets: toArray(raw?.best_odds_selected_markets, []),
    bestOddsMarketLines: raw?.best_odds_market_lines && typeof raw.best_odds_market_lines === "object"
      ? raw.best_odds_market_lines
      : {},
    bestOddsMinImprovement: toNumber(raw?.best_odds_min_improvement, 0),
    bestOddsMaxOdds:
      typeof raw?.best_odds_max_odds === "number" && Number.isFinite(raw.best_odds_max_odds)
        ? raw.best_odds_max_odds
        : undefined,
    bestOddsMinOdds:
      typeof raw?.best_odds_min_odds === "number" && Number.isFinite(raw.best_odds_min_odds)
        ? raw.best_odds_min_odds
        : undefined,
    bestOddsComparisonMode: raw?.best_odds_comparison_mode ?? "average",
    bestOddsComparisonBook: raw?.best_odds_comparison_book ?? null,
    evBankroll: toNumber(raw?.ev_bankroll, 1000),
    evKellyPercent: toNumber(raw?.ev_kelly_percent, 25),
  };
}

const SELECT_COLUMNS = [
  "preferred_sportsbooks",
  "arbitrage_selected_books",
  "arbitrage_min_arb",
  "arbitrage_max_arb",
  "arbitrage_min_liquidity",
  "positive_ev_selected_books",
  "positive_ev_selected_sports",
  "positive_ev_sharp_preset",
  "positive_ev_min_ev",
  "positive_ev_max_ev",
  "positive_ev_min_books_per_side",
  "best_odds_selected_sports",
  "best_odds_selected_markets",
  "best_odds_market_lines",
  "best_odds_min_improvement",
  "best_odds_max_odds",
  "best_odds_min_odds",
  "best_odds_comparison_mode",
  "best_odds_comparison_book",
  "ev_bankroll",
  "ev_kelly_percent"
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
