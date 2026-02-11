import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChartFiltersState } from "@/components/hit-rates/chart-filters";

/**
 * Filter Presets Hook
 * 
 * Manages user-saved filter presets for the hit rate drilldown.
 * Supports CRUD operations with server persistence.
 */

// Types - Hit Rate specific filter presets (distinct from EV/Edge filter presets)
export interface HitRateFilterPreset {
  id: string;
  userId: string;
  name: string;
  description?: string;
  quickFilters: string[];
  chartFilters: Partial<ChartFiltersState>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHitRatePresetInput {
  name: string;
  description?: string;
  quickFilters: string[];
  chartFilters: Partial<ChartFiltersState>;
}

export interface UpdateHitRatePresetInput {
  id: string;
  name?: string;
  description?: string;
  quickFilters?: string[];
  chartFilters?: Partial<ChartFiltersState>;
  isDefault?: boolean;
}

// API Fetchers - Use hit-rate specific endpoint
async function fetchPresets(): Promise<HitRateFilterPreset[]> {
  const response = await fetch("/api/user/hit-rate-filter-presets", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || "Failed to fetch presets");
  }

  const data = await response.json();
  return data.presets || [];
}

async function createPreset(input: CreateHitRatePresetInput): Promise<HitRateFilterPreset> {
  const response = await fetch("/api/user/hit-rate-filter-presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || "Failed to create preset");
  }

  const data = await response.json();
  return data.preset;
}

async function updatePreset(input: UpdateHitRatePresetInput): Promise<HitRateFilterPreset> {
  const response = await fetch("/api/user/hit-rate-filter-presets", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || "Failed to update preset");
  }

  const data = await response.json();
  return data.preset;
}

async function deletePreset(id: string): Promise<void> {
  const response = await fetch(`/api/user/hit-rate-filter-presets?id=${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error || "Failed to delete preset");
  }
}

// Main Hook
export function useHitRateFilterPresets(enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = ["hit-rate-filter-presets"];

  // Query for fetching all presets
  const query = useQuery({
    queryKey,
    queryFn: fetchPresets,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled,
  });

  // Mutation for creating a preset
  const createMutation = useMutation({
    mutationFn: createPreset,
    onSuccess: (newPreset) => {
      queryClient.setQueryData<HitRateFilterPreset[]>(queryKey, (old) => {
        return old ? [...old, newPreset] : [newPreset];
      });
    },
  });

  // Mutation for updating a preset
  const updateMutation = useMutation({
    mutationFn: updatePreset,
    onSuccess: (updatedPreset) => {
      queryClient.setQueryData<HitRateFilterPreset[]>(queryKey, (old) => {
        if (!old) return [updatedPreset];
        return old.map((p) => (p.id === updatedPreset.id ? updatedPreset : p));
      });
    },
  });

  // Mutation for deleting a preset
  const deleteMutation = useMutation({
    mutationFn: deletePreset,
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<HitRateFilterPreset[]>(queryKey, (old) => {
        if (!old) return [];
        return old.filter((p) => p.id !== deletedId);
      });
    },
  });

  return {
    // Data
    presets: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,

    // Actions
    createPreset: createMutation.mutateAsync,
    updatePreset: updateMutation.mutateAsync,
    deletePreset: deleteMutation.mutateAsync,

    // Loading states for mutations
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Errors for mutations
    createError: createMutation.error as Error | null,
    updateError: updateMutation.error as Error | null,
    deleteError: deleteMutation.error as Error | null,

    // Refetch
    refetch: query.refetch,
  };
}

// Helper to convert HitRateFilterPreset to SmartPreset format
export function hitRatePresetToSmartPreset(preset: HitRateFilterPreset) {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description || "",
    icon: null, // User presets don't have icons
    color: "from-neutral-500 to-neutral-600",
    quickFilters: preset.quickFilters,
    chartFilters: preset.chartFilters,
    isUserPreset: true,
  };
}
