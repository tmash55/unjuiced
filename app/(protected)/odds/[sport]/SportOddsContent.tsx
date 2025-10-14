'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { OddsTable, type OddsTableItem } from '@/components/odds-screen/tables/odds-table'
import { OddsFilters } from '@/components/odds-screen/filters'
import { getMarketsForSport, type SportMarket } from '@/lib/data/markets'
import { useOddsPreferences } from '@/context/preferences-context'
import { LoadingSpinner } from '@/components/icons/loading-spinner'

/**
 * Sport-specific Odds Page
 * 
 * Displays odds for a specific sport with clean URLs like /odds/nfl, /odds/nba, etc.
 */
function SportOddsContent({ 
  params 
}: { 
  params: Promise<{ sport: string }> 
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { preferences } = useOddsPreferences()
  // Get sport from URL path, other parameters from query string with defaults
  const { sport: rawSport } = React.use(params)
  const sport = (rawSport ?? 'nfl').toLowerCase()
  const type = searchParams.get('type') || 'game'
  const market = searchParams.get('market') || getDefaultMarket(sport, type as 'game' | 'player')
  const scope = searchParams.get('scope') || 'pregame'

  const [data, setData] = useState<OddsTableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [marketState, setMarketState] = useState<string>(market)
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [periodFilter, setPeriodFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('')
  const [isSearching, setIsSearching] = useState<boolean>(false)

  // Debounce search query for performance (VC-level optimization)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setIsSearching(false)
    }, 150) // 150ms debounce - fast enough for real-time feel, slow enough to prevent excessive filtering

    // Show searching state immediately when typing
    if (searchQuery !== debouncedSearchQuery) {
      setIsSearching(true)
    }

    return () => clearTimeout(timer)
  }, [searchQuery, debouncedSearchQuery])

  // Optimized search handler with performance tracking
  const handleSearchChange = useCallback((value: string) => {
    const startTime = performance.now()
    setSearchQuery(value)
    
    // Performance monitoring for VC standards
    const processingTime = performance.now() - startTime
    if (processingTime > 16) { // 60fps threshold
      console.warn(`[SEARCH] Slow input processing: ${processingTime.toFixed(2)}ms`)
    }
  }, [])

  // Optimized clear handler
  const handleSearchClear = useCallback(() => {
    setSearchQuery('')
    setDebouncedSearchQuery('')
    setIsSearching(false)
  }, [])

  // Keyboard shortcuts for VC-level UX
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to clear search
      if (e.key === 'Escape' && searchQuery) {
        handleSearchClear()
        return
      }
      
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchQuery, handleSearchClear])

  // Memoized search results counter for performance (moved to top to fix hooks order)
  const searchResultsCount = useMemo(() => {
    if (!debouncedSearchQuery.trim() || !data.length) return data.length
    
    const query = debouncedSearchQuery.toLowerCase().trim()
    return data.filter(item => {
      if (type === 'player' && item.entity?.name) {
        return item.entity.name.toLowerCase().includes(query)
      }
      if (type === 'game') {
        const homeTeam = item.event?.homeTeam?.toLowerCase() || ''
        const awayTeam = item.event?.awayTeam?.toLowerCase() || ''
        return homeTeam.includes(query) || awayTeam.includes(query)
      }
      return false
    }).length
  }, [data, debouncedSearchQuery, type])

  // Resolve sport key for markets map
  function resolveSportKey(key: string): string {
    const map: Record<string, string> = {
      nfl: 'football_nfl',
      ncaaf: 'football_ncaaf',
      nba: 'basketball_nba',
      wnba: 'basketball_wnba',
      ncaab: 'basketball_ncaab',
      mlb: 'baseball_mlb',
      nhl: 'icehockey_nhl',
    }
    return map[key] || key
  }

  // Default market using centralized markets
  function getDefaultMarket(sportKey: string, t: 'game' | 'player'): string {
    const all = getMarketsForSport(resolveSportKey(sportKey))
    const gameKeys = new Set(['moneyline', 'spread', 'total', 'h2h', 'spreads', 'totals', 'home_total', 'away_total', 'total_touchdowns', 'total_fgs', 'safety', 'overtime', '1h_total', '2h_total', '1q_total', '2nd_half_total_points_reg_time', '1st_half_total_touchdowns', '2nd_half_total_touchdowns', '1st_quarter_total_touchdowns', '1st_half_home_team_total_points', '1st_half_away_team_total_points', '1st_half_home_team_total_touchdowns', '1st_half_away_team_total_touchdowns', '1h_total_fgs', '2h_total_fgs', 'total_fg_yards', 'longest_field_goal_made_yards', 'shortest_field_goal_made_yards', 'total_td_yards', 'longest_td_yards', 'shortest_td_yards', 'first_td_yards', 'home_safety', 'away_safety', '2pt_attempt', '2pt_conversion', 'total_punts', 'largest_lead', 'first_score_yards', '1st_quarter_both_teams_to_score'])
    if (t === 'game') {
      const game = all.find((m) => gameKeys.has(m.apiKey))
      return game?.apiKey || 'total'
    }
    // For player props, find first non-game market, preferring passing markets for NFL
    const playerMarkets = all.filter((m) => !gameKeys.has(m.apiKey))
    if (sportKey === 'nfl' || sportKey === 'ncaaf') {
      // Prefer passing yards or passing TDs for football
      const passingYards = playerMarkets.find((m) => m.apiKey === 'passing_yards')
      const passingTds = playerMarkets.find((m) => m.apiKey === 'passing_tds')
      return passingYards?.apiKey || passingTds?.apiKey || playerMarkets[0]?.apiKey || 'passing_tds'
    }
    return playerMarkets[0]?.apiKey || 'passing_tds'
  }

  // Centralized market options from constants with group/period filters
  function getAvailableMarkets(s: string, t: 'game' | 'player') {
    const all = getMarketsForSport(resolveSportKey(s))
    const gameKeys = new Set(['moneyline', 'spread', 'total', 'h2h', 'spreads', 'totals', 'home_total', 'away_total', 'total_touchdowns', 'total_fgs', 'safety', 'overtime', '1h_total', '2h_total', '1q_total', '2nd_half_total_points_reg_time', '1st_half_total_touchdowns', '2nd_half_total_touchdowns', '1st_quarter_total_touchdowns', '1st_half_home_team_total_points', '1st_half_away_team_total_points', '1st_half_home_team_total_touchdowns', '1st_half_away_team_total_touchdowns', '1h_total_fgs', '2h_total_fgs', 'total_fg_yards', 'longest_field_goal_made_yards', 'shortest_field_goal_made_yards', 'total_td_yards', 'longest_td_yards', 'shortest_td_yards', 'first_td_yards', 'home_safety', 'away_safety', '2pt_attempt', '2pt_conversion', 'total_punts', 'largest_lead', 'first_score_yards', '1st_quarter_both_teams_to_score'])
    let items: SportMarket[] = t === 'game'
      ? all.filter((m) => gameKeys.has(m.apiKey))
      : all.filter((m) => !gameKeys.has(m.apiKey))

    // Apply group/period filters to both game and player markets
    if (groupFilter !== 'all') items = items.filter((m) => m.group === groupFilter)
    if (periodFilter !== 'all') items = items.filter((m) => (m.period || 'full') === periodFilter)

    return items.map((m) => ({ key: m.apiKey, label: m.label, available: true }))
  }

  // Fetch data when parameters change
  const queryKey = ['odds-screen', sport, type, marketState, scope]
  const { data: queryData, isLoading, isError, error: queryError, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const url = `/api/odds-screen?sport=${encodeURIComponent(sport)}&type=${encodeURIComponent(type)}&market=${encodeURIComponent(marketState)}&scope=${encodeURIComponent(scope)}`
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      if (res.status === 304) return { success: true, data: data }
      const json = await res.json()
      return json
    },
    staleTime: scope === 'live' ? 8_000 : 75_000, // Slightly more aggressive for VC standards
    gcTime: 15 * 60_000, // Longer cache retention
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: scope === 'live' ? 8_000 : 60_000, // Live: 8s, Pregame: 60s
    refetchIntervalInBackground: scope === 'live', // Continue live updates in background
    retry: 3, // More resilient for VC standards
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    placeholderData: (previousData) => previousData, // Smooth transitions
    select: (result: any): { data: OddsTableItem[]; error?: string | null } => {
      if (!result?.success) return { data: [], error: (result?.error as string) || null }
      return { data: result.data as OddsTableItem[] }
    }
  })

  useEffect(() => {
    if (queryData?.data) setData(queryData.data)
  }, [queryData])

  useEffect(() => {
    setLoading(isLoading)
    setError(isError ? (queryError as any)?.message || 'Failed to fetch data' : null)
  }, [isLoading, isError, queryError])

  // Sync local market state if the URL market param changes externally
  useEffect(() => {
    if (market && market !== marketState) {
      setMarketState(market)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market])

  if (loading) {
    return (
      <div className="container mx-auto px-2 sm:px-4 py-4">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 px-2 sm:px-0">
            {sport.toUpperCase()} Odds
          </h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner className="h-6 w-6" />
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {`Loading ${sport.toUpperCase()} Odds`}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Fetching the latest odds and market data...
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-2 sm:px-4 py-4">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 px-2 sm:px-0">
            {sport.toUpperCase()} Odds
          </h1>
        </div>
        <div className="max-w-md mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              Unable to Load Odds
            </h2>
            <p className="text-red-600 dark:text-red-400 mb-4 text-sm">
              {error}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white rounded-md transition-colors duration-200 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleMarketChange = (newMarket: string) => {
    setMarketState(newMarket)
    const next = `/odds/${sport}?type=${type}&market=${newMarket}&scope=${scope}`
    router.replace(next)
  }

  const handleTypeChange = (newType: string) => {
    const defaultMarket = getDefaultMarket(sport, newType as 'game' | 'player')
    setMarketState(defaultMarket)
    // Reset filters when switching between game and player props
    setGroupFilter('all')
    setPeriodFilter('all')
    const next = `/odds/${sport}?type=${newType}&market=${defaultMarket}&scope=${scope}`
    router.replace(next)
  }

  const handleSportChange = (newSport: string) => {
    // Reset filters when changing sports
    setGroupFilter('all')
    setPeriodFilter('all')
    // Navigate to the new sport page
    router.push(`/odds/${newSport}?type=${type}&market=${getDefaultMarket(newSport, type as 'game' | 'player')}`)
  }

  const availableMarkets = getAvailableMarkets(sport, type as 'game' | 'player')
  const allPlayerMarkets = getMarketsForSport(resolveSportKey(sport)).filter((m) => !new Set(['moneyline', 'spread', 'total', 'h2h', 'spreads', 'totals', 'home_total', 'away_total', 'total_touchdowns', 'total_fgs', 'safety', 'overtime', '1h_total', '2h_total', '1q_total', '2nd_half_total_points_reg_time', '1st_half_total_touchdowns', '2nd_half_total_touchdowns', '1st_quarter_total_touchdowns', '1st_half_home_team_total_points', '1st_half_away_team_total_points', '1st_half_home_team_total_touchdowns', '1st_half_away_team_total_touchdowns', '1h_total_fgs', '2h_total_fgs', 'total_fg_yards', 'longest_field_goal_made_yards', 'shortest_field_goal_made_yards', 'total_td_yards', 'longest_td_yards', 'shortest_td_yards', 'first_td_yards', 'home_safety', 'away_safety', '2pt_attempt', '2pt_conversion', 'total_punts', 'largest_lead', 'first_score_yards', '1st_quarter_both_teams_to_score']).has(m.apiKey))
  const groups = Array.from(new Set(allPlayerMarkets.map((m) => m.group).filter(Boolean))) as string[]
  const periods = Array.from(new Set(allPlayerMarkets.map((m) => m.period || 'full')))
  
  // For game props, get groups/periods from game markets
  const allGameMarkets = getMarketsForSport(resolveSportKey(sport)).filter((m) => new Set(['moneyline', 'spread', 'total', 'h2h', 'spreads', 'totals', 'home_total', 'away_total', 'total_touchdowns', 'total_fgs', 'safety', 'overtime', '1h_total', '2h_total', '1q_total', '2nd_half_total_points_reg_time', '1st_half_total_touchdowns', '2nd_half_total_touchdowns', '1st_quarter_total_touchdowns', '1st_half_home_team_total_points', '1st_half_away_team_total_points', '1st_half_home_team_total_touchdowns', '1st_half_away_team_total_touchdowns', '1h_total_fgs', '2h_total_fgs', 'total_fg_yards', 'longest_field_goal_made_yards', 'shortest_field_goal_made_yards', 'total_td_yards', 'longest_td_yards', 'shortest_td_yards', 'first_td_yards', 'home_safety', 'away_safety', '2pt_attempt', '2pt_conversion', 'total_punts', 'largest_lead', 'first_score_yards', '1st_quarter_both_teams_to_score']).has(m.apiKey))
  const gameGroups = Array.from(new Set(allGameMarkets.map((m) => m.group).filter(Boolean))) as string[]
  const gamePeriods = Array.from(new Set(allGameMarkets.map((m) => m.period || 'full')))
  const availableSports = ['nfl', 'ncaaf', 'nba', 'mlb', 'nhl']

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 animate-in fade-in duration-300">
      {/* Header with sport and navigation */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 px-2 sm:px-0">
          {sport.toUpperCase()} Odds
        </h1>
        
        {/* Modern Filter Bar - Mobile Responsive */}
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* Mobile Layout (< md) - Stacked */}
          <div className="block md:hidden space-y-3">
            {/* Top Row: League + Type Toggle */}
            <div className="flex items-center justify-between gap-3">
              {/* League Selector */}
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:block">League</span>
                <select
                  value={sport}
                  onChange={(e) => handleSportChange(e.target.value)}
                  className="px-3 py-3 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-1 min-w-0 touch-manipulation"
                >
                  {availableSports.map((sportKey) => (
                    <option key={sportKey} value={sportKey}>
                      {sportKey.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Game/Player Toggle */}
              <div className="flex bg-gray-200 dark:bg-gray-600 rounded-md p-0.5 flex-shrink-0">
                <button
                  onClick={() => handleTypeChange('game')}
                  className={`px-3 py-2 text-xs font-medium rounded transition-all touch-manipulation ${
                    type === 'game' 
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 active:bg-gray-300 dark:active:bg-gray-500'
                  }`}
                >
                  Game
                </button>
                <button
                  onClick={() => handleTypeChange('player')}
                  className={`px-3 py-2 text-xs font-medium rounded transition-all touch-manipulation ${
                    type === 'player' 
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 active:bg-gray-300 dark:active:bg-gray-500'
                  }`}
                >
                  Player
                </button>
              </div>
            </div>

            {/* Bottom Row: Market + Status + Settings */}
            <div className="flex items-center justify-between gap-3">
              {/* Market Type Selector */}
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:block">Market</span>
                <select
                  value={marketState}
                  onChange={(e) => handleMarketChange(e.target.value)}
                  className="px-3 py-3 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-1 min-w-0 touch-manipulation"
                >
                  {availableMarkets.map((m) => (
                    <option key={m.key} value={m.key} disabled={!m.available}>
                      {m.label}{!m.available ? ' (N/A)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status & Settings */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Compact Refresh Indicator for Mobile */}
                {scope === 'live' && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                    <div className={`w-2 h-2 rounded-full ${isFetching ? 'bg-green-500 animate-pulse' : 'bg-green-400'}`} />
                    <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                      {isFetching ? 'Live' : 'Live'}
                    </span>
                  </div>
                )}
                  
                {scope === 'pregame' && isFetching && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                      Updating
                    </span>
                  </div>
                )}

                <OddsFilters />
              </div>
            </div>

            {/* Search Row */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:block">Search</span>
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={type === 'player' ? "Search players..." : "Search teams..."}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full px-3 py-3 pl-10 pr-10 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation transition-all duration-200"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {isSearching ? (
                    <LoadingSpinner className="h-4 w-4" />
                  ) : (
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>
                {searchQuery && (
                  <button
                    onClick={handleSearchClear}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center group"
                    aria-label="Clear search"
                  >
                    <svg className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Layout (>= md) - Horizontal */}
          <div className="hidden md:flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              {/* League Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">League</span>
                <select
                  value={sport}
                  onChange={(e) => handleSportChange(e.target.value)}
                  className="px-3 py-2.5 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[80px] touch-manipulation"
                >
                  {availableSports.map((sportKey) => (
                    <option key={sportKey} value={sportKey}>
                      {sportKey.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Game/Player Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type</span>
                <div className="flex bg-gray-200 dark:bg-gray-600 rounded-md p-0.5">
                  <button
                    onClick={() => handleTypeChange('game')}
                    className={`px-3 py-2 text-xs font-medium rounded transition-all touch-manipulation ${
                      type === 'game' 
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 active:bg-gray-300 dark:active:bg-gray-500'
                    }`}
                  >
                    Game
                  </button>
                  <button
                    onClick={() => handleTypeChange('player')}
                    className={`px-3 py-2 text-xs font-medium rounded transition-all touch-manipulation ${
                      type === 'player' 
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 active:bg-gray-300 dark:active:bg-gray-500'
                    }`}
                  >
                    Player
                  </button>
                </div>
              </div>

              {/* Market Type Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Market</span>
                <select
                  value={marketState}
                  onChange={(e) => handleMarketChange(e.target.value)}
                  className="px-3 py-2.5 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[120px] touch-manipulation"
                >
                  {availableMarkets.map((m) => (
                    <option key={m.key} value={m.key} disabled={!m.available}>
                      {m.label}{!m.available ? ' (N/A)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Input */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Search</span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={type === 'player' ? "Search players..." : "Search teams..."}
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="px-3 py-2.5 pl-10 pr-10 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[200px] touch-manipulation transition-all duration-200"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {isSearching ? (
                    <LoadingSpinner className="h-4 w-4" />
                  ) : (
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                  </div>
                  {searchQuery && (
                    <button
                      onClick={handleSearchClear}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center group"
                      aria-label="Clear search"
                    >
                      <svg className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Settings & Status */}
            <div className="flex items-center gap-3">
              {/* Live Refresh Indicator */}
              {scope === 'live' && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <div className={`w-2 h-2 rounded-full ${isFetching ? 'bg-green-500 animate-pulse' : 'bg-green-400'}`} />
                  <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                    {isFetching ? 'Updating...' : 'Live'}
                  </span>
                  <span className="text-xs text-green-600 dark:text-green-400">
                    8s refresh
                  </span>
                </div>
              )}
                
              {/* Pregame Refresh Indicator */}
              {scope === 'pregame' && isFetching && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    Refreshing odds...
                  </span>
                </div>
              )}

              <OddsFilters />
            </div>
          </div>
        </div>

        {/* Search Results Indicator */}
        {debouncedSearchQuery.trim() && (
          <div className="mt-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {searchResultsCount === 0 
                    ? `No ${type === 'player' ? 'players' : 'teams'} found for "${debouncedSearchQuery}"`
                    : `Found ${searchResultsCount} ${type === 'player' ? 'player' : 'game'}${searchResultsCount !== 1 ? 's' : ''} matching "${debouncedSearchQuery}"`
                  }
                </span>
              </div>
              <button
                onClick={handleSearchClear}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium transition-colors duration-150"
              >
                Clear search
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Odds Table */}
      <OddsTable 
        data={data}
        loading={loading || (isFetching && data.length === 0)}
        error={error}
        sport={sport}
        type={type as 'game' | 'player'}
        market={marketState}
        scope={scope as 'pregame' | 'live'}
        maxSportsbookColumns={14}
        columnHighlighting={preferences?.columnHighlighting ?? true}
        searchQuery={debouncedSearchQuery}
        onRowClick={(item) => {
          console.log('Row clicked:', item)
          // TODO: Implement row click behavior (e.g., expand details, navigate to detail page)
        }}
        onOddsClick={(item, side, book) => {
          console.log('Odds clicked:', { item: item.entity.name, side, book })
          // TODO: Implement odds click behavior (e.g., add to betslip, open sportsbook link)
        }}
      />
    </div>
  )
}

const queryClient = new QueryClient()

export default function SportOddsConent(props: { params: Promise<{ sport: string }> }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SportOddsContent {...props} />
    </QueryClientProvider>
  )
}