"use client";

import React, { useState, useCallback, useRef, createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { AlternatesModal } from "../alternates-modal";

// Context to share modal state with the entity column
interface ExpandContextType {
  openModal: (e: React.MouseEvent) => void;
  isLoading: boolean;
}

const ExpandContext = createContext<ExpandContextType | null>(null);

export function useExpandContext() {
  return useContext(ExpandContext);
}

// Team logo button - just displays team logo, no expand functionality
export function ExpandButton({ 
  hide = false, 
  disabled = false,
  teamLogo,
  teamName 
}: { 
  hide?: boolean; 
  disabled?: boolean;
  teamLogo?: string;
  teamName?: string;
}) {
  // If no team logo or hidden/disabled, show placeholder
  if (hide || disabled || !teamLogo) {
    return <div className="w-6 h-6 shrink-0" />;
  }
  
  return (
    <div className="w-6 h-6 shrink-0 flex items-center justify-center">
      <img 
        src={teamLogo} 
        alt={teamName || 'Team'}
        className="w-5 h-5 object-contain"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    </div>
  );
}

// Alt badge that opens the modal
export function AltBadge({ disabled = false }: { disabled?: boolean }) {
  const context = useExpandContext();
  
  if (!context || disabled) return null;
  
  const { openModal, isLoading } = context;
  
  return (
    <button
      onClick={openModal}
      disabled={isLoading}
      className={cn(
        "text-[10px] font-semibold uppercase tracking-wide transition-all",
        "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300",
        "hover:underline cursor-pointer",
        isLoading && "opacity-50 cursor-wait"
      )}
    >
      {isLoading ? "Loading..." : "Alt"}
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
  // Player info for modal
  playerName?: string;
  team?: string;
  playerPosition?: string;
  // Event info for favorites
  homeTeam?: string;
  awayTeam?: string;
  startTime?: string;
  // Callback to open player profile
  onViewProfile?: () => void;
  // Data attribute for scroll-to functionality
  'data-event-id'?: string;
}

// Client-side cache with TTL (60 seconds)
const alternatesCache = new Map<string, { data: AlternatesResponse; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * ExpandableRowWrapper
 * 
 * Wraps a table row and adds modal functionality to fetch and display
 * alternate lines in a modal overlay.
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
  playerName,
  team,
  playerPosition,
  homeTeam,
  awayTeam,
  startTime,
  onViewProfile,
  'data-event-id': dataEventId,
}: ExpandableRowWrapperProps & { rowClassName?: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMarket, setCurrentMarket] = useState(market || '');
  const [alternates, setAlternates] = useState<AlternateLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedMarkets = useRef(new Set<string>());

  /**
   * Fetch alternates from API with caching
   */
  const fetchAlternates = useCallback(async (marketKey?: string) => {
    if (!includeAlternates) return;
    
    const targetMarket = marketKey || market || '';
    const cacheKey = `${sport}:${eventId}:${playerKey}:${targetMarket}`;
    const cached = alternatesCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setAlternates(cached.data.alternates);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      let url: string;
      
      if (eventId && targetMarket && playerKey) {
        const query = new URLSearchParams({ 
          sport, 
          eventId, 
          market: targetMarket, 
          player: playerKey,
          ...(primaryLine !== undefined && { primaryLine: String(primaryLine) })
        });
        url = `/api/v2/props/alternates?${query.toString()}`;
      } else {
        const query = new URLSearchParams({ sport, sid });
        url = `/api/props/alternates?${query.toString()}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      // Use all_lines to include the primary line, fallback to alternates for backwards compatibility
      const alternatesData = result.all_lines || result.alternates || [];
      
      alternatesCache.set(cacheKey, {
        data: { ...result, alternates: alternatesData },
        timestamp: Date.now(),
      });
      
      setAlternates(alternatesData);
      fetchedMarkets.current.add(targetMarket);
    } catch (err: any) {
      console.error("[Alternates] Fetch error:", err);
      setError(err.message || "Failed to load alternates");
    } finally {
      setLoading(false);
    }
  }, [sport, sid, includeAlternates, eventId, market, playerKey, primaryLine]);

  /**
   * Open modal and fetch alternates
   */
  const openModal = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!includeAlternates) return;
    
    setIsModalOpen(true);
    setCurrentMarket(market || '');
    
    if (!fetchedMarkets.current.has(market || '')) {
      await fetchAlternates(market);
    }
  }, [includeAlternates, fetchAlternates, market]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  /**
   * Handle market change from modal - fetch new alternates
   */
  const handleMarketChange = useCallback(async (newMarket: string) => {
    setCurrentMarket(newMarket);
    
    // Check if we already fetched this market
    if (!fetchedMarkets.current.has(newMarket)) {
      await fetchAlternates(newMarket);
    } else {
      // Load from cache
      const cacheKey = `${sport}:${eventId}:${playerKey}:${newMarket}`;
      const cached = alternatesCache.get(cacheKey);
      if (cached) {
        setAlternates(cached.data.alternates);
      }
    }
  }, [fetchAlternates, sport, eventId, playerKey]);

  // If alternates are disabled, just render the children without modal functionality
  if (!includeAlternates) {
    return (
      <tr data-event-id={dataEventId} className={cn("group relative transition-colors hover:[background:color-mix(in_oklab,var(--primary)_5%,var(--card))]", rowClassName)}>
        {children}
      </tr>
    );
  }

  return (
    <ExpandContext.Provider value={{ openModal, isLoading: loading }}>
      {/* Main Row */}
      <tr data-event-id={dataEventId} className="group relative transition-colors hover:[background:color-mix(in_oklab,var(--primary)_5%,var(--card))]">
        {children}
      </tr>

      {/* Alternates Modal */}
      <AlternatesModal
        isOpen={isModalOpen}
        onClose={closeModal}
        playerName={playerName || 'Player'}
        team={team}
        market={currentMarket || market || 'props'}
        sport={sport}
        alternates={alternates}
        loading={loading}
        error={error}
        primaryLine={primaryLine}
        playerId={playerKey}
        eventId={eventId}
        onMarketChange={handleMarketChange}
        onViewProfile={onViewProfile}
        // Additional props for favorites
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        startTime={startTime}
        playerPosition={playerPosition}
      />
    </ExpandContext.Provider>
  );
}
