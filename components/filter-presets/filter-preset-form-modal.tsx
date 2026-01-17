"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Loader2, 
  ChevronDown, 
  ChevronRight, 
  Check,
  Filter,
  Info,
  Layers,
  SlidersHorizontal,
  LayoutGrid
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
import { useFilterPresets } from "@/hooks/use-filter-presets";
import { 
  PRESET_SPORTS, 
  parseSports,
  formatSportsForStorage,
  getEqualWeights,
  type FilterPreset, 
  type FilterPresetCreate 
} from "@/lib/types/filter-presets";
import { sportsbooks } from "@/lib/data/sportsbooks";
import { SportIcon } from "@/components/icons/sport-icons";
import { SPORT_MARKETS, type SportMarket } from "@/lib/data/markets";
import { useAvailableMarkets } from "@/hooks/use-available-markets";
import { getMarketDisplay } from "@/lib/odds/types";

interface FilterPresetFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset?: FilterPreset;
  onSuccess?: () => void;
}

// Get all active sportsbooks for reference book selection
// Priority order for sorting (higher priority = shown first)
const PRIORITY_BOOKS = ['pinnacle', 'fanduel', 'draftkings', 'caesars', 'betmgm', 'bet365'];

const REFERENCE_BOOKS = sportsbooks
  .filter(book => book.isActive !== false)
  .sort((a, b) => {
    // Sort by priority first (priority books come first)
    const aIdx = PRIORITY_BOOKS.indexOf(a.id);
    const bIdx = PRIORITY_BOOKS.indexOf(b.id);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    // Then alphabetically by name
    return a.name.localeCompare(b.name);
  });

// Pie chart colors
const PIE_COLORS = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
];

// Helper to get sport key for markets lookup
function getSportMarketKey(sport: string): string {
  const mapping: Record<string, string> = {
    'nba': 'basketball_nba',
    'wnba': 'basketball_wnba',
    'ncaab': 'basketball_ncaab',
    'nfl': 'football_nfl',
    'ncaaf': 'football_ncaaf',
    'mlb': 'baseball_mlb',
    'nhl': 'icehockey_nhl',
  };
  return mapping[sport] || sport;
}

// Infer market group from apiKey for dynamically discovered markets
function inferMarketGroup(apiKey: string): string {
  const key = apiKey.toLowerCase();
  
  // Football
  if (key.includes('passing') || key.includes('pass_')) return 'Passing';
  if (key.includes('rushing') || key.includes('rush_')) return 'Rushing';
  if (key.includes('receiving') || key.includes('reception')) return 'Receiving';
  if (key.includes('touchdown') || key.includes('_td')) return 'Scoring';
  if (key.includes('field_goal') || key.includes('kicking')) return 'Kicking';
  if (key.includes('sack') || key.includes('tackle') || key.includes('interception') || key.includes('defense')) return 'Defense';
  
  // Basketball
  if (key.includes('point') && !key.includes('power_play')) return 'Scoring';
  if (key.includes('rebound')) return 'Scoring';
  if (key.includes('assist') && !key.includes('hockey')) return 'Scoring';
  if (key.includes('three') || key.includes('3pt')) return 'Scoring';
  if (key.includes('block') || key.includes('steal') || key.includes('turnover')) return 'Defense';
  if (key.includes('double_double') || key.includes('triple_double') || key.includes('pra') || key.includes('combo')) return 'Combo';
  
  // Hockey
  if (key.includes('goal') && !key.includes('field_goal')) return 'Skater';
  if (key.includes('save') || key.includes('shutout')) return 'Goalie';
  if (key.includes('shot') && key.includes('hockey')) return 'Skater';
  if (key.includes('power_play') || key.includes('pp_')) return 'Skater';
  
  // Baseball
  if (key.includes('batter_') || key.includes('hit') || key.includes('home_run') || key.includes('rbi')) return 'Batter';
  if (key.includes('pitcher_') || key.includes('strikeout') || key.includes('earned_run')) return 'Pitcher';
  
  // Soccer
  if (key.includes('goalscorer')) return 'Player';
  
  // Game-level markets
  if (key.includes('spread') || key.includes('moneyline') || key.includes('total') || key.includes('h2h')) return 'Game';
  if (key.includes('1h_') || key.includes('2h_') || key.includes('half')) return 'Halves';
  if (key.includes('1q_') || key.includes('2q_') || key.includes('3q_') || key.includes('4q_') || key.includes('quarter')) return 'Quarters';
  if (key.includes('p1_') || key.includes('p2_') || key.includes('p3_') || key.includes('period')) return '1st Period';
  
  return 'Other';
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
    const group = market.group || 'Other';
    
    // Check if it's a player prop by looking at apiKey
    const isPlayerProp = market.apiKey.includes('player_') || 
                         market.apiKey.includes('batter_') || 
                         market.apiKey.includes('pitcher_') ||
                         market.apiKey.includes('passing_') ||
                         market.apiKey.includes('rushing_') ||
                         market.apiKey.includes('receiving_') ||
                         market.apiKey.includes('receptions') ||
                         market.apiKey.includes('first_td') ||
                         market.apiKey.includes('last_td');
    
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

// Smooth Pie Chart component using stroke-dasharray animation
function PieChart({ 
  data, 
  size = 180 
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
  
  // Calculate cumulative offsets for each segment
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
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background circle */}
        <circle
          cx={radius}
          cy={radius}
          r={circleRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-neutral-200 dark:text-neutral-700"
        />
        {/* Animated segments */}
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
            style={{
              transitionProperty: 'stroke-dasharray, stroke-dashoffset',
            }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-neutral-900 dark:text-white transition-all duration-300">
          {data.length}
        </span>
        <span className="text-xs text-neutral-500">{data.length === 1 ? 'Book' : 'Books'}</span>
      </div>
    </div>
  );
}

export function FilterPresetFormModal({
  open,
  onOpenChange,
  preset,
  onSuccess,
}: FilterPresetFormModalProps) {
  const { createPreset, updatePreset, isCreating, isUpdating } = useFilterPresets();
  const isEditing = !!preset;

  // Form state
  const [name, setName] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>(["nba"]);
  const [expandedSports, setExpandedSports] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Track selected markets per sport - empty means "all selected"
  // Keys are like "nba:gameLines" or "nba:playerProps" or "nba:Scoring" (for groups)
  const [selectedMarkets, setSelectedMarkets] = useState<Record<string, Set<string>>>({});
  
  const [referenceBooks, setReferenceBooks] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [minBooksRequired, setMinBooksRequired] = useState(2);
  const [minOdds, setMinOdds] = useState(-500);
  const [maxOdds, setMaxOdds] = useState(500);
  const [error, setError] = useState<string | null>(null);

  // Fetch dynamic markets from API to merge with static definitions
  // This ensures users see all available markets, not just the hardcoded ones
  const { data: dynamicMarketsData } = useAvailableMarkets(selectedSports);

  // Helper to get all market IDs for a sport
  // Merges static SPORT_MARKETS with dynamically discovered markets
  const getMarketData = useCallback((sportId: string) => {
    const marketKey = getSportMarketKey(sportId);
    const staticMarkets = SPORT_MARKETS[marketKey] || [];
    
    // Get dynamic markets for this sport
    const dynamicMarkets: SportMarket[] = [];
    if (dynamicMarketsData?.aggregatedMarkets) {
      for (const market of dynamicMarketsData.aggregatedMarkets) {
        // Only include markets that are available for this sport
        if (market.sports.includes(sportId)) {
          // Check if this market is already in static markets
          const alreadyExists = staticMarkets.some(m => m.apiKey === market.key);
          if (!alreadyExists) {
            // Add dynamic market with inferred properties
            dynamicMarkets.push({
              value: market.key,
              label: market.display || getMarketDisplay(market.key),
              apiKey: market.key,
              group: inferMarketGroup(market.key),
              period: 'full',
            });
          }
        }
      }
    }
    
    // Merge static and dynamic markets
    const allMarkets = [...staticMarkets, ...dynamicMarkets];
    return categorizeMarkets(allMarkets);
  }, [dynamicMarketsData?.aggregatedMarkets]);

  // Build markets payload (only include when there is a custom selection)
  const buildSelectedMarketsPayload = useCallback((): string[] | null => {
    console.log('[FilterPreset] Building markets payload...');
    console.log('[FilterPreset] selectedSports:', selectedSports);
    console.log('[FilterPreset] selectedMarkets state:', Object.fromEntries(
      Object.entries(selectedMarkets).map(([k, v]) => [k, Array.from(v)])
    ));
    
    let hasCustom = false;
    const markets: string[] = [];

    selectedSports.forEach((sportId) => {
      const data = getMarketData(sportId);
      const glKey = `${sportId}:gameLines`;
      const ppKey = `${sportId}:playerProps`;

      const glSet = selectedMarkets[glKey];
      const ppSet = selectedMarkets[ppKey];

      console.log(`[FilterPreset] Sport ${sportId}:`, {
        glKey,
        ppKey,
        hasGlSet: !!glSet,
        hasPpSet: !!ppSet,
        glSetSize: glSet?.size,
        ppSetSize: ppSet?.size,
        totalGameLines: data.gameLineIds.length,
        totalPlayerProps: data.playerPropIds.length,
      });

      // If a set exists, it means the user customized this category
      if (glSet) {
        hasCustom = true;
        markets.push(...Array.from(glSet));
        console.log(`[FilterPreset] Adding ${glSet.size} game lines for ${sportId}`);
      }
      if (ppSet) {
        hasCustom = true;
        markets.push(...Array.from(ppSet));
        console.log(`[FilterPreset] Adding ${ppSet.size} player props for ${sportId}`);
      }
    });

    console.log('[FilterPreset] Final payload:', { hasCustom, marketCount: markets.length, markets: markets.slice(0, 10) });
    return hasCustom ? markets : null;
  }, [selectedMarkets, selectedSports, getMarketData]);

  // Build selectedMarkets state from an existing preset (for edit mode)
  const buildSelectedMarketsFromPreset = useCallback((presetToLoad: FilterPreset, sportsToUse: string[]) => {
    console.log('[FilterPreset] === Loading preset markets ===');
    console.log('[FilterPreset] Preset name:', presetToLoad.name);
    console.log('[FilterPreset] Preset markets from DB:', presetToLoad.markets);
    console.log('[FilterPreset] Sports to use:', sportsToUse);
    
    const next: Record<string, Set<string>> = {};
    const presetMarkets = presetToLoad.markets;
    if (!presetMarkets || presetMarkets.length === 0) {
      console.log('[FilterPreset] No custom markets in preset - using all markets');
      return next; // all markets
    }

    // Preset has custom markets - we need to reconstruct the selection state
    sportsToUse.forEach((sportId) => {
      const data = getMarketData(sportId);

      const glKey = `${sportId}:gameLines`;
      const ppKey = `${sportId}:playerProps`;
      const glSet = new Set<string>();
      const ppSet = new Set<string>();

      presetMarkets.forEach((m) => {
        if (data.gameLineIds.includes(m)) glSet.add(m);
        if (data.playerPropIds.includes(m)) ppSet.add(m);
      });

      console.log(`[FilterPreset] Sport ${sportId}:`, {
        glMatched: glSet.size,
        glTotal: data.gameLineIds.length,
        ppMatched: ppSet.size,
        ppTotal: data.playerPropIds.length,
      });

      // IMPORTANT: If preset has custom markets, we MUST create entries for each category
      // An empty Set means "none selected", no entry means "all selected"
      // Since the preset has markets, any category not in the preset should be empty (deselected)
      
      // For game lines: if none matched or only some matched, store the set
      if (glSet.size < data.gameLineIds.length) {
        next[glKey] = glSet; // Could be empty (all deselected) or partial
        console.log(`[FilterPreset] Storing gameLines for ${sportId}: ${glSet.size} selected (${glSet.size === 0 ? 'ALL DESELECTED' : 'partial'})`);
      }
      // For player props: if none matched or only some matched, store the set
      if (ppSet.size < data.playerPropIds.length) {
        next[ppKey] = ppSet; // Could be empty (all deselected) or partial
        console.log(`[FilterPreset] Storing playerProps for ${sportId}: ${ppSet.size} selected (${ppSet.size === 0 ? 'ALL DESELECTED' : 'partial'})`);
      }
    });

    console.log('[FilterPreset] Final loaded state:', Object.keys(next));
    return next;
  }, [getMarketData]);

  // Check if a category is fully selected
  const isCategorySelected = useCallback((sportId: string, category: 'gameLines' | 'playerProps') => {
    const key = `${sportId}:${category}`;
    const data = getMarketData(sportId);
    const allIds = category === 'gameLines' ? data.gameLineIds : data.playerPropIds;
    
    // If no selection set, it's fully selected
    if (!selectedMarkets[key]) return true;
    
    return allIds.every(id => selectedMarkets[key].has(id));
  }, [selectedMarkets, getMarketData]);

  // Check if a category is partially selected
  const isCategoryPartial = useCallback((sportId: string, category: 'gameLines' | 'playerProps') => {
    const key = `${sportId}:${category}`;
    const data = getMarketData(sportId);
    const allIds = category === 'gameLines' ? data.gameLineIds : data.playerPropIds;
    
    if (!selectedMarkets[key]) return false;
    
    const selectedCount = allIds.filter(id => selectedMarkets[key].has(id)).length;
    return selectedCount > 0 && selectedCount < allIds.length;
  }, [selectedMarkets, getMarketData]);

  // Check if a specific market is selected
  const isMarketSelected = useCallback((sportId: string, category: 'gameLines' | 'playerProps', marketId: string) => {
    const key = `${sportId}:${category}`;
    if (!selectedMarkets[key]) return true; // Default to all selected
    return selectedMarkets[key].has(marketId);
  }, [selectedMarkets]);

  // Toggle entire category
  const toggleCategory = useCallback((sportId: string, category: 'gameLines' | 'playerProps') => {
    const key = `${sportId}:${category}`;
    const data = getMarketData(sportId);
    const allIds = category === 'gameLines' ? data.gameLineIds : data.playerPropIds;
    const wasSelected = isCategorySelected(sportId, category);
    
    console.log(`[FilterPreset] toggleCategory called:`, {
      sportId,
      category,
      key,
      wasSelected,
      willBe: wasSelected ? 'DESELECTED' : 'SELECTED',
      totalIds: allIds.length,
    });
    
    setSelectedMarkets(prev => {
      const next = { ...prev };
      
      if (wasSelected) {
        // Deselect all
        next[key] = new Set();
        console.log(`[FilterPreset] Category ${key} now EMPTY (deselected all)`);
      } else {
        // Select all
        next[key] = new Set(allIds);
        console.log(`[FilterPreset] Category ${key} now has ALL ${allIds.length} markets`);
      }
      
      return next;
    });
  }, [getMarketData, isCategorySelected]);

  // Toggle individual market
  const toggleMarket = useCallback((sportId: string, category: 'gameLines' | 'playerProps', marketId: string) => {
    const key = `${sportId}:${category}`;
    const data = getMarketData(sportId);
    const allIds = category === 'gameLines' ? data.gameLineIds : data.playerPropIds;
    
    console.log(`[FilterPreset] toggleMarket called:`, {
      sportId,
      category,
      marketId,
      key,
    });
    
    setSelectedMarkets(prev => {
      const next = { ...prev };
      
      // Initialize if needed
      if (!next[key]) {
        console.log(`[FilterPreset] Initializing ${key} with all ${allIds.length} markets`);
        next[key] = new Set(allIds);
      }
      
      const current = new Set(next[key]);
      const wasSelected = current.has(marketId);
      if (wasSelected) {
        current.delete(marketId);
        console.log(`[FilterPreset] Removed ${marketId} from ${key}, now has ${current.size} markets`);
      } else {
        current.add(marketId);
        console.log(`[FilterPreset] Added ${marketId} to ${key}, now has ${current.size} markets`);
      }
      next[key] = current;
      
      return next;
    });
  }, [getMarketData]);

  // Toggle category expand
  const toggleCategoryExpand = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Reset form when modal opens/closes or preset changes
  useEffect(() => {
    if (!open) return;
    
    if (preset) {
      console.log('[FilterPreset] Modal opened for editing, hydrating form...');
      const sports = parseSports(preset.sport);
      setName(preset.name);
      setSelectedSports(sports);
      setReferenceBooks(preset.sharp_books || []);
      setWeights(preset.book_weights || getEqualWeights(preset.sharp_books || []));
      setMinBooksRequired(preset.min_books_reference || 2);
      setMinOdds(preset.min_odds ?? -500);
      setMaxOdds(preset.max_odds ?? 500);
      setExpandedSports(new Set());
      setExpandedCategories(new Set());
      
      // Load markets inline to avoid dependency issues
      const presetMarkets = preset.markets;
      if (!presetMarkets || presetMarkets.length === 0) {
        setSelectedMarkets({});
      } else {
        const next: Record<string, Set<string>> = {};
        const sportsToUse = sports.length ? sports : ["nba"];
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

          if (glSet.size < categorized.gameLineIds.length) {
            next[glKey] = glSet;
          }
          if (ppSet.size < categorized.playerPropIds.length) {
            next[ppKey] = ppSet;
          }
        });
        setSelectedMarkets(next);
      }
    } else {
      setName("");
      setSelectedSports(["nba"]);
      setExpandedSports(new Set());
      setExpandedCategories(new Set());
      setSelectedMarkets({});
      setReferenceBooks(["pinnacle", "fanduel", "draftkings"]);
      setWeights(getEqualWeights(["pinnacle", "fanduel", "draftkings"]));
      setMinBooksRequired(2);
      setMinOdds(-500);
      setMaxOdds(500);
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset?.id]);

  // Keep minBooksRequired valid when referenceBooks changes.
  // If user removes books and minBooksRequired is now impossible, clamp it down.
  useEffect(() => {
    if (!open) return;
    const maxAllowed = referenceBooks.length;
    if (maxAllowed === 0) return;
    if (minBooksRequired > maxAllowed) {
      setMinBooksRequired(maxAllowed);
    }
  }, [open, referenceBooks.length, minBooksRequired]);

  // Toggle a sport
  const toggleSport = (sportId: string) => {
    console.log(`[FilterPreset] toggleSport called:`, { sportId });
    setSelectedSports(prev => {
      const wasSelected = prev.includes(sportId);
      let next: string[];
      if (wasSelected) {
        if (prev.length === 1) {
          console.log(`[FilterPreset] Cannot deselect ${sportId} - it's the only sport selected`);
          return prev;
        }
        next = prev.filter(s => s !== sportId);
        console.log(`[FilterPreset] Deselected ${sportId}, now selected:`, next);
      } else {
        next = [...prev, sportId];
        console.log(`[FilterPreset] Selected ${sportId}, now selected:`, next);
      }
      return next;
    });
  };

  // Toggle expand/collapse for a sport
  const toggleExpand = (sportId: string) => {
    setExpandedSports(prev => {
      const next = new Set(prev);
      if (next.has(sportId)) {
        next.delete(sportId);
      } else {
        next.add(sportId);
      }
      return next;
    });
  };

  // Toggle a reference book
  const toggleReferenceBook = (bookId: string) => {
    // OLD (stable) behavior: update books and weights together.
    setReferenceBooks(prev => {
      const newBooks = prev.includes(bookId) 
        ? prev.filter(b => b !== bookId)
        : [...prev, bookId];
      
      if (newBooks.length === 0) {
        setWeights({});
      } else {
        setWeights(getEqualWeights(newBooks));
      }
      
      return newBooks;
    });
  };

  // Handle weight change - only adjust the LAST book to maintain 100%
  // This allows setting specific weights from top to bottom without them changing
  const handleWeightChange = useCallback((bookId: string, newValue: number) => {
    setWeights(prev => {
      const newWeights: Record<string, number> = { ...prev, [bookId]: newValue };
      
      // Find the last book in the reference list (the one that will absorb changes)
      const lastBook = referenceBooks[referenceBooks.length - 1];
      
      // If we're changing the last book, don't auto-adjust
      if (bookId === lastBook) {
        return newWeights;
      }
      
      // Calculate total of all other books (excluding the last one)
      const otherBooksTotal = referenceBooks
        .filter(b => b !== lastBook)
        .reduce((sum, b) => sum + (newWeights[b] ?? prev[b] ?? 0), 0);
      
      // Adjust the last book to make total = 100
      const lastBookWeight = Math.max(0, 100 - otherBooksTotal);
      newWeights[lastBook] = lastBookWeight;
      
      return newWeights;
    });
  }, [referenceBooks]);

  // Calculate total weight
  const totalWeight = useMemo(() => 
    referenceBooks.reduce((sum, book) => sum + (weights[book] || 0), 0),
    [referenceBooks, weights]
  );

  // Prepare pie chart data
  const pieData = useMemo(() => 
    referenceBooks.map((bookId, idx) => {
      const book = sportsbooks.find(b => b.id === bookId);
      return {
        id: bookId,
        name: book?.name || bookId,
        value: weights[bookId] || 0,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      };
    }),
    [referenceBooks, weights]
  );

  // Determine market_type based on selections
  const getMarketType = (): "all" | "player" | "game" => {
    let hasGameLines = false;
    let hasPlayerProps = false;
    
    selectedSports.forEach(sportId => {
      if (isCategorySelected(sportId, 'gameLines') || isCategoryPartial(sportId, 'gameLines')) {
        hasGameLines = true;
      }
      if (isCategorySelected(sportId, 'playerProps') || isCategoryPartial(sportId, 'playerProps')) {
        hasPlayerProps = true;
      }
    });
    
    if (hasGameLines && hasPlayerProps) return "all";
    if (hasPlayerProps) return "player";
    if (hasGameLines) return "game";
    return "all";
  };

  // Get selected market count for a sport
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
      setError("Please enter a name for this filter");
      return;
    }
    if (selectedSports.length === 0) {
      setError("Please select at least one sport");
      return;
    }
    if (referenceBooks.length === 0) {
      setError("Please select at least one reference book");
      return;
    }
    if (referenceBooks.length < minBooksRequired) {
      setError(`You need at least ${minBooksRequired} reference books selected`);
      return;
    }
    if (Math.abs(totalWeight - 100) > 0.5) {
      setError("Weights must add up to 100%");
      return;
    }

    try {
      const marketsPayload = buildSelectedMarketsPayload();
      const data: FilterPresetCreate = {
        name: name.trim(),
        sport: formatSportsForStorage(selectedSports),
        markets: marketsPayload,
        market_type: getMarketType(),
        sharp_books: referenceBooks,
        book_weights: weights,
        fallback_mode: "hide",
        fallback_weights: null,
        min_books_reference: minBooksRequired,
        min_odds: minOdds,
        max_odds: maxOdds,
      };

      console.log('[FilterPreset] === SUBMITTING FILTER ===');
      console.log('[FilterPreset] Full data being saved:', JSON.stringify(data, null, 2));
      console.log('[FilterPreset] Markets payload:', marketsPayload);
      console.log('[FilterPreset] Market count:', marketsPayload?.length ?? 'null (all markets)');
      console.log('[FilterPreset] Sports:', data.sport);
      console.log('[FilterPreset] Market type:', data.market_type);

      if (isEditing && preset) {
        console.log('[FilterPreset] Updating preset ID:', preset.id);
        await updatePreset(preset.id, data);
      } else {
        console.log('[FilterPreset] Creating new preset');
        await createPreset(data);
      }

      console.log('[FilterPreset] Save successful!');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('[FilterPreset] Save failed:', err);
      setError(err instanceof Error ? err.message : "Failed to save filter");
    }
  };

  const isLoading = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-[100dvh] sm:h-auto sm:max-w-6xl sm:max-h-[90vh] overflow-hidden border-0 sm:border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-b from-white to-neutral-50/80 dark:from-neutral-900 dark:to-neutral-950/80 p-0 sm:rounded-2xl rounded-none fixed inset-0 sm:inset-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] translate-x-0 translate-y-0 max-w-none sm:max-w-6xl ring-1 ring-black/[0.03] dark:ring-white/[0.03] shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh]">
          {/* Premium gradient accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hidden sm:block" />
          
          {/* Header */}
          <DialogHeader className="border-b border-neutral-200/80 dark:border-neutral-800/80 px-4 sm:px-6 py-4 sm:py-5 shrink-0 bg-gradient-to-r from-white via-emerald-50/20 to-teal-50/20 dark:from-neutral-900 dark:via-emerald-950/10 dark:to-teal-950/10">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
                  {isEditing ? "Edit Model" : "Create Model"}
                </DialogTitle>
                <DialogDescription className="text-sm text-neutral-500 dark:text-neutral-400">
                  Configure your custom edge detection filter
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Content - Two Column Layout */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-4 sm:p-6">
              {/* Filter Name - Full Width */}
              <div className="mb-6">
                <Label htmlFor="name" className="text-sm font-semibold text-neutral-900 dark:text-white mb-2 block">
                  Model Name
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Sharp Consensus NBA"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="h-12 bg-white dark:bg-neutral-800 border-neutral-200/80 dark:border-neutral-700/80 rounded-xl text-base font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-stretch">
                
                {/* LEFT COLUMN - Reference Books & Weights */}
                <div className="space-y-5">
                  {/* Pie Chart & Weights Section */}
                  <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-br from-white to-neutral-50/80 dark:from-neutral-800/60 dark:to-neutral-900/50 p-4 sm:p-5 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.02]">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 flex items-center justify-center">
                          <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                            Adjust Weights
                          </h3>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                            Weight each book&apos;s contribution
                          </p>
                        </div>
                      </div>
                      {referenceBooks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setWeights(getEqualWeights(referenceBooks));
                          }}
                          disabled={isLoading}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                        >
                          Equal
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                      {/* Pie Chart */}
                      <div className="shrink-0 flex justify-center sm:justify-start">
                        <PieChart data={pieData} size={100} />
                      </div>
                      
                      {/* Weight Inputs */}
                      <div className="flex-1 space-y-2 min-w-0">
                        {referenceBooks.map((bookId, idx) => {
                          const book = sportsbooks.find(b => b.id === bookId);
                          const weight = weights[bookId] || 0;
                          return (
                            <div key={bookId} className="flex items-center gap-2">
                              <div 
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                              />
                              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex-1 truncate min-w-0">
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
                                  className="w-14 h-8 text-center text-sm font-semibold bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-md focus:ring-1 focus:ring-emerald-500"
                                />
                                <span className="text-xs text-neutral-400">%</span>
                              </div>
                            </div>
                          );
                        })}
                        {referenceBooks.length === 0 && (
                          <p className="text-xs text-neutral-400 italic">Select books below</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reference Books Section */}
                  <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-br from-white to-neutral-50/80 dark:from-neutral-800/60 dark:to-neutral-900/50 p-4 sm:p-5 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.02]">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 flex items-center justify-center">
                        <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                          Reference Books
                        </h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          Select books to calculate fair odds
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-[250px] sm:max-h-[320px] overflow-y-auto pr-1">
                      {REFERENCE_BOOKS.map((book) => {
                        const isSelected = referenceBooks.includes(book.id);
                        const colorIndex = referenceBooks.indexOf(book.id);
                        
                        return (
                          <div
                            key={book.id}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            aria-disabled={isLoading}
                            onClick={() => !isLoading && toggleReferenceBook(book.id)}
                            onKeyDown={(e) => {
                              if (isLoading) return;
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleReferenceBook(book.id);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all select-none",
                              isSelected
                                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"
                                : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600",
                              isLoading && "opacity-60 cursor-not-allowed"
                            )}
                          >
                            {/* Visual checkbox (avoid Radix <button> to prevent dialog loops) */}
                            <div
                              aria-hidden
                              className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                                isSelected
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-transparent"
                              )}
                            >
                              <Check className="h-3 w-3" />
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
                              isSelected ? "text-neutral-900 dark:text-white" : "text-neutral-500 dark:text-neutral-400"
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
                  {/* Settings Row */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Min Books Required */}
                    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-br from-white to-neutral-50/80 dark:from-neutral-800/60 dark:to-neutral-900/50 p-4 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.02]">
                      <Label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Min Books Required
                      </Label>
                      <div className="flex gap-1.5 mt-3">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setMinBooksRequired(n)}
                            disabled={isLoading || n > referenceBooks.length}
                            className={cn(
                              "flex-1 h-8 rounded-lg text-xs font-semibold transition-all border",
                              minBooksRequired === n
                                ? "bg-gradient-to-r from-emerald-500 to-teal-500 border-transparent text-white shadow-sm"
                                : "bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-emerald-300 dark:hover:border-emerald-600",
                              n > referenceBooks.length && "opacity-30 cursor-not-allowed"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Odds Range */}
                    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-br from-white to-neutral-50/80 dark:from-neutral-800/60 dark:to-neutral-900/50 p-4 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.02]">
                      <Label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Odds Range
                      </Label>
                      <div className="flex gap-2 mt-3">
                        <Input
                          type="number"
                          value={minOdds}
                          onChange={(e) => setMinOdds(Number(e.target.value))}
                          disabled={isLoading}
                          placeholder="Min"
                          className="h-8 text-xs font-medium bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 rounded-lg"
                        />
                        <span className="self-center text-neutral-400">to</span>
                        <Input
                          type="number"
                          value={maxOdds}
                          onChange={(e) => setMaxOdds(Number(e.target.value))}
                          disabled={isLoading}
                          placeholder="Max"
                          className="h-8 text-xs font-medium bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sports & Markets */}
                  <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-gradient-to-br from-white to-neutral-50/80 dark:from-neutral-800/60 dark:to-neutral-900/50 p-5 lg:flex-1 lg:min-h-0 overflow-y-auto shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.02]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20 flex items-center justify-center">
                      <LayoutGrid className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                        Sports & Markets
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Click to select, expand to customize
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {PRESET_SPORTS.map((sport) => {
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
                              ? "bg-white dark:bg-neutral-900 ring-1 ring-emerald-500/50 shadow-sm"
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
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (isSelected) {
                                  toggleExpand(sport.value);
                                } else {
                                  toggleSport(sport.value);
                                }
                              }
                            }}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none transition-colors",
                              isSelected 
                                ? "hover:bg-neutral-50 dark:hover:bg-neutral-800/50" 
                                : "hover:bg-neutral-100/50 dark:hover:bg-neutral-800/30"
                            )}
                          >
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSport(sport.value)}
                                disabled={isLoading}
                                className={cn(
                                  "h-4 w-4 transition-colors",
                                  isSelected && "border-emerald-500 data-[state=checked]:bg-emerald-500"
                                )}
                              />
                            </div>
                            
                            <SportIcon 
                              sport={sport.value} 
                              className={cn(
                                "w-4 h-4 transition-colors",
                                isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400"
                              )} 
                            />
                            
                            <span className={cn(
                              "text-sm font-medium flex-1 transition-colors",
                              isSelected ? "text-neutral-900 dark:text-white" : "text-neutral-500 dark:text-neutral-400"
                            )}>
                              {sport.label}
                            </span>
                            
                            {isSelected && (
                              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                                {selectedCount}/{totalMarkets} markets
                              </span>
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
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCategoryExpand(`${sport.value}:gameLines`); }}}
                                      className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                                    >
                                      <div onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                          checked={isCategorySelected(sport.value, 'gameLines') ? true : isCategoryPartial(sport.value, 'gameLines') ? "indeterminate" : false}
                                          onCheckedChange={() => toggleCategory(sport.value, 'gameLines')}
                                          className="h-3.5 w-3.5"
                                        />
                                      </div>
                                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex-1">
                                        Game Lines
                                      </span>
                                      <span className="text-[11px] text-neutral-400 tabular-nums">
                                        {data.gameLineIds.filter(id => isMarketSelected(sport.value, 'gameLines', id)).length}/{data.gameLines.length}
                                      </span>
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
                                              checked={isMarketSelected(sport.value, 'gameLines', market.apiKey)}
                                              onCheckedChange={() => toggleMarket(sport.value, 'gameLines', market.apiKey)}
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
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCategoryExpand(`${sport.value}:playerProps`); }}}
                                      className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                                    >
                                      <div onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                          checked={isCategorySelected(sport.value, 'playerProps') ? true : isCategoryPartial(sport.value, 'playerProps') ? "indeterminate" : false}
                                          onCheckedChange={() => toggleCategory(sport.value, 'playerProps')}
                                          className="h-3.5 w-3.5"
                                        />
                                      </div>
                                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex-1">
                                        Player Props
                                      </span>
                                      <span className="text-[11px] text-neutral-400 tabular-nums">
                                        {data.playerPropIds.filter(id => isMarketSelected(sport.value, 'playerProps', id)).length}/{data.playerPropIds.length}
                                      </span>
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
                                                    checked={isMarketSelected(sport.value, 'playerProps', market.apiKey)}
                                                    onCheckedChange={() => toggleMarket(sport.value, 'playerProps', market.apiKey)}
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
          </div>

            {/* Error */}
            {error && (
              <div className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-3">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>
          

          {/* Premium Footer */}
          <div className="border-t border-neutral-200/80 dark:border-neutral-800/80 px-4 sm:px-6 py-4 bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-900/80 dark:to-neutral-950/50 backdrop-blur-sm shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    {selectedSports.length} sport{selectedSports.length !== 1 ? 's' : ''} • {referenceBooks.length} book{referenceBooks.length !== 1 ? 's' : ''}
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
                  className="flex-1 sm:flex-none h-12 sm:h-10 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-2"
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
