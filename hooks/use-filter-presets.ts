"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import {
  parseSports,
  type FilterPreset,
  type FilterPresetCreate,
  type FilterPresetUpdate,
  type FilterPresetsResponse,
} from "@/lib/types/filter-presets";

const QUERY_KEY = ["filter-presets"];

/**
 * Hook for managing user filter presets
 */
export function useFilterPresets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all presets for the user
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<FilterPresetsResponse>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/user/filter-presets");
      if (!res.ok) {
        throw new Error("Failed to fetch filter presets");
      }
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000, // 1 minute
    refetchOnWindowFocus: false,
  });

  const presets = data?.presets || [];
  const activePresets = presets.filter((p) => p.is_active);

  // Create a new preset
  const createMutation = useMutation({
    mutationFn: async (preset: FilterPresetCreate) => {
      const res = await fetch("/api/user/filter-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create preset");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Update a preset
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: FilterPresetUpdate }) => {
      const res = await fetch(`/api/user/filter-presets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update preset");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Delete a preset
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/user/filter-presets/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete preset");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Toggle a preset's active state (optimistic update)
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch(`/api/user/filter-presets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) {
        throw new Error("Failed to toggle preset");
      }
      return res.json();
    },
    // Optimistic update
    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previousData = queryClient.getQueryData<FilterPresetsResponse>(QUERY_KEY);
      
      if (previousData) {
        queryClient.setQueryData<FilterPresetsResponse>(QUERY_KEY, {
          ...previousData,
          presets: previousData.presets.map((p) =>
            p.id === id ? { ...p, is_active } : p
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

  // Helper functions
  const createPreset = (preset: FilterPresetCreate) => createMutation.mutateAsync(preset);
  const updatePreset = (id: string, updates: FilterPresetUpdate) => 
    updateMutation.mutateAsync({ id, updates });
  const deletePreset = (id: string) => deleteMutation.mutateAsync(id);
  const togglePreset = (id: string, is_active: boolean) => 
    toggleMutation.mutate({ id, is_active });

  // Get presets grouped by sport (multi-sport presets go under "multi")
  const presetsBySport = presets.reduce((acc, preset) => {
    const sports = parseSports(preset.sport);
    const key = sports.length > 1 ? "multi" : (sports[0] || "other");
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(preset);
    return acc;
  }, {} as Record<string, FilterPreset[]>);

  return {
    // Data
    presets,
    activePresets,
    presetsBySport,
    count: presets.length,
    activeCount: activePresets.length,
    
    // State
    isLoading,
    error,
    isAuthenticated: !!user,
    
    // Actions
    createPreset,
    updatePreset,
    deletePreset,
    togglePreset,
    refetch,
    
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isToggling: toggleMutation.isPending,
  };
}

