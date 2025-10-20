"use client";

import React, { useState, useCallback, useRef, createContext, useContext } from "react";
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
  if (!context || hide || disabled) return <div className="w-6 h-6 shrink-0" />;
  
  const { isExpanded, handleToggle } = context;
  
  return (
    <button
      onClick={handleToggle}
      className={cn(
        "flex items-center justify-center w-6 h-6 rounded-md transition-all shrink-0",
        "hover:bg-neutral-100 dark:hover:bg-neutral-800",
        "text-neutral-500 dark:text-neutral-400",
        isExpanded && "bg-neutral-100 dark:bg-neutral-800"
      )}
      aria-label={isExpanded ? "Collapse alternates" : "Expand alternates"}
      aria-expanded={isExpanded}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isExpanded ? 90 : 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <ChevronRight className="w-4 h-4" />
      </motion.div>
    </button>
  );
}

interface AlternateLine {
  ln: number;
  books: Record<string, {
    over?: { price: number; u?: string };
    under?: { price: number; u?: string };
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
}: ExpandableRowWrapperProps & { rowClassName?: string }) {
  // Always call hooks at the top level (Rules of Hooks)
  const [isExpanded, setIsExpanded] = useState(false);
  const [alternates, setAlternates] = useState<AlternateLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  /**
   * Fetch alternates from API with caching
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
      const query = new URLSearchParams({ sport, sid });
      const response = await fetch(`/api/props/alternates?${query.toString()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result: AlternatesResponse = await response.json();
      
      // Update cache
      alternatesCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });
      
      setAlternates(result.alternates || []);
      console.log(`[Alternates] Fetched ${result.alternates.length} alternates for ${sid}`);
    } catch (err: any) {
      console.error("[Alternates] Fetch error:", err);
      setError(err.message || "Failed to load alternates");
    } finally {
      setLoading(false);
    }
  }, [sport, sid, includeAlternates]);

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









