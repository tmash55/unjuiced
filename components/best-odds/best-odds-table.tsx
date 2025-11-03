"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import type { BestOddsDeal } from "@/lib/best-odds-schema";
import { cn } from "@/lib/utils";
import { ExternalLink, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import { getSportsbookById } from "@/lib/data/sportsbooks";

interface BestOddsTableProps {
  deals: BestOddsDeal[];
  loading?: boolean;
}

export function BestOddsTable({ deals, loading }: BestOddsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-r-transparent mb-4"></div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading best odds...</p>
        </div>
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <TrendingUp className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
            No deals found
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Try adjusting your filters to see more opportunities
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8">
      <div className="inline-block min-w-full align-middle sm:px-6 lg:px-8">
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
            <thead className="bg-neutral-50 dark:bg-neutral-900">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-neutral-900 dark:text-white sm:pl-6">
                  Player / Market
                </th>
                <th scope="col" className="hidden lg:table-cell px-3 py-3.5 text-left text-xs font-semibold text-neutral-900 dark:text-white">
                  Game
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-neutral-900 dark:text-white">
                  Line
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-neutral-900 dark:text-white">
                  Best Odds
                </th>
                <th scope="col" className="hidden md:table-cell px-3 py-3.5 text-left text-xs font-semibold text-neutral-900 dark:text-white">
                  Improvement
                </th>
                <th scope="col" className="hidden xl:table-cell px-3 py-3.5 text-left text-xs font-semibold text-neutral-900 dark:text-white">
                  Books
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Bet</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-950">
              {deals.map((deal) => {
                const isExpanded = expandedRows.has(deal.key);
                return (
                  <React.Fragment key={deal.key}>
                    <tr 
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer"
                      onClick={() => toggleRow(deal.key)}
                    >
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                    <div className="flex items-center gap-2">
                      {/* Expand icon */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(deal.key);
                        }}
                        className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-neutral-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-neutral-500" />
                        )}
                      </button>
                      
                      <div className="flex flex-col">
                        <div className="font-medium text-neutral-900 dark:text-white">
                          {deal.playerName || deal.ent}
                        </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {deal.team && `${deal.team}`}
                          {deal.position && ` • ${deal.position}`}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                        {formatMarketName(deal.mkt)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden lg:table-cell whitespace-nowrap px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400">
                    {deal.homeTeam && deal.awayTeam ? (
                      <div className="flex flex-col">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {deal.awayTeam} @ {deal.homeTeam}
                        </span>
                        {deal.startTime && (
                          <span className="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">
                            {formatGameTime(deal.startTime)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        deal.side === "o" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      )}>
                        {deal.side === "o" ? "O" : "U"}
                      </span>
                      <span className="font-medium text-neutral-900 dark:text-white">
                        {deal.ln}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-brand">
                          {formatOdds(deal.bestPrice)}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 capitalize mt-0.5">
                        {deal.bestBook}
                      </span>
                    </div>
                  </td>
                  <td className="hidden md:table-cell whitespace-nowrap px-3 py-4 text-sm">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {Number(deal.priceImprovement).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      vs {formatOdds(deal.avgPrice)} avg
                    </div>
                  </td>
                  <td className="hidden xl:table-cell whitespace-nowrap px-3 py-4 text-sm text-neutral-500 dark:text-neutral-400">
                    {deal.numBooks} books
                  </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <a
                          href={deal.bestLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand/90 transition-colors"
                        >
                          Bet
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>

                    {/* Expanded Row - All Sportsbooks */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="bg-blue-50/40 dark:bg-blue-900/15 border-l-4 border-brand"
                        >
                          <td colSpan={7} className="px-4 sm:px-6 py-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-white">
                              <TrendingUp className="h-4 w-4 text-brand" />
                              All Sportsbook Odds ({deal.numBooks} books)
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                              {deal.allBooks
                                .sort((a, b) => b.price - a.price) // Sort by best odds first
                                .map((book, index) => (
                                  <motion.div
                                    key={`${deal.key}-${book.book}`}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2, delay: index * 0.03 }}
                                    className={cn(
                                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                      book.book === deal.bestBook
                                        ? "bg-brand/10 border-brand dark:bg-brand/20"
                                        : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      {/* Sportsbook Logo */}
                                      <div className={cn(
                                        "flex items-center justify-center w-10 h-10 rounded-md p-1.5",
                                        book.book === deal.bestBook
                                          ? "bg-white dark:bg-neutral-900"
                                          : "bg-neutral-50 dark:bg-neutral-900"
                                      )}>
                                        <Image
                                          src={getSportsbookById(book.book)?.image?.light || "/images/sports-books/generic-sportsbook.svg"}
                                          alt={getSportsbookById(book.book)?.name || book.book}
                                          width={32}
                                          height={32}
                                          className="w-full h-full object-contain"
                                        />
                                      </div>
                                      
                                      {/* Book Info */}
                                      <div className="flex flex-col">
                                        <span className={cn(
                                          "text-sm font-medium",
                                          book.book === deal.bestBook
                                            ? "text-brand"
                                            : "text-neutral-900 dark:text-white"
                                        )}>
                                          {getSportsbookById(book.book)?.name || book.book}
                                          {book.book === deal.bestBook && (
                                            <span className="ml-2 text-xs font-semibold text-brand">BEST</span>
                                          )}
                                        </span>
                                        <span className={cn(
                                          "text-lg font-bold",
                                          book.book === deal.bestBook
                                            ? "text-brand"
                                            : "text-neutral-700 dark:text-neutral-300"
                                        )}>
                                          {formatOdds(book.price)}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {book.link && (
                                      <a
                                        href={book.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className={cn(
                                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                                          book.book === deal.bestBook
                                            ? "bg-brand text-white hover:bg-brand/90"
                                            : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                                        )}
                                      >
                                        Bet
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </motion.div>
                                ))}
                            </div>

                            {/* Stats summary */}
                            <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-400">
                              <div className="flex gap-4">
                                <span>
                                  Avg: <span className="font-medium">{formatOdds(deal.avgPrice)}</span>
                                </span>
                                <span>
                                  Best: <span className="font-medium text-brand">{formatOdds(deal.bestPrice)}</span>
                                </span>
                              </div>
                              <span className="font-medium text-green-600 dark:text-green-400">
                                +{Number(deal.priceImprovement).toFixed(1)}% improvement
                              </span>
                            </div>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function formatOdds(odds: number): string {
  if (odds > 0) return `+${odds}`;
  return odds.toString();
}

function formatMarketName(market: string): string {
  return market
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatGameTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return "—";
  }
}

