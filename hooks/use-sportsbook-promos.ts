import { useQuery } from "@tanstack/react-query";
import type { PromoFilters, PromosApiResponse } from "@/lib/promos-schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayDateString(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
}

function buildQueryString(filters: PromoFilters): string {
  const params = new URLSearchParams();

  if (filters.sportsbooks.length > 0) {
    params.set("sportsbooks", filters.sportsbooks.join(","));
  }
  if (filters.sports.length > 0) {
    params.set("sports", filters.sports.join(","));
  }
  if (filters.promoTypes.length > 0) {
    params.set("promo_types", filters.promoTypes.join(","));
  }
  if (filters.newUserOnly) {
    params.set("new_user_only", "true");
  }
  if (filters.dailyOnly) {
    params.set("daily_only", "true");
  }

  const date = filters.date ?? getTodayDateString();
  params.set("date", date);

  return params.toString();
}

// ─── Query key factory ────────────────────────────────────────────────────────

export const promosQueryKeys = {
  all: ["promos"] as const,
  list: (filters: PromoFilters) =>
    ["promos", "list", filters] as const,
};

// ─── Fetch function ───────────────────────────────────────────────────────────

async function fetchPromos(filters: PromoFilters): Promise<PromosApiResponse> {
  const qs = buildQueryString(filters);
  const res = await fetch(`/api/v2/promos?${qs}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `HTTP ${res.status}`
    );
  }

  return res.json() as Promise<PromosApiResponse>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseSportsbookPromosOptions {
  filters?: Partial<PromoFilters>;
  enabled?: boolean;
}

export function useSportsbookPromos(options: UseSportsbookPromosOptions = {}) {
  const { enabled = true } = options;

  const filters: PromoFilters = {
    sportsbooks: options.filters?.sportsbooks ?? [],
    sports: options.filters?.sports ?? [],
    promoTypes: options.filters?.promoTypes ?? [],
    newUserOnly: options.filters?.newUserOnly ?? false,
    dailyOnly: options.filters?.dailyOnly ?? false,
    date: options.filters?.date ?? getTodayDateString(),
  };

  return useQuery({
    queryKey: promosQueryKeys.list(filters),
    queryFn: () => fetchPromos(filters),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}
