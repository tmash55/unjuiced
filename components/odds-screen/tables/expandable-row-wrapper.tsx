"use client";

import React, { useState, useCallback, useRef, createContext, useContext, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { AlternateLinesRow } from "./alternate-lines-row";

// Context to share expand state with the entity column
interface ExpandContextType {
  isExpanded: boolean;
  handleToggle: (e: React.MouseEvent) => void;
}

const ExpandContext = createContext<ExpandContextType | null>(null);

export function useExpandContext() {
  return useContext(ExpandContext);
}

// Expand button component to be used in the entity column
export function ExpandButton({ hide = false, disabled = false }: { hide?: boolean; disabled?: boolean }) {
  const context = useExpandContext();
  
  // Hide if explicitly hidden, disabled (alternates not enabled), or no context
  if (!context || hide || disabled) return <div className="w-7 h-6 shrink-0" />;
  
  const { isExpanded, handleToggle } = context;
  
  return (
    <button
      onClick={handleToggle}
      className={cn(
        "flex items-center justify-center gap-0.5 px-1.5 h-6 rounded-md transition-all shrink-0",
        "border border-transparent",
        !isExpanded && "hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-950/50 dark:hover:border-blue-800",
        !isExpanded && "text-blue-600 dark:text-blue-400",
        isExpanded && "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-300"
      )}
      aria-label={isExpanded ? "Collapse alternates" : "Expand alternates"}
      aria-expanded={isExpanded}
      title="View alternate lines"
    >
      <motion.div
        initial={false}
        animate={{ rotate: isExpanded ? 90 : 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </motion.div>
      <span className="text-[10px] font-semibold uppercase tracking-wide">Alt</span>
    </button>
  );
}

interface AlternateLine {
  ln: number;
  books: Record<string, {
    over?: { price: number; u?: string; m?: string };
    under?: { price: number; u?: string; m?: string };
  }>;
  best?: {
    over?: { bk: string; price: number };
    under?: { bk: string; price: number };
  };
  avg?: {
    over?: number;
    under?: number };
}

interface AlternatesResponse {
  sid: string;
  sport: string;
  alternates: AlternateLine[];
  primary_ln: number;
  player?: string;
  position?: string;
  team?: string;
  market?: string;
  event?: any;
  timestamp: number;
}

interface ExpandableRowWrapperProps {
  sid: string; // The unique row ID
  sport: string;
  primaryLine?: number;
  children: React.ReactNode; // The actual table row
  columnOrder: string[]; // Main column order (entity, event, best-line, average-line)
  sportsbookOrder: string[]; // Sportsbook column order
  onOddsClick?: (line: number, side: 'over' | 'under', bookId: string) => void;
  includeAlternates?: boolean; // Whether to enable alternates expansion
  isPro?: boolean; // Whether user is Pro (for deep linking)
  setShowProGate?: (show: boolean) => void; // Show Pro gate modal
  // V2 API params
  eventId?: string; // Event ID for v2 alternates
  market?: string; // Market key for v2 alternates
  playerKey?: string; // Normalized player key for v2 alternates
}

// Client-side cache with TTL (60 seconds)
const alternatesCache = new Map<string, { data: AlternatesResponse; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * ExpandableRowWrapper
 * 
 * Wraps a table row and adds expand/collapse functionality to fetch and display
 * alternate lines from the /api/props/alternates endpoint.
 * 
 * Features:
 * - Expand/collapse icon with smooth animations
 * - Client-side caching (60s TTL) to reduce API calls
 * - Loading states
 * - Error handling
 * - Smooth expand/collapse animations
 */
export function ExpandableRowWrapper({
  sid,
  sport,
  primaryLine,
  children,
  columnOrder,
  sportsbookOrder,
  onOddsClick,
  includeAlternates = true,
  isPro = false,
  setShowProGate,
  rowClassName,
  eventId,
  market,
  playerKey,
}: ExpandableRowWrapperProps & { rowClassName?: string }) {
  // Always call hooks at the top level (Rules of Hooks)
  const [isExpanded, setIsExpanded] = useState(false);
  const [alternates, setAlternates] = useState<AlternateLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  /**
   * Fetch alternates from API with caching
   * Uses v2 API when eventId, market, and playerKey are available
   */
  const fetchAlternates = useCallback(async () => {
    // Don't fetch if alternates are disabled
    if (!includeAlternates) return;
    
    // Check cache first
    const cacheKey = `${sport}:${sid}`;
    const cached = alternatesCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Alternates] Cache hit for ${sid}`);
      setAlternates(cached.data.alternates);
      return;
    }

    // Fetch from API
    setLoading(true);
    setError(null);
    
    try {
      let url: string;
      
      // Use v2 API if we have the required params
      if (eventId && market && playerKey) {
        const query = new URLSearchParams({ 
          sport, 
          eventId, 
          market, 
          player: playerKey,
          ...(primaryLine !== undefined && { primaryLine: String(primaryLine) })
        });
        url = `/api/v2/props/alternates?${query.toString()}`;
        console.log(`[Alternates v2] Fetching: ${url}`);
      } else {
        // Fall back to v1 API
        const query = new URLSearchParams({ sport, sid });
        url = `/api/props/alternates?${query.toString()}`;
        console.log(`[Alternates v1] Fetching: ${url}`);
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // v2 API returns "alternates" array, same as v1
      const alternatesData = result.alternates || [];
      
      // Update cache
      alternatesCache.set(cacheKey, {
        data: { ...result, alternates: alternatesData },
        timestamp: Date.now(),
      });
      
      setAlternates(alternatesData);
      console.log(`[Alternates] Fetched ${alternatesData.length} alternates for ${sid}`);
    } catch (err: any) {
      console.error("[Alternates] Fetch error:", err);
      setError(err.message || "Failed to load alternates");
    } finally {
      setLoading(false);
    }
  }, [sport, sid, includeAlternates, eventId, market, playerKey, primaryLine]);

  /**
   * Toggle expand/collapse
   */
  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click events
    
    if (!includeAlternates) return; // Don't allow toggle if disabled
    
    if (!isExpanded && !hasFetched.current) {
      hasFetched.current = true;
      await fetchAlternates();
    }
    
    setIsExpanded(prev => !prev);
  }, [isExpanded, fetchAlternates, includeAlternates]);

  /**
   * Real-time refresh: Poll alternates every 30 seconds while expanded
   * This keeps alternate lines in sync with main row odds
   */
  useEffect(() => {
    if (!isExpanded || !includeAlternates) return;

    const REFRESH_INTERVAL = 10 * 1000; // 10 seconds

    const refreshAlternates = async () => {
      // Bypass cache for real-time updates
      const cacheKey = `${sport}:${sid}`;
      alternatesCache.delete(cacheKey);
      
      try {
        let url: string;
        
        if (eventId && market && playerKey) {
          const query = new URLSearchParams({ 
            sport, 
            eventId, 
            market, 
            player: playerKey,
            ...(primaryLine !== undefined && { primaryLine: String(primaryLine) })
          });
          url = `/api/v2/props/alternates?${query.toString()}`;
        } else {
          const query = new URLSearchParams({ sport, sid });
          url = `/api/props/alternates?${query.toString()}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) return;
        
        const result = await response.json();
        const alternatesData = result.alternates || [];
        
        // Update cache
        alternatesCache.set(cacheKey, {
          data: { ...result, alternates: alternatesData },
          timestamp: Date.now(),
        });
        
        setAlternates(alternatesData);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Alternates] 🔄 Refreshed ${alternatesData.length} alternates for ${sid}`);
        }
      } catch (err) {
        // Silently fail on refresh errors - don't disrupt the UI
        if (process.env.NODE_ENV === 'development') {
          console.warn("[Alternates] Refresh error:", err);
        }
      }
    };

    const intervalId = setInterval(refreshAlternates, REFRESH_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [isExpanded, includeAlternates, sport, sid, eventId, market, playerKey, primaryLine]);

  // If alternates are disabled, just render the children without expand functionality
  if (!includeAlternates) {
    return (
      <tr className={cn("group relative transition-colors hover:[background:color-mix(in_oklab,var(--primary)_5%,var(--card))]", rowClassName)}>
        {children}
      </tr>
    );
  }

  return (
    <ExpandContext.Provider value={{ isExpanded, handleToggle }}>
      {/* Main Row */}
      <tr className="group relative transition-colors hover:[background:color-mix(in_oklab,var(--primary)_5%,var(--card))]">
        {children}
      </tr>

      {/* Alternate Lines Rows (Expandable) */}
      <AnimatePresence>
        {isExpanded && (
          <AlternateLinesRow
            alternates={alternates}
            loading={loading}
            error={error}
            primaryLine={primaryLine}
            columnOrder={columnOrder}
            sportsbookOrder={sportsbookOrder}
            onOddsClick={onOddsClick}
            isPro={isPro}
            setShowProGate={setShowProGate}
          />
        )}
      </AnimatePresence>
    </ExpandContext.Provider>
  );
}









