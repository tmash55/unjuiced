"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { GameInfo } from "@/components/odds-screen/odds-navigation";

interface OddsUtilityState {
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  // Filters
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
  openFilters: () => void;
  // Connection status
  connectionStatus: {
    connected: boolean;
    reconnecting: boolean;
    show: boolean;
  };
  setConnectionStatus: (status: { connected: boolean; reconnecting: boolean; show: boolean }) => void;
  // Games
  games: GameInfo[];
  setGames: (games: GameInfo[]) => void;
  onGameSelect: (gameId: string) => void;
  setGameSelectHandler: (handler: (gameId: string) => void) => void;
}

const OddsUtilityContext = createContext<OddsUtilityState | null>(null);

export function OddsUtilityProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    reconnecting: false,
    show: false,
  });
  const [games, setGames] = useState<GameInfo[]>([]);
  const [gameSelectHandler, setGameSelectHandler] = useState<(gameId: string) => void>(() => () => {});

  const openFilters = useCallback(() => setFiltersOpen(true), []);
  
  const onGameSelect = useCallback((gameId: string) => {
    gameSelectHandler(gameId);
  }, [gameSelectHandler]);

  return (
    <OddsUtilityContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        filtersOpen,
        setFiltersOpen,
        openFilters,
        connectionStatus,
        setConnectionStatus,
        games,
        setGames,
        onGameSelect,
        setGameSelectHandler,
      }}
    >
      {children}
    </OddsUtilityContext.Provider>
  );
}

export function useOddsUtility() {
  const context = useContext(OddsUtilityContext);
  if (!context) {
    throw new Error("useOddsUtility must be used within OddsUtilityProvider");
  }
  return context;
}

// Optional hook that returns null if not in provider (for layout)
export function useOddsUtilityOptional() {
  return useContext(OddsUtilityContext);
}
