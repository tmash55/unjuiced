"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import type {
  EvModel,
  EvModelCreate,
  EvModelUpdate,
  EvModelsResponse,
} from "@/lib/types/ev-models";
import { DEFAULT_MODEL_COLOR, parseEvSports } from "@/lib/types/ev-models";

const QUERY_KEY = ["ev-models"];

/**
 * Hook for managing user EV models
 * 
 * Similar to useFilterPresets but for Positive EV tool custom models.
 * Models define which sharp books to devig against and optional sport/market filters.
 * Devig methods and EV thresholds come from global settings.
 */
export function useEvModels() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all models for the user
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<EvModelsResponse>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/user/ev-models");
      if (!res.ok) {
        throw new Error("Failed to fetch EV models");
      }
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000, // 1 minute
    refetchOnWindowFocus: false,
  });

  const models = data?.models || [];
  const activeModels = models.filter((m) => m.is_active);
  const favoriteModels = models.filter((m) => m.is_favorite);

  // Create a new model (with optimistic update for faster UX)
  const createMutation = useMutation({
    mutationFn: async (model: EvModelCreate) => {
      const res = await fetch("/api/user/ev-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(model),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create model");
      }
      return res.json();
    },
    // Optimistic update for instant UI feedback
    onMutate: async (newModel) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previousData = queryClient.getQueryData<EvModelsResponse>(QUERY_KEY);
      
      if (previousData) {
        // Create a temporary model object for optimistic display
        const tempModel: EvModel = {
          id: `temp-${Date.now()}`, // Temporary ID
          user_id: user?.id || "",
          name: newModel.name,
          notes: newModel.notes || null,
          color: newModel.color ?? DEFAULT_MODEL_COLOR,
          sport: newModel.sport,
          markets: newModel.markets || null,
          market_type: newModel.market_type || "all",
          sharp_books: newModel.sharp_books,
          book_weights: newModel.book_weights || null,
          fallback_mode: newModel.fallback_mode || "hide",
          fallback_weights: newModel.fallback_weights || null,
          min_books_reference: newModel.min_books_reference ?? 2,
          is_active: true,
          is_favorite: newModel.is_favorite || false,
          sort_order: previousData.models.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        queryClient.setQueryData<EvModelsResponse>(QUERY_KEY, {
          ...previousData,
          models: [...previousData.models, tempModel],
          count: previousData.count + 1,
        });
      }
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Revert to previous state on error
      if (context?.previousData) {
        queryClient.setQueryData(QUERY_KEY, context.previousData);
      }
    },
    onSettled: () => {
      // Always refetch after mutation to get the real data
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Update a model
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: EvModelUpdate }) => {
      const res = await fetch(`/api/user/ev-models/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update model");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Delete a model
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/user/ev-models/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete model");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Toggle a model's active state (optimistic update)
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch(`/api/user/ev-models/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) {
        throw new Error("Failed to toggle model");
      }
      return res.json();
    },
    // Optimistic update
    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previousData = queryClient.getQueryData<EvModelsResponse>(QUERY_KEY);
      
      if (previousData) {
        queryClient.setQueryData<EvModelsResponse>(QUERY_KEY, {
          ...previousData,
          models: previousData.models.map((m) =>
            m.id === id ? { ...m, is_active } : m
          ),
        });
      }
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(QUERY_KEY, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Toggle a model's favorite state (optimistic update)
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const res = await fetch(`/api/user/ev-models/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite }),
      });
      if (!res.ok) {
        throw new Error("Failed to toggle favorite");
      }
      return res.json();
    },
    // Optimistic update
    onMutate: async ({ id, is_favorite }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previousData = queryClient.getQueryData<EvModelsResponse>(QUERY_KEY);
      
      if (previousData) {
        queryClient.setQueryData<EvModelsResponse>(QUERY_KEY, {
          ...previousData,
          models: previousData.models.map((m) =>
            m.id === id ? { ...m, is_favorite } : m
          ),
        });
      }
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(QUERY_KEY, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Deactivate all models
  const deactivateAllMutation = useMutation({
    mutationFn: async () => {
      // Deactivate each active model
      const activeIds = activeModels.map((m) => m.id);
      await Promise.all(
        activeIds.map((id) =>
          fetch(`/api/user/ev-models/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: false }),
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Helper functions
  const createModel = (model: EvModelCreate) => createMutation.mutateAsync(model);
  const updateModel = (id: string, updates: EvModelUpdate) =>
    updateMutation.mutateAsync({ id, updates });
  const deleteModel = (id: string) => deleteMutation.mutateAsync(id);
  const toggleModel = (id: string, is_active: boolean) =>
    toggleMutation.mutateAsync({ id, is_active });
  const toggleFavorite = (id: string, is_favorite: boolean) =>
    toggleFavoriteMutation.mutateAsync({ id, is_favorite });
  const deactivateAll = () => deactivateAllMutation.mutateAsync();

  // Get models grouped by sport
  const modelsBySport = models.reduce((acc, model) => {
    const sports = parseEvSports(model.sport);
    const key = sports.length === 0
      ? "all"
      : sports.length > 1
        ? "multi"
        : sports[0];
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(model);
    return acc;
  }, {} as Record<string, EvModel[]>);

  return {
    // Data
    models,
    activeModels,
    favoriteModels,
    modelsBySport,
    count: models.length,
    activeCount: activeModels.length,
    favoriteCount: favoriteModels.length,
    
    // State
    isLoading,
    error,
    isAuthenticated: !!user,
    
    // Actions
    createModel,
    updateModel,
    deleteModel,
    toggleModel,
    toggleFavorite,
    deactivateAll,
    refetch,
    
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isToggling: toggleMutation.isPending,
    isTogglingFavorite: toggleFavoriteMutation.isPending,
    isDeactivatingAll: deactivateAllMutation.isPending,
  };
}
