"use client";

import React, { useState } from "react";
import type { BestOddsDeal } from "@/lib/best-odds-schema";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getAllLeagues } from "@/lib/data/sports";
import { SportIcon } from "@/components/icons/sport-icons";
import { formatMarketLabel } from "@/lib/data/markets";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip } from "@/components/tooltip";
import { cn } from "@/lib/utils";
import { getStandardAbbreviation } from "@/lib/data/team-mappings";

const chooseBookLink = (desktop?: string | null, mobile?: string | null, fallback?: string | null) => {
  if (typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)) {
    return mobile || desktop || fallback || undefined;
  }
  return desktop || mobile || fallback || undefined;
};

interface BestOddsCardsProps {
  deals: BestOddsDeal[];
  loading?: boolean;
}

export function BestOddsCards({ deals, loading }: BestOddsCardsProps) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const allLeagues = getAllLeagues();

  // Helper to get league info
  const getLeagueLabel = (sport: string) => {
    const league = allLeagues.find(l => l.id === sport);
    return league?.name || sport.toUpperCase();
  };

  const getSportForLeague = (sport: string) => {
    const league = allLeagues.find(l => l.id === sport);
    return league?.sportId || 'football';
  };

  // Helper to get sportsbook info
  const logo = (bookId: string) => {
    const sb = getSportsbookById(bookId);
    return sb?.image?.light || null;
  };

  const bookName = (bookId: string) => {
    const sb = getSportsbookById(bookId);
    return sb?.name || bookId;
  };

  const getBookFallbackUrl = (bookId: string) => {
    const sb = getSportsbookById(bookId);
    return sb?.links?.desktop || '#';
  };

  // Helper to format odds
  const formatOdds = (price: number) => {
    if (price >= 0) return `+${price}`;
    return `${price}`;
  };

  // Helper to open link
  const openLink = (desktop?: string | null, mobile?: string | null, bookId?: string) => {
    const fallback = getBookFallbackUrl(bookId || '');
    const finalUrl = chooseBookLink(desktop, mobile, fallback);
    if (!finalUrl) return;
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  // Helper to format time
  const formatGameTime = (isoString: string | undefined) => {
    if (!isoString) return 'TBD';
    const date = new Date(isoString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const gameDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (gameDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Helper to get team logo URL
  const getTeamLogoUrl = (teamName: string, sport: string): string => {
    if (!teamName) return '';
    const abbr = getStandardAbbreviation(teamName, sport);
    // NCAAB shares logos with NCAAF (same schools)
    const logoSport = sport.toLowerCase() === 'ncaab' ? 'ncaaf' : sport;
    return `/team-logos/${logoSport}/${abbr.toUpperCase()}.svg`;
  };

  const hasTeamLogos = (sportKey: string): boolean => {
    const sportsWithLogos = ['nfl', 'nhl', 'nba', 'ncaaf', 'ncaab'];
    return sportsWithLogos.includes(sportKey.toLowerCase());
  };

  // Helper to humanize market name
  const humanizeMarket = (mkt: string) => {
    // First try to format using the markets.ts mapping
    const formatted = formatMarketLabel(mkt);
    // If it's the same as input, do basic formatting
    if (formatted === mkt) {
      return mkt
        .replace(/_/g, ' ')
        .replace(/\bplayer\b\s*/gi, '') // Remove "player" prefix
        .replace(/\s{2,}/g, ' ') // Remove extra spaces
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    return formatted;
  };

  const toggleCard = (dealId: string) => {
    setExpandedCard(prev => prev === dealId ? null : dealId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-r-transparent mb-4"></div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading opportunities...</p>
        </div>
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-neutral-600 dark:text-neutral-400">No deals found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {deals.map((deal: BestOddsDeal, index: number) => {
        const uniqueKey = `${deal.key}-${index}`;
        const isExpanded = expandedCard === uniqueKey;
        const startTime = deal.startTime || (deal as any).game_start;
        const playerName = deal.playerName || (deal as any).player_name;
        const homeTeam = deal.homeTeam || (deal as any).home_team;
        const awayTeam = deal.awayTeam || (deal as any).away_team;
        const isLive = deal.scope === 'live';

        // Determine if this is a player or game prop
        const isPlayerProp = !!playerName;

        // Get best book(s) with the best price
        const bestBooksWithPrice = deal.allBooks.filter((b: { price: number }) => b.price === deal.bestPrice);

        // Market display logic - YES/NO markets (always show YES regardless of side)
        const marketLower = deal.mkt.toLowerCase().replace(/[_\s]/g, '');
        const yesNoMarkets = [
          // Scorer markets
          'first_goal_scorer', 'last_goal_scorer', 'anytime_goal_scorer',
          'player_anytime_td', 'first_touchdown_scorer', 'last_touchdown_scorer',
          'will_score_touchdown', 'first_td', 'last_td', 'first_goal', 'last_goal',
          'first goalscorer', 'last goalscorer', 'anytime goalscorer', 'anytime_goalscorer',
          // Double double and overtime
          'double_double', 'doubledouble', 'triple_double', 'tripledouble',
          'overtime', 'will_go_to_overtime', 'game_goes_to_overtime',
        ];
        const isYesNoMarket = yesNoMarkets.some(m => {
          const normalized = m.toLowerCase().replace(/[_\s]/g, '');
          return marketLower.includes(normalized);
        });

        return (
          <div
            key={uniqueKey}
            className="group relative flex flex-col overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm transition-all hover:shadow-xl hover:border-sky-200/50 dark:border-neutral-800/80 dark:bg-neutral-900 dark:hover:border-sky-800/30"
          >
            {/* Subtle brand tint overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-500/[0.015] via-transparent to-transparent dark:from-sky-500/[0.02]" />
            
            {/* Header - Odds with Sportsbook Logo */}
            <div className="relative border-b border-neutral-200/80 bg-neutral-50/60 px-3 py-2.5 dark:border-neutral-800/80 dark:bg-neutral-950/40">
              <div className="flex flex-col gap-1.5">
                {/* Top row: Best Odds + Logo and Edge Badge */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatOdds(deal.bestPrice)}
                    </span>
                    
                    {/* Sportsbook Logo */}
                    {bestBooksWithPrice.slice(0, 1).map((book: { book: string; price: number; link: string }, idx: number) => {
                      const bookLogo = logo(book.book);
                      const shortName = bookName(book.book);
                      return (
                        <div key={idx} className="flex items-center gap-2">
                        {bookLogo ? (
                          <img
                            src={bookLogo}
                            alt={shortName}
                            className="h-6 w-6 rounded object-contain"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded bg-neutral-200 text-xs font-bold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                            {book.book.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Edge Badge */}
                  <div className="edge-badge up flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold">
                    <span className="caret"></span>
                    {Number(deal.priceImprovement || 0).toFixed(1)}%
                  </div>
                </div>

                {/* Bottom row: Average odds + League */}
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span>
                    {formatOdds(deal.avgPrice)} ({deal.numBooks})
                  </span>
                  <span>
                    {getLeagueLabel(deal.sport)}
                  </span>
                </div>
              </div>
            </div>

            {/* Player/Game Info - Single Tight Block */}
            <div className="relative flex-1 px-3 py-2">
              {isPlayerProp ? (
                <div className="space-y-0.5 text-sm leading-snug">
                  {/* Player Name */}
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {playerName}
                    {deal.position && (
                      <span className="ml-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                        ({deal.position})
                      </span>
                    )}
                  </div>
                  
                  {/* Game Details */}
                  <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                    {homeTeam && awayTeam ? (
                      <>
                        {hasTeamLogos(deal.sport) && awayTeam && (
                          <img
                            src={getTeamLogoUrl(awayTeam, deal.sport)}
                            alt={awayTeam}
                            className="w-3.5 h-3.5 object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span className={cn(
                          deal.team && awayTeam.toLowerCase() === deal.team.toLowerCase() && "font-bold text-neutral-900 dark:text-neutral-100"
                        )}>
                          {awayTeam}
                        </span>
                        <span className="mx-0.5">@</span>
                        {hasTeamLogos(deal.sport) && homeTeam && (
                          <img
                            src={getTeamLogoUrl(homeTeam, deal.sport)}
                            alt={homeTeam}
                            className="w-3.5 h-3.5 object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span className={cn(
                          deal.team && homeTeam.toLowerCase() === deal.team.toLowerCase() && "font-bold text-neutral-900 dark:text-neutral-100"
                        )}>
                          {homeTeam}
                        </span>
                      </>
                    ) : (
                      <span>Game TBD</span>
                    )}
                    {isLive ? (
                      <>
                        <span className="mx-0.5">•</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">Live</span>
                      </>
                    ) : startTime ? (
                      <>
                        <span className="mx-0.5">•</span>
                        <span>{formatGameTime(startTime)}</span>
                      </>
                    ) : null}
                  </div>
                  
                  {/* Market */}
                  <div className="flex items-center gap-1.5 mt-2 mb-1.5">
                    <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                      {humanizeMarket(deal.mkt)}
                    </span>
                    {deal.ln !== undefined && deal.ln !== null && (
                      <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                        {isYesNoMarket ? (
                          'YES'
                        ) : (
                          `${deal.side === 'o' ? 'O' : deal.side === 'u' ? 'U' : deal.side === 'a' ? 'Away' : 'Home'} ${deal.ln}`
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5 text-sm leading-snug">
                  {/* Game Matchup */}
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {awayTeam || 'Away'} @ {homeTeam || 'Home'}
                  </div>
                  
                  {/* Game Details */}
                  {(isLive || startTime) && (
                    <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                      {isLive ? (
                        <span className="font-semibold text-red-600 dark:text-red-400">Live</span>
                      ) : (
                        <span>{formatGameTime(startTime)}</span>
                      )}
                    </div>
                  )}
                  
                  {/* Market */}
                  <div className="flex items-center gap-1.5 mt-2 mb-1.5">
                    <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                      {humanizeMarket(deal.mkt)}
                    </span>
                    {deal.ln !== undefined && deal.ln !== null && (
                      <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                        {isYesNoMarket ? (
                          'YES'
                        ) : (
                          `${deal.side === 'o' ? 'O' : deal.side === 'u' ? 'U' : deal.side === 'a' ? 'Away' : 'Home'} ${deal.ln}`
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons - Supportive Layout */}
            <div className="relative flex items-center justify-between gap-3 border-t border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
              {/* Left: Add to Bet Slip (Outline Button) */}
              <button
                onClick={() => {
                  const primary = bestBooksWithPrice[0];
                  if (!primary) return;
                  openLink(primary.link ?? null, primary.mobileLink ?? null, primary.book);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-50 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:border-neutral-600"
              >
                Add to Bet Slip
              </button>

              {/* Right: View Books (Text Button with Icon) */}
              <button
                onClick={() => toggleCard(uniqueKey)}
                className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                View Books
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Book Links - Shown on expand */}
            {isExpanded && (
              <div className="relative border-t border-neutral-200 bg-neutral-50/50 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/50">
                {/* All Books */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {deal.allBooks
                    .sort((a: { price: number }, b: { price: number }) => b.price - a.price)
                    .map((book: { book: string; price: number; link: string; mobileLink?: string | null; limit_max?: number | null }, idx: number) => {
                      const bookLogo = logo(book.book);
                      const isBest = book.price === deal.bestPrice;
                      const preferredLink = chooseBookLink(book.link, book.mobileLink ?? null, getBookFallbackUrl(book.book));
                      const hasLink = !!preferredLink;
                      
                      return (
                        <Tooltip 
                          key={idx} 
                          content={
                            hasLink
                              ? `Place bet on ${bookName(book.book)}${book.limit_max ? ` (Max: $${book.limit_max})` : ''}`
                              : `${bookName(book.book)} - No link available`
                          }
                        >
                          <button
                            onClick={() => openLink(book.link ?? null, book.mobileLink ?? null, book.book)}
                            disabled={!hasLink}
                            className={cn(
                              "flex items-center gap-2.5 px-4 py-3 rounded-lg border transition-all",
                              hasLink ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                              isBest
                                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 shadow-sm"
                                : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-md"
                            )}
                          >
                            {bookLogo && (
                              <img
                                src={bookLogo}
                                alt={book.book}
                                className="h-6 w-6 object-contain shrink-0"
                              />
                            )}
                            <span className={cn(
                              "text-base font-bold",
                              isBest
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-neutral-900 dark:text-neutral-100"
                            )}>
                              {formatOdds(book.price)}
                            </span>
                            {hasLink && (
                              <ExternalLink className="h-4 w-4 text-neutral-400 dark:text-neutral-500 ml-1" />
                            )}
                          </button>
                        </Tooltip>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

