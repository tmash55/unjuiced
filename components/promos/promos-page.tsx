"use client";

import { useState, useCallback } from "react";
import { CalendarDays, Wrench } from "lucide-react";
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
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
        <p>We&apos;re working on getting the promo feed updated.</p>
      </div>
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
