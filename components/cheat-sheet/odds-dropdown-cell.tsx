"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { OddsData } from "@/hooks/use-cheat-sheet";

// Helper to get sportsbook logo
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
  return sb.affiliateLink || sb.links?.desktop || null;
};

// Book display structure
interface BookOddsDisplay {
  book: string;
  price: number;
  url: string | null;
  mobileUrl: string | null;
}

// Choose the best link based on device type
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

// Format odds price
const formatOdds = (price: number): string => {
  if (price >= 0) return `+${price}`;
  return String(price);
};

interface OddsDropdownCellProps {
  odds: OddsData | null;
  line: number;
  isLive?: boolean;
}

/**
 * OddsDropdownCell - Used by injury impact components that fetch odds separately
 * For the main cheat sheet, use OddsDropdown from hit-rates instead
 */
export function OddsDropdownCell({ 
  odds, 
  line,
  isLive 
}: OddsDropdownCellProps) {
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

  // Build the list of books with odds for the current line
  const booksForLine = useMemo((): BookOddsDisplay[] => {
    if (!odds) return [];

    // Find the line in allLines
    const lineData = odds.allLines.find((l) => l.line === line);
    
    if (!lineData?.books) {
      // Fall back to bestOver if we have it
      if (odds.bestOver) {
        return [{
          book: odds.bestOver.book,
          price: odds.bestOver.price,
          url: odds.bestOver.url,
          mobileUrl: odds.bestOver.mobileUrl,
        }];
      }
      return [];
    }

    // Extract all books with over odds, sorted by price (best first)
    const books: BookOddsDisplay[] = [];
    for (const [bookId, bookOdds] of Object.entries(lineData.books)) {
      if (bookOdds.over !== undefined) {
        books.push({
          book: bookId,
          price: bookOdds.over.price,
          url: bookOdds.over.url,
          mobileUrl: bookOdds.over.mobileUrl,
        });
      }
    }

    // Sort by price descending (higher/better odds first)
    books.sort((a, b) => b.price - a.price);
    return books;
  }, [odds, line]);

  // No odds available
  if (!odds || booksForLine.length === 0) {
    return <span className="text-sm text-neutral-400">—</span>;
  }

  const bestBook = booksForLine[0];
  const bestBookLogo = getBookLogo(bestBook.book);
  const bestBookName = getBookName(bestBook.book);

  // Get the appropriate link for a book based on device
  const getBookLink = (book: BookOddsDisplay): string | null => {
    return chooseBookLink(book.book, book.url, book.mobileUrl, isMobile);
  };

  const handleBookClick = (book: BookOddsDisplay, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = getBookLink(book);
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const hasMultipleBooks = booksForLine.length > 1;
  const singleBookLink = !hasMultipleBooks ? getBookLink(bestBook) : null;

  const handleSingleBookClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (singleBookLink) {
      window.open(singleBookLink, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div ref={dropdownRef} className="relative inline-flex">
      <button
        type="button"
        onClick={hasMultipleBooks ? handleToggle : handleSingleBookClick}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-all min-w-[85px] justify-center",
          "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800",
          "hover:bg-neutral-50 dark:hover:bg-neutral-700 cursor-pointer",
          isLive && "border-red-300 dark:border-red-700"
        )}
      >
        {bestBookLogo && (
          <img
            src={bestBookLogo}
            alt={bestBookName}
            className="h-4 w-4 rounded object-contain"
          />
        )}
        <span className={cn(
          "tabular-nums",
          bestBook.price >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
        )}>
          {formatOdds(bestBook.price)}
        </span>
        {hasMultipleBooks ? (
          <ChevronDown className={cn(
            "h-3.5 w-3.5 opacity-50 transition-transform",
            isOpen && "rotate-180"
          )} />
        ) : (
          <ExternalLink className="h-3.5 w-3.5 opacity-50" />
        )}
        {isLive && (
          <span className="text-[9px] font-bold text-red-500 animate-pulse">LIVE</span>
        )}
      </button>

      {isOpen && booksForLine.length > 1 && (
        <div className="absolute left-1/2 top-full z-[70] mt-1 -translate-x-1/2 min-w-[180px] rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
          <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
            {booksForLine.map((book, idx) => {
              const bookLogo = getBookLogo(book.book);
              const bookName = getBookName(book.book);
              const isBest = idx === 0;
              const bookLink = getBookLink(book);
              
              return (
                <button
                  key={book.book}
                  onClick={(e) => handleBookClick(book, e)}
                  disabled={!bookLink}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                    bookLink 
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
                    "font-semibold tabular-nums",
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
          
          {booksForLine.length > 1 && (
            <div className="mt-1.5 border-t border-neutral-200 dark:border-neutral-700 pt-1.5">
              <p className="px-2 text-[10px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {booksForLine.length} books • Best: {formatOdds(bestBook.price)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
