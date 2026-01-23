"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

interface Game {
  id: string;
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
}

interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  show: boolean;
}

interface OddsUtilityContextType {
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Filters
  openFilters: () => void;
  closeFilters: () => void;
  isFiltersOpen: boolean;
  
  // Games
  games: Game[];
  setGames: (games: Game[]) => void;
  selectedGameId: string | null;
  onGameSelect: (gameId: string | null) => void;
  
  // Connection status
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

const OddsUtilityContext = createContext<OddsUtilityContextType | null>(null);

export function OddsUtilityProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQueryState] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [games, setGamesState] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatusState] = useState<ConnectionStatus>({
    connected: true,
    reconnecting: false,
    show: false,
  });
  
  // Wrap all setters in useCallback for stable references
  const setSearchQuery = useCallback((query: string) => setSearchQueryState(query), []);
  const setGames = useCallback((newGames: Game[]) => setGamesState(newGames), []);
  const setConnectionStatus = useCallback((status: ConnectionStatus) => setConnectionStatusState(status), []);
  const openFilters = useCallback(() => setIsFiltersOpen(true), []);
  const closeFilters = useCallback(() => setIsFiltersOpen(false), []);
  const onGameSelect = useCallback((gameId: string | null) => setSelectedGameId(gameId), []);
  
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    searchQuery,
    setSearchQuery,
    openFilters,
    closeFilters,
    isFiltersOpen,
    games,
    setGames,
    selectedGameId,
    onGameSelect,
    connectionStatus,
    setConnectionStatus,
  }), [
    searchQuery,
    setSearchQuery,
    openFilters,
    closeFilters,
    isFiltersOpen,
    games,
    setGames,
    selectedGameId,
    onGameSelect,
    connectionStatus,
    setConnectionStatus,
  ]);
  
  return (
    <OddsUtilityContext.Provider value={value}>
      {children}
    </OddsUtilityContext.Provider>
  );
}

export function useOddsUtility(): OddsUtilityContextType {
  const context = useContext(OddsUtilityContext);
  if (!context) {
    throw new Error("useOddsUtility must be used within OddsUtilityProvider");
  }
  return context;
}

export function useOddsUtilityOptional(): OddsUtilityContextType | null {
  return useContext(OddsUtilityContext);
}
