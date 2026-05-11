"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMarketLabel } from "@/lib/data/markets";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { useIsMobile } from "@/hooks/use-media-query";
import { useEntitlements } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, LineChart, Loader2, Lock } from "lucide-react";
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

function hasLineHistoryAccess(plan?: string | null): boolean {
  return plan === "sharp" || plan === "elite" || plan === "admin" || plan === "unlimited";
}

function LineMovementPreview() {
  const points = [
    { x: 0, y: 58 },
    { x: 16, y: 58 },
    { x: 16, y: 48 },
    { x: 32, y: 48 },
    { x: 32, y: 66 },
    { x: 48, y: 66 },
    { x: 48, y: 40 },
    { x: 67, y: 40 },
    { x: 67, y: 25 },
    { x: 84, y: 25 },
    { x: 84, y: 34 },
    { x: 100, y: 34 },
  ];
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-sky-400/20 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.16),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200/70">
        <span>Line Movement</span>
        <span>Preview</span>
      </div>
      <div className="relative h-44 rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:25%_33.33%]" />
        <svg viewBox="0 0 100 80" className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] overflow-visible">
          <path d={path} fill="none" stroke="rgba(56,189,248,0.2)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          <path d={path} fill="none" stroke="rgb(56,189,248)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {[points[2], points[6], points[8], points[10]].map((point, index) => (
            <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="2.6" fill={index % 2 === 0 ? "rgb(34,197,94)" : "rgb(248,113,113)"} />
          ))}
        </svg>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-neutral-400">
          <span>Open +1700</span>
          <span>Current +2200</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {[
          ["CLV", "+500"],
          ["Moves", "24"],
          ["Books", "6"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</div>
            <div className="mt-1 font-bold tabular-nums text-white">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LineHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: LineHistoryContext | null;
  sideContexts?: Partial<Record<"over" | "under", LineHistoryContext | null>>;
}

export function LineHistoryDialog({ open, onOpenChange, context, sideContexts }: LineHistoryDialogProps) {
  const isMobile = useIsMobile();
  const chartRef = useRef<HTMLDivElement>(null);
  const { data: entitlements, isLoading: isLoadingEntitlements } = useEntitlements();
  const [activeSide, setActiveSide] = useState<"over" | "under">(context?.side === "under" ? "under" : "over");
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [bookDataById, setBookDataById] = useState<Record<string, LineHistoryBookData>>({});
  const [loadingBookIds, setLoadingBookIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hiddenBookIds, setHiddenBookIds] = useState<Set<string>>(new Set());
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("all");
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const canViewLineHistory = !isLoadingEntitlements && !!entitlements?.authenticated && hasLineHistoryAccess(entitlements?.plan);
  const accessKnown = !isLoadingEntitlements;
  const showLockedState = open && accessKnown && !canViewLineHistory;
  const availableSideContexts = useMemo(
    () => ({
      over: sideContexts?.over || null,
      under: sideContexts?.under || null,
    }),
    [sideContexts]
  );
  const hasSideSwitcher = !!availableSideContexts.over && !!availableSideContexts.under;
  const activeContext = hasSideSwitcher
    ? availableSideContexts[activeSide] || availableSideContexts.over || availableSideContexts.under || context
    : context;
  const lockedStateCopy = entitlements?.authenticated
    ? {
        title: "Line movement is a Sharp tool",
        description: "Upgrade to Sharp or Elite to compare historical price movement, CLV, opening lines, and book-by-book steam before you add a play.",
        cta: "View plans",
        href: "/pricing",
      }
    : {
        title: "Sign in to view line movement",
        description: "Line movement is available to signed-in Sharp and Elite members.",
        cta: "Sign in",
        href: "/login",
      };

  /* ── Derived book lists ───────────────────────────────────────────── */

  const visibleBookIds = useMemo(
    () => selectedBookIds.filter((id) => !hiddenBookIds.has(id)),
    [selectedBookIds, hiddenBookIds]
  );

  const allBookIds = useMemo(() => {
    if (!activeContext) return [];
    const seed = [
      ...(activeContext.allBookIds || []),
      ...(activeContext.bestBookId ? [activeContext.bestBookId] : []),
      ...(activeContext.compareBookIds || []),
    ];
    return Array.from(new Set(seed.filter(Boolean)));
  }, [activeContext]);

  const priorityBookIds = useMemo(() => {
    if (!activeContext) return [];
    return Array.from(
      new Set(
        [activeContext.bestBookId, ...(activeContext.compareBookIds || [])]
          .filter(Boolean)
          .filter((bookId): bookId is string => !!bookId)
      )
    );
  }, [activeContext]);

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
    context: activeContext,
    bookDataById,
  });

  /* ── Data fetching ────────────────────────────────────────────────── */

  const fetchBooks = useCallback(
    async (books: string[], options?: { addToSelected?: boolean; silent?: boolean }) => {
      if (!activeContext || books.length === 0 || !canViewLineHistory) return;

      const targetBooks = Array.from(new Set(books.filter(Boolean)));
      if (targetBooks.length === 0) return;

      setLoadingBookIds((prev) => {
        const next = new Set(prev);
        targetBooks.forEach((bookId) => next.add(bookId));
        return next;
      });
      if (!options?.silent) setErrorMessage(null);

      try {
        const payload: LineHistoryApiRequest = { context: activeContext, books: targetBooks };
        const response = await fetch("/api/v2/odds/line-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          throw new Error("Sign in to view historical line movement.");
        }
        if (response.status === 403) {
          throw new Error("Historical line movement is available on Sharp and Elite plans.");
        }
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
    [canViewLineHistory, activeContext]
  );

  /* ── Smarter initial selection ────────────────────────────────────── */

  useEffect(() => {
    if (!open || !activeContext) return;

    setBookDataById({});
    setErrorMessage(null);
    setTimeRange("all");
    setMobileDetailsOpen(false);

    if (!canViewLineHistory) {
      setSelectedBookIds([]);
      setHiddenBookIds(new Set());
      setLoadingBookIds(new Set());
      return;
    }

    // Select ALL books, but hide everything except bestBook + first sharp from compareBookIds
    const firstBooks = priorityBookIds.length > 0 ? priorityBookIds : allBookIds.slice(0, 1);
    const remaining = allBookIds.filter((bookId) => !firstBooks.includes(bookId));
    const initialSelected = [...firstBooks, ...remaining];
    setSelectedBookIds(initialSelected);

    // Determine which books to show on chart initially (bestBook + first sharp)
    const initialVisible = new Set<string>();
    if (activeContext.bestBookId) initialVisible.add(activeContext.bestBookId);
    const firstSharp = (activeContext.compareBookIds || []).find((id) => SHARP_BOOK_IDS.includes(id));
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
  }, [open, activeContext, canViewLineHistory, priorityBookIds, allBookIds, fetchBooks]);

  useEffect(() => {
    if (!open || !context?.side) return;
    setActiveSide(context.side === "under" ? "under" : "over");
  }, [open, context?.side]);

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
    if (!activeContext) return "Line History";
    const selection =
      activeContext.selectionName ||
      activeContext.playerName ||
      activeContext.team ||
      `${activeContext.awayTeam || ""} @ ${activeContext.homeTeam || ""}`.trim();
    const rawMarket = activeContext.marketDisplay || activeContext.market;
    const market = rawMarket && rawMarket.includes("_") ? formatMarketLabel(rawMarket) : rawMarket;
    return selection ? `${selection} · ${market}` : market;
  }, [activeContext]);

  const bestBookData = activeContext?.bestBookId ? bookDataById[activeContext.bestBookId] : undefined;
  const bestBookName = activeContext?.bestBookId ? getSportsbookById(activeContext.bestBookId)?.name || activeContext.bestBookId : null;
  const visibleCount = visibleBookIds.length;
  const totalCount = selectedBookIds.length;
  const sourceLabel =
    activeContext?.source === "positive_ev"
      ? "EV Tool"
      : activeContext?.source === "edge"
        ? "Edge Finder"
      : activeContext?.source === "betslip"
        ? "My Betslip"
        : activeContext?.source === "prop_center"
          ? "Prop Center"
          : null;
  const sectionClass = "rounded-[20px] border border-neutral-200/80 dark:border-neutral-800/80 bg-white/85 dark:bg-neutral-950/65 shadow-[0_20px_55px_-32px_rgba(15,23,42,0.55)] backdrop-blur-sm";

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="top-2 sm:top-[50%] left-[50%] translate-x-[-50%] translate-y-0 sm:translate-y-[-50%] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] sm:w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-3rem)] lg:max-w-[1200px] max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100vh-2rem)] p-0 gap-0 overflow-hidden border border-neutral-200/80 dark:border-neutral-800/90 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_28%),linear-gradient(180deg,_rgba(252,252,253,0.98),_rgba(245,247,250,0.96))] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_28%),linear-gradient(180deg,_rgba(8,12,18,0.98),_rgba(4,8,14,0.98))] shadow-[0_28px_90px_-40px_rgba(15,23,42,0.85)]"
      >
        <DialogHeader className="px-3 sm:px-5 pr-16 sm:pr-24 py-3 sm:py-4 border-b border-neutral-200/70 dark:border-neutral-800/80 bg-white/55 dark:bg-neutral-950/35 backdrop-blur-sm">
          <div className="flex flex-col items-start gap-3 min-w-0">
            <div className="flex w-full flex-col items-start sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 min-w-0">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {sourceLabel && (
                    <span className="inline-flex items-center rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">
                      {sourceLabel}
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                    {visibleCount}/{Math.max(totalCount, visibleCount)} books visible
                  </span>
                  {bestBookName && (
                    <span className="inline-flex items-center rounded-full border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-white/5 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                      Focus: {bestBookName}
                    </span>
                  )}
                </div>
                <DialogTitle className="text-[19px] sm:text-[21px] font-semibold tracking-tight text-neutral-950 dark:text-white">Historical Line Movement</DialogTitle>
                <DialogDescription className="text-[11px] sm:text-sm text-neutral-500 truncate max-w-[760px]">
                  {showLockedState ? "Sharp and Elite plan feature" : selectionTitle || "Selection history"}
                </DialogDescription>
                {hasSideSwitcher && (
                  <div className="mt-2 inline-flex max-w-full rounded-xl border border-neutral-200 bg-neutral-100/80 p-1 dark:border-neutral-800 dark:bg-white/[0.04]">
                    {(["over", "under"] as const).map((side) => {
                      const sideContext = availableSideContexts[side];
                      const label = sideContext?.selectionName || sideContext?.team || (side === "over" ? "Away / Over" : "Home / Under");
                      const active = activeSide === side;
                      return (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setActiveSide(side)}
                          className={cn(
                            "max-w-[180px] truncate rounded-lg px-3 py-1.5 text-xs font-black transition-colors",
                            active
                              ? "bg-white text-neutral-950 shadow-sm dark:bg-sky-500/20 dark:text-sky-100"
                              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:justify-end">
                {!showLockedState && canShowEV && (
                  <button
                    type="button"
                    onClick={toggleEV}
                    className={cn(
                      "px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all shadow-sm",
                      showEV
                        ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-700 dark:text-emerald-300"
                        : "border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
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
                {!showLockedState && (
                  <>
                    <ChartHelpButton canShowEV={canShowEV} />
                    <ExportChartButton chartRef={chartRef} selectionTitle={selectionTitle || "line-history"} />
                    <TimeRangeSelector value={timeRange} onChange={setTimeRange} className={isMobile ? "" : "ml-1"} />
                  </>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="px-3 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4 max-h-[calc(100dvh-6.5rem)] sm:max-h-[calc(100vh-10rem)] overflow-y-auto overflow-x-hidden overscroll-contain">
          {isLoadingEntitlements && (
            <div className="rounded-[20px] border border-neutral-200/70 dark:border-neutral-800/70 p-6 text-sm text-neutral-500 text-center bg-white/80 dark:bg-neutral-950/60">
              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-brand" />
              Checking line movement access...
            </div>
          )}

          {showLockedState && (
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <section className={cn(sectionClass, "p-5 sm:p-6")}>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300">
                  <Lock className="h-4 w-4" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {lockedStateCopy.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                  {lockedStateCopy.description}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <a
                    href={lockedStateCopy.href}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-sky-400 active:scale-[0.98]"
                  >
                    <LineChart className="h-4 w-4" />
                    {lockedStateCopy.cta}
                  </a>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Historical prices, OLV, CLV, and movement depth.
                  </span>
                </div>
              </section>
              <LineMovementPreview />
            </div>
          )}

          {!showLockedState && !isLoadingEntitlements && (
            <>
          {errorMessage && (
            <div className="rounded-2xl border border-red-300/70 dark:border-red-900/70 bg-red-50/80 dark:bg-red-950/25 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          {selectedBookIds.length > 0 && (
            <>
              <section className={cn(sectionClass, "px-3 sm:px-4 py-3")}>
                <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">Sportsbooks</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Toggle books on and off to compare movement and isolate sharper signals.
                    </p>
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {visibleCount} visible of {totalCount}
                  </div>
                </div>
                <BookLegend
                  bookIds={selectedBookIds}
                  hiddenBookIds={hiddenBookIds}
                  loadingBookIds={loadingBookIds}
                  isMobile={isMobile}
                  onToggle={handleToggleBook}
                  onSelectAll={handleSelectAll}
                  onDeselectAll={handleDeselectAll}
                />
              </section>

              <section className={cn(sectionClass, "px-2 sm:px-3 py-2 sm:py-3")}>
                <div className="px-1 sm:px-2 pb-2.5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">Movement Chart</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Step history across visible books with opening, current, and steam inflection points.
                    </p>
                  </div>
                </div>
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
              </section>

              <section className={cn(sectionClass, "px-3 sm:px-4 py-3 space-y-3")}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">Snapshot</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {bestBookName ? `${bestBookName} is being used as the primary reference book.` : "Primary book snapshot and closing line value indicators."}
                    </p>
                  </div>
                </div>

                <SummaryStats bookData={bestBookData} isMobile={isMobile} />

                <CLVTracker
                  bestBookData={bestBookData}
                  bookDataById={bookDataById}
                  compareBookIds={activeContext?.compareBookIds || []}
                  isMobile={isMobile}
                />
              </section>

              {noHistoryBookNames.length > 0 && (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 sm:px-3.5 py-2 text-[11px] sm:text-xs text-amber-700 dark:text-amber-300">
                  No historical data for {isMobile ? noHistorySummary : noHistoryBookNames.join(", ")} at this time. Current odds may still be available.
                </div>
              )}

              {isMobile ? (
                <div className={cn(sectionClass, "overflow-hidden")}>
                  <button
                    type="button"
                    onClick={() => setMobileDetailsOpen((prev) => !prev)}
                    className="w-full px-3 py-3 flex items-center justify-between text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 bg-neutral-100/80 dark:bg-white/5"
                  >
                    <span>Book Details</span>
                    {mobileDetailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {mobileDetailsOpen && (
                    <div className="px-2 pb-2 pt-1">
                      <StatsTable bookIds={selectedBookIds} bookDataById={bookDataById} isMobile={isMobile} />
                    </div>
                  )}
                </div>
              ) : (
                <section className={cn(sectionClass, "px-3 sm:px-4 py-3")}>
                  <div className="mb-2.5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">Book Details</p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Opening line value, closing line value, current price, move, age, and history depth by book.</p>
                    </div>
                  </div>
                  <StatsTable bookIds={selectedBookIds} bookDataById={bookDataById} isMobile={isMobile} />
                </section>
              )}
            </>
          )}

          {selectedBookIds.length === 0 && (
            <div className="rounded-[20px] border border-neutral-200/70 dark:border-neutral-800/70 p-5 text-sm text-neutral-500 text-center bg-white/80 dark:bg-neutral-950/60">
              No books selected for historical lookup.
            </div>
          )}

          {addableBooks.length > 0 && (
            <section className={cn(sectionClass, "px-3 sm:px-4 py-3 space-y-2.5")}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Add Sportsbooks</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Pull in additional books for comparison without reopening the modal.</p>
              </div>
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
                        "px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors shadow-sm",
                        "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700",
                        "bg-white/85 dark:bg-white/5 text-neutral-700 dark:text-neutral-300",
                        loading && "opacity-60 cursor-wait"
                      )}
                    >
                      {loading ? `Loading ${name}...` : name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
