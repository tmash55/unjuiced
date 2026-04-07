"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useFavorites, type Favorite, type BookSnapshot } from "@/hooks/use-favorites";
import { useFavoritesStream, type FavoriteChange } from "@/hooks/use-favorites-stream";
import { favoritesToSgpLegs, type SgpBookOdds } from "@/hooks/use-sgp-quote-stream";
import { cn } from "@/lib/utils";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { formatMarketLabelShort, formatMarketLabel } from "@/lib/data/markets";
import { useStateLink } from "@/hooks/use-state-link";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getMlbHeadshotUrl } from "@/lib/utils/player-headshot";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  X,
  Trash2,
  Check,
  ExternalLink,
  Loader2,
  BarChart3,
  Layers,
  Search,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatOdds = (price: number | string | null | undefined): string => {
  if (price === null || price === undefined) return "—";
  const num = typeof price === "string" ? parseInt(price, 10) : price;
  if (isNaN(num)) return "—";
  return num >= 0 ? `+${num}` : `${num}`;
};

const formatSide = (side: string): string => {
  if (side === "over" || side === "o") return "O";
  if (side === "under" || side === "u") return "U";
  return side.charAt(0).toUpperCase();
};

const formatTime = (value?: string | null): string | null => {
  if (!value) return null;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = isDateOnly ? new Date(`${value}T00:00:00`) : new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
};

function getBookLogo(bookId: string): string | null {
  const sb = getSportsbookById(bookId);
  return sb?.image?.light || sb?.image?.square || null;
}

function getBookName(bookId: string): string {
  const sb = getSportsbookById(bookId);
  return sb?.name || bookId;
}

function parseSnapshot(raw: Record<string, BookSnapshot> | string | null): Record<string, BookSnapshot> | null {
  if (!raw) return null;
  if (typeof raw === "string") try { return JSON.parse(raw); } catch { return null; }
  return raw;
}

function getBestOdds(rawSnapshot: Record<string, BookSnapshot> | string | null): { bookId: string; price: number } | null {
  const snapshot = parseSnapshot(rawSnapshot);
  if (!snapshot) return null;
  let best: { bookId: string; price: number } | null = null;
  for (const [bookId, data] of Object.entries(snapshot)) {
    if (data.price && (!best || data.price > best.price)) {
      best = { bookId, price: data.price };
    }
  }
  return best;
}

function oddsToImplied(american: number): number {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

function impliedToAmerican(prob: number): number {
  if (prob <= 0 || prob >= 1) return 0;
  if (prob >= 0.5) return Math.round(-100 * prob / (1 - prob));
  return Math.round(100 * (1 - prob) / prob);
}

function formatPropLine(fav: Favorite): string {
  const isMoneyline = fav.market?.includes("moneyline");
  const isSpread = fav.market?.includes("spread") || fav.market?.includes("run_line");
  const marketLabel = formatMarketLabelShort(fav.market) || formatMarketLabel(fav.market) || fav.market;

  if (isMoneyline) return "Moneyline";
  if (isSpread) {
    const val = fav.line != null ? (fav.side === "over" ? `+${fav.line}` : `-${fav.line}`) : "";
    return `${val} Spread`;
  }
  const side = formatSide(fav.side);
  const line = fav.line != null ? fav.line : "";
  return `${side} ${line} ${marketLabel}`;
}

function getPlayerOrTeam(fav: Favorite): string {
  if (fav.player_name) return fav.player_name;
  if (fav.type === "game" && fav.away_team && fav.home_team) {
    const isTeamSide = fav.market?.includes("moneyline") || fav.market?.includes("spread") || fav.market?.includes("run_line");
    if (isTeamSide) return fav.side === "over" ? fav.away_team : fav.home_team;
    return `${fav.away_team} @ ${fav.home_team}`;
  }
  return fav.home_team || "Unknown";
}

function getGameLabel(fav: Favorite): string | null {
  if (fav.away_team && fav.home_team) return `${fav.away_team} @ ${fav.home_team}`;
  return null;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface RefreshedFavoriteOdds {
  best: { price: number; book: string } | null;
  allBooks: Record<string, { price: number; link: string | null; sgp: string | null }>;
}

// ── Panel Props ──────────────────────────────────────────────────────────────

interface BetslipPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Main Component ───────────────────────────────────────────────────────────

export function BetslipPanel({ open, onOpenChange }: BetslipPanelProps) {
  const { favorites, removeFavorite, refreshOdds, isLoading } = useFavorites();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const applyState = useStateLink();

  // Local selection state (all checked by default)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [compareOdds, setCompareOdds] = useState<Record<string, SgpBookOdds>>({});
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [expandedLegId, setExpandedLegId] = useState<string | null>(null);
  const compareCache = useRef<Map<string, Record<string, SgpBookOdds>>>(new Map());

  // Live odds via SSE
  const { refreshedOdds: streamRefreshedOdds, changes: streamChanges } = useFavoritesStream({
    favorites,
    refreshOdds,
    enabled: open,
  });

  const refreshedOddsMap = useMemo(() => {
    const map = new Map<string, RefreshedFavoriteOdds | null>();
    for (const [id, data] of streamRefreshedOdds) {
      if (data) {
        map.set(id, { best: data.best ? { price: data.best.price, book: data.best.book } : null, allBooks: data.allBooks });
      }
    }
    return map;
  }, [streamRefreshedOdds]);

  // Auto-select all when panel opens + auto-fetch compare
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(favorites.map((f) => f.id)));
      setShowBreakdown(false);
      setExpandedLegId(null);
      setCompareOdds({});
      // Auto-show compare if 2+ plays
      if (favorites.length >= 2) {
        setShowCompare(true);
        setIsLoadingCompare(true); // show loading state immediately
      } else {
        setShowCompare(false);
      }
    }
  }, [open, favorites]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRemove = useCallback(async (id: string) => {
    try {
      await removeFavorite(id);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch { /* toast handled by hook */ }
  }, [removeFavorite]);

  const handleClearAll = useCallback(async () => {
    setShowClearConfirm(false);
    for (const fav of favorites) {
      await removeFavorite(fav.id).catch(() => {});
    }
    toast("Betslip cleared");
  }, [favorites, removeFavorite]);

  const selectedFavorites = useMemo(() => favorites.filter((f) => selectedIds.has(f.id)), [favorites, selectedIds]);

  // Estimated combo odds
  const comboOdds = useMemo(() => {
    if (selectedFavorites.length < 2) return null;
    let combinedProb = 1;
    for (const fav of selectedFavorites) {
      const refreshed = refreshedOddsMap.get(fav.id);
      const price = refreshed?.best?.price ?? fav.best_price_at_save;
      if (!price) return null;
      combinedProb *= oddsToImplied(price);
    }
    return impliedToAmerican(combinedProb);
  }, [selectedFavorites, refreshedOddsMap]);

  // Build a cache key from selected favorite IDs
  const compareCacheKey = useMemo(() => {
    return [...selectedIds].sort().join(",");
  }, [selectedIds]);

  // SGP compare — with caching
  const fetchCompare = useCallback(async (force = false) => {
    if (selectedFavorites.length < 2) return;

    // Check cache first
    if (!force && compareCache.current.has(compareCacheKey)) {
      setCompareOdds(compareCache.current.get(compareCacheKey)!);
      return;
    }

    setIsLoadingCompare(true);
    try {
      const legs = favoritesToSgpLegs(selectedFavorites, refreshedOddsMap);
      const res = await fetch("/api/v2/sgp-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legs }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const odds = data.odds || {};
      setCompareOdds(odds);
      compareCache.current.set(compareCacheKey, odds);
    } catch {
      toast.error("Failed to fetch parlay odds");
    } finally {
      setIsLoadingCompare(false);
    }
  }, [selectedFavorites, refreshedOddsMap, compareCacheKey]);

  // Auto-fetch compare when panel opens or selection changes (skip cache on selection change)
  const prevCacheKeyRef = useRef(compareCacheKey);
  useEffect(() => {
    if (open && showCompare && selectedFavorites.length >= 2) {
      const selectionChanged = prevCacheKeyRef.current !== compareCacheKey;
      prevCacheKeyRef.current = compareCacheKey;
      fetchCompare(selectionChanged); // force refresh if selection changed
    }
  }, [open, showCompare, compareCacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSelectedLegs = selectedFavorites.length;

  // Split into full-support (all legs) and partial-support books
  const { fullBooks, partialBooks } = useMemo(() => {
    const full: [string, SgpBookOdds & { legs_supported?: number; total_legs?: number; has_all_legs?: boolean }][] = [];
    const partial: [string, SgpBookOdds & { legs_supported?: number; total_legs?: number; has_all_legs?: boolean }][] = [];
    for (const [bookId, rawOdds] of Object.entries(compareOdds)) {
      const odds = rawOdds as SgpBookOdds & { legs_supported?: number; total_legs?: number; has_all_legs?: boolean };
      if (!odds.price || odds.error) continue;
      if (odds.has_all_legs === false) {
        partial.push([bookId, odds]);
      } else {
        full.push([bookId, odds]);
      }
    }
    full.sort((a, b) => parseInt(b[1].price || "0") - parseInt(a[1].price || "0"));
    partial.sort((a, b) => parseInt(b[1].price || "0") - parseInt(a[1].price || "0"));
    return { fullBooks: full, partialBooks: partial };
  }, [compareOdds]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col p-0 gap-0 border-neutral-200/60 dark:border-neutral-800/40",
          isMobile ? "h-[90vh] rounded-t-2xl" : "w-[420px] sm:max-w-[420px]"
        )}
        hideCloseButton
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200/60 dark:border-neutral-800/40">
          <div>
            <SheetHeader className="p-0">
              <SheetTitle className="text-base font-bold text-neutral-900 dark:text-white">
                My Betslip {favorites.length > 0 && <span className="text-neutral-400 font-medium">({favorites.length})</span>}
              </SheetTitle>
            </SheetHeader>
          </div>
          <div className="flex items-center gap-2">
            {favorites.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-[11px] font-medium text-neutral-400 hover:text-red-500 transition-colors"
              >
                Clear All
              </button>
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Play list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            </div>
          ) : favorites.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
                <Layers className="w-6 h-6 text-neutral-400" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-1">Your betslip is empty</h3>
              <p className="text-xs text-neutral-500 mb-4 max-w-[240px]">
                Tap the heart icon on any prop to start building your parlay.
              </p>
              <Link
                href="/odds"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand/90 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                Browse Props
              </Link>
            </div>
          ) : (
            <div>
              <AnimatePresence mode="popLayout">
                {favorites.map((fav) => {
                  const isSelected = selectedIds.has(fav.id);
                  const refreshed = refreshedOddsMap.get(fav.id);
                  const bestOdds = refreshed?.best
                    ? { bookId: refreshed.best.book, price: refreshed.best.price }
                    : getBestOdds(fav.books_snapshot);
                  const priceChange = streamChanges.get(fav.id);
                  const gameLabel = getGameLabel(fav);
                  const playerOrTeam = getPlayerOrTeam(fav);
                  const propLine = formatPropLine(fav);
                  const timeLabel = formatTime(fav.start_time || fav.game_date);

                  return (
                    <motion.div
                      key={fav.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        "group/play border-b border-neutral-100 dark:border-neutral-800/50 transition-colors",
                        isSelected ? "bg-brand/3" : "hover:bg-neutral-50/60 dark:hover:bg-neutral-800/20"
                      )}
                    >
                      <div className="flex items-center gap-2.5 px-4 py-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleSelect(fav.id)}
                          className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                            isSelected
                              ? "border-brand bg-brand text-white"
                              : "border-neutral-300 dark:border-neutral-600"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </button>

                        {/* Player headshot or team logo */}
                        {fav.player_id && fav.sport === "mlb" ? (
                          <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0 overflow-hidden flex items-center justify-center">
                            <Image
                              src={getMlbHeadshotUrl(Number(fav.player_id), "tiny")}
                              alt=""
                              width={28}
                              height={28}
                              className="object-cover"
                              unoptimized
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                            {/* Team logo fallback behind headshot */}
                            {fav.player_team && (
                              <img
                                src={`/team-logos/${fav.sport}/${fav.player_team.toUpperCase()}.svg`}
                                alt=""
                                className="absolute w-4 h-4 object-contain opacity-40"
                              />
                            )}
                          </div>
                        ) : (
                          /* Game-type or non-MLB: show team logo */
                          <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 shrink-0 flex items-center justify-center">
                            {(() => {
                              const teamCode = fav.player_team || (fav.side === "over" ? fav.away_team : fav.home_team);
                              return teamCode ? (
                                <img
                                  src={`/team-logos/${fav.sport}/${teamCode.toUpperCase()}.svg`}
                                  alt=""
                                  className="w-4 h-4 object-contain"
                                />
                              ) : null;
                            })()}
                          </div>
                        )}

                        {/* Play info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                              {playerOrTeam}
                            </span>
                            {fav.player_team && (
                              <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded shrink-0">
                                {fav.player_team}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-semibold text-brand">{propLine}</span>
                            {gameLabel && fav.player_name && (
                              <>
                                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                                <span className="text-[10px] text-neutral-400">{gameLabel}</span>
                              </>
                            )}
                            {timeLabel && (
                              <>
                                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                                <span className="text-[10px] text-neutral-400">{timeLabel}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Best odds — click to bet, or expand to see all books */}
                        <div className="flex items-center gap-1 shrink-0">
                          {bestOdds && (
                            <a
                              href={(() => {
                                const parsed = parseSnapshot(fav.books_snapshot);
                              const snap = parsed?.[bestOdds.bookId];
                                const refreshedLink = refreshedOddsMap.get(fav.id)?.allBooks?.[bestOdds.bookId]?.link;
                                return applyState(refreshedLink || snap?.u || snap?.m || '') || '#';
                              })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                            >
                              {getBookLogo(bestOdds.bookId) && (
                                <img src={getBookLogo(bestOdds.bookId)!} alt="" className="h-4 w-4 object-contain" />
                              )}
                              <span className={cn(
                                "text-sm font-bold tabular-nums",
                                "text-emerald-600 dark:text-emerald-400",
                                priceChange?.priceDirection === "up" && "text-emerald-500",
                                priceChange?.priceDirection === "down" && "text-red-500",
                              )}>
                                {formatOdds(bestOdds.price)}
                              </span>
                              <ExternalLink className="w-2.5 h-2.5 text-neutral-400" />
                            </a>
                          )}

                          {/* Expand to see all books for this leg */}
                          <button
                            onClick={() => setExpandedLegId(expandedLegId === fav.id ? null : fav.id)}
                            className={cn(
                              "p-1 rounded transition-colors",
                              expandedLegId === fav.id
                                ? "text-brand bg-brand/10"
                                : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                            )}
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Remove */}
                          <button
                            onClick={() => handleRemove(fav.id)}
                            className="p-1 rounded text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover/play:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded: all books for this leg */}
                      <AnimatePresence>
                        {expandedLegId === fav.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.12 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 ml-7">
                              <div className="rounded-lg border border-neutral-200/40 dark:border-neutral-700/40 overflow-hidden">
                                {(() => {
                                  // Merge saved snapshot + refreshed odds
                                  const allBooks: { bookId: string; price: number; link: string | null }[] = [];
                                  const refreshed = refreshedOddsMap.get(fav.id);
                                  const seen = new Set<string>();

                                  // Refreshed first (live data)
                                  if (refreshed?.allBooks) {
                                    for (const [bookId, data] of Object.entries(refreshed.allBooks)) {
                                      if (data.price) {
                                        allBooks.push({ bookId, price: data.price, link: data.link });
                                        seen.add(bookId);
                                      }
                                    }
                                  }
                                  // Then saved snapshot (may be a JSON string from Supabase)
                                  const snapshot = parseSnapshot(fav.books_snapshot);
                                  if (snapshot) {
                                    for (const [bookId, data] of Object.entries(snapshot)) {
                                      if (!seen.has(bookId) && data.price) {
                                        allBooks.push({ bookId, price: data.price, link: data.u || data.m || null });
                                        seen.add(bookId);
                                      }
                                    }
                                  }

                                  allBooks.sort((a, b) => b.price - a.price);
                                  const bestPrice = allBooks[0]?.price;

                                  return (
                                    <div className="divide-y divide-neutral-100/40 dark:divide-neutral-800/30">
                                      {allBooks.slice(0, 8).map(({ bookId, price, link }) => {
                                        const logo = getBookLogo(bookId);
                                        const isBest = price === bestPrice;
                                        const resolvedLink = link ? (applyState(link) || link) : null;
                                        return (
                                          <div key={bookId} className={cn(
                                            "flex items-center justify-between px-3 py-1.5",
                                            isBest && "bg-emerald-500/5"
                                          )}>
                                            <div className="flex items-center gap-2">
                                              {logo ? <img src={logo} alt="" className="h-4 w-4 object-contain" /> : <div className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />}
                                              <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">{getBookName(bookId)}</span>
                                              {isBest && <span className="text-[8px] font-black uppercase text-emerald-500">Best</span>}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <span className={cn("text-xs font-bold tabular-nums", isBest ? "text-emerald-500" : "text-neutral-600 dark:text-neutral-300")}>
                                                {formatOdds(price)}
                                              </span>
                                              {resolvedLink && (
                                                <a href={resolvedLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                                  <ExternalLink className="w-2.5 h-2.5 text-neutral-400 hover:text-brand transition-colors" />
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {allBooks.length > 8 && (
                                        <div className="text-[10px] text-neutral-400 text-center py-1">+{allBooks.length - 8} more</div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        {favorites.length > 0 && (
          <div className="border-t border-neutral-200/60 dark:border-neutral-800/40 bg-white dark:bg-neutral-900">
            {/* Selection summary + combo odds */}
            <div className="px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500">
                  {selectedFavorites.length} leg{selectedFavorites.length !== 1 ? "s" : ""} selected
                </span>
                {comboOdds != null && (
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    Est. {formatOdds(comboOdds)}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              {selectedFavorites.length >= 2 && (
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    onClick={() => { setShowCompare(!showCompare); setShowBreakdown(false); if (!showCompare) fetchCompare(); }}
                    disabled={isLoadingCompare}
                    className={cn(
                      "flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all",
                      showCompare
                        ? "bg-brand text-white"
                        : "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90"
                    )}
                  >
                    {isLoadingCompare ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                    {showCompare ? "Hide Odds" : "Parlay Odds"}
                  </button>
                  <button
                    onClick={() => { setShowBreakdown(!showBreakdown); setShowCompare(false); }}
                    className={cn(
                      "flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all",
                      showBreakdown
                        ? "bg-brand text-white"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    )}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Breakdown
                  </button>
                </div>
              )}
            </div>

            {/* Compare Odds inline expand */}
            <AnimatePresence>
              {showCompare && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden border-t border-neutral-100 dark:border-neutral-800/50"
                >
                  <div className="px-5 py-3">
                    {isLoadingCompare ? (
                      <div className="flex items-center gap-2 py-4 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
                        <span className="text-xs text-neutral-500">Fetching parlay odds...</span>
                      </div>
                    ) : fullBooks.length === 0 && partialBooks.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-xs text-neutral-400">No sportsbooks returned odds for this combo</p>
                        <button
                          onClick={() => fetchCompare(true)}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-brand bg-brand/10 hover:bg-brand/20 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {fullBooks.length > 0 && (
                          <>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                                Parlay Odds ({totalSelectedLegs} legs)
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-neutral-400">{fullBooks.length} books</span>
                                <button
                                  onClick={() => fetchCompare(true)}
                                  disabled={isLoadingCompare}
                                  className="p-1 rounded text-neutral-400 hover:text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
                                  title="Refresh odds"
                                >
                                  <RefreshCw className={cn("w-3 h-3", isLoadingCompare && "animate-spin")} />
                                </button>
                              </div>
                            </div>
                            {fullBooks.map(([bookId, odds], idx) => {
                              const isBest = idx === 0;
                              const logo = getBookLogo(bookId);
                              const hasLink = !!odds.links?.desktop || !!odds.links?.mobile;
                              const link = isMobile ? (odds.links?.mobile || odds.links?.desktop) : (odds.links?.desktop || odds.links?.mobile);

                              return (
                                <div
                                  key={bookId}
                                  className={cn(
                                    "flex items-center justify-between px-3 py-2 rounded-lg transition-colors",
                                    isBest ? "bg-emerald-500/8 ring-1 ring-emerald-500/20" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                                  )}
                                >
                                  <div className="flex items-center gap-2.5">
                                    {logo ? <img src={logo} alt="" className="h-5 w-5 object-contain" /> : <div className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700" />}
                                    <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">{getBookName(bookId)}</span>
                                    {isBest && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">Best</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={cn("text-sm font-bold tabular-nums", isBest ? "text-emerald-500" : "text-neutral-800 dark:text-neutral-200")}>
                                      {formatOdds(odds.price)}
                                    </span>
                                    {hasLink && (
                                      <a
                                        href={applyState(link!) || link!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-brand text-white hover:bg-brand/90 transition-colors"
                                      >
                                        Bet <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}

                        {/* Partial-support books — show with leg count warning */}
                        {partialBooks.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/40">
                            <span className="text-[10px] font-medium text-neutral-400 flex items-center gap-1 mb-1.5">
                              <AlertTriangle className="w-3 h-3" />
                              Partial match — not all legs supported
                            </span>
                            {partialBooks.map(([bookId, odds]) => {
                              const logo = getBookLogo(bookId);
                              return (
                                <div key={bookId} className="flex items-center justify-between px-3 py-1.5 rounded-lg opacity-60">
                                  <div className="flex items-center gap-2.5">
                                    {logo ? <img src={logo} alt="" className="h-4 w-4 object-contain" /> : <div className="w-4 h-4 rounded bg-neutral-200 dark:bg-neutral-700" />}
                                    <span className="text-[11px] text-neutral-500">{getBookName(bookId)}</span>
                                    <span className="text-[9px] text-amber-500 font-medium">
                                      {odds.legs_supported}/{odds.total_legs} legs
                                    </span>
                                  </div>
                                  <span className="text-xs font-bold tabular-nums text-neutral-400">{formatOdds(odds.price)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Breakdown inline expand */}
            <AnimatePresence>
              {showBreakdown && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden border-t border-neutral-100 dark:border-neutral-800/50"
                >
                  <div className="px-5 py-3 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Leg Breakdown</span>
                    {selectedFavorites.map((fav, i) => {
                      const refreshed = refreshedOddsMap.get(fav.id);
                      const price = refreshed?.best?.price ?? fav.best_price_at_save;
                      const implied = price ? oddsToImplied(price) : null;

                      return (
                        <div key={fav.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/30">
                          <div className="min-w-0">
                            <span className="text-[11px] font-semibold text-neutral-900 dark:text-white truncate block">
                              {getPlayerOrTeam(fav)}
                            </span>
                            <span className="text-[10px] text-brand">{formatPropLine(fav)}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-right">
                            {implied != null && (
                              <span className="text-[10px] text-neutral-400 tabular-nums">{(implied * 100).toFixed(0)}%</span>
                            )}
                            <span className="text-xs font-bold tabular-nums text-neutral-800 dark:text-neutral-200">
                              {price ? formatOdds(price) : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {comboOdds != null && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-brand/5 ring-1 ring-brand/10">
                        <span className="text-[11px] font-bold text-brand">Combined</span>
                        <span className="text-sm font-black tabular-nums text-brand">{formatOdds(comboOdds)}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {/* Inline clear confirmation — renders inside the sheet so no z-index issues */}
        <AnimatePresence>
          {showClearConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-l-2xl"
              onClick={() => setShowClearConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="mx-6 w-full max-w-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xl p-5"
              >
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Clear betslip?</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Remove all {favorites.length} play{favorites.length !== 1 ? "s" : ""}. This can&apos;t be undone.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
