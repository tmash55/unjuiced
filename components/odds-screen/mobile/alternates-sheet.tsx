"use client";

import React, { useMemo, useState } from "react";
import { X, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import type { OddsScreenItem } from "../types/odds-screen-types";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getStandardAbbreviation } from "@/lib/data/team-mappings";

interface AlternatesSheetProps {
  item: OddsScreenItem;
  sport: string;
  market: string;
  isOpen: boolean;
  onClose: () => void;
}

// Response types from the alternates API
interface AlternateLine {
  ln: number;
  books: Record<string, {
    over?: { price: number; decimal: number; u: string | null; m: string | null; sgp: string | null };
    under?: { price: number; decimal: number; u: string | null; m: string | null; sgp: string | null };
  }>;
  best?: {
    over?: { bk: string; price: number };
    under?: { bk: string; price: number };
  };
}

interface AlternatesResponse {
  eventId: string;
  sport: string;
  market: string;
  player: string | null;
  team: string | null;
  position: string | null;
  primary_ln: number | null;
  alternates: AlternateLine[];
  all_lines: AlternateLine[];
  timestamp: number;
}

// Format American odds
function formatOdds(price: number | undefined | null): string {
  if (price === undefined || price === null) return "—";
  return price >= 0 ? `+${price}` : `${price}`;
}

// Get sportsbook logo
function getBookLogo(bookId: string): string | null {
  const book = getSportsbookById(bookId);
  return book?.image?.square || book?.image?.light || null;
}

// Get team logo URL
function getTeamLogoUrl(teamName: string, sport: string): string {
  if (!teamName) return "";
  const abbr = getStandardAbbreviation(teamName, sport);
  return `/team-logos/${sport}/${abbr.toUpperCase()}.svg`;
}

// Check if sport has team logos
function hasTeamLogos(sport: string): boolean {
  const sportsWithLogos = ["nfl", "nhl", "nba", "mlb"];
  return sportsWithLogos.includes(sport.toLowerCase());
}

// Get market display label
function getMarketLabel(market: string): string {
  const labels: Record<string, string> = {
    player_points: "Points",
    player_rebounds: "Rebounds",
    player_assists: "Assists",
    player_pra: "PRA",
    player_threes_made: "3-Pointers",
    player_steals: "Steals",
    player_blocks: "Blocks",
    player_turnovers: "Turnovers",
    player_passing_yards: "Pass Yards",
    player_rushing_yards: "Rush Yards",
    player_receiving_yards: "Rec Yards",
    player_touchdowns: "Touchdowns",
    player_goals: "Goals",
    player_shots_on_goal: "Shots on Goal",
  };
  return labels[market] || market.replace("player_", "").replace(/_/g, " ");
}

export function AlternatesSheet({ item, sport, market, isOpen, onClose }: AlternatesSheetProps) {
  const [selectedLine, setSelectedLine] = useState<{ line: AlternateLine; side: "over" | "under" } | null>(null);
  const showLogos = hasTeamLogos(sport);

  // Get player ID from entity
  const playerId = item.entity?.id;
  const eventId = item.event?.id;

  // Fetch alternates data
  const { data, isLoading, error } = useQuery<AlternatesResponse>({
    queryKey: ["alternates", sport, eventId, market, playerId],
    queryFn: async () => {
      const params = new URLSearchParams({
        sport,
        eventId: eventId || "",
        market,
        player: playerId || "",
      });
      const response = await fetch(`/api/v2/props/alternates?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch alternates");
      return response.json();
    },
    enabled: isOpen && !!eventId && !!playerId,
    staleTime: 30_000,
  });

  // Get all lines sorted
  const allLines = useMemo(() => {
    return data?.all_lines || [];
  }, [data]);

  const primaryLine = data?.primary_ln;

  // Handle clicking on a line's odds
  const handleLineClick = (line: AlternateLine, side: "over" | "under") => {
    setSelectedLine({ line, side });
  };

  // Handle clicking on a book in the expanded view
  const handleBookClick = (bookId: string, bookData: { u: string | null; m: string | null } | undefined) => {
    const link = bookData?.m || bookData?.u;
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-white dark:bg-neutral-900 rounded-t-3xl h-[85vh] flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            </div>

            {/* Header */}
            <div className="px-5 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {showLogos && item.entity?.team && (
                    <img
                      src={getTeamLogoUrl(item.entity.team, sport)}
                      alt={item.entity.team}
                      className="w-8 h-8 object-contain"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                      {item.entity.name}
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {getMarketLabel(market)} • {allLines.length} line{allLines.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors active:scale-[0.95]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto pb-safe">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500 mb-3" />
                  <p className="text-neutral-500 dark:text-neutral-400 text-center">
                    Loading alternate lines...
                  </p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <p className="text-neutral-500 dark:text-neutral-400 text-center">
                    Failed to load alternate lines
                  </p>
                </div>
              ) : allLines.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <p className="text-neutral-500 dark:text-neutral-400 text-center">
                    No alternate lines available
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {allLines.map((line) => {
                    const isPrimary = line.ln === primaryLine;
                    const bestOver = line.best?.over;
                    const bestUnder = line.best?.under;
                    const isExpanded = selectedLine?.line.ln === line.ln;

                    return (
                      <div key={line.ln}>
                        {/* Line Row */}
                        <div className={cn(
                          "p-4",
                          isPrimary && "bg-emerald-50/50 dark:bg-emerald-900/10"
                        )}>
                          {/* Line Value */}
                          <div className="flex items-center gap-2 mb-3">
                            <span className={cn(
                              "text-lg font-bold tabular-nums",
                              isPrimary ? "text-emerald-700 dark:text-emerald-400" : "text-neutral-900 dark:text-white"
                            )}>
                              {line.ln}
                            </span>
                            {isPrimary && (
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                                Primary
                              </span>
                            )}
                          </div>

                          {/* Over/Under Buttons */}
                          <div className="flex gap-2">
                            {/* Over Button */}
                            <button
                              onClick={() => handleLineClick(line, "over")}
                              disabled={!bestOver}
                              className={cn(
                                "flex-1 flex items-center justify-between px-4 py-3 rounded-xl transition-all active:scale-[0.98]",
                                bestOver
                                  ? isExpanded && selectedLine?.side === "over"
                                    ? "bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-500"
                                    : "bg-emerald-50 dark:bg-emerald-900/20"
                                  : "bg-neutral-50 dark:bg-neutral-800/50 opacity-50"
                              )}
                            >
                              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                Over
                              </span>
                              {bestOver && (
                                <div className="flex items-center gap-1.5">
                                  {getBookLogo(bestOver.bk) && (
                                    <img
                                      src={getBookLogo(bestOver.bk)!}
                                      alt={bestOver.bk}
                                      className="w-4 h-4 object-contain opacity-60"
                                    />
                                  )}
                                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                    {formatOdds(bestOver.price)}
                                  </span>
                                  <ChevronRight className={cn(
                                    "w-4 h-4 text-emerald-400 transition-transform",
                                    isExpanded && selectedLine?.side === "over" && "rotate-90"
                                  )} />
                                </div>
                              )}
                            </button>

                            {/* Under Button */}
                            <button
                              onClick={() => handleLineClick(line, "under")}
                              disabled={!bestUnder}
                              className={cn(
                                "flex-1 flex items-center justify-between px-4 py-3 rounded-xl transition-all active:scale-[0.98]",
                                bestUnder
                                  ? isExpanded && selectedLine?.side === "under"
                                    ? "bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500"
                                    : "bg-blue-50 dark:bg-blue-900/20"
                                  : "bg-neutral-50 dark:bg-neutral-800/50 opacity-50"
                              )}
                            >
                              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                Under
                              </span>
                              {bestUnder && (
                                <div className="flex items-center gap-1.5">
                                  {getBookLogo(bestUnder.bk) && (
                                    <img
                                      src={getBookLogo(bestUnder.bk)!}
                                      alt={bestUnder.bk}
                                      className="w-4 h-4 object-contain opacity-60"
                                    />
                                  )}
                                  <span className="text-sm font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                                    {formatOdds(bestUnder.price)}
                                  </span>
                                  <ChevronRight className={cn(
                                    "w-4 h-4 text-blue-400 transition-transform",
                                    isExpanded && selectedLine?.side === "under" && "rotate-90"
                                  )} />
                                </div>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Books List */}
                        <AnimatePresence>
                          {isExpanded && selectedLine && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <BooksExpanded
                                line={selectedLine.line}
                                side={selectedLine.side}
                                onBookClick={handleBookClick}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Expanded books list for a specific line/side
interface BooksExpandedProps {
  line: AlternateLine;
  side: "over" | "under";
  onBookClick: (bookId: string, bookData: { u: string | null; m: string | null } | undefined) => void;
}

function BooksExpanded({ line, side, onBookClick }: BooksExpandedProps) {
  // Get all books with odds for this side, sorted by price
  const books = useMemo(() => {
    const result: { bookId: string; name: string; logo: string | null; price: number; link: string | null; mobileLink: string | null }[] = [];

    Object.entries(line.books).forEach(([bookId, bookData]) => {
      const sideData = bookData[side];
      if (!sideData) return;

      const bookMeta = getSportsbookById(bookId);
      result.push({
        bookId,
        name: bookMeta?.name || bookId,
        logo: getBookLogo(bookId),
        price: sideData.price,
        link: sideData.u,
        mobileLink: sideData.m,
      });
    });

    // Sort by price (best first)
    result.sort((a, b) => b.price - a.price);
    return result;
  }, [line, side]);

  const bestPrice = line.best?.[side]?.price;

  return (
    <div className={cn(
      "mx-4 mb-4 rounded-xl overflow-hidden border",
      side === "over" 
        ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
        : "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
    )}>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
        {books.map((book, index) => {
          const isBest = book.price === bestPrice;
          return (
            <button
              key={book.bookId}
              onClick={() => onBookClick(book.bookId, { u: book.link, m: book.mobileLink })}
              disabled={!book.link && !book.mobileLink}
              className={cn(
                "w-full px-4 py-3 flex items-center justify-between transition-colors",
                (book.link || book.mobileLink) && "active:bg-white/50 dark:active:bg-black/20"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Rank */}
                <span className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                  index === 0
                    ? side === "over" 
                      ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300"
                      : "bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300"
                    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                )}>
                  {index + 1}
                </span>

                {/* Logo */}
                {book.logo ? (
                  <img
                    src={book.logo}
                    alt={book.name}
                    className="w-6 h-6 rounded object-contain"
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-500">
                    {book.name.charAt(0)}
                  </div>
                )}

                {/* Name */}
                <span className="text-sm font-medium text-neutral-900 dark:text-white">
                  {book.name}
                </span>
              </div>

              {/* Price */}
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-sm font-bold tabular-nums",
                  isBest
                    ? side === "over"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-blue-700 dark:text-blue-400"
                    : "text-neutral-700 dark:text-neutral-300"
                )}>
                  {formatOdds(book.price)}
                </span>
                {(book.link || book.mobileLink) && (
                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
