"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Loader2, 
  ChevronDown, 
  ChevronRight, 
  Check,
  Plus,
  Minus,
  Filter,
  Layers,
  SlidersHorizontal,
  LayoutGrid,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useEvModels } from "@/hooks/use-ev-models";
import { 
  EV_MODEL_SPORTS,
  getEvEqualWeights,
  parseEvSports,
  formatEvSportsForStorage,
  DEFAULT_MODEL_COLOR,
  type EvModel, 
  type EvModelCreate 
} from "@/lib/types/ev-models";
import { sportsbooks } from "@/lib/data/sportsbooks";
import { SportIcon } from "@/components/icons/sport-icons";
import { SPORT_MARKETS, type SportMarket } from "@/lib/data/markets";
import { useAvailableMarkets } from "@/hooks/use-available-markets";
import { getMarketDisplay } from "@/lib/odds/types";
import { Tooltip } from "@/components/tooltip";

interface EvModelFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model?: EvModel;
  onSuccess?: () => void;
}

// Priority books for sorting (shown first)
const PRIORITY_BOOKS = ["pinnacle", "circa", "fanduel", "draftkings", "caesars", "betmgm", "bet365"];

const REFERENCE_BOOKS = sportsbooks
  .filter(book => book.isActive !== false)
  .sort((a, b) => {
    const aIdx = PRIORITY_BOOKS.indexOf(a.id);
    const bIdx = PRIORITY_BOOKS.indexOf(b.id);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

// Pie chart colors
const PIE_COLORS = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
];

const MODEL_COLOR_SWATCHES = [
  "#0EA5E9", // sky
  "#22C55E", // green
  "#F97316", // orange
  "#A855F7", // purple
  "#EF4444", // red
  "#EAB308", // yellow
  "#14B8A6", // teal
  "#3B82F6", // blue
];

// Helper to get sport key for markets lookup
function getSportMarketKey(sport: string): string {
  const mapping: Record<string, string> = {
    nba: "basketball_nba",
    wnba: "basketball_wnba",
    ncaab: "basketball_ncaab",
    nfl: "football_nfl",
    ncaaf: "football_ncaaf",
    mlb: "baseball_mlb",
    nhl: "icehockey_nhl",
  };
  return mapping[sport] || sport;
}

// Infer market group from apiKey
function inferMarketGroup(apiKey: string): string {
  const key = apiKey.toLowerCase();
  
  if (key.includes("passing") || key.includes("pass_")) return "Passing";
  if (key.includes("rushing") || key.includes("rush_")) return "Rushing";
  if (key.includes("receiving") || key.includes("reception")) return "Receiving";
  if (key.includes("touchdown") || key.includes("_td")) return "Scoring";
  if (key.includes("field_goal") || key.includes("kicking")) return "Kicking";
  if (key.includes("sack") || key.includes("tackle") || key.includes("interception") || key.includes("defense")) return "Defense";
  if (key.includes("point") && !key.includes("power_play")) return "Scoring";
  if (key.includes("rebound")) return "Scoring";
  if (key.includes("assist") && !key.includes("hockey")) return "Scoring";
  if (key.includes("three") || key.includes("3pt")) return "Scoring";
  if (key.includes("block") || key.includes("steal") || key.includes("turnover")) return "Defense";
  if (key.includes("double_double") || key.includes("triple_double") || key.includes("pra") || key.includes("combo")) return "Combo";
  if (key.includes("goal") && !key.includes("field_goal")) return "Skater";
  if (key.includes("save") || key.includes("shutout")) return "Goalie";
  if (key.includes("shot") && key.includes("hockey")) return "Skater";
  if (key.includes("power_play") || key.includes("pp_")) return "Skater";
  if (key.includes("batter_") || key.includes("hit") || key.includes("home_run") || key.includes("rbi")) return "Batter";
  if (key.includes("pitcher_") || key.includes("strikeout") || key.includes("earned_run")) return "Pitcher";
  if (key.includes("goalscorer")) return "Player";
  if (key.includes("spread") || key.includes("moneyline") || key.includes("total") || key.includes("h2h")) return "Game";
  if (key.includes("1h_") || key.includes("2h_") || key.includes("half")) return "Halves";
  if (key.includes("1q_") || key.includes("2q_") || key.includes("3q_") || key.includes("4q_") || key.includes("quarter")) return "Quarters";
  if (key.includes("p1_") || key.includes("p2_") || key.includes("p3_") || key.includes("period")) return "1st Period";
  
  return "Other";
}

// Categorize markets into game lines and player props
function categorizeMarkets(markets: SportMarket[]): { 
  gameLines: SportMarket[], 
  playerProps: Record<string, SportMarket[]>,
  gameLineIds: string[],
  playerPropIds: string[]
} {
  const gameLines: SportMarket[] = [];
  const playerProps: Record<string, SportMarket[]> = {};
  
  markets.forEach(market => {
    const group = market.group || "Other";
    
    const isPlayerProp = market.apiKey.includes("player_") || 
                         market.apiKey.includes("batter_") || 
                         market.apiKey.includes("pitcher_") ||
                         market.apiKey.includes("passing_") ||
                         market.apiKey.includes("rushing_") ||
                         market.apiKey.includes("receiving_") ||
                         market.apiKey.includes("receptions") ||
                         market.apiKey.includes("first_td") ||
                         market.apiKey.includes("last_td");
    
    if (isPlayerProp) {
      if (!playerProps[group]) playerProps[group] = [];
      playerProps[group].push(market);
    } else {
      gameLines.push(market);
    }
  });
  
  return { 
    gameLines, 
    playerProps,
    gameLineIds: gameLines.map(m => m.apiKey),
    playerPropIds: Object.values(playerProps).flat().map(m => m.apiKey)
  };
}

// Pie Chart component
function PieChart({ 
  data, 
  size = 100 
}: { 
  data: { id: string; name: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;
  
  const radius = size / 2;
  const innerRadius = radius * 0.6;
  const strokeWidth = radius - innerRadius;
  const circleRadius = (radius + innerRadius) / 2;
  const circumference = 2 * Math.PI * circleRadius;
  
  const segments = useMemo(() => {
    let cumulativePercent = 0;
    return data.map((item) => {
      const percent = total > 0 ? item.value / total : 0;
      const offset = cumulativePercent;
      cumulativePercent += percent;
      return {
        ...item,
        percent,
        offset,
        dashArray: `${percent * circumference} ${circumference}`,
        dashOffset: -offset * circumference,
      };
    });
  }, [data, total, circumference]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={radius}
          cy={radius}
          r={circleRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-neutral-200 dark:text-neutral-700"
        />
        {segments.map((segment) => (
          <circle
            key={segment.id}
            cx={radius}
            cy={radius}
            r={circleRadius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={segment.dashArray}
            strokeDashoffset={segment.dashOffset}
            strokeLinecap="butt"
            className="transition-all duration-500 ease-out"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-neutral-900 dark:text-white">
          {data.length}
        </span>
        <span className="text-xs text-neutral-500">{data.length === 1 ? "Book" : "Books"}</span>
      </div>
    </div>
  );
}

export function EvModelFormModal({
  open,
  onOpenChange,
  model,
  onSuccess,
}: EvModelFormModalProps) {
  const { createModel, updateModel, isCreating, isUpdating } = useEvModels();
  const isEditing = !!model;

  // Form state
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [color, setColor] = useState(DEFAULT_MODEL_COLOR);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [expandedSports, setExpandedSports] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedMarkets, setSelectedMarkets] = useState<Record<string, Set<string>>>({});
  const [sharpBooks, setSharpBooks] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [minBooksReference, setMinBooksReference] = useState(2);
  const [error, setError] = useState<string | null>(null);

  // Fetch dynamic markets
  const { data: dynamicMarketsData } = useAvailableMarkets(selectedSports);

  // Get market data for a sport
  const getMarketData = useCallback((sportId: string) => {
    const marketKey = getSportMarketKey(sportId);
    const staticMarkets = SPORT_MARKETS[marketKey] || [];
    
    const dynamicMarkets: SportMarket[] = [];
    if (dynamicMarketsData?.aggregatedMarkets) {
      for (const market of dynamicMarketsData.aggregatedMarkets) {
        if (market.sports.includes(sportId)) {
          const alreadyExists = staticMarkets.some(m => m.apiKey === market.key);
          if (!alreadyExists) {
            dynamicMarkets.push({
              value: market.key,
              label: market.display || getMarketDisplay(market.key),
              apiKey: market.key,
              group: inferMarketGroup(market.key),
              period: "full",
            });
          }
        }
      }
    }
    
    const allMarkets = [...staticMarkets, ...dynamicMarkets];
    return categorizeMarkets(allMarkets);
  }, [dynamicMarketsData?.aggregatedMarkets]);

  // Build markets payload
  const buildSelectedMarketsPayload = useCallback((): string[] | null => {
    let hasCustom = false;
    const markets: string[] = [];

    selectedSports.forEach((sportId) => {
      const data = getMarketData(sportId);
      const glKey = `${sportId}:gameLines`;
      const ppKey = `${sportId}:playerProps`;

      const glSet = selectedMarkets[glKey];
      const ppSet = selectedMarkets[ppKey];

      if (glSet) {
        hasCustom = true;
        markets.push(...Array.from(glSet));
      }
      if (ppSet) {
        hasCustom = true;
        markets.push(...Array.from(ppSet));
      }
    });

    return hasCustom ? markets : null;
  }, [selectedMarkets, selectedSports, getMarketData]);

  // Check if category is fully selected
  const isCategorySelected = useCallback((sportId: string, category: "gameLines" | "playerProps") => {
    const key = `${sportId}:${category}`;
    const data = getMarketData(sportId);
    const allIds = category === "gameLines" ? data.gameLineIds : data.playerPropIds;
    if (!selectedMarkets[key]) return true;
    return allIds.every(id => selectedMarkets[key].has(id));
  }, [selectedMarkets, getMarketData]);

  // Check if category is partially selected
  const isCategoryPartial = useCallback((sportId: string, category: "gameLines" | "playerProps") => {
    const key = `${sportId}:${category}`;
    const data = getMarketData(sportId);
    const allIds = category === "gameLines" ? data.gameLineIds : data.playerPropIds;
    if (!selectedMarkets[key]) return false;
    const selectedCount = allIds.filter(id => selectedMarkets[key].has(id)).length;
    return selectedCount > 0 && selectedCount < allIds.length;
  }, [selectedMarkets, getMarketData]);

  // Check if market is selected
  const isMarketSelected = useCallback((sportId: string, category: "gameLines" | "playerProps", marketId: string) => {
    const key = `${sportId}:${category}`;
    if (!selectedMarkets[key]) return true;
    return selectedMarkets[key].has(marketId);
  }, [selectedMarkets]);

  // Toggle category
  const toggleCategory = useCallback((sportId: string, category: "gameLines" | "playerProps") => {
    const key = `${sportId}:${category}`;
    const data = getMarketData(sportId);
    const allIds = category === "gameLines" ? data.gameLineIds : data.playerPropIds;
    const wasSelected = isCategorySelected(sportId, category);
    
    setSelectedMarkets(prev => {
      const next = { ...prev };
      if (wasSelected) {
        next[key] = new Set();
      } else {
        next[key] = new Set(allIds);
      }
      return next;
    });
  }, [getMarketData, isCategorySelected]);

  // Toggle market
  const toggleMarket = useCallback((sportId: string, category: "gameLines" | "playerProps", marketId: string) => {
    const key = `${sportId}:${category}`;
    const data = getMarketData(sportId);
    const allIds = category === "gameLines" ? data.gameLineIds : data.playerPropIds;
    
    setSelectedMarkets(prev => {
      const next = { ...prev };
      if (!next[key]) {
        next[key] = new Set(allIds);
      }
      const current = new Set(next[key]);
      if (current.has(marketId)) {
        current.delete(marketId);
      } else {
        current.add(marketId);
      }
      next[key] = current;
      return next;
    });
  }, [getMarketData]);

  // Toggle category expand
  const toggleCategoryExpand = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Reset form
  useEffect(() => {
    if (!open) return;
    
    if (model) {
      const sports = parseEvSports(model.sport);
      setName(model.name);
      setNotes(model.notes || "");
      setColor(model.color || DEFAULT_MODEL_COLOR);
      setSelectedSports(sports.length ? sports : []);
      setSharpBooks(model.sharp_books || []);
      setWeights(model.book_weights || getEvEqualWeights(model.sharp_books || []));
      setMinBooksReference(model.min_books_reference || 2);
      setExpandedSports(new Set());
      setExpandedCategories(new Set());
      
      // Load markets
      const presetMarkets = model.markets;
      if (!presetMarkets || presetMarkets.length === 0) {
        setSelectedMarkets({});
      } else {
        const next: Record<string, Set<string>> = {};
        const sportsToUse = sports.length ? sports : [];
        sportsToUse.forEach((sportId) => {
          const marketKey = getSportMarketKey(sportId);
          const markets = SPORT_MARKETS[marketKey] || [];
          const categorized = categorizeMarkets(markets);
          
          const glKey = `${sportId}:gameLines`;
          const ppKey = `${sportId}:playerProps`;
          const glSet = new Set<string>();
          const ppSet = new Set<string>();

          presetMarkets.forEach((m) => {
            if (categorized.gameLineIds.includes(m)) glSet.add(m);
            if (categorized.playerPropIds.includes(m)) ppSet.add(m);
          });

          if (glSet.size < categorized.gameLineIds.length) next[glKey] = glSet;
          if (ppSet.size < categorized.playerPropIds.length) next[ppKey] = ppSet;
        });
        setSelectedMarkets(next);
      }
    } else {
      setName("");
      setNotes("");
      setColor(DEFAULT_MODEL_COLOR);
      setSelectedSports([]);
      setExpandedSports(new Set());
      setExpandedCategories(new Set());
      setSelectedMarkets({});
      setSharpBooks(["pinnacle"]);
      setWeights({ pinnacle: 100 });
      setMinBooksReference(2);
    }
    setError(null);
  }, [open, model?.id]);

  // Clamp minBooksReference
  useEffect(() => {
    if (!open) return;
    const maxAllowed = sharpBooks.length;
    if (maxAllowed === 0) return;
    if (minBooksReference > maxAllowed) {
      setMinBooksReference(maxAllowed);
    }
  }, [open, sharpBooks.length, minBooksReference]);

  // Toggle sport
  const toggleSport = (sportId: string) => {
    setSelectedSports(prev => {
      if (prev.includes(sportId)) {
        return prev.filter(s => s !== sportId);
      }
      return [...prev, sportId];
    });
  };

  // Toggle expand
  const toggleExpand = (sportId: string) => {
    setExpandedSports(prev => {
      const next = new Set(prev);
      if (next.has(sportId)) next.delete(sportId);
      else next.add(sportId);
      return next;
    });
  };

  const selectAllMarketsForSport = (sportId: string) => {
    setSelectedMarkets((prev) => {
      const next = { ...prev };
      delete next[`${sportId}:gameLines`];
      delete next[`${sportId}:playerProps`];
      return next;
    });
  };

  const clearAllMarketsForSport = (sportId: string) => {
    const data = getMarketData(sportId);
    setSelectedMarkets((prev) => {
      const next = { ...prev };
      if (data.gameLineIds.length > 0) {
        next[`${sportId}:gameLines`] = new Set();
      }
      if (data.playerPropIds.length > 0) {
        next[`${sportId}:playerProps`] = new Set();
      }
      return next;
    });
  };

  const selectAllMarketsForCategory = (sportId: string, category: "gameLines" | "playerProps") => {
    setSelectedMarkets((prev) => {
      const next = { ...prev };
      delete next[`${sportId}:${category}`];
      return next;
    });
  };

  const clearAllMarketsForCategory = (sportId: string, category: "gameLines" | "playerProps") => {
    setSelectedMarkets((prev) => {
      const next = { ...prev };
      const key = `${sportId}:${category}`;
      next[key] = new Set();
      return next;
    });
  };

  // Toggle sharp book
  const toggleSharpBook = (bookId: string) => {
    setSharpBooks(prev => {
      const newBooks = prev.includes(bookId) 
        ? prev.filter(b => b !== bookId)
        : [...prev, bookId];
      
      if (newBooks.length === 0) {
        setWeights({});
      } else {
        setWeights(getEvEqualWeights(newBooks));
      }
      return newBooks;
    });
  };

  const allSportsSelected = selectedSports.length === EV_MODEL_SPORTS.length;
  const hasCustomMarkets = Object.keys(selectedMarkets).length > 0;

  const handleSelectAllSports = () => {
    setSelectedSports(EV_MODEL_SPORTS.map((sport) => sport.value));
  };

  const handleClearSports = () => {
    setSelectedSports([]);
    setExpandedSports(new Set());
  };

  const handleSelectAllMarkets = () => {
    const targetSports = selectedSports.length > 0
      ? selectedSports
      : EV_MODEL_SPORTS.map((sport) => sport.value);

    setSelectedMarkets((prev) => {
      const next = { ...prev };
      targetSports.forEach((sportId) => {
        delete next[`${sportId}:gameLines`];
        delete next[`${sportId}:playerProps`];
      });
      return next;
    });
  };

  const handleClearMarkets = () => {
    const targetSports = selectedSports.length > 0
      ? selectedSports
      : EV_MODEL_SPORTS.map((sport) => sport.value);

    setSelectedMarkets((prev) => {
      const next = { ...prev };
      targetSports.forEach((sportId) => {
        const data = getMarketData(sportId);
        if (data.gameLineIds.length > 0) {
          next[`${sportId}:gameLines`] = new Set();
        }
        if (data.playerPropIds.length > 0) {
          next[`${sportId}:playerProps`] = new Set();
        }
      });
      return next;
    });
  };

  const handleSelectAllSharpBooks = () => {
    const allBooks = REFERENCE_BOOKS.map(book => book.id);
    setSharpBooks(allBooks);
    setWeights(getEvEqualWeights(allBooks));
  };

  const handleDeselectAllSharpBooks = () => {
    setSharpBooks([]);
    setWeights({});
  };

  const allSharpBooksSelected = sharpBooks.length === REFERENCE_BOOKS.length;

  // Handle weight change
  const handleWeightChange = useCallback((bookId: string, newValue: number) => {
    setWeights(prev => {
      const newWeights: Record<string, number> = { ...prev, [bookId]: newValue };
      const lastBook = sharpBooks[sharpBooks.length - 1];
      
      if (bookId === lastBook) return newWeights;
      
      const otherBooksTotal = sharpBooks
        .filter(b => b !== lastBook)
        .reduce((sum, b) => sum + (newWeights[b] ?? prev[b] ?? 0), 0);
      
      const lastBookWeight = Math.max(0, 100 - otherBooksTotal);
      newWeights[lastBook] = lastBookWeight;
      return newWeights;
    });
  }, [sharpBooks]);

  // Total weight
  const totalWeight = useMemo(() => 
    sharpBooks.reduce((sum, book) => sum + (weights[book] || 0), 0),
    [sharpBooks, weights]
  );

  // Pie chart data
  const pieData = useMemo(() => 
    sharpBooks.map((bookId, idx) => {
      const book = sportsbooks.find(b => b.id === bookId);
      return {
        id: bookId,
        name: book?.name || bookId,
        value: weights[bookId] || 0,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      };
    }),
    [sharpBooks, weights]
  );

  // Get market type
  const getMarketType = (): "all" | "player" | "game" => {
    let hasGameLines = false;
    let hasPlayerProps = false;
    
    selectedSports.forEach(sportId => {
      if (isCategorySelected(sportId, "gameLines") || isCategoryPartial(sportId, "gameLines")) {
        hasGameLines = true;
      }
      if (isCategorySelected(sportId, "playerProps") || isCategoryPartial(sportId, "playerProps")) {
        hasPlayerProps = true;
      }
    });
    
    if (hasGameLines && hasPlayerProps) return "all";
    if (hasPlayerProps) return "player";
    if (hasGameLines) return "game";
    return "all";
  };

  // Get selected market count
  const getSelectedMarketCount = (sportId: string): number => {
    const data = getMarketData(sportId);
    let count = 0;
    
    const glKey = `${sportId}:gameLines`;
    const ppKey = `${sportId}:playerProps`;
    
    if (!selectedMarkets[glKey]) {
      count += data.gameLineIds.length;
    } else {
      count += data.gameLineIds.filter(id => selectedMarkets[glKey].has(id)).length;
    }
    
    if (!selectedMarkets[ppKey]) {
      count += data.playerPropIds.length;
    } else {
      count += data.playerPropIds.filter(id => selectedMarkets[ppKey].has(id)).length;
    }
    
    return count;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter a name for this model");
      return;
    }
    if (sharpBooks.length === 0) {
      setError("Please select at least one sharp book");
      return;
    }
    if (sharpBooks.length < minBooksReference) {
      setError(`You need at least ${minBooksReference} sharp books selected`);
      return;
    }
    if (Math.abs(totalWeight - 100) > 0.5) {
      setError("Weights must add up to 100%");
      return;
    }

    try {
      const marketsPayload = buildSelectedMarketsPayload();
      const data: EvModelCreate = {
        name: name.trim(),
        notes: notes.trim() || undefined,
        color,
        sport: formatEvSportsForStorage(selectedSports),
        markets: marketsPayload,
        market_type: getMarketType(),
        sharp_books: sharpBooks,
        book_weights: sharpBooks.length > 1 ? weights : null,
        min_books_reference: minBooksReference,
      };

      if (isEditing && model) {
        await updateModel(model.id, data);
      } else {
        await createModel(data);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save model");
    }
  };

  const isLoading = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-[100dvh] sm:h-auto sm:max-w-6xl sm:max-h-[90vh] overflow-hidden border-0 sm:border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0 sm:rounded-2xl rounded-none fixed inset-0 sm:inset-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] translate-x-0 translate-y-0 max-w-none sm:max-w-6xl shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh]">
          {/* Premium gradient accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 hidden sm:block" />
          
          {/* Header */}
          <DialogHeader className="border-b border-neutral-200/80 dark:border-neutral-800/80 px-4 sm:px-6 py-4 sm:py-5 shrink-0 bg-gradient-to-r from-white via-sky-50/20 to-blue-50/20 dark:from-neutral-900 dark:via-sky-950/10 dark:to-blue-950/10">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/25">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
                  {isEditing ? "Edit Model" : "Create Model"}
                </DialogTitle>
                <DialogDescription className="text-sm text-neutral-500 dark:text-neutral-400">
                  Configure your custom +EV detection model
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-4 sm:p-6">
              {/* Model Name */}
              <div className="mb-6">
                <Label htmlFor="name" className="text-sm font-semibold text-neutral-900 dark:text-white mb-2 block">
                  Model Name
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Pinnacle Sharp Model"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="h-12 bg-white dark:bg-neutral-800 border-neutral-200/80 dark:border-neutral-700/80 rounded-xl text-base font-medium focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="mb-6">
                <Label htmlFor="model-color" className="text-sm font-semibold text-neutral-900 dark:text-white mb-2 block">
                  Model Color
                </Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 rounded-xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 px-3 py-2">
                    <input
                      id="model-color"
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value.toUpperCase())}
                      disabled={isLoading}
                      className="h-8 w-10 cursor-pointer rounded-md border border-neutral-200/80 dark:border-neutral-700/80 bg-transparent"
                    />
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {color.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {MODEL_COLOR_SWATCHES.map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
                        onClick={() => setColor(swatch)}
                        className={cn(
                          "h-7 w-7 rounded-full border transition-all",
                          color.toUpperCase() === swatch
                            ? "border-neutral-900 dark:border-white ring-2 ring-neutral-900/10 dark:ring-white/10"
                            : "border-neutral-200 dark:border-neutral-700 hover:scale-105"
                        )}
                        style={{ backgroundColor: swatch }}
                        aria-label={`Select ${swatch}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-stretch">
                
                {/* LEFT COLUMN - Sharp Books & Weights */}
                <div className="space-y-5">
                  {/* Pie Chart & Weights */}
                  <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-br from-white to-neutral-50/80 dark:from-neutral-800/60 dark:to-neutral-900/50 p-4 sm:p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500/10 to-blue-500/10 flex items-center justify-center">
                          <SlidersHorizontal className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                            Adjust Weights
                          </h3>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Weight each book&apos;s contribution
                          </p>
                        </div>
                      </div>
                      {sharpBooks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setWeights(getEvEqualWeights(sharpBooks))}
                          disabled={isLoading}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-colors"
                        >
                          Equal
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                      <div className="shrink-0 flex justify-center sm:justify-start">
                        <PieChart data={pieData} size={100} />
                      </div>
                      
                      <div className="flex-1 space-y-2 min-w-0">
                        {sharpBooks.map((bookId, idx) => {
                          const book = sportsbooks.find(b => b.id === bookId);
                          const weight = weights[bookId] || 0;
                          return (
                            <div key={bookId} className="flex items-center gap-2">
                              <div 
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                              />
                              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex-1 truncate">
                                {book?.name || bookId}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={weight}
                                  onChange={(e) => handleWeightChange(bookId, Math.min(100, Math.max(0, Number(e.target.value))))}
                                  disabled={isLoading}
                                  className="w-14 h-8 text-center text-sm font-semibold bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-md focus:ring-1 focus:ring-sky-500"
                                />
                                <span className="text-xs text-neutral-400">%</span>
                              </div>
                            </div>
                          );
                        })}
                        {sharpBooks.length === 0 && (
                          <p className="text-xs text-neutral-400 italic">Select books below</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sharp Books Selection */}
                  <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-br from-white to-neutral-50/80 dark:from-neutral-800/60 dark:to-neutral-900/50 p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 flex items-center justify-center">
                        <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                          Sharp Books
                        </h3>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Select books to calculate fair odds
                        </p>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllSharpBooks}
                          disabled={isLoading || allSharpBooksSelected}
                          className={cn(
                            "text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors",
                            allSharpBooksSelected
                              ? "text-neutral-400 border-neutral-200 dark:border-neutral-800"
                              : "text-neutral-700 border-neutral-200 bg-neutral-50 hover:bg-neutral-100 dark:text-neutral-200 dark:border-neutral-700 dark:bg-neutral-800/60 dark:hover:bg-neutral-700"
                          )}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAllSharpBooks}
                          disabled={isLoading || sharpBooks.length === 0}
                          className={cn(
                            "text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors",
                            sharpBooks.length === 0
                              ? "text-neutral-400 border-neutral-200 dark:border-neutral-800"
                              : "text-neutral-600 border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                          )}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-[250px] sm:max-h-[320px] overflow-y-auto pr-1">
                      {REFERENCE_BOOKS.map((book) => {
                        const isSelected = sharpBooks.includes(book.id);
                        const colorIndex = sharpBooks.indexOf(book.id);
                        
                        return (
                          <div
                            key={book.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => !isLoading && toggleSharpBook(book.id)}
                            onKeyDown={(e) => {
                              if (isLoading) return;
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleSharpBook(book.id);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all select-none",
                              isSelected
                                ? "bg-sky-50 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700"
                                : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300",
                              isLoading && "opacity-60 cursor-not-allowed"
                            )}
                          >
                            <div
                              className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                                isSelected
                                  ? "bg-sky-500 border-sky-500 text-white"
                                  : "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <div className="relative">
                              <img 
                                src={book.logo} 
                                alt={book.name}
                                className="h-6 w-6 object-contain"
                              />
                              {isSelected && colorIndex >= 0 && (
                                <div 
                                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-neutral-800"
                                  style={{ backgroundColor: PIE_COLORS[colorIndex % PIE_COLORS.length] }}
                                />
                              )}
                            </div>
                            <span className={cn(
                              "text-xs font-medium truncate",
                              isSelected ? "text-neutral-900 dark:text-white" : "text-neutral-500"
                            )}>
                              {book.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN - Settings & Sports/Markets */}
                <div className="space-y-4 lg:flex lg:flex-col lg:h-full">
                  {/* Min Books Required */}
                  <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-br from-white to-neutral-50/80 dark:from-neutral-800/60 dark:to-neutral-900/50 p-4 shadow-sm">
                    <Label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Min Books Required
                    </Label>
                    <div className="flex gap-1.5 mt-3">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setMinBooksReference(n)}
                          disabled={isLoading || n > sharpBooks.length}
                          className={cn(
                            "flex-1 h-8 rounded-lg text-xs font-semibold transition-all border",
                            minBooksReference === n
                              ? "bg-gradient-to-r from-sky-500 to-blue-500 border-transparent text-white shadow-sm"
                              : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-sky-300",
                            n > sharpBooks.length && "opacity-30 cursor-not-allowed"
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sports & Markets */}
                  <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-br from-white to-neutral-50/80 dark:from-neutral-800/60 dark:to-neutral-900/50 p-5 lg:flex-1 lg:min-h-0 overflow-y-auto shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center">
                        <LayoutGrid className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                          Sports & Markets <span className="font-normal text-neutral-400">(optional)</span>
                        </h3>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {selectedSports.length === 0 ? "Applies to all sports" : "Click to select, expand to customize"}
                        </p>
                      </div>
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllSports}
                          disabled={isLoading || allSportsSelected}
                          className={cn(
                            "text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors",
                            allSportsSelected
                              ? "text-neutral-400 border-neutral-200 dark:border-neutral-800"
                              : "text-neutral-700 border-neutral-200 bg-neutral-50 hover:bg-neutral-100 dark:text-neutral-200 dark:border-neutral-700 dark:bg-neutral-800/60 dark:hover:bg-neutral-700"
                          )}
                        >
                          All sports
                        </button>
                        <button
                          type="button"
                          onClick={handleClearSports}
                          disabled={isLoading || selectedSports.length === 0}
                          className={cn(
                            "text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors",
                            selectedSports.length === 0
                              ? "text-neutral-400 border-neutral-200 dark:border-neutral-800"
                              : "text-neutral-600 border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                          )}
                        >
                          Clear sports
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {EV_MODEL_SPORTS.map((sport) => {
                        const isSelected = selectedSports.includes(sport.value);
                        const isExpanded = expandedSports.has(sport.value);
                        const data = getMarketData(sport.value);
                        const totalMarkets = data.gameLineIds.length + data.playerPropIds.length;
                        const selectedCount = isSelected ? getSelectedMarketCount(sport.value) : 0;

                        return (
                          <div
                            key={sport.value}
                            className={cn(
                              "rounded-lg overflow-hidden transition-all duration-200",
                              isSelected
                                ? "bg-white dark:bg-neutral-900 ring-1 ring-sky-500/50 shadow-sm"
                                : "bg-white/50 dark:bg-neutral-900/50 hover:bg-white dark:hover:bg-neutral-900"
                            )}
                          >
                            {/* Sport Header */}
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (isSelected) {
                                  toggleExpand(sport.value);
                                } else {
                                  toggleSport(sport.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (isSelected) toggleExpand(sport.value);
                                  else toggleSport(sport.value);
                                }
                              }}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none transition-colors",
                                isSelected ? "hover:bg-neutral-50 dark:hover:bg-neutral-800/50" : "hover:bg-neutral-100/50 dark:hover:bg-neutral-800/30"
                              )}
                            >
                              <div onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSport(sport.value)}
                                  disabled={isLoading}
                                  className={cn(
                                    "h-4 w-4 transition-colors",
                                    isSelected && "border-sky-500 data-[state=checked]:bg-sky-500"
                                  )}
                                />
                              </div>
                              
                              <SportIcon 
                                sport={sport.value} 
                                className={cn(
                                  "w-4 h-4 transition-colors",
                                  isSelected ? "text-sky-600 dark:text-sky-400" : "text-neutral-400"
                                )} 
                              />
                              
                              <span className={cn(
                                "text-sm font-medium flex-1 transition-colors",
                                isSelected ? "text-neutral-900 dark:text-white" : "text-neutral-500 dark:text-neutral-400"
                              )}>
                                {sport.label}
                              </span>
                              
                              {isSelected && (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <Tooltip content="Select all markets for this sport">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          selectAllMarketsForSport(sport.value);
                                        }}
                                        className="flex h-5 w-5 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:hover:text-neutral-200 transition-colors"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    </Tooltip>
                                    <Tooltip content="Clear all markets for this sport">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          clearAllMarketsForSport(sport.value);
                                        }}
                                        className="flex h-5 w-5 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:hover:text-neutral-200 transition-colors"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </button>
                                    </Tooltip>
                                  </div>
                                  <span className="text-[11px] font-medium text-neutral-500">
                                    {selectedCount}/{totalMarkets} markets
                                  </span>
                                </div>
                              )}
                              
                              <ChevronDown className={cn(
                                "w-4 h-4 transition-all duration-200",
                                isSelected ? "text-neutral-400" : "text-neutral-300",
                                isExpanded && "rotate-180"
                              )} />
                            </div>

                            {/* Expanded Content */}
                            {isSelected && isExpanded && (
                              <div className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/30">
                                <div className="p-2 space-y-2">
                                  {/* Game Lines */}
                                  {data.gameLines.length > 0 && (
                                    <div className="rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => toggleCategoryExpand(`${sport.value}:gameLines`)}
                                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCategoryExpand(`${sport.value}:gameLines`); }}}
                                        className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                                      >
                                        <div onClick={(e) => e.stopPropagation()}>
                                          <Checkbox
                                            checked={isCategorySelected(sport.value, "gameLines") ? true : isCategoryPartial(sport.value, "gameLines") ? "indeterminate" : false}
                                            onCheckedChange={() => toggleCategory(sport.value, "gameLines")}
                                            className="h-3.5 w-3.5"
                                          />
                                        </div>
                                        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex-1">
                                          Game Lines
                                        </span>
                                        <span className="text-[11px] text-neutral-400 tabular-nums">
                                          {data.gameLineIds.filter(id => isMarketSelected(sport.value, "gameLines", id)).length}/{data.gameLines.length}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <Tooltip content="Select all game lines">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                selectAllMarketsForCategory(sport.value, "gameLines");
                                              }}
                                              className="flex h-5 w-5 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:hover:text-neutral-200 transition-colors"
                                            >
                                              <Plus className="h-3 w-3" />
                                            </button>
                                          </Tooltip>
                                          <Tooltip content="Clear all game lines">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                clearAllMarketsForCategory(sport.value, "gameLines");
                                              }}
                                              className="flex h-5 w-5 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:hover:text-neutral-200 transition-colors"
                                            >
                                              <Minus className="h-3 w-3" />
                                            </button>
                                          </Tooltip>
                                        </div>
                                        <ChevronRight className={cn(
                                          "w-3.5 h-3.5 text-neutral-400 transition-transform duration-200",
                                          expandedCategories.has(`${sport.value}:gameLines`) && "rotate-90"
                                        )} />
                                      </div>
                                      
                                      {expandedCategories.has(`${sport.value}:gameLines`) && (
                                        <div className="border-t border-neutral-100 dark:border-neutral-800 p-2 grid grid-cols-2 gap-0.5 max-h-32 overflow-y-auto">
                                          {data.gameLines.map((market) => (
                                            <label
                                              key={market.apiKey}
                                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                                            >
                                              <Checkbox
                                                checked={isMarketSelected(sport.value, "gameLines", market.apiKey)}
                                                onCheckedChange={() => toggleMarket(sport.value, "gameLines", market.apiKey)}
                                                className="h-3 w-3"
                                              />
                                              <span className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate">
                                                {market.label}
                                              </span>
                                            </label>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Player Props */}
                                  {Object.keys(data.playerProps).length > 0 && (
                                    <div className="rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => toggleCategoryExpand(`${sport.value}:playerProps`)}
                                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCategoryExpand(`${sport.value}:playerProps`); }}}
                                        className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                                      >
                                        <div onClick={(e) => e.stopPropagation()}>
                                          <Checkbox
                                            checked={isCategorySelected(sport.value, "playerProps") ? true : isCategoryPartial(sport.value, "playerProps") ? "indeterminate" : false}
                                            onCheckedChange={() => toggleCategory(sport.value, "playerProps")}
                                            className="h-3.5 w-3.5"
                                          />
                                        </div>
                                        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex-1">
                                          Player Props
                                        </span>
                                        <span className="text-[11px] text-neutral-400 tabular-nums">
                                          {data.playerPropIds.filter(id => isMarketSelected(sport.value, "playerProps", id)).length}/{data.playerPropIds.length}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <Tooltip content="Select all player props">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                selectAllMarketsForCategory(sport.value, "playerProps");
                                              }}
                                              className="flex h-5 w-5 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:hover:text-neutral-200 transition-colors"
                                            >
                                              <Plus className="h-3 w-3" />
                                            </button>
                                          </Tooltip>
                                          <Tooltip content="Clear all player props">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                clearAllMarketsForCategory(sport.value, "playerProps");
                                              }}
                                              className="flex h-5 w-5 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 dark:hover:text-neutral-200 transition-colors"
                                            >
                                              <Minus className="h-3 w-3" />
                                            </button>
                                          </Tooltip>
                                        </div>
                                        <ChevronRight className={cn(
                                          "w-3.5 h-3.5 text-neutral-400 transition-transform duration-200",
                                          expandedCategories.has(`${sport.value}:playerProps`) && "rotate-90"
                                        )} />
                                      </div>
                                      
                                      {expandedCategories.has(`${sport.value}:playerProps`) && (
                                        <div className="border-t border-neutral-100 dark:border-neutral-800 p-2 space-y-2 max-h-40 overflow-y-auto">
                                          {Object.entries(data.playerProps).map(([group, markets]) => (
                                            <div key={group}>
                                              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1 px-2">
                                                {group}
                                              </p>
                                              <div className="grid grid-cols-2 gap-0.5">
                                                {markets.map((market) => (
                                                  <label
                                                    key={market.apiKey}
                                                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                                                  >
                                                    <Checkbox
                                                      checked={isMarketSelected(sport.value, "playerProps", market.apiKey)}
                                                      onCheckedChange={() => toggleMarket(sport.value, "playerProps", market.apiKey)}
                                                      className="h-3 w-3"
                                                    />
                                                    <span className="text-[11px] text-neutral-600 dark:text-neutral-400 truncate">
                                                      {market.label}
                                                    </span>
                                                  </label>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="mt-6">
                <Label htmlFor="notes" className="text-sm font-semibold text-neutral-900 dark:text-white mb-2 block">
                  Notes <span className="text-neutral-400 font-normal">(optional)</span>
                </Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isLoading}
                  placeholder="Add any notes about this model..."
                  rows={2}
                  maxLength={500}
                  className="w-full px-4 py-3 text-sm bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 rounded-xl resize-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-3">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 sm:px-6 py-4 bg-neutral-50 dark:bg-neutral-900 shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <div className="w-2 h-2 rounded-full bg-sky-500" />
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    {sharpBooks.length} book{sharpBooks.length !== 1 ? "s" : ""} 
                    {selectedSports.length > 0 && ` • ${selectedSports.length} sport${selectedSports.length !== 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                  className="flex-1 sm:flex-none h-12 sm:h-10 px-5 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 sm:flex-none h-12 sm:h-10 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 shadow-lg shadow-sky-500/25 transition-all hover:shadow-sky-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEditing ? "Save Changes" : "Create Model"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
