"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMarketLabel } from "@/lib/data/markets";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type {
  LineHistoryApiRequest,
  LineHistoryApiResponse,
  LineHistoryBookData,
  LineHistoryContext,
} from "@/lib/odds/line-history";
import type { TimeRangeKey } from "@/lib/line-history/types";
import { SHARP_BOOKS } from "@/lib/ev/constants";

import { BookLegend } from "@/components/line-history/book-legend";
import { UnifiedLineChart } from "@/components/line-history/unified-line-chart";
import { TimeRangeSelector } from "@/components/line-history/time-range-selector";
import { StatsTable } from "@/components/line-history/stats-table";
import { SummaryStats } from "@/components/line-history/summary-stats";
import { CLVTracker } from "@/components/line-history/clv-tracker";
import { ExportChartButton } from "@/components/line-history/export-chart-button";
import { ChartHelpButton } from "@/components/line-history/chart-help-button";
import { useEVTimeline } from "@/components/line-history/ev-overlay";

const SHARP_BOOK_IDS = Object.keys(SHARP_BOOKS);

interface LineHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: LineHistoryContext | null;
}

export function LineHistoryDialog({ open, onOpenChange, context }: LineHistoryDialogProps) {
  const isMobile = useIsMobile();
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [bookDataById, setBookDataById] = useState<Record<string, LineHistoryBookData>>({});
  const [loadingBookIds, setLoadingBookIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hiddenBookIds, setHiddenBookIds] = useState<Set<string>>(new Set());
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("all");
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);

  /* ── Derived book lists ───────────────────────────────────────────── */

  const visibleBookIds = useMemo(
    () => selectedBookIds.filter((id) => !hiddenBookIds.has(id)),
    [selectedBookIds, hiddenBookIds]
  );

  const allBookIds = useMemo(() => {
    if (!context) return [];
    const seed = [
      ...(context.allBookIds || []),
      ...(context.bestBookId ? [context.bestBookId] : []),
      ...(context.compareBookIds || []),
    ];
    return Array.from(new Set(seed.filter(Boolean)));
  }, [context]);

  const priorityBookIds = useMemo(() => {
    if (!context) return [];
    return Array.from(
      new Set(
        [context.bestBookId, ...(context.compareBookIds || [])]
          .filter(Boolean)
          .filter((bookId): bookId is string => !!bookId)
      )
    );
  }, [context]);

  const addableBooks = useMemo(
    () => allBookIds.filter((bookId) => !selectedBookIds.includes(bookId)),
    [allBookIds, selectedBookIds]
  );

  const isChartLoading = useMemo(
    () => visibleBookIds.some((bookId) => loadingBookIds.has(bookId) && !bookDataById[bookId]),
    [visibleBookIds, loadingBookIds, bookDataById]
  );

  const noHistoryBooks = useMemo(
    () =>
      selectedBookIds.filter((bookId) => {
        const item = bookDataById[bookId];
        if (!item || loadingBookIds.has(bookId)) return false;
        return item.status !== "ok" || (item.entries?.length || 0) === 0;
      }),
    [selectedBookIds, bookDataById, loadingBookIds]
  );

  const noHistoryBookNames = useMemo(
    () => noHistoryBooks.map((bookId) => getSportsbookById(bookId)?.name || bookId),
    [noHistoryBooks]
  );

  const noHistorySummary = useMemo(() => {
    if (noHistoryBookNames.length === 0) return "";
    if (noHistoryBookNames.length <= 3) return noHistoryBookNames.join(", ");
    return `${noHistoryBookNames.slice(0, 3).join(", ")} +${noHistoryBookNames.length - 3} more`;
  }, [noHistoryBookNames]);

  /* ── EV overlay hook ──────────────────────────────────────────────── */

  const { evTimeline, showEV, isLoadingOpposite, canShowEV, toggleEV } = useEVTimeline({
    context,
    bookDataById,
  });

  /* ── Data fetching ────────────────────────────────────────────────── */

  const fetchBooks = useCallback(
    async (books: string[], options?: { addToSelected?: boolean; silent?: boolean }) => {
      if (!context || books.length === 0) return;

      const targetBooks = Array.from(new Set(books.filter(Boolean)));
      if (targetBooks.length === 0) return;

      setLoadingBookIds((prev) => {
        const next = new Set(prev);
        targetBooks.forEach((bookId) => next.add(bookId));
        return next;
      });
      if (!options?.silent) setErrorMessage(null);

      try {
        const payload: LineHistoryApiRequest = { context, books: targetBooks };
        const response = await fetch("/api/v2/odds/line-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed to load line history (${response.status})`);
        }

        const data = (await response.json()) as LineHistoryApiResponse;
        const incoming = Array.isArray(data?.books) ? data.books : [];

        setBookDataById((prev) => {
          const next = { ...prev };
          incoming.forEach((item) => {
            next[item.bookId] = item;
          });
          return next;
        });

        if (options?.addToSelected) {
          setSelectedBookIds((prev) => Array.from(new Set([...prev, ...targetBooks])));
        }
      } catch (error) {
        if (!options?.silent) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load line history.");
        }
      } finally {
        setLoadingBookIds((prev) => {
          const next = new Set(prev);
          targetBooks.forEach((bookId) => next.delete(bookId));
          return next;
        });
      }
    },
    [context]
  );

  /* ── Smarter initial selection ────────────────────────────────────── */

  useEffect(() => {
    if (!open || !context) return;

    setBookDataById({});
    setErrorMessage(null);
    setTimeRange("all");
    setMobileDetailsOpen(false);

    // Select ALL books, but hide everything except bestBook + first sharp from compareBookIds
    const firstBooks = priorityBookIds.length > 0 ? priorityBookIds : allBookIds.slice(0, 1);
    const remaining = allBookIds.filter((bookId) => !firstBooks.includes(bookId));
    const initialSelected = [...firstBooks, ...remaining];
    setSelectedBookIds(initialSelected);

    // Determine which books to show on chart initially (bestBook + first sharp)
    const initialVisible = new Set<string>();
    if (context.bestBookId) initialVisible.add(context.bestBookId);
    const firstSharp = (context.compareBookIds || []).find((id) => SHARP_BOOK_IDS.includes(id));
    if (firstSharp) initialVisible.add(firstSharp);
    // If no specific best/sharp, show all priority books
    if (initialVisible.size === 0) {
      firstBooks.forEach((id) => initialVisible.add(id));
    }
    const initialHidden = new Set(initialSelected.filter((id) => !initialVisible.has(id)));
    setHiddenBookIds(initialHidden);

    // Fetch priority books immediately, remaining after 250ms delay
    void fetchBooks(firstBooks, { addToSelected: false });

    if (remaining.length > 0) {
      const timer = window.setTimeout(() => {
        void fetchBooks(remaining, { silent: true });
      }, 250);
      return () => window.clearTimeout(timer);
    }
  }, [open, context, priorityBookIds, allBookIds, fetchBooks]);

  /* ── Legend toggle handlers ───────────────────────────────────────── */

  const handleToggleBook = useCallback((bookId: string) => {
    setHiddenBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setHiddenBookIds(new Set());
  }, []);

  const handleDeselectAll = useCallback(() => {
    setHiddenBookIds(new Set(selectedBookIds));
  }, [selectedBookIds]);

  /* ── Title ────────────────────────────────────────────────────────── */

  const selectionTitle = useMemo(() => {
    if (!context) return "Line History";
    const selection =
      context.selectionName ||
      context.playerName ||
      context.team ||
      `${context.awayTeam || ""} @ ${context.homeTeam || ""}`.trim();
    const rawMarket = context.marketDisplay || context.market;
    const market = rawMarket && rawMarket.includes("_") ? formatMarketLabel(rawMarket) : rawMarket;
    return selection ? `${selection} · ${market}` : market;
  }, [context]);

  const bestBookData = context?.bestBookId ? bookDataById[context.bestBookId] : undefined;

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-3rem)] lg:max-w-[1200px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-3 sm:px-5 pr-16 sm:pr-24 py-2.5 sm:py-3 border-b border-neutral-200/70 dark:border-neutral-800/70">
          <div className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 min-w-0">
            <div className="min-w-0">
              <DialogTitle className="text-[18px] sm:text-lg font-semibold tracking-tight">Historical Line Movement</DialogTitle>
              <DialogDescription className="text-[11px] sm:text-sm text-neutral-500 truncate">
                {selectionTitle || "Selection history"}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {canShowEV && (
                <button
                  type="button"
                  onClick={toggleEV}
                  className={cn(
                    "px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all",
                    showEV
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                      : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  )}
                >
                  {isLoadingOpposite ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      EV
                    </span>
                  ) : isMobile ? (
                    "EV"
                  ) : (
                    "EV Overlay"
                  )}
                </button>
              )}
              <ChartHelpButton canShowEV={canShowEV} />
              <ExportChartButton chartRef={chartRef} selectionTitle={selectionTitle || "line-history"} />
              <TimeRangeSelector value={timeRange} onChange={setTimeRange} className={isMobile ? "" : "mr-3"} />
            </div>
          </div>
        </DialogHeader>

        <div className="px-3 sm:px-5 py-2.5 sm:py-4 space-y-2.5 sm:space-y-3 max-h-[calc(100vh-7.5rem)] sm:max-h-[calc(100vh-10rem)] overflow-y-auto overflow-x-hidden">
          {errorMessage && (
            <div className="rounded-lg border border-red-300/70 dark:border-red-900/70 bg-red-50/70 dark:bg-red-950/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          {selectedBookIds.length > 0 && (
            <>
              <BookLegend
                bookIds={selectedBookIds}
                hiddenBookIds={hiddenBookIds}
                loadingBookIds={loadingBookIds}
                isMobile={isMobile}
                onToggle={handleToggleBook}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
              />

              <UnifiedLineChart
                bookIds={visibleBookIds}
                bookDataById={bookDataById}
                timeRange={timeRange}
                isLoading={isChartLoading}
                isMobile={isMobile}
                evTimeline={evTimeline}
                showEV={showEV}
                chartRef={chartRef}
              />

              {/* Summary stats for primary book */}
              <SummaryStats bookData={bestBookData} isMobile={isMobile} />

              {/* CLV tracker + reverse line movement badges */}
              <CLVTracker
                bestBookData={bestBookData}
                bookDataById={bookDataById}
                compareBookIds={context?.compareBookIds || []}
                isMobile={isMobile}
              />

              {noHistoryBookNames.length > 0 && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-amber-700 dark:text-amber-300">
                  No historical data for {isMobile ? noHistorySummary : noHistoryBookNames.join(", ")} at this time. Current odds may still be available.
                </div>
              )}

              {isMobile ? (
                <div className="rounded-md border border-neutral-200/70 dark:border-neutral-800/70 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMobileDetailsOpen((prev) => !prev)}
                    className="w-full px-2.5 py-2 flex items-center justify-between text-[11px] font-semibold text-neutral-300 bg-neutral-900/30"
                  >
                    <span>Book Details (OLV, CLV, Current)</span>
                    {mobileDetailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {mobileDetailsOpen && (
                    <div className="p-1.5">
                      <StatsTable bookIds={selectedBookIds} bookDataById={bookDataById} isMobile={isMobile} />
                    </div>
                  )}
                </div>
              ) : (
                <StatsTable bookIds={selectedBookIds} bookDataById={bookDataById} isMobile={isMobile} />
              )}
            </>
          )}

          {selectedBookIds.length === 0 && (
            <div className="rounded-xl border border-neutral-200/70 dark:border-neutral-800/70 p-5 text-sm text-neutral-500 text-center">
              No books selected for historical lookup.
            </div>
          )}

          {addableBooks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Add Sportsbooks</p>
              <div className="flex flex-wrap gap-2">
                {addableBooks.map((bookId) => {
                  const meta = getSportsbookById(bookId);
                  const name = meta?.name || bookId;
                  const loading = loadingBookIds.has(bookId);
                  return (
                    <button
                      key={bookId}
                      type="button"
                      onClick={() => {
                        if (bookDataById[bookId]) {
                          setSelectedBookIds((prev) => Array.from(new Set([...prev, bookId])));
                          return;
                        }
                        void fetchBooks([bookId], { addToSelected: true });
                      }}
                      disabled={loading}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                        "border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600",
                        "bg-neutral-50 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300",
                        loading && "opacity-60 cursor-wait"
                      )}
                    >
                      {loading ? `Loading ${name}...` : name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
