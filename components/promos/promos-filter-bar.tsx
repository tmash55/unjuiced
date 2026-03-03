"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import Image from "next/image";
import { Search, X, ChevronDown, Check, Building2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FiltersBar, FiltersBarSection, FiltersBarDivider } from "@/components/common/filters-bar";
import {
  SPORTSBOOK_LIST,
  PROMO_TYPE_LIST,
  SPORT_LIST,
  PROMO_TYPE_CONFIG,
  DEFAULT_PROMO_FILTERS,
  SPORTSBOOK_LOGO_MAP,
  type PromoFilters,
  type PromoType,
} from "@/lib/promos-schema";
import { SportIcon } from "@/components/icons/sport-icons";


// ─── Helpers ──────────────────────────────────────────────────────────────────

function countActiveFilters(filters: PromoFilters): number {
  let count = 0;
  if (filters.sportsbooks.length > 0) count++;
  if (filters.sports.length > 0) count++;
  if (filters.promoTypes.length > 0) count++;
  if (filters.newUserOnly) count++;
  if (filters.dailyOnly) count++;
  if (filters.search && filters.search.trim().length > 0) count++;
  return count;
}

function getSportsbookLogo(name: string): string {
  const filename = SPORTSBOOK_LOGO_MAP[name] ?? "generic-sportsbook.svg";
  return `/images/sports-books/${filename}`;
}

// ─── Sportsbooks Dropdown ─────────────────────────────────────────────────────

function SportsbooksFilter({
  selected,
  onChange,
  counts,
}: {
  selected: string[];
  onChange: (books: string[]) => void;
  counts: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<string[]>(selected);

  useEffect(() => {
    if (open) setLocal(selected);
  }, [open, selected]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && open) {
        const changed =
          JSON.stringify([...local].sort()) !==
          JSON.stringify([...selected].sort());
        if (changed) onChange(local);
      }
      setOpen(next);
    },
    [open, local, selected, onChange]
  );

  const allSelected = local.length === 0;
  const toggleBook = (book: string) => {
    if (allSelected) {
      // Switch from all to all-except-this
      setLocal(SPORTSBOOK_LIST.filter((b) => b !== book));
    } else if (local.includes(book)) {
      const next = local.filter((b) => b !== book);
      setLocal(next.length === 0 ? [] : next);
    } else {
      const next = [...local, book];
      setLocal(next.length === SPORTSBOOK_LIST.length ? [] : next);
    }
  };

  const count = allSelected ? SPORTSBOOK_LIST.length : local.length;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 h-8 px-3 rounded-lg text-sm font-medium transition-all",
            "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
            "border border-neutral-200/80 dark:border-neutral-700/80",
            "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
          )}
        >
          <Building2 className="w-4 h-4" />
          <span className="hidden sm:inline">Books</span>
          {!allSelected && (
            <span className="text-xs bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded-full tabular-nums">
              {count}
            </span>
          )}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64 p-0 overflow-hidden z-[300]">
        <div className="px-3 py-2.5 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              {allSelected ? "All" : count} of {SPORTSBOOK_LIST.length} books
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  if (allSelected) {
                    // Already all → select just the first book
                    setLocal([SPORTSBOOK_LIST[0]]);
                  } else {
                    // Some selected → back to all
                    setLocal([]);
                  }
                }}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                  allSelected
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                )}
              >
                All
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-1.5">
          <div className="space-y-0.5">
            {SPORTSBOOK_LIST.map((book) => {
              const isIncluded = allSelected || local.includes(book);
              const bookCount = counts[book] || 0;

              return (
                <button
                  key={book}
                  onClick={() => toggleBook(book)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-all",
                    isIncluded
                      ? "bg-neutral-100 dark:bg-neutral-800"
                      : "opacity-50 hover:opacity-75"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                      isIncluded
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-neutral-300 dark:border-neutral-600"
                    )}
                  >
                    {isIncluded && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <Image
                      src={getSportsbookLogo(book)}
                      alt={book}
                      width={20}
                      height={20}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex-1 text-left truncate">
                    {book}
                  </span>
                  {bookCount > 0 && (
                    <span
                      className={cn(
                        "text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full",
                        isIncluded
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500"
                      )}
                    >
                      {bookCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Promo Type Dropdown ──────────────────────────────────────────────────────

function PromoTypeFilter({
  selected,
  onChange,
}: {
  selected: PromoType[];
  onChange: (types: PromoType[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<PromoType[]>(selected);

  useEffect(() => {
    if (open) setLocal(selected);
  }, [open, selected]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && open) {
        const changed =
          JSON.stringify([...local].sort()) !==
          JSON.stringify([...selected].sort());
        if (changed) onChange(local);
      }
      setOpen(next);
    },
    [open, local, selected, onChange]
  );

  const toggleType = (type: PromoType) => {
    if (allSelected) {
      // "All" is active (empty array) — switch to all-except-this
      setLocal(PROMO_TYPE_LIST.map((p) => p.value).filter((t) => t !== type));
    } else if (local.includes(type)) {
      const next = local.filter((t) => t !== type);
      // If removing the last one, go back to "All"
      setLocal(next.length === 0 ? [] : next);
    } else {
      const next = [...local, type];
      // If all are now selected, use empty array (shorthand for "all")
      setLocal(next.length === PROMO_TYPE_LIST.length ? [] : next);
    }
  };

  const allSelected = local.length === 0;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 h-8 px-3 rounded-lg text-sm font-medium transition-all",
            "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
            "border border-neutral-200/80 dark:border-neutral-700/80",
            "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
          )}
        >
          <Tag className="w-4 h-4" />
          <span className="hidden sm:inline">Type</span>
          {!allSelected && (
            <span className="text-xs bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded-full tabular-nums">
              {local.length}
            </span>
          )}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56 p-0 overflow-hidden z-[300]">
        <div className="px-3 py-2.5 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              Promo Type
            </span>
            <button
              onClick={() => {
                if (allSelected) {
                  // Already all → clear everything (select none)
                  setLocal(PROMO_TYPE_LIST.map((p) => p.value).slice(0, 1));
                } else {
                  // Some selected → go back to all
                  setLocal([]);
                }
              }}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                allSelected
                  ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                  : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600"
              )}
            >
              All
            </button>
          </div>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-1.5">
          <div className="space-y-0.5">
            {PROMO_TYPE_LIST.map(({ value, label }) => {
              const cfg = PROMO_TYPE_CONFIG[value];
              const isSelected = allSelected || local.includes(value);

              return (
                <button
                  key={value}
                  onClick={() => toggleType(value)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-all",
                    isSelected
                      ? "bg-neutral-100 dark:bg-neutral-800"
                      : "opacity-60 hover:opacity-80"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                      isSelected
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-neutral-300 dark:border-neutral-600"
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${cfg.dotColor}`}
                  />
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex-1 text-left">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Sport Tabs ───────────────────────────────────────────────────────────────

function SportTabs({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (sports: string[]) => void;
}) {
  const allActive = selected.length === 0;

  function handleClick(sport: string) {
    if (sport === "All") {
      onChange([]);
      return;
    }
    if (selected.includes(sport)) {
      onChange(selected.filter((s) => s !== sport));
    } else {
      onChange([...selected, sport]);
    }
  }

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
      {SPORT_LIST.map((sport) => {
        const active = sport === "All" ? allActive : selected.includes(sport);

        return (
          <button
            key={sport}
            type="button"
            onClick={() => handleClick(sport)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap",
              active
                ? "bg-neutral-200/80 dark:bg-neutral-700 text-neutral-900 dark:text-white"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            {sport !== "All" && (
              <SportIcon sport={sport} className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            {sport}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PromosFilterBarProps {
  filters: PromoFilters;
  onChange: (filters: PromoFilters) => void;
  totalCount: number;
  isLoading?: boolean;
  countsBySportsbook?: Record<string, number>;
}

export function PromosFilterBar({
  filters,
  onChange,
  totalCount,
  isLoading,
  countsBySportsbook = {},
}: PromosFilterBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const activeCount = countActiveFilters(filters);

  const clearAll = useCallback(() => {
    onChange({ ...DEFAULT_PROMO_FILTERS, date: filters.date });
    if (searchRef.current) searchRef.current.value = "";
  }, [filters.date, onChange]);

  // Debounced search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      onChange({ ...filters, search: val });
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-2">
      {/* Primary filter bar */}
      <FiltersBar>
        <FiltersBarSection align="left">
          {/* Sport tabs */}
          <SportTabs
            selected={filters.sports}
            onChange={(sports) => onChange({ ...filters, sports })}
          />
        </FiltersBarSection>

        <FiltersBarDivider />

        <FiltersBarSection align="right" className="overflow-x-auto scrollbar-hide flex-nowrap sm:flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search..."
              defaultValue={filters.search ?? ""}
              onChange={handleSearchChange}
              className="w-full sm:w-[160px] pl-8 pr-3 h-8 rounded-lg text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/50 transition-all"
            />
            {filters.search && filters.search.trim().length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onChange({ ...filters, search: "" });
                  if (searchRef.current) searchRef.current.value = "";
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sportsbooks dropdown */}
          <SportsbooksFilter
            selected={filters.sportsbooks}
            onChange={(sportsbooks) => onChange({ ...filters, sportsbooks })}
            counts={countsBySportsbook}
          />

          {/* Promo type dropdown */}
          <PromoTypeFilter
            selected={filters.promoTypes}
            onChange={(promoTypes) => onChange({ ...filters, promoTypes })}
          />

          {/* Toggle chips */}
          <ToggleChip
            label="New User"
            active={filters.newUserOnly}
            onChange={() =>
              onChange({ ...filters, newUserOnly: !filters.newUserOnly })
            }
          />
          <ToggleChip
            label="Daily"
            active={filters.dailyOnly}
            onChange={() =>
              onChange({ ...filters, dailyOnly: !filters.dailyOnly })
            }
          />

          {/* Count + Reset */}
          <div className="flex items-center gap-2">
            {!isLoading && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums whitespace-nowrap">
                <span className="font-bold text-neutral-900 dark:text-white">
                  {totalCount}
                </span>{" "}
                promo{totalCount !== 1 ? "s" : ""}
              </span>
            )}
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-300 transition-all"
              >
                <X className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </FiltersBarSection>
      </FiltersBar>
    </div>
  );
}

// ─── Toggle Chip ──────────────────────────────────────────────────────────────

function ToggleChip({
  label,
  active,
  onChange,
}: {
  label: string;
  active: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-all whitespace-nowrap",
        active
          ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white"
          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200/80 dark:border-neutral-700/80 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
      )}
    >
      {label}
    </button>
  );
}
