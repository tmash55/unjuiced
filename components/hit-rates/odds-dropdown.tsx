"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import type { BookOdds, LineOdds } from "@/hooks/use-hit-rate-odds";

interface OddsDropdownProps {
  odds: LineOdds | null;
  loading?: boolean;
}

const formatOdds = (price: number): string => {
  if (price >= 0) return `+${price}`;
  return String(price);
};

// Helper to get sportsbook logo (same pattern as best-odds-table)
const getBookLogo = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || null;
};

// Helper to get sportsbook name
const getBookName = (bookId?: string): string => {
  if (!bookId) return "";
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
};

// Helper to get the fallback URL from sportsbook metadata
const getBookFallbackUrl = (bookId?: string): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  if (!sb) return null;
  // Use affiliate link if available, otherwise desktop link
  return sb.affiliateLink || sb.links?.desktop || null;
};

// Choose the best link based on device type
// Priority: 
// - Mobile: mobileUrl -> url -> fallback
// - Desktop: url -> mobileUrl -> fallback
const chooseBookLink = (
  bookId: string,
  desktopUrl: string | null,
  mobileUrl: string | null,
  isMobile: boolean
): string | null => {
  const fallback = getBookFallbackUrl(bookId);
  
  if (isMobile) {
    return mobileUrl || desktopUrl || fallback;
  }
  return desktopUrl || mobileUrl || fallback;
};

export function OddsDropdown({ odds, loading }: OddsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Detect if user is on mobile device
  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      </div>
    );
  }

  // No odds available
  if (!odds || !odds.books.length) {
    return (
      <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>
    );
  }

  const bestBook = odds.books[0];
  const bestBookLogo = getBookLogo(bestBook.book);
  const bestBookName = getBookName(bestBook.book);

  // Get the appropriate link for a book based on device
  const getBookLink = (book: BookOdds): string | null => {
    return chooseBookLink(book.book, book.url, book.mobileUrl, isMobile);
  };

  const handleBookClick = (book: BookOdds, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = getBookLink(book);
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click from triggering
    setIsOpen(!isOpen);
  };

  return (
    <div ref={dropdownRef} className="relative inline-flex">
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-all",
          "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700",
          "text-neutral-900 dark:text-white"
        )}
      >
        {bestBookLogo && (
          <img
            src={bestBookLogo}
            alt={bestBookName}
            className="h-4 w-4 rounded object-contain"
          />
        )}
        <span>{formatOdds(bestBook.price)}</span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 opacity-50 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 top-full z-[70] mt-1 -translate-x-1/2 min-w-[180px] rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
          <div className="flex flex-col gap-0.5">
            {odds.books.map((book, idx) => {
              const bookLogo = getBookLogo(book.book);
              const bookName = getBookName(book.book);
              const isBest = idx === 0;
              
              return (
                <button
                  key={book.book}
                  onClick={(e) => handleBookClick(book, e)}
                  disabled={!book.url}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                    book.url 
                      ? "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700" 
                      : "cursor-default opacity-60",
                    isBest && "bg-emerald-50 dark:bg-emerald-900/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {bookLogo ? (
                      <img
                        src={bookLogo}
                        alt={bookName}
                        className="h-5 w-5 rounded object-contain"
                      />
                    ) : (
                      <div className="h-5 w-5 rounded bg-neutral-200 dark:bg-neutral-700" />
                    )}
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {bookName}
                    </span>
                  </div>
                  <span className={cn(
                    "font-semibold",
                    book.price >= 0 
                      ? "text-emerald-600 dark:text-emerald-400" 
                      : "text-neutral-900 dark:text-white"
                  )}>
                    {formatOdds(book.price)}
                  </span>
                </button>
              );
            })}
          </div>
          
          {odds.books.length > 1 && (
            <div className="mt-1.5 border-t border-neutral-200 dark:border-neutral-700 pt-1.5">
              <p className="px-2 text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {odds.books.length} books • Best: {formatOdds(bestBook.price)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

