'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { OddsTable, type OddsTableItem } from '@/components/odds-screen/tables/odds-table'
import { OddsFilters } from '@/components/odds-screen/filters'
import { getMarketsForSport, type SportMarket } from '@/lib/data/markets'
import { useOddsPreferences } from '@/context/preferences-context'
import { OddsTableSkeleton } from '@/components/odds-screen/tables/odds-table-skeleton'
import { useSSE } from '@/hooks/use-sse'
import { useAuth } from '@/components/auth/auth-provider'
import { useEntitlements } from '@/hooks/use-entitlements'
import { ConnectionErrorDialog } from '@/components/common/connection-error-dialog'
import { cn } from '@/lib/utils'
import { useOddsUtility } from '../odds-utility-context'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('')
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [userPlan, setUserPlan] = useState<string | null>(null)
  const [liveUpdatesEnabled, setLiveUpdatesEnabled] = useState<boolean>(true) // Pro users default to live
  
  // Use shared utility context for search, filters, connection status, and games
  const { 
    searchQuery, 
    setSearchQuery,
    filtersOpen,
    setFiltersOpen,
    setConnectionStatus,
    setGames,
    setGameSelectHandler,
  } = useOddsUtility()
  
  const { user } = useAuth()
  const isPro = userPlan === 'pro' || userPlan === 'admin'
  const isFree = !isPro
  const isLiveScope = scope === 'live'
  
  // All users can use SSE now (can toggle off)
  const shouldUseLiveUpdates = liveUpdatesEnabled

  // Use shared entitlements cache (VC-grade efficiency)
  const { data: entitlements } = useEntitlements()
  useEffect(() => {
    setUserPlan(entitlements?.plan ?? null)
  }, [entitlements])

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
        const homeName = item.event?.homeName?.toLowerCase() || ''
        const awayName = item.event?.awayName?.toLowerCase() || ''
        return (
          homeTeam.includes(query) ||
          awayTeam.includes(query) ||
          homeName.includes(query) ||
          awayName.includes(query)
        )
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
    const gameKeys = new Set([
      // Generic game markets
      'moneyline', 'spread', 'total', 'h2h', 'spreads', 'totals',
      'home_total', 'away_total', 'total_touchdowns', 'total_fgs', 'safety', 'overtime',
      '1h_total', '2h_total', '1q_total', '2nd_half_total_points_reg_time',
      '1st_half_total_touchdowns', '2nd_half_total_touchdowns', '1st_quarter_total_touchdowns',
      '1st_half_home_team_total_points', '1st_half_away_team_total_points',
      '1st_half_home_team_total_touchdowns', '1st_half_away_team_total_touchdowns',
      '1h_total_fgs', '2h_total_fgs', 'total_fg_yards', 'longest_field_goal_made_yards',
      'shortest_field_goal_made_yards', 'total_td_yards', 'longest_td_yards', 'shortest_td_yards',
      'first_td_yards', 'home_safety', 'away_safety', '2pt_attempt', '2pt_conversion',
      'total_punts', 'largest_lead', 'first_score_yards', '1st_quarter_both_teams_to_score',
      // NBA/Basketball game markets
      'total_points_odd_even', '1h_moneyline', '1h_spread', '2h_total',
      '1q_moneyline', '1q_spread', '1q_total',
      '2q_moneyline', '2q_spread', '2q_total',
      '3q_moneyline', '3q_spread', '3q_total',
      '4q_moneyline', '4q_spread', '4q_total',
      // NHL game markets
      'puck_line', 'total_goals', 'moneyline_3way', 'total_goals_reg', 'total_goals_odd_even', 
      'puck_line_reg', 'draw_no_bet', 'both_teams_to_score', 'both_teams_to_score_2', 
      'first_team_to_score', 'first_team_to_score_3way', 'last_team_to_score_3way', 
      'away_total_goals', 'away_total_goals_reg', 'home_total_goals', 'home_total_goals_reg',
      // NHL period game markets
      'p1_moneyline', 'p1_moneyline_3way', 'p1_total_goals', 'p1_total_goals_odd_even', 'p1_puck_line',
      'p1_10m_total_goals', 'p1_5m_total_goals', 'p1_btts', 'p1_first_team_to_score_3way',
      'p1_home_total_goals', 'p1_away_total_goals',
      'p2_moneyline', 'p2_moneyline_3way', 'p2_puck_line', 'p2_total_goals', 'p2_total_goals_odd_even',
      'p2_btts', 'p2_10m_total_goals', 'p2_5m_total_goals',
      'p3_moneyline', 'p3_moneyline_3way', 'p3_puck_line', 'p3_total_goals', 'p3_total_goals_odd_even',
      // NHL race markets
      'race_to_2_goals_3way_reg', 'race_to_3_goals_3way_reg', 'race_to_4_goals_3way_reg', 'race_to_5_goals_3way_reg',
    ])
    if (t === 'game') {
      // Default to moneyline for all sports
      return 'moneyline'
    }
    // For player props, use sport-specific defaults
    const playerMarkets = all.filter((m) => !gameKeys.has(m.apiKey))
    if (sportKey === 'nfl' || sportKey === 'ncaaf') {
      // Prefer Anytime TD for football
      const anytimeTd = playerMarkets.find((m) => m.apiKey === 'player_touchdowns')
      return anytimeTd?.apiKey || playerMarkets[0]?.apiKey || 'player_touchdowns'
    }
    if (sportKey === 'nhl') {
      // Prefer player goals for hockey
      const playerGoals = playerMarkets.find((m) => m.apiKey === 'player_goals')
      return playerGoals?.apiKey || playerMarkets[0]?.apiKey || 'player_goals'
    }
    return playerMarkets[0]?.apiKey || 'player_points'
  }

  // Centralized market options from constants with group/period filters
  function getAvailableMarkets(s: string, t: 'game' | 'player') {
    const all = getMarketsForSport(resolveSportKey(s))
    const gameKeys = new Set([
      // Generic game markets
      'moneyline', 'spread', 'total', 'h2h', 'spreads', 'totals',
      'home_total', 'away_total', 'total_touchdowns', 'total_fgs', 'safety', 'overtime',
      '1h_total', '2h_total', '1q_total', '2nd_half_total_points_reg_time',
      '1st_half_total_touchdowns', '2nd_half_total_touchdowns', '1st_quarter_total_touchdowns',
      '1st_half_home_team_total_points', '1st_half_away_team_total_points',
      '1st_half_home_team_total_touchdowns', '1st_half_away_team_total_touchdowns',
      '1h_total_fgs', '2h_total_fgs', 'total_fg_yards', 'longest_field_goal_made_yards',
      'shortest_field_goal_made_yards', 'total_td_yards', 'longest_td_yards', 'shortest_td_yards',
      'first_td_yards', 'home_safety', 'away_safety', '2pt_attempt', '2pt_conversion',
      'total_punts', 'largest_lead', 'first_score_yards', '1st_quarter_both_teams_to_score',
      // NBA/Basketball game markets
      'total_points_odd_even', '1h_moneyline', '1h_spread', '2h_total',
      '1q_moneyline', '1q_spread', '1q_total',
      '2q_moneyline', '2q_spread', '2q_total',
      '3q_moneyline', '3q_spread', '3q_total',
      '4q_moneyline', '4q_spread', '4q_total',
      // NHL game markets
      'puck_line', 'total_goals', 'moneyline_3way', 'total_goals_reg', 'total_goals_odd_even', 
      'puck_line_reg', 'draw_no_bet', 'both_teams_to_score', 'both_teams_to_score_2', 
      'first_team_to_score', 'first_team_to_score_3way', 'last_team_to_score_3way', 
      'away_total_goals', 'away_total_goals_reg', 'home_total_goals', 'home_total_goals_reg',
      // NHL period game markets
      'p1_moneyline', 'p1_moneyline_3way', 'p1_total_goals', 'p1_total_goals_odd_even', 'p1_puck_line',
      'p1_10m_total_goals', 'p1_5m_total_goals', 'p1_btts', 'p1_first_team_to_score_3way',
      'p1_home_total_goals', 'p1_away_total_goals',
      'p2_moneyline', 'p2_moneyline_3way', 'p2_puck_line', 'p2_total_goals', 'p2_total_goals_odd_even',
      'p2_btts', 'p2_10m_total_goals', 'p2_5m_total_goals',
      'p3_moneyline', 'p3_moneyline_3way', 'p3_puck_line', 'p3_total_goals', 'p3_total_goals_odd_even',
      // NHL race markets
      'race_to_2_goals_3way_reg', 'race_to_3_goals_3way_reg', 'race_to_4_goals_3way_reg', 'race_to_5_goals_3way_reg',
    ])
    let items: SportMarket[] = t === 'game'
      ? all.filter((m) => gameKeys.has(m.apiKey))
      : all.filter((m) => !gameKeys.has(m.apiKey))

    // Apply group/period filters to both game and player markets
    if (groupFilter !== 'all') items = items.filter((m) => m.group === groupFilter)
    if (periodFilter !== 'all') items = items.filter((m) => (m.period || 'full') === periodFilter)

    return items.map((m) => ({ key: m.apiKey, label: m.label, available: true }))
  }

  // Fetch data when parameters change (using v2 props API with new key structure)
  const queryKey = ['odds-props-v2', sport, type, marketState, scope]
  const { data: queryData, isLoading, isError, error: queryError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      // Use v2 props API with new SSE key structure
      const url = `/api/v2/props/table?sport=${encodeURIComponent(sport)}&market=${encodeURIComponent(marketState)}&scope=${encodeURIComponent(scope)}&limit=300`
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[FETCH v2] Requesting: ${url}`)
        console.log(`[FETCH v2] Using new key structure: odds:${sport}:*:${marketState}:*`)
      }
      
      const startTime = performance.now()
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error(`[FETCH v2] Error response:`, errorText)
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      
      const propsResponse = await res.json()
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[FETCH v2] Received ${propsResponse.rows?.length || 0} rows in ${propsResponse.meta?.duration_ms || 0}ms`)
      }
      
      // Transform props format to OddsTableItem format
      const { transformPropsResponseToOddsScreen } = await import('@/lib/api-adapters/props-to-odds')
      const transformedData = transformPropsResponseToOddsScreen(propsResponse, type as 'player' | 'game')
      
      const duration = performance.now() - startTime
      if (duration > 1000) {
        console.warn(`[FETCH v2] Slow API response: ${duration.toFixed(0)}ms`)
      }
      
      return {
        data: transformedData,
        nextCursor: propsResponse.nextCursor,
        fetchTime: duration
      }
    },
    staleTime: scope === 'live' ? 8_000 : 75_000, // Live: 8s, Pregame: 75s
    gcTime: 15 * 60_000, // 15 minute cache retention
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // When SSE is active, disable polling entirely (SSE handles real-time updates)
    refetchInterval: shouldUseLiveUpdates ? false : (scope === 'live' ? 8_000 : 60_000),
    refetchIntervalInBackground: !shouldUseLiveUpdates && scope === 'live', // Only poll in background if SSE is off
    retry: 3, // Resilient retry strategy
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
    placeholderData: (previousData) => previousData, // Smooth transitions (no flash of empty state)
  })

  useEffect(() => {
    if (queryData?.data) {
      let filteredData = queryData.data
      
      // Filter out games that have already started from pregame view
      if (scope === 'pregame') {
        const now = new Date()
        filteredData = queryData.data.filter(item => {
          // Check if event has a start time
          if (item.event?.startTime) {
            const startTime = new Date(item.event.startTime)
            // Only include if game hasn't started yet (with 5 min buffer for data sync)
            return startTime.getTime() > now.getTime() - (5 * 60 * 1000)
          }
          // If no start time, include it (shouldn't happen but safe fallback)
          return true
        })
        
        if (process.env.NODE_ENV === 'development' && filteredData.length !== queryData.data.length) {
          console.log(`[PREGAME_FILTER] Filtered out ${queryData.data.length - filteredData.length} started games`)
        }
      }
      
      setData(filteredData)
      // Log fetch performance for VC monitoring
      if (queryData.fetchTime) {
        console.log(`[FETCH] Loaded ${filteredData.length} rows in ${queryData.fetchTime.toFixed(0)}ms`)
      }
    }
  }, [queryData, scope])

  // SSE Integration for Pro users (VC-grade efficiency)
  // V2 payload format: { type: "update", keys: ["odds:nba:event123:player_points:draftkings", ...], count: N, timestamp: "..." }
  const handleSSEUpdateV2 = useCallback(async (message: any) => {
    const perfStart = performance.now();
    
    try {
      // V2 format: { type, keys, count, events_updated, timestamp }
      const { type: msgType, keys = [], count = 0 } = message;
      
      // Only process update messages
      if (msgType !== 'update' || !Array.isArray(keys) || keys.length === 0) {
        return;
      }
      
      // Parse keys to check if any match our current market
      // Key format: odds:{sport}:{eventId}:{market}:{book}
      const relevantUpdates = keys.filter((key: string) => {
        const parts = key.split(':');
        if (parts.length < 5) return false;
        const [, keySport, , keyMarket] = parts;
        // Only process updates for our current sport and market
        return keySport === sport && keyMarket === marketState;
      });
      
      if (relevantUpdates.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[SSE v2] Skipping ${count} updates (no match for ${sport}/${marketState})`);
        }
        return;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[SSE v2] 📡 ${relevantUpdates.length}/${count} updates match ${sport}/${marketState}`);
      }
      
      // Trigger a refetch to get fresh data from v2 API
      // This is more efficient than incremental updates for the new key structure
      await refetch();
      
      if (process.env.NODE_ENV === 'development') {
        const perfEnd = performance.now();
        console.log(`[SSE v2] ⚡ Refetched in ${(perfEnd - perfStart).toFixed(1)}ms`);
      }
    } catch (error) {
      console.error('[SSE v2] Update failed:', error);
    }
  }, [sport, marketState, refetch]);
  
  // SSE enabled for Pro users (works for both pregame and live)
  const sseEnabled = shouldUseLiveUpdates
  
  // Use V2 SSE endpoint with new channel format (odds_updates:{sport})
  const { isConnected: sseConnected, isReconnecting: sseReconnecting, hasFailed: sseFailed } = useSSE(
    `/api/v2/sse/props?sport=${sport}`,
    {
      enabled: sseEnabled,
      onMessage: handleSSEUpdateV2,
      onError: (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('[SSE] Connection error:', error)
        }
      },
    }
  )
  
  // Track if we should show the connection error dialog
  const [showConnectionError, setShowConnectionError] = useState(false)
  
  // Show dialog when SSE fails (only for Pro users with live updates enabled)
  useEffect(() => {
    if (sseFailed && isPro && liveUpdatesEnabled) {
      setShowConnectionError(true)
    }
  }, [sseFailed, isPro, liveUpdatesEnabled])
  
  // Sync connection status with navigation context
  useEffect(() => {
    setConnectionStatus({
      connected: sseConnected,
      reconnecting: sseReconnecting,
      show: shouldUseLiveUpdates,
    })
  }, [sseConnected, sseReconnecting, shouldUseLiveUpdates, setConnectionStatus])

  // Extract unique games from data and sync to context
  useEffect(() => {
    if (!data.length) {
      setGames([])
      return
    }
    
    const gamesMap = new Map<string, {
      id: string;
      homeTeam: string;
      awayTeam: string;
      homeAbbr?: string;
      awayAbbr?: string;
      startTime?: string;
      isLive?: boolean;
    }>()
    
    data.forEach((item) => {
      if (item.event?.id && !gamesMap.has(item.event.id)) {
        gamesMap.set(item.event.id, {
          id: item.event.id,
          homeTeam: item.event.homeName || item.event.homeTeam || '',
          awayTeam: item.event.awayName || item.event.awayTeam || '',
          homeAbbr: item.event.homeTeam,
          awayAbbr: item.event.awayTeam,
          startTime: item.event.startTime,
          isLive: scope === 'live',
        })
      }
    })
    
    setGames(Array.from(gamesMap.values()))
  }, [data, scope, setGames])

  // Handle game selection - scroll within table container to game header
  const handleGameSelect = useCallback((gameId: string) => {
    // Find the game header element
    const gameHeader = document.querySelector(`[data-game-id="${gameId}"]`) as HTMLElement
    if (!gameHeader) return
    
    // Find the table's scroll container (the div with overflow-auto)
    const scrollContainer = gameHeader.closest('.overflow-auto') as HTMLElement
    if (scrollContainer) {
      // Calculate position relative to scroll container using bounding rects
      const containerRect = scrollContainer.getBoundingClientRect()
      const headerRect = gameHeader.getBoundingClientRect()
      
      // Current scroll position + element position relative to container - small offset for sticky header
      const stickyHeaderHeight = 44 // Account for sticky table header
      const targetScrollTop = scrollContainer.scrollTop + (headerRect.top - containerRect.top) - stickyHeaderHeight
      
      // Scroll within the container only
      scrollContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      })
    } else {
      // Fallback: if no scroll container found, use scrollIntoView
      gameHeader.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    
    // Add highlight effect
    gameHeader.classList.add('game-highlight')
    setTimeout(() => {
      gameHeader.classList.remove('game-highlight')
    }, 2000)
  }, [])

  // Set the game select handler in context
  useEffect(() => {
    setGameSelectHandler(() => handleGameSelect)
  }, [handleGameSelect, setGameSelectHandler])

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

  // Handler functions (defined before useEffect that uses them)
  const handleTypeChange = useCallback((newType: string) => {
    const defaultMarket = getDefaultMarket(sport, newType as 'game' | 'player')
    setMarketState(defaultMarket)
    // Reset filters when switching between game and player props
    setGroupFilter('all')
    setPeriodFilter('all')
    // Show loading state immediately for smooth transition
    setData([])
    setLoading(true)
    const next = `/odds/${sport}?type=${newType}&market=${defaultMarket}&scope=${scope}`
    router.replace(next, { scroll: false })
  }, [sport, scope, router])

  // Auto-switch to game props if on NCAAB player props (since NCAAB has no player props)
  useEffect(() => {
    if (sport === 'ncaab' && type === 'player') {
      handleTypeChange('game')
    }
  }, [sport, type, handleTypeChange])

  // Define game keys for filtering (matches getAvailableMarkets)
  const gameKeysSet = useMemo(() => new Set([
    // Generic game markets
    'moneyline', 'spread', 'total', 'h2h', 'spreads', 'totals',
    'home_total', 'away_total', 'total_touchdowns', 'total_fgs', 'safety', 'overtime',
    '1h_total', '2h_total', '1q_total', '2nd_half_total_points_reg_time',
    '1st_half_total_touchdowns', '2nd_half_total_touchdowns', '1st_quarter_total_touchdowns',
    '1st_half_home_team_total_points', '1st_half_away_team_total_points',
    '1st_half_home_team_total_touchdowns', '1st_half_away_team_total_touchdowns',
    '1h_total_fgs', '2h_total_fgs', 'total_fg_yards', 'longest_field_goal_made_yards',
    'shortest_field_goal_made_yards', 'total_td_yards', 'longest_td_yards', 'shortest_td_yards',
    'first_td_yards', 'home_safety', 'away_safety', '2pt_attempt', '2pt_conversion',
    'total_punts', 'largest_lead', 'first_score_yards', '1st_quarter_both_teams_to_score',
    // NBA/Basketball game markets
    'total_points_odd_even', '1h_moneyline', '1h_spread', '2h_total',
    '1q_moneyline', '1q_spread', '1q_total',
    '2q_moneyline', '2q_spread', '2q_total',
    '3q_moneyline', '3q_spread', '3q_total',
    '4q_moneyline', '4q_spread', '4q_total',
    // NHL game markets
    'puck_line', 'total_goals', 'moneyline_3way', 'total_goals_reg', 'total_goals_odd_even', 
    'puck_line_reg', 'draw_no_bet', 'both_teams_to_score', 'both_teams_to_score_2', 
    'first_team_to_score', 'first_team_to_score_3way', 'last_team_to_score_3way', 
    'away_total_goals', 'away_total_goals_reg', 'home_total_goals', 'home_total_goals_reg',
    // NHL period game markets
    'p1_moneyline', 'p1_moneyline_3way', 'p1_total_goals', 'p1_total_goals_odd_even', 'p1_puck_line',
    'p1_10m_total_goals', 'p1_5m_total_goals', 'p1_btts', 'p1_first_team_to_score_3way',
    'p1_home_total_goals', 'p1_away_total_goals',
    'p2_moneyline', 'p2_moneyline_3way', 'p2_puck_line', 'p2_total_goals', 'p2_total_goals_odd_even',
    'p2_btts', 'p2_10m_total_goals', 'p2_5m_total_goals',
    'p3_moneyline', 'p3_moneyline_3way', 'p3_puck_line', 'p3_total_goals', 'p3_total_goals_odd_even',
    // NHL race markets
    'race_to_2_goals_3way_reg', 'race_to_3_goals_3way_reg', 'race_to_4_goals_3way_reg', 'race_to_5_goals_3way_reg',
  ]), [])

  // Prepare data for rendering (must be before early returns to maintain hook order)
  const availableMarkets = useMemo(() => getAvailableMarkets(sport, type as 'game' | 'player'), [sport, type, groupFilter, periodFilter])
  const allPlayerMarkets = useMemo(() => getMarketsForSport(resolveSportKey(sport)).filter((m) => !gameKeysSet.has(m.apiKey)), [sport, gameKeysSet])
  const groups = useMemo(() => Array.from(new Set(allPlayerMarkets.map((m) => m.group).filter(Boolean))) as string[], [allPlayerMarkets])
  const periods = useMemo(() => Array.from(new Set(allPlayerMarkets.map((m) => m.period || 'full'))), [allPlayerMarkets])
  
  // For game props, get groups/periods from game markets
  const allGameMarkets = useMemo(() => getMarketsForSport(resolveSportKey(sport)).filter((m) => gameKeysSet.has(m.apiKey)), [sport, gameKeysSet])
  const gameGroups = useMemo(() => Array.from(new Set(allGameMarkets.map((m) => m.group).filter(Boolean))) as string[], [allGameMarkets])
  const gamePeriods = useMemo(() => Array.from(new Set(allGameMarkets.map((m) => m.period || 'full'))), [allGameMarkets])

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 py-4">
        <OddsTableSkeleton 
          rows={10}
          sportsbookCount={8}
          showBestLine={true}
          showAverageLine={true}
          showLineColumn={false}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
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

  return (
    <div className="w-full px-4 sm:px-6 pt-4 pb-8">
      {/* Filters Sheet - triggered from navigation */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-md p-0 bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800"
        >
          <SheetHeader className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/80">
            <SheetTitle className="text-lg font-semibold text-neutral-900 dark:text-white">Filters & Settings</SheetTitle>
          </SheetHeader>
          <div className="px-6 py-6 overflow-y-auto flex-1">
            <OddsFilters 
              isPro={true}
              liveUpdatesEnabled={liveUpdatesEnabled}
              onLiveUpdatesChange={setLiveUpdatesEnabled}
              embedded={true}
              onClose={() => setFiltersOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Search Results Indicator */}
      {debouncedSearchQuery.trim() && (
        <div className="mb-6 px-3 py-2 bg-brand/10 border border-brand/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {searchResultsCount === 0 
                  ? `No ${type === 'player' ? 'players' : 'teams'} found for "${debouncedSearchQuery}"`
                  : `Found ${searchResultsCount} ${type === 'player' ? 'player' : 'game'}${searchResultsCount !== 1 ? 's' : ''} matching "${debouncedSearchQuery}"`}
              </span>
            </div>
            <button
              onClick={handleSearchClear}
              className="text-brand hover:opacity-80 text-sm font-medium transition-opacity duration-150"
            >
              Clear search
            </button>
          </div>
        </div>
      )}

  {/* Upgrade banner removed to allow open access for all users */}

      {/* Odds Table */}
      <OddsTable 
        data={data}
        loading={loading || (isFetching && data.length === 0)}
        error={error}
        sport={sport}
        type={type as 'game' | 'player'}
        market={marketState}
        scope={scope as 'pregame' | 'live'}
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

      {/* Connection Error Dialog */}
      <ConnectionErrorDialog
        isOpen={showConnectionError}
        onClose={() => setShowConnectionError(false)}
        onRefresh={() => window.location.reload()}
      />
    </div>
  )
}

export default function SportOddsPage(props: { params: Promise<{ sport: string }> }) {
  return <SportOddsContent {...props} />
}