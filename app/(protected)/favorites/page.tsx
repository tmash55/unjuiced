"use client";

import { useState, useMemo } from "react";
import { useFavorites, Favorite } from "@/hooks/use-favorites";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { 
  Heart, 
  Trash2, 
  Loader2, 
  ChevronRight,
  ExternalLink,
  Calendar,
  Clock,
  ShoppingCart,
  Zap
} from "lucide-react";
import { HeartFill } from "@/components/icons/heart-fill";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getTeamLogoUrl } from "@/lib/data/team-mappings";

// ============================================================================
// HELPERS
// ============================================================================

const formatMarket = (market: string): string => {
  const marketMap: Record<string, string> = {
    player_points: "Points",
    player_rebounds: "Rebounds",
    player_assists: "Assists",
    player_threes_made: "3-Pointers",
    player_steals: "Steals",
    player_blocks: "Blocks",
    player_turnovers: "Turnovers",
    player_points_rebounds_assists: "Pts+Reb+Ast",
    player_points_rebounds: "Pts+Reb",
    player_points_assists: "Pts+Ast",
    player_rebounds_assists: "Reb+Ast",
    player_blocks_steals: "Blk+Stl",
  };
  return marketMap[market] || market.replace("player_", "").replace(/_/g, " ");
};

const formatMarketShort = (market: string): string => {
  const marketMap: Record<string, string> = {
    player_points: "PTS",
    player_rebounds: "REB",
    player_assists: "AST",
    player_threes_made: "3PM",
    player_steals: "STL",
    player_blocks: "BLK",
    player_turnovers: "TO",
    player_points_rebounds_assists: "PRA",
    player_points_rebounds: "P+R",
    player_points_assists: "P+A",
    player_rebounds_assists: "R+A",
    player_blocks_steals: "B+S",
  };
  return marketMap[market] || market.replace("player_", "").toUpperCase();
};

const formatOdds = (price: number | null): string => {
  if (price === null) return "—";
  return price >= 0 ? `+${price}` : `${price}`;
};

const getBookLogo = (bookId?: string | null): string | null => {
  if (!bookId) return null;
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || null;
};

const getBookName = (bookId?: string | null): string => {
  if (!bookId) return "";
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
};

// Group favorites by event_id for potential SGP grouping
const groupByEvent = (favorites: Favorite[]): Map<string, Favorite[]> => {
  const grouped = new Map<string, Favorite[]>();
  favorites.forEach((fav) => {
    const existing = grouped.get(fav.event_id) || [];
    existing.push(fav);
    grouped.set(fav.event_id, existing);
  });
  return grouped;
};

// ============================================================================
// COMPONENTS
// ============================================================================

// Single favorite item card
function FavoriteCard({
  favorite,
  onRemove,
  isRemoving,
  isSelected,
  onSelect,
}: {
  favorite: Favorite;
  onRemove: () => void;
  isRemoving: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const teamLogo = favorite.player_team
    ? getTeamLogoUrl(favorite.player_team, "basketball_nba")
    : null;
  const bookLogo = getBookLogo(favorite.best_book_at_save);
  const bookName = getBookName(favorite.best_book_at_save);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-4 p-4 rounded-xl border transition-all",
        "bg-white dark:bg-neutral-900",
        isSelected
          ? "border-brand ring-2 ring-brand/20"
          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700",
        isRemoving && "opacity-50"
      )}
    >
      {/* Selection Checkbox (for future betslip) */}
      <button
        onClick={onSelect}
        className={cn(
          "shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
          isSelected
            ? "bg-brand border-brand text-white"
            : "border-neutral-300 dark:border-neutral-600 hover:border-brand"
        )}
      >
        {isSelected && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Team Logo */}
      {teamLogo && (
        <div className="shrink-0 w-10 h-10 flex items-center justify-center">
          <Image
            src={teamLogo}
            alt={favorite.player_team || ""}
            width={40}
            height={40}
            className="w-8 h-8 object-contain"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-neutral-900 dark:text-white">
            {favorite.player_name}
          </span>
          {favorite.player_team && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {favorite.player_team}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium text-brand">
            {formatMarket(favorite.market)} Over {favorite.line}
          </span>
          {favorite.game_date && (
            <span className="text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(favorite.game_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Odds + Book */}
      <div className="shrink-0 flex items-center gap-3">
        {bookLogo && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800">
            <Image
              src={bookLogo}
              alt={bookName}
              width={20}
              height={20}
              className="w-5 h-5 object-contain rounded"
            />
            {favorite.best_price_at_save && (
              <span
                className={cn(
                  "font-bold tabular-nums",
                  favorite.best_price_at_save >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-neutral-700 dark:text-neutral-200"
                )}
              >
                {formatOdds(favorite.best_price_at_save)}
              </span>
            )}
          </div>
        )}

        {/* Remove Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          disabled={isRemoving}
          className={cn(
            "p-2 rounded-lg transition-all",
            "text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50",
            "opacity-0 group-hover:opacity-100",
            isRemoving && "opacity-100"
          )}
        >
          {isRemoving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <Heart className="w-8 h-8 text-neutral-400" />
      </div>
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
        No saved picks yet
      </h2>
      <p className="text-neutral-500 dark:text-neutral-400 text-center max-w-md mb-6">
        Save your favorite player props from the cheat sheets by clicking the heart icon.
        Build your betslip here!
      </p>
      <Link
        href="/cheatsheets/nba/hit-rates"
        className={cn(
          "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl",
          "bg-brand text-white font-semibold",
          "hover:bg-brand/90 transition-colors"
        )}
      >
        Browse Cheat Sheets
        <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// Sidebar - Betslip Builder Placeholder
function BetslipSidebar({
  selectedCount,
  selectedFavorites,
}: {
  selectedCount: number;
  selectedFavorites: Favorite[];
}) {
  const hasSameEvent = useMemo(() => {
    if (selectedFavorites.length < 2) return false;
    const firstEventId = selectedFavorites[0]?.event_id;
    return selectedFavorites.every((f) => f.event_id === firstEventId);
  }, [selectedFavorites]);

  return (
    <div className="sticky top-24 space-y-4">
      {/* Betslip Builder Card */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-brand" />
            <span className="font-semibold text-sm text-neutral-900 dark:text-white">
              Betslip Builder
            </span>
            {selectedCount > 0 && (
              <span className="ml-auto text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-medium">
                {selectedCount} selected
              </span>
            )}
          </div>
        </div>

        <div className="p-4">
          {selectedCount === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
              Select picks to build your betslip
            </p>
          ) : (
            <div className="space-y-3">
              {/* Selected picks summary */}
              <div className="space-y-2">
                {selectedFavorites.slice(0, 3).map((fav) => (
                  <div
                    key={fav.id}
                    className="text-xs flex items-center gap-2 text-neutral-600 dark:text-neutral-300"
                  >
                    <span className="truncate">
                      {fav.player_name?.split(" ").pop()} {formatMarketShort(fav.market)} o
                      {fav.line}
                    </span>
                  </div>
                ))}
                {selectedCount > 3 && (
                  <div className="text-xs text-neutral-400">
                    +{selectedCount - 3} more
                  </div>
                )}
              </div>

              {/* SGP Badge */}
              {hasSameEvent && selectedCount >= 2 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    SGP Eligible
                  </span>
                </div>
              )}

              {/* Build Button (Coming Soon) */}
              <button
                disabled
                className={cn(
                  "w-full py-2.5 rounded-lg text-sm font-semibold transition-colors",
                  "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
                )}
              >
                Build Betslip (Coming Soon)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">
          Quick Actions
        </h3>
        <div className="space-y-2">
          <Link
            href="/cheatsheets/nba/hit-rates"
            className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 hover:text-brand transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Hit Rate Cheat Sheet
          </Link>
          <Link
            href="/cheatsheets/nba/injury-impact"
            className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 hover:text-brand transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Injury Impact Sheet
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function FavoritesPage() {
  const { favorites, isLoading, removeFavorite } = useFavorites();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      await removeFavorite(id);
      // Also remove from selection
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setRemovingId(null);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === favorites.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(favorites.map((f) => f.id)));
    }
  };

  const handleClearSelected = async () => {
    const idsToRemove = Array.from(selectedIds);
    for (const id of idsToRemove) {
      await handleRemove(id);
    }
  };

  const selectedFavorites = useMemo(
    () => favorites.filter((f) => selectedIds.has(f.id)),
    [favorites, selectedIds]
  );

  const allSelected = favorites.length > 0 && selectedIds.size === favorites.length;

  return (
    <div className="min-h-screen pb-16">
      <MaxWidthWrapper className="pt-24 md:pt-28">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <HeartFill className="w-6 h-6 text-red-500" />
            <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
              Saved Picks
            </h1>
            {favorites.length > 0 && (
              <span className="text-neutral-500 dark:text-neutral-400 text-lg">
                ({favorites.length})
              </span>
            )}
          </div>
          <p className="text-neutral-500 dark:text-neutral-400">
            Your favorited player props. Select picks to build a betslip.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
          </div>
        ) : favorites.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-4">
              {/* Actions Bar */}
              <div className="flex items-center justify-between py-2">
                <button
                  onClick={handleSelectAll}
                  className="text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-brand transition-colors"
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </button>

                {selectedIds.size > 0 && (
                  <button
                    onClick={handleClearSelected}
                    className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Selected ({selectedIds.size})
                  </button>
                )}
              </div>

              {/* Favorites List */}
              <div className="space-y-3">
                {favorites.map((favorite) => (
                  <FavoriteCard
                    key={favorite.id}
                    favorite={favorite}
                    onRemove={() => handleRemove(favorite.id)}
                    isRemoving={removingId === favorite.id}
                    isSelected={selectedIds.has(favorite.id)}
                    onSelect={() => handleSelect(favorite.id)}
                  />
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div className="hidden lg:block">
              <BetslipSidebar
                selectedCount={selectedIds.size}
                selectedFavorites={selectedFavorites}
              />
            </div>
          </div>
        )}
      </MaxWidthWrapper>
    </div>
  );
}

