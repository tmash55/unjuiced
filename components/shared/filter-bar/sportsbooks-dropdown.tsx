"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Building2 } from "lucide-react";
import { getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FilterTool } from "./unified-filter-bar";

interface SportsbooksDropdownProps {
  tool: FilterTool;
  selectedBooks: string[];
  onBooksChange: (books: string[]) => void;
  sportsbookCounts?: Record<string, number>;
  disabled?: boolean;
}

export function SportsbooksDropdown({
  tool,
  selectedBooks,
  onBooksChange,
  sportsbookCounts = {},
  disabled = false,
}: SportsbooksDropdownProps) {
  const [open, setOpen] = useState(false);
  
  // Local state for pending changes - only apply when dropdown closes
  const [localSelectedBooks, setLocalSelectedBooks] = useState<string[]>(selectedBooks);

  // Get all active sportsbooks
  const allBooks = useMemo(() => {
    return getAllActiveSportsbooks().sort((a, b) => {
      // Sort by priority (higher first), then alphabetically
      const aPriority = a.priority ?? 0;
      const bPriority = b.priority ?? 0;
      if (bPriority !== aPriority) return bPriority - aPriority;
      return a.name.localeCompare(b.name);
    });
  }, []);

  const allBookIds = useMemo(() => allBooks.map(b => b.id), [allBooks]);

  // Sync local state with prop when dropdown opens
  useEffect(() => {
    if (open) {
      setLocalSelectedBooks(selectedBooks);
    }
  }, [open, selectedBooks]);

  // Handle dropdown close - apply changes only when closing
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && open) {
      // Dropdown is closing - apply pending changes if different
      const hasChanges = JSON.stringify(localSelectedBooks.sort()) !== JSON.stringify(selectedBooks.sort());
      if (hasChanges) {
        onBooksChange(localSelectedBooks);
      }
    }
    setOpen(newOpen);
  }, [open, localSelectedBooks, selectedBooks, onBooksChange]);

  /**
   * Selection semantics:
   * - Positive EV & Arbitrage: selectedBooks = books to INCLUDE (empty = all books included)
   * - Edge Finder: selectedBooks = books to EXCLUDE (empty = all books included)
   * 
   * For display, we want to show which books are INCLUDED (visible in results)
   */
  const isExcludeMode = tool === "edge-finder";

  // Get the books that are actually being shown (included in results) - use local state
  const includedBooks = useMemo(() => {
    if (isExcludeMode) {
      // Edge Finder: selectedBooks are EXCLUDED, so included = all - selected
      if (localSelectedBooks.length === 0) return allBookIds;
      return allBookIds.filter(id => !localSelectedBooks.includes(id));
    } else {
      // Positive EV: selectedBooks are INCLUDED (empty = all)
      if (localSelectedBooks.length === 0) return allBookIds;
      return localSelectedBooks;
    }
  }, [localSelectedBooks, allBookIds, isExcludeMode]);

  // Check if a book is visually "selected" (i.e., included in results)
  const isBookIncluded = (bookId: string) => {
    return includedBooks.includes(bookId);
  };

  // Toggle sportsbook selection - update LOCAL state only
  const toggleBook = (bookId: string) => {
    if (isExcludeMode) {
      // Edge Finder: selectedBooks = books to EXCLUDE
      if (localSelectedBooks.includes(bookId)) {
        // Book is excluded, remove from exclusion list (include it)
        setLocalSelectedBooks(localSelectedBooks.filter((b) => b !== bookId));
      } else {
        // Book is included, add to exclusion list (exclude it)
        setLocalSelectedBooks([...localSelectedBooks, bookId]);
      }
    } else {
      // Positive EV / Arbitrage: selectedBooks = books to INCLUDE (empty = all)
      const currentlyIncluded = localSelectedBooks.length === 0 ? allBookIds : localSelectedBooks;
      const isCurrentlyIncluded = currentlyIncluded.includes(bookId);
      
      if (isCurrentlyIncluded) {
        // Deselect this book
        const newIncluded = currentlyIncluded.filter((b) => b !== bookId);
        // Don't allow zero books selected - need at least one
        if (newIncluded.length === 0) return;
        setLocalSelectedBooks(newIncluded);
      } else {
        // Select this book
        const newIncluded = [...currentlyIncluded, bookId];
        // If all books are now selected, use empty array (shorthand for "all")
        if (newIncluded.length === allBookIds.length) {
          setLocalSelectedBooks([]);
        } else {
          setLocalSelectedBooks(newIncluded);
        }
      }
    }
  };

  // Select all (include all books) - update LOCAL state only
  const selectAll = () => setLocalSelectedBooks([]);

  // Clear all (include no books - or in practice, just one) - update LOCAL state only
  const clearAll = () => {
    if (isExcludeMode) {
      const booksToExclude = allBookIds.slice(1);
      setLocalSelectedBooks(booksToExclude);
    } else {
      setLocalSelectedBooks([allBookIds[0]]);
    }
  };

  // Count display - how many are included
  const includedCount = includedBooks.length;
  const totalCount = allBooks.length;
  const isAllIncluded = includedCount === totalCount;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          className={cn(
            "flex items-center gap-2 h-8 px-3 rounded-lg text-sm font-medium transition-all",
            "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
            "border border-neutral-200/80 dark:border-neutral-700/80",
            "hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <Building2 className="w-4 h-4" />
          <span className="hidden sm:inline">Books</span>
          {!isAllIncluded && (
            <span className="text-xs bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded-full tabular-nums">
              {includedCount}
            </span>
          )}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              {includedCount} of {totalCount} books
            </span>
            <div className="flex gap-1">
              <button
                onClick={selectAll}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                  isAllIncluded
                    ? "bg-emerald-500 text-white"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                )}
              >
                All
              </button>
              <button
                onClick={clearAll}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Sportsbook list */}
        <div className="max-h-[360px] overflow-y-auto p-1.5">
          <div className="space-y-0.5">
            {allBooks.map((book) => {
              const isIncluded = isBookIncluded(book.id);
              const count = sportsbookCounts[book.id] || 0;
              const logo = book.image.light;

              return (
                <button
                  key={book.id}
                  onClick={() => toggleBook(book.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-all",
                    isIncluded
                      ? "bg-neutral-100 dark:bg-neutral-800"
                      : "opacity-50 hover:opacity-75"
                  )}
                >
                  {/* Checkbox */}
                  <div className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                    isIncluded
                      ? "bg-emerald-500 border-emerald-500"
                      : "border-neutral-300 dark:border-neutral-600"
                  )}>
                    {isIncluded && <Check className="w-3 h-3 text-white" />}
                  </div>

                  {/* Logo */}
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {logo ? (
                      <img
                        src={logo}
                        alt={book.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <Building2 className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>

                  {/* Name */}
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex-1 text-left truncate">
                    {book.name}
                  </span>

                  {/* Count badge */}
                  {count > 0 && (
                    <span className={cn(
                      "text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full",
                      isIncluded
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500"
                    )}>
                      {count}
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
