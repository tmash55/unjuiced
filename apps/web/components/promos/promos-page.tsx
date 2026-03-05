"use client";

import { useState, useCallback } from "react";
import { CalendarDays } from "lucide-react";
import { AppPageLayout } from "@/components/layout/app-page-layout";
import { PromosFilterBar } from "./promos-filter-bar";
import { PromosTable } from "./promos-table";
import { useSportsbookPromos } from "@/hooks/use-sportsbook-promos";
import { DEFAULT_PROMO_FILTERS, type PromoFilters } from "@/lib/promos-schema";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PromosPage() {
  const [filters, setFilters] = useState<PromoFilters>(DEFAULT_PROMO_FILTERS);

  const handleFiltersChange = useCallback((next: PromoFilters) => {
    setFilters(next);
  }, []);

  const { data, isLoading, error } = useSportsbookPromos({ filters });

  const promos = data?.promos ?? [];
  const total = data?.total ?? 0;
  const collectedDate = data?.collected_date ?? null;
  const countsBySportsbook = data?.counts_by_sportsbook ?? {};

  return (
    <AppPageLayout
      title="Promos & Boosts"
      subtitle="Daily sportsbook promotions, boosts, and free bets — all in one place."
      headerActions={
        collectedDate ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400 text-sm font-medium">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{formatDate(collectedDate)}</span>
          </div>
        ) : null
      }
      contextBar={
        <PromosFilterBar
          filters={filters}
          onChange={handleFiltersChange}
          totalCount={total}
          isLoading={isLoading}
          countsBySportsbook={countsBySportsbook}
        />
      }
      stickyContextBar
    >
      <PromosTable
        promos={promos}
        isLoading={isLoading}
        error={
          error
            ? error instanceof Error
              ? error.message
              : String(error)
            : null
        }
      />
    </AppPageLayout>
  );
}
