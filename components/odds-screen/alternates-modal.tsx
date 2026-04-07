"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, User, ChevronRight, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSportsbookById, sportsbooks } from "@/lib/data/sportsbooks";
import { Tooltip } from "@/components/tooltip";
import { motion, AnimatePresence } from "motion/react";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";
import { usePlayerLookup } from "@/hooks/use-player-lookup";
import { useFavorites, type AddFavoriteParams, type BookSnapshot } from "@/hooks/use-favorites";
import { useStateLink } from "@/hooks/use-state-link";

interface AlternateLine {
  ln: number;
  books: Record<string, {
    over?: { price: number; u?: string; m?: string; sgp?: string };
    under?: { price: number; u?: string; m?: string; sgp?: string };
  }>;
}

interface AlternatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  team?: string;
  market: string;
  sport: string;
  alternates: AlternateLine[];
  loading: boolean;
  error: string | null;
  primaryLine?: number;
  playerId?: string;
  eventId?: string;
  onMarketChange?: (market: string) => void;
  onViewProfile?: () => void;
  alternatesType?: "player" | "game"; // Type of market (affects column labels & market tabs)
  // Additional props for favorites
  homeTeam?: string;
  awayTeam?: string;
  startTime?: string;
  playerPosition?: string;
}

type ViewMode = 'over' | 'under' | 'both';

// Player prop markets for each sport
// Game-level markets (spread, moneyline, total)
const GAME_MARKETS: { key: string; label: string; shortLabel: string }[] = [
  { key: 'game_spread', label: 'Spread', shortLabel: 'Spread' },
  { key: 'game_moneyline', label: 'Moneyline', shortLabel: 'ML' },
  { key: 'game_total', label: 'Total', shortLabel: 'Total' },
];

const PLAYER_MARKETS: Record<string, { key: string; label: string; shortLabel: string }[]> = {
  nba: [
    { key: 'player_points', label: 'Points', shortLabel: 'PTS' },
    { key: 'player_rebounds', label: 'Rebounds', shortLabel: 'REB' },
    { key: 'player_assists', label: 'Assists', shortLabel: 'AST' },
    { key: 'player_threes_made', label: '3-Pointers', shortLabel: '3PM' },
    { key: 'player_points_rebounds_assists', label: 'PRA', shortLabel: 'PRA' },
    { key: 'player_points_rebounds', label: 'Points + Rebounds', shortLabel: 'P+R' },
    { key: 'player_points_assists', label: 'Points + Assists', shortLabel: 'P+A' },
    { key: 'player_rebounds_assists', label: 'Rebounds + Assists', shortLabel: 'R+A' },
    { key: 'player_double_double', label: 'Double Double', shortLabel: 'DD' },
    { key: 'player_blocks', label: 'Blocks', shortLabel: 'BLK' },
    { key: 'player_steals', label: 'Steals', shortLabel: 'STL' },
    { key: 'first_field_goal', label: 'First Basket', shortLabel: '1st' },
  ],
  wnba: [
    { key: 'player_points', label: 'Points', shortLabel: 'PTS' },
    { key: 'player_rebounds', label: 'Rebounds', shortLabel: 'REB' },
    { key: 'player_assists', label: 'Assists', shortLabel: 'AST' },
    { key: 'player_threes_made', label: '3-Pointers', shortLabel: '3PM' },
    { key: 'player_points_rebounds_assists', label: 'PRA', shortLabel: 'PRA' },
  ],
  nfl: [
    { key: 'player_pass_yards', label: 'Pass Yards', shortLabel: 'Pass' },
    { key: 'player_pass_tds', label: 'Pass TDs', shortLabel: 'PTD' },
    { key: 'player_rush_yards', label: 'Rush Yards', shortLabel: 'Rush' },
    { key: 'player_rush_attempts', label: 'Rush Attempts', shortLabel: 'Att' },
    { key: 'player_receptions', label: 'Receptions', shortLabel: 'Rec' },
    { key: 'player_receiving_yards', label: 'Receiving Yards', shortLabel: 'RecYd' },
    { key: 'player_anytime_td', label: 'Anytime TD', shortLabel: 'TD' },
    { key: 'player_first_td', label: 'First TD', shortLabel: '1st TD' },
  ],
  nhl: [
    { key: 'player_goals', label: 'Goals', shortLabel: 'G' },
    { key: 'player_assists', label: 'Assists', shortLabel: 'A' },
    { key: 'player_points', label: 'Points', shortLabel: 'PTS' },
    { key: 'player_shots', label: 'Shots', shortLabel: 'SOG' },
    { key: 'player_saves', label: 'Saves', shortLabel: 'SV' },
    { key: 'player_first_goal', label: 'First Goal', shortLabel: '1st' },
    { key: 'player_anytime_goal', label: 'Anytime Goal', shortLabel: 'ATG' },
  ],
  soccer_epl: [
    { key: 'player_goals', label: 'Goals', shortLabel: 'Goals' },
    { key: 'player_shots_on_target', label: 'Shots on Target', shortLabel: 'SOT' },
    { key: 'player_assists', label: 'Assists', shortLabel: 'AST' },
    { key: 'player_shots', label: 'Shots', shortLabel: 'Shots' },
    { key: 'player_first_goal', label: 'First Goalscorer', shortLabel: '1st G' },
    { key: 'player_fouls', label: 'Fouls', shortLabel: 'Fouls' },
    { key: 'player_offsides', label: 'Offsides', shortLabel: 'Offsides' },
  ],
  soccer_laliga: [
    { key: 'player_goals', label: 'Goals', shortLabel: 'Goals' },
    { key: 'player_shots_on_target', label: 'Shots on Target', shortLabel: 'SOT' },
    { key: 'player_assists', label: 'Assists', shortLabel: 'AST' },
    { key: 'player_shots', label: 'Shots', shortLabel: 'Shots' },
    { key: 'player_first_goal', label: 'First Goalscorer', shortLabel: '1st G' },
    { key: 'player_fouls', label: 'Fouls', shortLabel: 'Fouls' },
    { key: 'player_offsides', label: 'Offsides', shortLabel: 'Offsides' },
  ],
  soccer_mls: [
    { key: 'player_goals', label: 'Goals', shortLabel: 'Goals' },
    { key: 'player_shots_on_target', label: 'Shots on Target', shortLabel: 'SOT' },
    { key: 'player_assists', label: 'Assists', shortLabel: 'AST' },
    { key: 'player_shots', label: 'Shots', shortLabel: 'Shots' },
    { key: 'player_first_goal', label: 'First Goalscorer', shortLabel: '1st G' },
    { key: 'player_fouls', label: 'Fouls', shortLabel: 'Fouls' },
    { key: 'player_offsides', label: 'Offsides', shortLabel: 'Offsides' },
  ],
  soccer_ucl: [
    { key: 'player_goals', label: 'Goals', shortLabel: 'Goals' },
    { key: 'player_shots_on_target', label: 'Shots on Target', shortLabel: 'SOT' },
    { key: 'player_assists', label: 'Assists', shortLabel: 'AST' },
    { key: 'player_shots', label: 'Shots', shortLabel: 'Shots' },
    { key: 'player_first_goal', label: 'First Goalscorer', shortLabel: '1st G' },
    { key: 'player_fouls', label: 'Fouls', shortLabel: 'Fouls' },
    { key: 'player_offsides', label: 'Offsides', shortLabel: 'Offsides' },
  ],
  soccer_uel: [
    { key: 'player_goals', label: 'Goals', shortLabel: 'Goals' },
    { key: 'player_shots_on_target', label: 'Shots on Target', shortLabel: 'SOT' },
    { key: 'player_assists', label: 'Assists', shortLabel: 'AST' },
    { key: 'player_shots', label: 'Shots', shortLabel: 'Shots' },
    { key: 'player_first_goal', label: 'First Goalscorer', shortLabel: '1st G' },
    { key: 'player_fouls', label: 'Fouls', shortLabel: 'Fouls' },
    { key: 'player_offsides', label: 'Offsides', shortLabel: 'Offsides' },
  ],
  mlb: [
    { key: 'player_hits', label: 'Hits', shortLabel: 'H' },
    { key: 'player_home_runs', label: 'Home Runs', shortLabel: 'HR' },
    { key: 'player_total_bases', label: 'Total Bases', shortLabel: 'TB' },
    { key: 'player_rbis', label: 'RBIs', shortLabel: 'RBI' },
    { key: 'player_runs', label: 'Runs', shortLabel: 'R' },
    { key: 'player_stolen_bases', label: 'Stolen Bases', shortLabel: 'SB' },
    { key: 'player_strikeouts', label: 'Pitcher Ks', shortLabel: 'K' },
    { key: 'player_hits_allowed', label: 'Hits Allowed', shortLabel: 'HA' },
    { key: 'player_earned_runs', label: 'Earned Runs', shortLabel: 'ER' },
    { key: 'player_outs', label: 'Outs', shortLabel: 'Outs' },
  ],
};

export function AlternatesModal({
  isOpen,
  onClose,
  playerName,
  team,
  market,
  sport,
  alternates,
  loading,
  error,
  primaryLine,
  playerId, // This is the odds_player_id from the odds API
  eventId,
  onMarketChange,
  onViewProfile,
  // Additional props for favorites
  homeTeam,
  awayTeam,
  startTime,
  playerPosition,
  alternatesType = "player",
}: AlternatesModalProps) {
  const applyState = useStateLink();
  const isGame = alternatesType === "game";
  const isSpreadMarket = market.includes('spread') || market.includes('puck_line') || market.includes('run_line') || market.includes('handicap');
  const [viewMode, setViewMode] = useState<ViewMode>('over');
  const [selectedMarket, setSelectedMarket] = useState(market);
  
  // Favorites functionality
  const { toggleFavorite, isFavorited, isToggling, isLoggedIn } = useFavorites();

  // Save favorite for an alternate line, then enrich any missing SGP tokens from Redis
  const saveAlternateFavorite = React.useCallback((
    line: number,
    side: 'over' | 'under',
    alternateData: AlternateLine
  ) => {
    // Build books_snapshot from alternate line data
    const booksSnapshot: Record<string, BookSnapshot> = {};
    for (const [bookId, bookOdds] of Object.entries(alternateData.books)) {
      const sideOdds = side === 'over' ? bookOdds.over : bookOdds.under;
      if (sideOdds) {
        booksSnapshot[bookId] = {
          price: sideOdds.price,
          u: sideOdds.u || null,
          m: sideOdds.m || null,
          sgp: sideOdds.sgp || null,
        };
      }
    }

    // Find best price for this side
    let bestPrice: number | null = null;
    let bestBook: string | null = null;
    for (const [bookId, bookOdds] of Object.entries(alternateData.books)) {
      const sideOdds = side === 'over' ? bookOdds.over : bookOdds.under;
      if (sideOdds?.price !== undefined && (bestPrice === null || sideOdds.price > bestPrice)) {
        bestPrice = sideOdds.price;
        bestBook = bookId;
      }
    }

    const params: AddFavoriteParams = {
      type: alternatesType === 'game' ? 'game' : 'player',
      sport,
      event_id: eventId || '',
      game_date: startTime?.split('T')[0] || null,
      home_team: homeTeam || null,
      away_team: awayTeam || null,
      start_time: startTime || null,
      player_id: playerId || null,
      player_name: playerName || null,
      player_team: team || null,
      player_position: playerPosition || null,
      market: selectedMarket,
      line,
      side,
      odds_key: `odds:${sport}:${eventId}:${selectedMarket}`,
      odds_selection_id: `${eventId}:${playerId}:${selectedMarket}:${line}:${side}`,
      books_snapshot: Object.keys(booksSnapshot).length > 0 ? booksSnapshot : null,
      best_price_at_save: bestPrice,
      best_book_at_save: bestBook,
      source: 'alternates_modal',
    };

    toggleFavorite(params).then((result) => {
      // Enrich books missing SGP tokens from Redis
      if (result?.action === 'added' && eventId) {
        const enrichBooks = Object.keys(booksSnapshot).filter(b => !booksSnapshot[b].sgp);
        if (enrichBooks.length > 0) {
          fetch('/api/v2/favorites/enrich-sgp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sport,
              event_id: eventId,
              market: selectedMarket,
              player_name: playerName || '',
              line,
              side,
              books: enrichBooks,
            }),
          })
            .then(r => r.json())
            .then(data => {
              if (data.sgp_tokens && Object.keys(data.sgp_tokens).length > 0) {
                const favoriteId = result.favorite?.id;
                if (favoriteId) {
                  const enriched = { ...booksSnapshot };
                  for (const [bookId, token] of Object.entries(data.sgp_tokens)) {
                    if (enriched[bookId]) {
                      enriched[bookId] = { ...enriched[bookId], sgp: token as string };
                    }
                  }
                  import('@/libs/supabase/client').then(({ createClient }) => {
                    createClient()
                      .from('user_favorites')
                      .update({ books_snapshot: enriched })
                      .eq('id', favoriteId)
                      .then(() => {});
                  });
                }
              }
            })
            .catch(() => {});
        }
      }
    });
  }, [sport, eventId, startTime, homeTeam, awayTeam, playerId, playerName, team, playerPosition, selectedMarket, alternatesType, toggleFavorite]);

  // Lookup the NBA player ID from the odds player ID (only for NBA/WNBA)
  const { data: playerLookupData, isLoading: isLookingUpPlayer } = usePlayerLookup({
    odds_player_id: playerId,
    player_name: playerName,
    enabled: isOpen && (sport === 'nba' || sport === 'wnba') && !!playerId,
  });
  
  // The actual NBA player ID to use for the hit rates link
  const nbaPlayerId = playerLookupData?.player?.nba_player_id;

  // Update selected market when prop changes
  useEffect(() => {
    setSelectedMarket(market);
  }, [market]);

  // Get available markets for this sport
  const availableMarkets = React.useMemo(() => {
    if (isGame) return GAME_MARKETS;
    let configured = PLAYER_MARKETS[sport] || [];

    // For MLB, filter to batter or pitcher markets based on the original market
    if (sport === "mlb" && configured.length > 0) {
      const pitcherMarkets = new Set(["player_strikeouts", "player_hits_allowed", "player_earned_runs", "player_outs", "pitcher_strikeouts", "pitcher_hits_allowed"]);
      const isPitcher = pitcherMarkets.has(market);
      if (isPitcher) {
        configured = configured.filter(m => pitcherMarkets.has(m.key));
      } else {
        configured = configured.filter(m => !pitcherMarkets.has(m.key));
      }
    }

    if (configured.length > 0) return configured;

    // Never default to NBA markets for unsupported sports.
    // Keep current market selectable so users can still switch back.
    const fallbackLabel = selectedMarket
      .replace(/_/g, ' ')
      .replace(/player /i, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return [{ key: selectedMarket, label: fallbackLabel, shortLabel: fallbackLabel }];
  }, [sport, selectedMarket]);

  // Get available sportsbooks from the alternates data
  const availableSportsbooks = React.useMemo(() => {
    const bookIds = new Set<string>();
    alternates.forEach(alt => {
      Object.keys(alt.books).forEach(bookId => bookIds.add(bookId));
    });
    return sportsbooks
      .filter(sb => bookIds.has(sb.id))
      .map(sb => sb.id);
  }, [alternates]);

  // Sort alternates by line value
  const sortedAlternates = React.useMemo(() => {
    return [...alternates].sort((a, b) => a.ln - b.ln);
  }, [alternates]);

  // Format odds display
  const formatOdds = (price: number) => {
    return price > 0 ? `+${price}` : `${price}`;
  };

  // Helper to get preferred link based on device type
  const getPreferredLink = (desktopLink?: string, mobileLink?: string) => {
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);
    return isMobile ? (mobileLink || desktopLink || undefined) : (desktopLink || mobileLink || undefined);
  };

  // Find best odds for a specific line and side
  const getBestOddsForLine = (alt: AlternateLine, side: 'over' | 'under'): number | null => {
    let best: number | null = null;
    Object.values(alt.books).forEach(bookData => {
      const odds = bookData?.[side]?.price;
      if (odds !== undefined && (best === null || odds > best)) {
        best = odds;
      }
    });
    return best;
  };

  // Format market name for display
  const formatMarket = (m: string) => {
    const found = availableMarkets.find(mk => mk.key === m);
    if (found) return found.label;
    return m
      .replace(/_/g, ' ')
      .replace(/player /i, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Handle market change
  const handleMarketChange = (newMarket: string) => {
    setSelectedMarket(newMarket);
    onMarketChange?.(newMarket);
  };

  // Check if NBA/WNBA and we have a valid NBA player ID for profile link
  const showProfileLink = (sport === 'nba' || sport === 'wnba') && nbaPlayerId;

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Don't render if not open or if we're on the server
  if (!isOpen || typeof document === 'undefined') return null;

  // Use portal to render modal outside of table DOM hierarchy
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-4 sm:inset-6 md:inset-8 lg:inset-x-[10%] lg:inset-y-6 z-50 flex flex-col bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl overflow-hidden border border-neutral-200/60 dark:border-neutral-800/40"
          >
            {/* Header */}
            <div className="border-b border-neutral-200/60 dark:border-neutral-800/40">
              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  {team && (
                    <div className="w-9 h-9 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        src={getTeamLogoUrl(team, sport)}
                        alt={team}
                        className="w-6 h-6 object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-neutral-900 dark:text-white">{playerName}</h2>
                      {team && <span className="text-[10px] font-bold text-neutral-400">{team}</span>}
                    </div>
                    <span className="text-[11px] font-medium text-brand">{formatMarket(selectedMarket)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {showProfileLink && (
                    <a
                      href={`/hit-rates/${sport}/player/${nbaPlayerId}?market=${selectedMarket}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <User className="w-3 h-3" />
                      Stats
                    </a>
                  )}

                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800/60 rounded-lg p-0.5">
                    {[
                      { key: 'over' as ViewMode, label: isGame && !market.includes('total') ? (awayTeam || 'Away') : 'Over' },
                      { key: 'under' as ViewMode, label: isGame && !market.includes('total') ? (homeTeam || 'Home') : 'Under' },
                      { key: 'both' as ViewMode, label: 'Both' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setViewMode(opt.key)}
                        className={cn(
                          "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all",
                          viewMode === opt.key
                            ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                            : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Market Tabs */}
              <div className="px-5 pb-2.5 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-1 min-w-max">
                  {availableMarkets.map((mk) => (
                    <button
                      key={mk.key}
                      onClick={() => handleMarketChange(mk.key)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all whitespace-nowrap",
                        selectedMarket === mk.key
                          ? "bg-brand text-white shadow-sm"
                          : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                      )}
                    >
                      {mk.shortLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3">
                    <div className="relative w-5 h-5">
                      <div className="absolute inset-0 rounded-full border-2 border-neutral-200 dark:border-neutral-800" />
                      <div className="absolute inset-0 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                    </div>
                    <span className="text-sm text-neutral-500">Loading lines...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              ) : sortedAlternates.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">No alternate lines available for this market</p>
                </div>
              ) : (
                <div className="absolute inset-0 overflow-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-white dark:bg-neutral-950 border-b border-neutral-200/60 dark:border-neutral-800/40">
                        <th className="sticky left-0 z-20 bg-white dark:bg-neutral-950 px-4 py-2 text-left text-[10px] font-bold text-neutral-400 uppercase tracking-wider min-w-[60px]">
                          {viewMode === 'both' ? 'Line' : viewMode.toUpperCase()}
                        </th>
                        <th className="px-1 py-2 text-center min-w-[32px]" />
                        {availableSportsbooks.map((bookId: string) => {
                          const sb = getSportsbookById(bookId);
                          const logoUrl = sb?.image?.square || sb?.image?.light;
                          return (
                            <th key={bookId} className="px-1 py-2 text-center min-w-[60px]">
                              <Tooltip content={sb?.name || bookId}>
                                <div className="flex items-center justify-center">
                                  {logoUrl ? (
                                    <img src={logoUrl} alt={sb?.name || bookId} className="h-5 w-5 object-contain" />
                                  ) : (
                                    <span className="text-[9px] font-bold text-neutral-500 uppercase">{bookId.slice(0, 3)}</span>
                                  )}
                                </div>
                              </Tooltip>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAlternates.map((alt, index) => {
                        const bestOver = getBestOddsForLine(alt, 'over');
                        const bestUnder = getBestOddsForLine(alt, 'under');
                        const isPrimaryLine = alt.ln === primaryLine;

                        const rowBg = index % 2 === 0
                          ? 'bg-white dark:bg-neutral-950'
                          : 'bg-neutral-50/40 dark:bg-neutral-900/40';
                        const stickyBg = index % 2 === 0
                          ? 'bg-white dark:bg-neutral-950'
                          : 'bg-neutral-50 dark:bg-neutral-900';

                        return (
                          <React.Fragment key={alt.ln}>
                            {/* Over row */}
                            {(viewMode === 'over' || viewMode === 'both') && (
                              <tr 
                                className={cn(
                                  "border-b border-neutral-100/60 dark:border-neutral-800/30 transition-colors",
                                  "hover:bg-neutral-50 dark:hover:bg-neutral-800/20",
                                  !isPrimaryLine && rowBg,
                                  isPrimaryLine && rowBg // Treat primary line same as others
                                )}
                              >
                                <td className={cn(
                                  "sticky left-0 z-[5] px-4 py-2 text-xs font-semibold tabular-nums border-r border-neutral-100/60 dark:border-neutral-800/30",
                                  cn("text-neutral-700 dark:text-neutral-300", stickyBg)
                                )}>
                                  <div className="flex items-center gap-1.5">
                                    {viewMode === 'both' && <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase">{isGame && !market.includes('total') ? 'A' : 'o'}</span>}
                                    <span>{isGame && isSpreadMarket ? `+${alt.ln}` : alt.ln}</span>
                                  </div>
                                </td>
                                {/* Favorite button for Over */}
                                <td className="px-2 py-2.5 text-center">
                                  {(() => {
                                    const favorited = isFavorited({
                                      event_id: eventId || '',
                                      type: 'player',
                                      market: selectedMarket,
                                      side: 'over',
                                      line: alt.ln,
                                      player_id: playerId || null,
                                    });
                                    return (
                                      <Tooltip content={favorited ? "Remove from My Plays" : "Add to My Plays"}>
                                        <button
                                          onClick={() => {
                                            if (!isLoggedIn) return;
                                            saveAlternateFavorite(alt.ln, 'over', alt);
                                          }}
                                          disabled={isToggling}
                                          className={cn(
                                            "p-1 rounded-md transition-colors",
                                            favorited 
                                              ? "text-red-500 bg-red-50 dark:bg-red-950/30" 
                                              : "text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                                            isToggling && "opacity-50 cursor-not-allowed"
                                          )}
                                        >
                                          <Heart className={cn("w-3.5 h-3.5", favorited && "fill-current")} />
                                        </button>
                                      </Tooltip>
                                    );
                                  })()}
                                </td>
                                {availableSportsbooks.map((bookId: string) => {
                                  const bookData = alt.books[bookId];
                                  const odds = bookData?.over;
                                  const isBest = odds?.price !== undefined && odds.price === bestOver;
                                  const link = odds ? getPreferredLink(odds.u, odds.m) : undefined;
                                  const sb = getSportsbookById(bookId);

                                  if (!odds) {
                                    return (
                                      <td key={bookId} className="px-2 py-2.5 text-center">
                                        {/* Empty cell */}
                                      </td>
                                    );
                                  }

                                  return (
                                    <td key={bookId} className="px-2 py-2.5 text-center">
                                      <Tooltip content={link ? `Place bet on ${sb?.name}` : sb?.name || bookId}>
                                        <button
                                          onClick={() => {
                                            if (link) {
                                              window.open(applyState(link) || link, '_blank', 'noopener,noreferrer');
                                            }
                                          }}
                                          disabled={!link}
                                          className={cn(
                                            "inline-block px-2 py-1 text-xs font-bold tabular-nums rounded-md transition-all",
                                            link && "cursor-pointer hover:brightness-110 active:scale-[0.97]",
                                            !link && "cursor-default",
                                            isBest
                                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30"
                                              : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                                          )}
                                        >
                                          {formatOdds(odds.price)}
                                        </button>
                                      </Tooltip>
                                    </td>
                                  );
                                })}
                              </tr>
                            )}

                            {/* Under row */}
                            {(viewMode === 'under' || viewMode === 'both') && (
                              <tr 
                                className={cn(
                                  "border-b border-neutral-100/60 dark:border-neutral-800/30 transition-colors",
                                  "hover:bg-neutral-50 dark:hover:bg-neutral-800/20",
                                  viewMode === 'both' && "bg-neutral-50/30 dark:bg-neutral-800/20",
                                  viewMode === 'under' && rowBg
                                )}
                              >
                                <td className={cn(
                                  "sticky left-0 z-[5] px-4 py-2 text-xs font-semibold tabular-nums border-r border-neutral-100/60 dark:border-neutral-800/30",
                                  viewMode === 'both' 
                                    ? "text-neutral-500 dark:text-neutral-500 bg-neutral-50/30 dark:bg-neutral-800/20"
                                    : cn("text-neutral-700 dark:text-neutral-300", stickyBg)
                                )}>
                                  <div className="flex items-center gap-1.5">
                                    {viewMode === 'both' && <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase">{isGame && !market.includes('total') ? 'H' : 'u'}</span>}
                                    <span>{isGame && isSpreadMarket ? `-${alt.ln}` : alt.ln}</span>
                                  </div>
                                </td>
                                {/* Favorite button for Under */}
                                <td className={cn(
                                  "px-2 py-2.5 text-center",
                                  viewMode === 'both' && "bg-neutral-50/30 dark:bg-neutral-800/20"
                                )}>
                                  {(() => {
                                    const favorited = isFavorited({
                                      event_id: eventId || '',
                                      type: 'player',
                                      market: selectedMarket,
                                      side: 'under',
                                      line: alt.ln,
                                      player_id: playerId || null,
                                    });
                                    return (
                                      <Tooltip content={favorited ? "Remove from My Plays" : "Add to My Plays"}>
                                        <button
                                          onClick={() => {
                                            if (!isLoggedIn) return;
                                            saveAlternateFavorite(alt.ln, 'under', alt);
                                          }}
                                          disabled={isToggling}
                                          className={cn(
                                            "p-1 rounded-md transition-colors",
                                            favorited 
                                              ? "text-red-500 bg-red-50 dark:bg-red-950/30" 
                                              : "text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                                            isToggling && "opacity-50 cursor-not-allowed"
                                          )}
                                        >
                                          <Heart className={cn("w-3.5 h-3.5", favorited && "fill-current")} />
                                        </button>
                                      </Tooltip>
                                    );
                                  })()}
                                </td>
                                {availableSportsbooks.map((bookId: string) => {
                                  const bookData = alt.books[bookId];
                                  const odds = bookData?.under;
                                  const isBest = odds?.price !== undefined && odds.price === bestUnder;
                                  const link = odds ? getPreferredLink(odds.u, odds.m) : undefined;
                                  const sb = getSportsbookById(bookId);

                                  if (!odds) {
                                    return (
                                      <td key={bookId} className={cn(
                                        "px-2 py-2.5 text-center",
                                        viewMode === 'both' && "bg-neutral-50/30 dark:bg-neutral-800/20"
                                      )}>
                                        {/* Empty cell */}
                                      </td>
                                    );
                                  }

                                  return (
                                    <td key={bookId} className={cn(
                                      "px-2 py-2.5 text-center",
                                      viewMode === 'both' && "bg-neutral-50/30 dark:bg-neutral-800/20"
                                    )}>
                                      <Tooltip content={link ? `Place bet on ${sb?.name}` : sb?.name || bookId}>
                                        <button
                                          onClick={() => {
                                            if (link) {
                                              window.open(applyState(link) || link, '_blank', 'noopener,noreferrer');
                                            }
                                          }}
                                          disabled={!link}
                                          className={cn(
                                            "inline-block px-2 py-1 text-xs font-bold tabular-nums rounded-md transition-all",
                                            link && "cursor-pointer hover:brightness-110 active:scale-[0.97]",
                                            !link && "cursor-default",
                                            isBest
                                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30"
                                              : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50"
                                          )}
                                        >
                                          {formatOdds(odds.price)}
                                        </button>
                                      </Tooltip>
                                    </td>
                                  );
                                })}
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer - Mobile Profile Link */}
            {showProfileLink && (
              <div className="sm:hidden px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                <a
                  href={`/hit-rates/${sport}/player/${nbaPlayerId}?market=${selectedMarket}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                >
                  <User className="w-4 h-4" />
                  View Advanced Stats
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
