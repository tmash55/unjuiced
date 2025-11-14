'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { OddsTable, type OddsTableItem } from '@/components/odds-screen/tables/odds-table'
import { OddsFilters } from '@/components/odds-screen/filters'
import { getMarketsForSport, type SportMarket } from '@/lib/data/markets'
import { useOddsPreferences } from '@/context/preferences-context'
import { LoadingState } from '@/components/common/loading-state'
import { useSSE } from '@/hooks/use-sse'
import { useAuth } from '@/components/auth/auth-provider'
import { useEntitlements } from '@/hooks/use-entitlements'
import { ConnectionErrorDialog } from '@/components/common/connection-error-dialog'
import { cn } from '@/lib/utils'
import { Combobox } from '@/components/ui/combobox'
import { ChevronsUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { InputSearch } from '@/components/icons/input-search'
import { ToolHeading } from '@/components/common/tool-heading'
import { ToolSubheading } from '@/components/common/tool-subheading'
import { FiltersBar, FiltersBarSection, FiltersBarDivider } from '@/components/common/filters-bar'

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
  const [userPlan, setUserPlan] = useState<string | null>(null)
  const [liveUpdatesEnabled, setLiveUpdatesEnabled] = useState<boolean>(true) // Pro users default to live
  
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
      const game = all.find((m) => gameKeys.has(m.apiKey))
      return game?.apiKey || 'total'
    }
    // For player props, find first non-game market, preferring sport-specific defaults
    const playerMarkets = all.filter((m) => !gameKeys.has(m.apiKey))
    if (sportKey === 'nfl' || sportKey === 'ncaaf') {
      // Prefer passing yards or passing TDs for football
      const passingYards = playerMarkets.find((m) => m.apiKey === 'passing_yards')
      const passingTds = playerMarkets.find((m) => m.apiKey === 'passing_tds')
      return passingYards?.apiKey || passingTds?.apiKey || playerMarkets[0]?.apiKey || 'passing_tds'
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

  // Fetch data when parameters change (using new props API with pub/sub support)
  const queryKey = ['odds-props', sport, type, marketState, scope]
  const { data: queryData, isLoading, isError, error: queryError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      // Use new props API with transformation adapter
      const url = `/api/props/table?sport=${encodeURIComponent(sport)}&market=${encodeURIComponent(marketState)}&scope=${encodeURIComponent(scope)}&limit=300`
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[FETCH] Requesting: ${url}`)
        console.log(`[FETCH] Redis key would be: props:${sport}:sort:roi:${scope}:${marketState}`)
      }
      
      const startTime = performance.now()
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error(`[FETCH] Error response:`, errorText)
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      
      const propsResponse = await res.json()
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[FETCH] Received ${propsResponse.rows?.length || 0} rows`)
      }
      
      // Transform props format to OddsTableItem format
      const { transformPropsResponseToOddsScreen } = await import('@/lib/api-adapters/props-to-odds')
      const transformedData = transformPropsResponseToOddsScreen(propsResponse, type as 'player' | 'game')
      
      const duration = performance.now() - startTime
      if (duration > 1000) {
        console.warn(`[FETCH] Slow API response: ${duration.toFixed(0)}ms`)
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
  const handleSSEUpdate = useCallback(async (message: any) => {
    const perfStart = performance.now();
    const { add = [], upd = [], del = [] } = message;
    
    try {
      // Early exit: no updates
      if (add.length === 0 && upd.length === 0 && del.length === 0) return;
      
      // Handle deletions (O(n) filter)
      if (del.length > 0) {
        const delSet = new Set(del);
        setData(prev => prev.filter(item => !delSet.has(item.id)));
      }
      
      // Handle additions and updates
      const needIds = [...new Set([...add, ...upd])];
      if (needIds.length === 0) return;
      
      // Fetch updated rows (use typed client to keep params consistent)
      const { fetchPropsRows } = await import('@/lib/props-client');
      const fetchedRows = await fetchPropsRows(sport, needIds);
      
      if (!Array.isArray(fetchedRows)) return;
      
      // Single-pass filter: null rows + market/type match
      const validRows = fetchedRows.reduce((acc: any[], item: any) => {
        if (!item.row) return acc;
        
        const row = item.row;
        const matchesMarket = row.mkt === marketState;
        const isPlayerRow = row.player !== null || row.ent?.startsWith('pid:');
        const matchesType = (type === 'player') === isPlayerRow;
        
        if (matchesMarket && matchesType) acc.push(row);
        return acc;
      }, []);
      
      if (validRows.length === 0) return;
      
      // Transform (lazy-load adapter)
      const { transformPropsResponseToOddsScreen } = await import('@/lib/api-adapters/props-to-odds');
      const updatedItems = transformPropsResponseToOddsScreen(
        { sids: [], rows: validRows, nextCursor: null },
        type as 'player' | 'game'
      );
      
      // Merge updates (O(n) with Map lookup)
      setData(prevData => {
        const updatedMap = new Map(updatedItems.map(item => [item.id, item]));
        const merged = prevData.map(item => updatedMap.get(item.id) ?? item);
        
        // Apply pregame filter if in pregame mode
        if (scope === 'pregame') {
          const now = new Date();
          return merged.filter(item => {
            if (item.event?.startTime) {
              const startTime = new Date(item.event.startTime);
              return startTime.getTime() > now.getTime() - (5 * 60 * 1000);
            }
            return true;
          });
        }
        
        return merged;
    });
    
    // Performance logging (dev only)
      if (process.env.NODE_ENV === 'development') {
        const perfEnd = performance.now();
        console.log(`[SSE] ⚡ ${validRows.length} rows in ${(perfEnd - perfStart).toFixed(1)}ms`);
      }
    } catch (error) {
      console.error('[SSE] Update failed:', error);
    }
  }, [sport, type, marketState, scope]);
  
  // SSE enabled for Pro users (works for both pregame and live)
  const sseEnabled = shouldUseLiveUpdates
  
  const { isConnected: sseConnected, isReconnecting: sseReconnecting, hasFailed: sseFailed } = useSSE(
    `/api/sse/props?sport=${sport}`,
    {
      enabled: sseEnabled,
      onMessage: handleSSEUpdate,
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

  // Combobox options for League and Market (shared by mobile/desktop)
  const leagueOptions = useMemo(() => {
    const sports = [
      { value: 'nfl', label: 'NFL', disabled: false },
      { value: 'ncaaf', label: 'NCAAF', disabled: false },
      { value: 'nba', label: 'NBA', disabled: false },
      { value: 'ncaab', label: 'NCAAB', disabled: false },
      { value: 'nhl', label: 'NHL', disabled: false },
      { value: 'mlb', label: 'MLB (Off Season)', disabled: true },
    ]
    return sports
  }, [])

  const selectedLeague = useMemo(() => (
    leagueOptions.find((o) => o.value === sport) || null
  ), [leagueOptions, sport])

  const marketOptions = useMemo(() => (
    availableMarkets.map((m) => ({
      value: m.key,
      label: m.label,
      disabled: !m.available,
      disabledTooltip: !m.available ? 'Not available for this sport/period' : undefined,
    }))
  ), [availableMarkets])

  const selectedMarket = useMemo(() => (
    marketOptions.find((o) => o.value === marketState) || null
  ), [marketOptions, marketState])

  if (loading) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
            {sport.toUpperCase()} Odds
          </h1>
        </div>
        <LoadingState />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
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
    router.push(`/odds/${newSport}?type=${type}&market=${getDefaultMarket(newSport, type as 'game' | 'player')}&scope=${scope}`)
  }

  const handleScopeChange = (newScope: 'pregame' | 'live') => {
    const next = `/odds/${sport}?type=${type}&market=${marketState}&scope=${newScope}`
    router.replace(next)
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header with sport and navigation */}
      <div className="mb-8">
        <ToolHeading>
          <span className="flex items-center gap-2">
            {sport.toUpperCase()} Odds
            {/* Live Status Indicator - Mobile only (green dot after "Odds") */}
            {shouldUseLiveUpdates && (
              <span className={cn(
                "md:hidden inline-flex h-2 w-2 rounded-full",
                sseConnected ? "bg-green-500" : sseReconnecting ? "bg-amber-500 animate-pulse" : "bg-neutral-400"
              )} />
            )}
          </span>
        </ToolHeading>
        <ToolSubheading>
          Compare real-time odds across top sportsbooks and find the best value for {sport.toUpperCase()} games and player props.
        </ToolSubheading>
      </div>

      {/* Controls Section - Pregame/Live Toggle (Desktop only) */}
      <div className="mb-6 hidden md:flex items-center justify-between gap-3">
        {/* Left side: Toggle + Text */}
        <div className="flex items-center gap-3">
          {/* Pregame/Live Toggle */}
          <div className="mode-toggle">
            <button
              type="button"
              onClick={() => handleScopeChange('pregame')}
              className={cn(scope === 'pregame' && 'active')}
            >
              Pre-Game
            </button>
            <button
              type="button"
              onClick={() => handleScopeChange('live')}
              className={cn(scope === 'live' && 'active')}
            >
              Live
            </button>
          </div>

          {/* Info Text */}
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            {scope === 'pregame' ? 'Showing upcoming games' : 'Showing live in-progress games'}
          </div>
        </div>

        {/* Right side: Live Status Indicator */}
        {shouldUseLiveUpdates && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium",
            sseConnected
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
              : sseReconnecting
              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
              : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
          )}>
            <span className={cn(
              "inline-flex h-2 w-2 rounded-full",
              sseConnected ? "bg-green-500" : sseReconnecting ? "bg-amber-500 animate-pulse" : "bg-neutral-400"
            )} />
            <span>
              {sseConnected ? "Live" : sseReconnecting ? "Reconnecting..." : "Offline"}
            </span>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="mb-8">
         {/* Sticky Filter Bar - positioned below navbar */}
         <div className="sticky top-14 z-40 mt-6 mb-6">
          <FiltersBar useDots={true}>
          {/* Mobile Layout (< md) - Stacked */}
          <div className="block md:hidden space-y-3 w-full">
            {/* Row 1: Pre-Game/Live Toggle */}
            <div className="flex items-center gap-3">
              {/* Pregame/Live Toggle */}
              <div className="mode-toggle">
                <button
                  type="button"
                  onClick={() => handleScopeChange('pregame')}
                  className={cn(scope === 'pregame' && 'active')}
                >
                  Pre-Game
                </button>
                <button
                  type="button"
                  disabled={!isPro}
                  onClick={() => isPro && handleScopeChange('live')}
                  className={cn(scope === 'live' && isPro && 'active')}
                >
                  Live
                  {!isPro && (
                    <span className="ml-1 text-xs opacity-60">Pro</span>
                  )}
                </button>
              </div>
            </div>

            {/* Row 2: League + Game/Player Toggle */}
            <div className="flex items-center gap-3">
              {/* League Selector */}
              <div className="flex-1">
                <Combobox
                  selected={selectedLeague}
                  setSelected={(opt) => opt && handleSportChange(opt.value)}
                  options={leagueOptions}
                  matchTriggerWidth
                  caret={<ChevronsUpDown className="h-4 w-4 text-neutral-400" />}
                  buttonProps={{
                    className: "h-10 w-full",
                    textWrapperClassName: "text-sm font-medium",
                  }}
                />
              </div>

              {/* Game/Player Toggle */}
              <div className="mode-toggle flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleTypeChange('game')}
                  className={cn(type === 'game' && 'active')}
                >
                  Game
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('player')}
                  className={cn(type === 'player' && 'active')}
                >
                  Player
                </button>
              </div>
            </div>

            {/* Row 3: Market + Filters */}
            <div className="flex items-stretch gap-3">
              {/* Market Type Selector */}
              <div className="flex-1 min-w-0">
                <Combobox
                  selected={selectedMarket}
                  setSelected={(opt) => opt && handleMarketChange(opt.value)}
                  options={marketOptions}
                  matchTriggerWidth
                  searchPlaceholder="Search markets..."
                  caret={<ChevronsUpDown className="h-4 w-4 text-neutral-400" />}
                  buttonProps={{
                    className: "h-10 w-full",
                    textWrapperClassName: "text-sm font-medium",
                  }}
                />
              </div>

              {/* Settings */}
              <div className="flex items-center">
                <OddsFilters 
                isPro={true}
                  liveUpdatesEnabled={liveUpdatesEnabled}
                  onLiveUpdatesChange={setLiveUpdatesEnabled}
                />
              </div>
            </div>

            {/* Row 4: Search */}
            <div className="relative">
              <InputSearch className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-gray-400 dark:text-gray-500" />
              <Input
                type="text"
                placeholder={type === 'player' ? "Search players..." : "Search teams..."}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Desktop Layout (>= md) - Horizontal */}
          <div className="hidden md:flex items-center gap-3 w-full">
            <FiltersBarSection align="left">
              {/* League Selector */}
              <Combobox
                selected={selectedLeague}
                setSelected={(opt) => opt && handleSportChange(opt.value)}
                options={leagueOptions}
                caret={<ChevronsUpDown className="h-4 w-4 text-neutral-400" />}
                buttonProps={{
                  className: "h-9 w-[140px] md:w-[160px] lg:w-[180px]",
                  textWrapperClassName: "text-sm font-medium",
                }}
              />

              {/* Game/Player Toggle */}
              <div className="mode-toggle">
                <button
                  type="button"
                  onClick={() => handleTypeChange('game')}
                  className={cn(type === 'game' && 'active')}
                >
                  Game
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('player')}
                  className={cn(type === 'player' && 'active')}
                >
                  Player
                </button>
              </div>

              {/* Market Type Selector */}
              <Combobox
                selected={selectedMarket}
                setSelected={(opt) => opt && handleMarketChange(opt.value)}
                options={marketOptions}
                matchTriggerWidth
                searchPlaceholder="Search markets..."
                caret={<ChevronsUpDown className="h-4 w-4 text-neutral-400" />}
                buttonProps={{
                  className: "h-9 w-[180px] md:w-[240px] lg:w-[300px] xl:w-[320px]",
                  textWrapperClassName: "text-sm font-medium",
                }}
              />

              {/* Search Input */}
              <div className="relative min-w-0">
                <InputSearch className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-gray-400 dark:text-gray-500" />
                <Input
                  type="text"
                  placeholder={type === 'player' ? "Search players..." : "Search teams..."}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-[140px] md:w-[200px] lg:w-64 flex-shrink pl-10"
                />
              </div>
            </FiltersBarSection>

            <FiltersBarSection align="right">
              {/* Filters Button */}
              <OddsFilters 
                isPro={true}
                liveUpdatesEnabled={liveUpdatesEnabled}
                onLiveUpdatesChange={setLiveUpdatesEnabled}
              />
            </FiltersBarSection>
          </div>
        </FiltersBar>
        </div>

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
      </div>

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