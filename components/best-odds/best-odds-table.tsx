"use client";

import React, { useState, useMemo, useEffect } from "react";
import type { BestOddsDeal, BestOddsPrefs } from "@/lib/best-odds-schema";
import { ExternalLink, TrendingUp, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { Tooltip } from "@/components/tooltip";
import { SportIcon } from "@/components/icons/sport-icons";
import { getAllLeagues } from "@/lib/data/sports";
import { formatMarketLabel } from "@/lib/data/markets";
import { cn } from "@/lib/utils";
import { getStandardAbbreviation } from "@/lib/data/team-mappings";
import { motion, AnimatePresence } from "motion/react";
import { ButtonLink } from "@/components/button-link";
import LockIcon from "@/icons/lock";

const chooseBookLink = (desktop?: string | null, mobile?: string | null, fallback?: string | null) => {
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);
  return isMobile ? (mobile || desktop || fallback || undefined) : (desktop || mobile || fallback || undefined);
};

// Compute baseline price for comparison based on user prefs
const getBaselinePrice = (deal: BestOddsDeal, prefs?: BestOddsPrefs): number | null => {
  if (!prefs) return deal.avgPrice ?? null;

  const mode = prefs.comparisonMode ?? 'average';
  if (mode === 'average') {
    return deal.avgPrice ?? null;
  }

  if (mode === 'book') {
    const targetBook = prefs.comparisonBook;
    if (!targetBook) return deal.avgPrice ?? null;
    const entry = deal.allBooks.find(b => b.book.toLowerCase() === targetBook.toLowerCase());
    return entry?.price ?? null;
  }

  if (mode === 'next_best') {
    const sorted = [...(deal.allBooks || [])].sort((a, b) => b.price - a.price);
    if (!sorted.length) return null;
    const best = sorted[0].price;
    const tiedBestCount = sorted.filter(book => book.price === best).length;
    if (tiedBestCount > 1) {
      // Another book already matches this price; no improvement versus "next best".
      return best;
    }
    const next = sorted.find(b => b.price < best);
    return next?.price ?? null;
  }

  return deal.avgPrice ?? null;
};

// Compute improvement vs chosen baseline
const getDisplayImprovement = (deal: BestOddsDeal, prefs?: BestOddsPrefs): number | null => {
  const baseline = getBaselinePrice(deal, prefs);
  if (baseline == null || !Number.isFinite(baseline) || !Number.isFinite(deal.bestPrice)) {
    return null;
  }
  const diff = deal.bestPrice - baseline;
  return (diff / Math.abs(baseline)) * 100;
};

type SortField = 'improvement' | 'time';
type SortDirection = 'asc' | 'desc';

interface BestOddsTableProps {
  deals: BestOddsDeal[];
  loading?: boolean;
  isPro?: boolean;
  isLimitedPreview?: boolean;
  previewPerSport?: number;
  prefs?: BestOddsPrefs;
}

export function BestOddsTable({
  deals,
  loading,
  isPro = true,
  isLimitedPreview = false,
  previewPerSport = 2,
  prefs,
}: BestOddsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('improvement');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [openBetDropdown, setOpenBetDropdown] = useState<string | null>(null);

  // Restore scroll position on mount (for mobile UX)
  useEffect(() => {
    const savedScrollPos = sessionStorage.getItem('edgeFinder_scrollPos');
    if (savedScrollPos) {
      const scrollY = parseInt(savedScrollPos, 10);
      window.scrollTo(0, scrollY);
      sessionStorage.removeItem('edgeFinder_scrollPos');
    }
  }, []);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openBetDropdown) {
        setOpenBetDropdown(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openBetDropdown]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New field - set to desc for improvement, asc for time
      setSortField(field);
      setSortDirection(field === 'improvement' ? 'desc' : 'asc');
    }
  };

  // Sort deals based on current sort field and direction
  const sortedDeals = useMemo(() => {
    let sorted = [...deals];
    
    // If limited preview mode, group by sport first, then sort within each sport
    if (isLimitedPreview) {
      // Group by sport
      const dealsBySport = sorted.reduce((acc, deal) => {
        if (!acc[deal.sport]) acc[deal.sport] = [];
        acc[deal.sport].push(deal);
        return acc;
      }, {} as Record<string, BestOddsDeal[]>);
      
      // Sort within each sport group
      Object.keys(dealsBySport).forEach(sport => {
        dealsBySport[sport].sort((a, b) => {
          let aValue: number;
          let bValue: number;

          if (sortField === 'improvement') {
            aValue = Number(getDisplayImprovement(a, prefs) ?? a.priceImprovement ?? 0);
            bValue = Number(getDisplayImprovement(b, prefs) ?? b.priceImprovement ?? 0);
          } else {
            const aTime = (a.startTime || (a as any).game_start) ? new Date(a.startTime || (a as any).game_start).getTime() : 0;
            const bTime = (b.startTime || (b as any).game_start) ? new Date(b.startTime || (b as any).game_start).getTime() : 0;
            aValue = aTime;
            bValue = bTime;
          }

          if (sortDirection === 'asc') {
            return aValue - bValue;
          } else {
            return bValue - aValue;
          }
        });
      });
      
      // Flatten back into single array, maintaining sport groups
      sorted = Object.values(dealsBySport).flat();
    } else {
      // Normal sorting for pro users
      sorted.sort((a, b) => {
        let aValue: number;
        let bValue: number;

        if (sortField === 'improvement') {
          aValue = Number(getDisplayImprovement(a, prefs) ?? a.priceImprovement ?? 0);
          bValue = Number(getDisplayImprovement(b, prefs) ?? b.priceImprovement ?? 0);
        } else {
          const aTime = (a.startTime || (a as any).game_start) ? new Date(a.startTime || (a as any).game_start).getTime() : 0;
          const bTime = (b.startTime || (b as any).game_start) ? new Date(b.startTime || (b as any).game_start).getTime() : 0;
          aValue = aTime;
          bValue = bTime;
        }

        if (sortDirection === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });
    }

    return sorted;
  }, [deals, sortField, sortDirection, isLimitedPreview, prefs]);

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

  const logo = (id?: string) => {
    if (!id) return null;
    const sb = getSportsbookById(id);
    return sb?.image?.light || null;
  };

  const bookName = (id?: string) => {
    if (!id) return "";
    const sb = getSportsbookById(id);
    return sb?.name || id;
  };

  const getBookFallbackUrl = (id?: string): string | undefined => {
    if (!id) return undefined;
    const sb = getSportsbookById(id);
    if (!sb) return undefined;
    const base = (sb.affiliate && sb.affiliateLink) ? sb.affiliateLink : (sb.links?.desktop || undefined);
    if (!base) return undefined;
    if (sb.requiresState && base.includes("{state}")) return base.replace(/\{state\}/g, "nj");
    return base;
  };

  const formatOdds = (od: number) => (od > 0 ? `+${od}` : String(od));

  const formatPlayerShort = (full?: string) => {
    if (!full) return '';
    const tokens = full.trim().replace(/\s+/g, ' ').split(' ');
    if (tokens.length === 0) return '';
    const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'vi']);
    let end = tokens.length - 1;
    if (suffixes.has(tokens[end].toLowerCase())) end -= 1;
    if (end < 1) {
      const firstOnly = tokens[0];
      return `${firstOnly}, ${firstOnly.charAt(0).toUpperCase()}`;
    }
    const first = tokens[0];
    const prev = tokens[end - 1]?.toLowerCase();
    let last = tokens[end].replace(/[,]+/g, '');
    const lastPrefixes = new Set(['st.', 'st', 'de', 'la', 'le', 'del', 'della', 'di', 'da', 'van', 'von', 'mc', 'mac']);
    if (lastPrefixes.has(prev)) {
      last = tokens[end - 1] + ' ' + last;
      if (end - 2 >= 0 && tokens[end - 2].toLowerCase() === 'de' && tokens[end - 1].toLowerCase() === 'la') {
        last = tokens[end - 2] + ' ' + tokens[end - 1] + ' ' + tokens[end];
      }
    }
    const firstInitial = first.charAt(0).toUpperCase();
    return `${last}, ${firstInitial}`;
  };

  const openLink = (bookId?: string, desktopHref?: string | null, mobileHref?: string | null) => {
    const fallback = getBookFallbackUrl(bookId);
    const target = chooseBookLink(desktopHref, mobileHref, fallback);
    if (!target) return;
    
    // Save scroll position before opening link (for mobile UX)
    sessionStorage.setItem('edgeFinder_scrollPos', window.scrollY.toString());
    
    try {
      window.open(target, '_blank', 'noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes');
    } catch {void 0;}
  };

  const getLeagueLabel = (sport: string) => {
    const labels: Record<string, string> = {
      nfl: 'NFL',
      nba: 'NBA',
      nhl: 'NHL',
      ncaaf: 'NCAAF',
      ncaab: 'NCAAB',
      mlb: 'MLB',
      wnba: 'WNBA',
    };
    return labels[sport.toLowerCase()] || sport.toUpperCase();
  };

  const getSportForLeague = (leagueId: string): string => {
    const leagues = getAllLeagues();
    const league = leagues.find(l => l.id.toLowerCase() === leagueId.toLowerCase());
    return league?.sportId || 'Football'; // Default to Football if not found
  };

  // Helper function to get team logo URL
  const getTeamLogoUrl = (teamName: string, sport: string): string => {
    if (!teamName) return '';
    const abbr = getStandardAbbreviation(teamName, sport);
    // NCAAB shares logos with NCAAF (same schools)
    const logoSport = sport.toLowerCase() === 'ncaab' ? 'ncaaf' : sport;
    return `/team-logos/${logoSport}/${abbr.toUpperCase()}.svg`;
  };

  // Helper function to check if sport has team logos available
  const hasTeamLogos = (sportKey: string): boolean => {
    const sportsWithLogos = ['nfl', 'nhl', 'nba', 'ncaaf', 'ncaab']; // Sports with team logos
    return sportsWithLogos.includes(sportKey.toLowerCase());
  };

  return (
    <div className="overflow-auto max-h-[calc(100vh-300px)] rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className="min-w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: 100 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 240 }} />
          <col style={{ width: 200 }} />
          <col style={{ width: 180 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 100 }} />
        </colgroup>
        <thead className="table-header-gradient sticky top-0 z-10">
          <tr>
            <th 
              className="bg-neutral-50 dark:bg-neutral-900 font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider backdrop-blur-sm h-14 p-2 w-[100px] text-center border-b border-r border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              onClick={() => handleSort('improvement')}
            >
              <div className="flex items-center justify-center gap-1">
                <span>Improvement %</span>
                <Tooltip content="Improvement % = (Best − Avg) ÷ Avg in decimal odds. Higher means bigger edge vs market.">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                    aria-hidden
                  >
                    <path
                      fill="currentColor"
                      d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm0-11a1.25 1.25 0 1 0-1.25-1.25A1.25 1.25 0 0 0 12 9Zm1 2h-2a1 1 0 0 0-1 1v5h2v-4h1a1 1 0 0 0 0-2Z"
                    />
                  </svg>
                </Tooltip>
                {sortField === 'improvement' && (
                  sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </th>
            <th className="bg-neutral-50 dark:bg-neutral-900 font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider backdrop-blur-sm h-14 p-2 w-[80px] text-center border-b border-r border-neutral-200 dark:border-neutral-800">
              League
            </th>
            <th 
              className="bg-neutral-50 dark:bg-neutral-900 font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider backdrop-blur-sm h-14 p-2 w-[110px] text-left border-b border-r border-neutral-200 dark:border-neutral-800 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              onClick={() => handleSort('time')}
            >
              <div className="flex items-center gap-1">
                <span>Time</span>
                {sortField === 'time' && (
                  sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </th>
            <th className="bg-neutral-50 dark:bg-neutral-900 font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider backdrop-blur-sm h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800">
              Player
            </th>
            <th className="bg-neutral-50 dark:bg-neutral-900 font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider backdrop-blur-sm h-14 p-2 text-left border-b border-r border-neutral-200 dark:border-neutral-800">
              Market
            </th>
            <th className="bg-neutral-50 dark:bg-neutral-900 font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider backdrop-blur-sm h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">
              Best Book
            </th>
            <th className="bg-neutral-50 dark:bg-neutral-900 font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider backdrop-blur-sm h-14 p-2 text-center border-b border-r border-neutral-200 dark:border-neutral-800">
              Average
            </th>
            <th className="bg-neutral-50 dark:bg-neutral-900 font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider backdrop-blur-sm h-14 p-2 text-center w-[100px] border-b border-neutral-200 dark:border-neutral-800">
              Action
            </th>
          </tr>
        </thead>
        {(() => {
          const sportRenderCounts: Record<string, number> = {};

          return (
            <tbody>
          {sortedDeals.map((deal, index) => {
            const improvement = getDisplayImprovement(deal, prefs) ?? deal.priceImprovement ?? 0;
            const improvementPct = Number(improvement).toFixed(1);
            const improvementValue = Number(improvement);
            const bestLogo = logo(deal.bestBook);
            
            // Find all books with the best price
            const bestBooksWithPrice = deal.allBooks?.filter(book => book.price === deal.bestPrice) || [];
            
            // Handle both camelCase and snake_case field names
            const playerName = deal.playerName || (deal as any).player_name;
            const homeTeam = deal.homeTeam || (deal as any).home_team;
            const awayTeam = deal.awayTeam || (deal as any).away_team;
            const playerShort = formatPlayerShort(playerName);
            const sportForLeague = getSportForLeague(deal.sport);
            const showLogos = hasTeamLogos(deal.sport);
            const isExpanded = expandedRows.has(deal.key);
            
            // High-tier opportunities (>5% improvement) get extra glow
            const isHighTier = improvementValue >= 5;

            sportRenderCounts[deal.sport] = (sportRenderCounts[deal.sport] || 0) + 1;
            const sportRenderedCount = sportRenderCounts[deal.sport];
            const nextSport = sortedDeals[index + 1]?.sport;
            const isLastOfSportPreview = isLimitedPreview && sportRenderedCount === previewPerSport && nextSport !== deal.sport;

            return (
              <React.Fragment key={deal.key}>
                <tr
                  onClick={() => toggleRow(deal.key)}
                  className={cn(
                    "group/row transition-colors cursor-pointer hover:!bg-neutral-100 dark:hover:!bg-neutral-800/50",
                    index % 2 === 0 ? "table-row-even" : "table-row-odd"
                  )}
                >
                  {/* Improvement % */}
                  <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(deal.key);
                        }}
                        className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-md transition-all shrink-0",
                          "hover:bg-neutral-100 dark:hover:bg-neutral-800",
                          "text-neutral-500 dark:text-neutral-400",
                          isExpanded && "bg-neutral-100 dark:bg-neutral-800"
                        )}
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        <motion.div
                          initial={false}
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </motion.div>
                      </button>
                      <span className="edge-badge up">
                        <span className="caret"></span>
                        +{improvementPct}%
                      </span>
                    </div>
                  </td>

                {/* League */}
                  <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    <SportIcon sport={sportForLeague} className="h-3.5 w-3.5" />
                    {getLeagueLabel(deal.sport)}
                  </div>
                </td>

                {/* Time */}
                <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                  {(() => {
                    // Handle both startTime and game_start field names
                    const gameDate = (deal.startTime || (deal as any).game_start) ? new Date(deal.startTime || (deal as any).game_start) : null;
                    
                    // Check if the date is today
                    const isToday = gameDate ? (() => {
                      const today = new Date();
                      return gameDate.getDate() === today.getDate() &&
                             gameDate.getMonth() === today.getMonth() &&
                             gameDate.getFullYear() === today.getFullYear();
                    })() : false;
                    
                    const dateStr = gameDate ? (isToday ? 'Today' : gameDate.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' })) : 'TBD';
                    const timeStr = gameDate ? gameDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
                    
                    // Check if live
                    if (deal.scope === 'live') {
                      return (
                        <div className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-medium text-sm">Live</span>
                        </div>
                      );
                    }
                    
                    return (
                      <div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">{dateStr}</div>
                        {timeStr && <div className="text-xs text-neutral-500 dark:text-neutral-500">{timeStr}</div>}
                      </div>
                    );
                  })()}
                </td>

                {/* Player Info / Game */}
                <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                  {deal.ent === 'game' ? (
                    // Game markets - show team matchup on one line
                    <div className="flex items-center gap-1 text-sm md:text-base font-medium text-neutral-900 dark:text-neutral-100">
                      {showLogos && awayTeam && (
                        <img
                          src={getTeamLogoUrl(awayTeam, deal.sport)}
                          alt={awayTeam}
                          className="w-4 h-4 md:w-5 md:h-5 object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <span>{awayTeam}</span>
                      <span className="text-neutral-500 dark:text-neutral-400 mx-0.5">@</span>
                      {showLogos && homeTeam && (
                        <img
                          src={getTeamLogoUrl(homeTeam, deal.sport)}
                          alt={homeTeam}
                          className="w-4 h-4 md:w-5 md:h-5 object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <span>{homeTeam}</span>
                    </div>
                  ) : (
                    // Player props - show player name and matchup
                    <>
                      <div className="text-sm md:text-base font-medium text-neutral-900 dark:text-neutral-100">
                        {playerName || deal.ent}
                        {deal.position && (
                          <span className="text-[11px] md:text-xs text-neutral-500 dark:text-neutral-400 font-normal ml-1">
                            ({deal.position})
                          </span>
                        )}
                      </div>
                      {/* Show full matchup with player's team highlighted */}
                      {awayTeam && homeTeam && (
                        <div className="flex items-center gap-1 text-[11px] md:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {showLogos && (
                            <img
                              src={getTeamLogoUrl(awayTeam, deal.sport)}
                              alt={awayTeam}
                              className="w-4 h-4 object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <span className={cn(
                            deal.team === awayTeam && "font-semibold text-neutral-900 dark:text-neutral-100"
                          )}>
                            {awayTeam}
                          </span>
                          <span className="mx-0.5">@</span>
                          {showLogos && (
                            <img
                              src={getTeamLogoUrl(homeTeam, deal.sport)}
                              alt={homeTeam}
                              className="w-4 h-4 object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <span className={cn(
                            deal.team === homeTeam && "font-semibold text-neutral-900 dark:text-neutral-100"
                          )}>
                            {homeTeam}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </td>

                {/* Market */}
                <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                      {formatMarketLabel(deal.mkt)}
                    </span>
                    {deal.ln !== undefined && deal.ln !== null && (() => {
                      // YES/NO markets - always show "YES" regardless of side
                      const yesNoMarkets = [
                        // Scorer markets
                        'first_goal_scorer',
                        'last_goal_scorer',
                        'anytime_goal_scorer',
                        'player_anytime_td',
                        'first_touchdown_scorer',
                        'last_touchdown_scorer',
                        'will_score_touchdown',
                        'first_td',
                        'last_td',
                        'first_goal',
                        'last_goal',
                        'first goalscorer',
                        'last goalscorer',
                        'anytime goalscorer',
                        'anytime_goalscorer',
                        // Double double and overtime
                        'double_double',
                        'doubledouble',
                        'triple_double',
                        'tripledouble',
                        'overtime',
                        'will_go_to_overtime',
                        'game_goes_to_overtime',
                      ];
                      
                      const marketLower = deal.mkt.toLowerCase().replace(/[_\s]/g, '');
                      const isYesNoMarket = yesNoMarkets.some(m => {
                        const normalized = m.toLowerCase().replace(/[_\s]/g, '');
                        return marketLower.includes(normalized);
                      });
                      
                      // All markets use the same neutral styling
                      return (
                        <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                          {isYesNoMarket ? (
                            'YES'
                          ) : (
                            `${deal.side === "o" ? "O" : deal.side === "u" ? "U" : deal.side === "a" ? "Away" : "Home"} ${deal.ln}`
                          )}
                        </span>
                      );
                    })()}
                  </div>
                </td>

                {/* Best Book */}
                <td className="p-2 border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                  <div className="flex items-center justify-center gap-2">
                    {/* Show all books with best price */}
                    <div className="flex items-center -space-x-1">
                      {bestBooksWithPrice.slice(0, 3).map((book, idx) => {
                        const bookLogo = logo(book.book);
                        return bookLogo ? (
                          <img 
                            key={book.book}
                            src={bookLogo} 
                            alt={bookName(book.book)} 
                            className="h-6 w-6 object-contain"
                            title={bookName(book.book)}
                          />
                        ) : null;
                      })}
                      {bestBooksWithPrice.length > 3 && (
                        <div className="h-6 w-6 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-400">
                            +{bestBooksWithPrice.length - 3}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center leading-tight">
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                        {formatOdds(deal.bestPrice)}
                      </div>
                      {deal.bestLimit && (
                        <div className="text-[9px] text-neutral-400 dark:text-neutral-500 font-normal leading-none mt-0.5">
                          ${deal.bestLimit}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Average Odds */}
                <td className="p-2 text-center border-b border-r border-neutral-200/50 dark:border-neutral-800/50">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-bold text-lg text-neutral-600 dark:text-neutral-400">
                      {formatOdds(deal.avgPrice)}
                    </span>
                    <span className="text-sm text-neutral-500 dark:text-neutral-500">
                      ({deal.numBooks})
                    </span>
                  </div>
                </td>

                {/* Action */}
                <td className="p-2 text-center border-b border-neutral-200/50 dark:border-neutral-800/50">
                  {bestBooksWithPrice.length > 0 && (
                    <div className="relative">
                      {bestBooksWithPrice.length === 1 ? (
                        // Single best book - direct link
                        <Tooltip content={deal.bestLimit ? `Place bet on ${bookName(deal.bestBook)} (Max: $${deal.bestLimit})` : `Place bet on ${bookName(deal.bestBook)}`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLink(deal.bestBook, deal.bestLink, deal.bestLinkMobile);
                            }}
                            className="inline-flex items-center justify-center gap-1 h-9 px-4 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:ring-offset-1 transition-all font-medium text-sm"
                          >
                            <span>Bet</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      ) : (
                        // Multiple best books - show dropdown
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenBetDropdown(openBetDropdown === deal.key ? null : deal.key);
                            }}
                            className="inline-flex items-center justify-center gap-1 h-9 px-4 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 focus:ring-offset-1 transition-all font-medium text-sm"
                          >
                            <span>Bet</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          
                          {openBetDropdown === deal.key && (
                            <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg py-1">
                              {bestBooksWithPrice.map((book) => {
                                const bookLogo = logo(book.book);
                                return (
                                  <button
                                    key={book.book}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openLink(book.book, book.link, book.mobileLink ?? null);
                                      setOpenBetDropdown(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-left"
                                  >
                                    {bookLogo && (
                                      <img src={bookLogo} alt={book.book} className="h-5 w-5 object-contain" />
                                    )}
                                    <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                      {bookName(book.book)}
                                    </span>
                                    <ExternalLink className="h-3 w-3 ml-auto text-neutral-400" />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>

              {/* Expanded Row - All Books */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "bg-neutral-50/50 dark:bg-neutral-900/50",
                      index % 2 === 0 ? "table-row-even" : "table-row-odd"
                    )}
                  >
                    <td colSpan={8} className="px-4 py-4 border-b border-neutral-200/50 dark:border-neutral-800/50">
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                          {deal.allBooks?.sort((a, b) => b.price - a.price).map((book) => {
                            const bookLogo = logo(book.book);
                            // Highlight all books with the best price
                            const isBest = book.price === deal.bestPrice;
                            const bookLink = chooseBookLink(book.link, book.mobileLink, getBookFallbackUrl(book.book));
                            const hasLink = !!bookLink;
                            
                            // Build tooltip with limit if available
                            const tooltipContent = book.limit_max 
                              ? `Place bet on ${bookName(book.book)} (Max: $${book.limit_max})`
                              : bookLink 
                                ? `Place bet on ${bookName(book.book)}` 
                                : `${bookName(book.book)} - No link available`;
                            
                            return (
                              <Tooltip 
                                key={`${deal.key}-${book.book}`}
                                content={tooltipContent}
                              >
                                <button
                                  onClick={() => openLink(book.book, book.link ?? null, book.mobileLink ?? null)}
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
                                  <div className="flex flex-col items-start leading-tight">
                                    <span className={cn(
                                      "text-base font-bold",
                                      isBest
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-neutral-900 dark:text-neutral-100"
                                    )}>
                                      {formatOdds(book.price)}
                                    </span>
                                    {book.limit_max && (
                                      <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-normal leading-none mt-0.5">
                                        ${book.limit_max}
                                      </span>
                                    )}
                                  </div>
                                  {hasLink && (
                                    <ExternalLink className="h-4 w-4 text-neutral-400 dark:text-neutral-500 ml-1" />
                                  )}
                                </button>
                              </Tooltip>
                            );
                          })}
                      </div>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
                {isLastOfSportPreview && (
                  <tr key={`${deal.key}-limited`}>
                    <td colSpan={8} className="border-b border-neutral-200/70 bg-gradient-to-r from-[var(--tertiary)]/5 via-transparent to-transparent px-4 py-3 text-sm text-neutral-700 dark:border-neutral-800/70 dark:text-neutral-300">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <LockIcon className="h-4 w-4 text-[var(--tertiary)]" />
                          <div>
                            <p className="font-semibold text-neutral-900 dark:text-white">Only showing {previewPerSport} {deal.sport.toUpperCase()} edges.</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">Unlock all edges, filters and more.</p>
                          </div>
                        </div>
                        <ButtonLink href="/pricing" variant="outline" className="justify-center border border-[var(--tertiary)]/20 text-[var(--tertiary)] hover:bg-[var(--tertiary)]/10 dark:border-[var(--tertiary)]/30">
                          Unlock All Edges
                        </ButtonLink>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
            </tbody>
          );
        })()}
      </table>
    </div>
  );
}
