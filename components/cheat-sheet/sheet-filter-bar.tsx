"use client";

import React, { useEffect } from "react";
import { Search, X, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMlbGameDates } from "@/hooks/use-mlb-game-dates";
import { useMediaQuery } from "@/hooks/use-media-query";

// ── Primitives ──────────────────────────────────────────────────────────────

/** Segmented control — pill-style toggle group */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fullWidth,
}: {
  options: { label: string; value: T; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  /** When true, buttons expand to fill available width (useful for mobile stacked layouts) */
  fullWidth?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-0.5 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60", fullWidth && "w-full")}>
      {options.map((opt) => (
        <button
          key={opt.value}
          disabled={opt.disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1.5 md:py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
            fullWidth && "flex-1 text-center",
            value === opt.value
              ? "bg-white dark:bg-neutral-700 text-brand shadow-sm"
              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
            opt.disabled && "opacity-40 cursor-not-allowed"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Vertical divider between filter groups */
export function FilterDivider() {
  return <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700/40 shrink-0" />;
}

/** Labeled filter group — small uppercase title sits above the control(s) */
export function FilterGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 min-w-0", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-500 leading-none select-none">
        {label}
      </span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

/** Search input with icon and clear button */
export function FilterSearch({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full md:w-40 pl-7 pr-7 py-2 md:py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all text-neutral-700 dark:text-neutral-300"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2"
        >
          <X className="w-3 h-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300" />
        </button>
      )}
    </div>
  );
}

/** Result count badge */
export function FilterCount({ count, label }: { count: number; label: string }) {
  return (
    <span className="text-xs text-neutral-500 tabular-nums shrink-0">
      <span className="font-bold text-neutral-900 dark:text-white">{count}</span>{" "}
      {label}
    </span>
  );
}

// ── Date Nav ────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string): string {
  const d = new Date(`${getValidDateOrToday(dateStr)}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getTodayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function isValidDateValue(dateStr: string | null | undefined): dateStr is string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getValidDateOrToday(dateStr: string | null | undefined): string {
  return isValidDateValue(dateStr) ? dateStr : getTodayET();
}

/** Date navigator with prev/next and calendar picker — always on the left */
export function DateNav({
  selectedDate,
  onDateChange,
  availableDates: externalDates,
}: {
  selectedDate: string;
  onDateChange: (date: string) => void;
  availableDates?: string[];
}) {
  const gameDates = useMlbGameDates();
  const availableDates = externalDates ?? gameDates;
  const safeSelectedDate = getValidDateOrToday(selectedDate);

  useEffect(() => {
    if (selectedDate !== safeSelectedDate) {
      onDateChange(safeSelectedDate);
    }
  }, [onDateChange, safeSelectedDate, selectedDate]);

  let currentIdx = availableDates.indexOf(safeSelectedDate);
  if (currentIdx === -1) {
    currentIdx = availableDates.findIndex((d) => d > safeSelectedDate);
    if (currentIdx === -1) currentIdx = availableDates.length;
  }

  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < availableDates.length - 1;

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => hasPrev && onDateChange(availableDates[currentIdx - 1])}
        disabled={!hasPrev}
        className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5 text-neutral-500" />
      </button>
      <div className="group relative">
        <div
          aria-hidden="true"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors group-hover:bg-neutral-100 group-focus-within:ring-2 group-focus-within:ring-brand/30 dark:group-hover:bg-neutral-800"
        >
          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
          {formatShortDate(safeSelectedDate)}
        </div>
        <input
          type="date"
          value={safeSelectedDate}
          aria-label="Choose date"
          onChange={(e) => {
            if (e.target.value) onDateChange(getValidDateOrToday(e.target.value));
          }}
          className="absolute inset-0 h-full w-full cursor-pointer rounded-md opacity-0"
        />
      </div>
      <button
        type="button"
        onClick={() => {
          if (currentIdx < availableDates.length - 1) {
            onDateChange(availableDates[currentIdx + 1]);
          } else if (currentIdx === availableDates.length && availableDates.length > 0) {
            onDateChange(availableDates[availableDates.length - 1]);
          }
        }}
        disabled={!hasNext}
        className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
      </button>
    </div>
  );
}

// ── Composable Filter Bar ───────────────────────────────────────────────────

/**
 * SheetFilterBar — consistent filter bar wrapper for all cheat sheets.
 *
 * Renders as a single row: Date nav on the left, children in the middle,
 * right-side slot (search / count) on the right.
 *
 * Usage:
 * ```tsx
 * <SheetFilterBar
 *   selectedDate={date}
 *   onDateChange={setDate}
 *   right={<><FilterSearch ... /><FilterCount ... /></>}
 * >
 *   <SegmentedControl ... />
 *   <FilterDivider />
 *   <SegmentedControl ... />
 * </SheetFilterBar>
 * ```
 */
export function SheetFilterBar({
  selectedDate,
  onDateChange,
  availableDates,
  right,
  legend,
  children,
  /** Mobile-specific controls — rendered in a stacked layout below date on small screens.
   *  If not provided, `children` will be wrapped into the mobile layout automatically. */
  mobileControls,
}: {
  selectedDate: string;
  onDateChange: (date: string) => void;
  availableDates?: string[];
  /** Right-aligned content (search, count, etc.) */
  right?: React.ReactNode;
  /** Optional legend row below the main bar */
  legend?: React.ReactNode;
  /** Filter controls rendered between date nav and right slot */
  children?: React.ReactNode;
  /** Optional override for mobile filter layout — if omitted, children are auto-wrapped */
  mobileControls?: React.ReactNode;
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  return (
    <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60 overflow-visible">
      {/* ── Desktop: single horizontal row ── */}
      <div className={cn("px-4 py-2.5 items-center gap-3 flex-wrap", isMobile ? "hidden" : "flex")}>
        <DateNav
          selectedDate={selectedDate}
          onDateChange={onDateChange}
          availableDates={availableDates}
        />

        {children && (
          <>
            <FilterDivider />
            {children}
          </>
        )}

        {right && (
          <>
            <div className="flex-1 min-w-0" />
            <div className="flex items-center gap-3 shrink-0">
              {right}
            </div>
          </>
        )}
      </div>

      {/* ── Mobile: stacked vertical layout ── */}
      {isMobile && (
        <div className="px-3 py-2.5 space-y-2.5">
          {/* Row 1: Date nav + count (if present) */}
          <div className="flex items-center justify-between gap-2">
            <DateNav
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              availableDates={availableDates}
            />
            {/* Extract FilterCount from right slot if it exists */}
            {right && (
              <div className="flex items-center gap-2 shrink-0">
                {right}
              </div>
            )}
          </div>

          {/* Row 2+: Filter controls — stacked and full-width */}
          {(mobileControls || children) && (
            <div className="flex flex-wrap items-center gap-2">
              {mobileControls ?? children}
            </div>
          )}
        </div>
      )}

      {/* Optional legend row — hidden on mobile (too dense) */}
      {legend && (
        <div className="hidden md:flex px-4 py-1.5 items-center gap-4 border-t border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/40 dark:bg-neutral-800/10 text-[10px] text-neutral-400">
          {legend}
        </div>
      )}
    </div>
  );
}
