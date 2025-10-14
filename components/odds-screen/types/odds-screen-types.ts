// ============================================================================
// ODDS SCREEN - TYPESCRIPT INTERFACES
// ============================================================================
// Comprehensive type definitions for the unified odds screen component system
// Supports both player props and game props with shared interfaces

// ============================================================================
// API REQUEST & RESPONSE TYPES
// ============================================================================

/** Parameters for odds screen API requests */
export interface OddsScreenParams {
    sport: string                    // 'nfl', 'nba', 'mlb', etc.
    type: 'player' | 'game'         // Type of props to fetch
    market: string                   // Market code (e.g., 'passing_tds', 'total', 'spreads')
    scope: 'pregame' | 'live'       // Timing scope
    gameId?: string | null           // Optional game filter
    search?: string | null           // Optional search term
  }
  
  /** Main API response structure */
  export interface OddsScreenResponse {
    success: boolean
    metadata: OddsScreenMetadata
    data: OddsScreenItem[]
    error?: string                   // Present when success = false
    details?: any                    // Validation error details
  }
  
  /** Response metadata */
  export interface OddsScreenMetadata {
    sport: string
    type: 'player' | 'game'
    market: string
    scope: string
    lastUpdated: string              // ISO string
    totalCount: number
    filteredCount?: number           // Present when filters applied
  }
  
  // ============================================================================
  // CORE DATA TYPES
  // ============================================================================
  
  /** Individual odds screen item (player or game prop) */
  export interface OddsScreenItem {
    id: string                       // Unique identifier for the item
    entity: OddsScreenEntity         // Player or game information
    event: OddsScreenEvent           // Event/game details
    odds: OddsScreenOdds             // All odds data
  }
  
  /** Entity information (player or game) */
  export interface OddsScreenEntity {
    type: 'player' | 'game'
    name: string                     // Player name or "Team A @ Team B"
    details?: string                 // Position/team info or game details
    team?: string                    // Player team abbreviation (for player props)
    id?: string                      // Source identifier (e.g., playerId)
  }
  
  /** Event/game information */
  export interface OddsScreenEvent {
    id: string                       // Event ID
    startTime: string                // ISO string
    homeTeam: string                 // Team code (e.g., "KC")
    awayTeam: string                 // Team code (e.g., "BAL")
  }
  
  /** Complete odds information for an item */
  export interface OddsScreenOdds {
    best: BestOddsData              // Best available odds
    average: AverageOddsData        // Market average odds
    opening: OpeningOddsData        // Opening line odds
    books: SportsbookOddsData       // Individual sportsbook odds
  }
  
  // ============================================================================
  // ODDS DATA TYPES
  // ============================================================================
  
  /** Best odds across all sportsbooks */
  export interface BestOddsData {
    over?: OddsPrice
    under?: OddsPrice
  }
  
  /** Average odds across the market */
  export interface AverageOddsData {
    over?: OddsPrice
    under?: OddsPrice
  }
  
  /** Opening line odds */
  export interface OpeningOddsData {
    over?: OddsPrice
    under?: OddsPrice
  }
  
  /** Individual sportsbook odds */
  export interface SportsbookOddsData {
    [bookId: string]: {
      over?: OddsPrice
      under?: OddsPrice
    }
  }
  
  /** Individual odds price with line and link */
  export interface OddsPrice {
    price: number                    // American odds (e.g., -110, +150)
    line: number                     // Line value (e.g., 4.5, 47.5)
    book?: string                    // Sportsbook identifier
    link?: string | null             // Deep link to sportsbook
  }
  
  // ============================================================================
  // FILTER TYPES
  // ============================================================================
  
  /** Complete filter state for odds screen */
  export interface OddsScreenFilters {
    sport: string
    type: 'player' | 'game'
    market: string
    scope: 'pregame' | 'live'
    selectedGames: string[]          // Game IDs to include
    searchQuery: string
    selectedSportsbooks: string[]    // Sportsbook IDs to display
    showAlternates: boolean          // Future: show alternate lines
    includeAlternates: boolean       // Toggle to fetch alternate lines
  }
  
  /** Filter update payload */
  export interface OddsScreenFilterUpdate {
    sport?: string
    type?: 'player' | 'game'
    market?: string
    scope?: 'pregame' | 'live'
    selectedGames?: string[]
    searchQuery?: string
    selectedSportsbooks?: string[]
    showAlternates?: boolean
    includeAlternates?: boolean
  }
  
  // ============================================================================
  // COMPONENT PROP TYPES
  // ============================================================================
  
  /** Props for main odds screen component */
  export interface OddsScreenProps {
    defaultFilters?: Partial<OddsScreenFilters>
    onFiltersChange?: (filters: OddsScreenFilters) => void
    className?: string
  }
  
  /** Props for filters component */
  export interface OddsScreenFiltersProps {
    filters: OddsScreenFilters
    onFiltersChange: (filters: OddsScreenFilters) => void
    availableMarkets: MarketOption[]
    availableGames: GameOption[]
    availableSportsbooks: SportsbookOption[]
    isLoading?: boolean
  }
  
  /** Props for table component */
  export interface OddsScreenTableProps {
    data: OddsScreenItem[]
    filters: OddsScreenFilters
    columnConfig: ColumnConfig
    onColumnConfigChange: (config: ColumnConfig) => void
    isLoading?: boolean
    error?: string | null
  }
  
  /** Props for individual table row */
  export interface OddsScreenTableRowProps {
    item: OddsScreenItem
    columnConfig: ColumnConfig
    visibleSportsbooks: string[]
    onExpandAlternates?: (itemId: string) => void // Future feature
  }
  
  // ============================================================================
  // COLUMN CONFIGURATION TYPES
  // ============================================================================
  
  /** Complete column configuration */
  export interface ColumnConfig {
    columns: ColumnDefinition[]
    visibleSportsbooks: string[]
    sportsbookOrder: string[]
  }
  
  /** Individual column definition */
  export interface ColumnDefinition {
    id: string                       // Column identifier
    label: string                    // Display label
    type: ColumnType                 // Column type
    visible: boolean                 // Show/hide column
    width?: number                   // Column width (px)
    sortable?: boolean               // Can be sorted
    position: number                 // Display order
  }
  
  /** Column types */
  export type ColumnType = 
    | 'datetime'                     // Event date/time
    | 'entity'                       // Player/game name
    | 'best-odds'                    // Best odds display
    | 'average-odds'                 // Average odds display
    | 'opening-odds'                 // Opening line display
    | 'sportsbook'                   // Individual sportsbook
  
  // ============================================================================
  // DROPDOWN/SELECT OPTION TYPES
  // ============================================================================
  
  /** Market dropdown option */
  export interface MarketOption {
    id: string                       // Market code
    label: string                    // Display name
    type: 'player' | 'game'         // Prop type
    sport?: string                   // Optional sport restriction
  }
  
  /** Game dropdown option */
  export interface GameOption {
    id: string                       // Event ID
    label: string                    // Display name (e.g., "BAL @ KC")
    startTime: string                // ISO string
    sport: string                    // Sport code
  }
  
  /** Sportsbook dropdown option */
  export interface SportsbookOption {
    id: string                       // Sportsbook ID
    name: string                     // Display name
    logo?: string                    // Logo URL
    isActive: boolean                // Available for selection
    priority?: number                // Display order
  }
  
  // ============================================================================
  // STATE MANAGEMENT TYPES
  // ============================================================================
  
  /** Data loading state */
  export interface DataLoadingState {
    isLoading: boolean
    error: string | null
    lastUpdated: string | null
  }
  
  /** Filter state management */
  export interface FilterState {
    current: OddsScreenFilters
    pending?: OddsScreenFilterUpdate
    hasUnsavedChanges: boolean
  }
  
  // ============================================================================
  // HOOK RETURN TYPES
  // ============================================================================
  
  /** Return type for data fetching hook */
  export interface UseOddsScreenDataReturn {
    data: OddsScreenItem[]
    metadata: OddsScreenMetadata | null
    isLoading: boolean
    error: string | null
    refetch: () => void
    lastUpdated: string | null
  }
  
  /** Return type for filters hook */
  export interface UseOddsScreenFiltersReturn {
    filters: OddsScreenFilters
    updateFilters: (update: OddsScreenFilterUpdate) => void
    resetFilters: () => void
    hasUnsavedChanges: boolean
    saveFilters: () => Promise<void>
    currentParams: OddsScreenParams
    isLoading: boolean
  }
  
  /** Return type for column configuration hook */
  export interface UseColumnConfigReturn {
    columnConfig: ColumnConfig
    updateColumnConfig: (config: Partial<ColumnConfig>) => void
    reorderColumns: (fromIndex: number, toIndex: number) => void
    toggleColumnVisibility: (columnId: string) => void
    toggleSportsbookVisibility: (sportsbookId: string) => void
    reorderSportsbooks: (fromIndex: number, toIndex: number) => void
    resetToDefaults: () => void
    hasUnsavedChanges: boolean
    isLoading: boolean
    saveConfiguration: () => Promise<void>
  }
  
  // ============================================================================
  // SORTING & INTERACTION TYPES
  // ============================================================================
  
  /** Sort configuration */
  export interface SortConfig {
    field: string                    // Field to sort by
    direction: 'asc' | 'desc'       // Sort direction
  }
  
  /** Table interaction handlers */
  export interface TableInteractionHandlers {
    onSort?: (config: SortConfig) => void
    onRowClick?: (item: OddsScreenItem) => void
    onOddsClick?: (item: OddsScreenItem, side: 'over' | 'under', book?: string) => void
    onExpandAlternates?: (itemId: string) => void
  }
  
  // ============================================================================
  // FUTURE FEATURES - ALTERNATES
  // ============================================================================
  
  /** Alternate lines data (future feature) */
  export interface AlternateLineData {
    eventId: string
    playerId?: string                // For player props
    alternates: {
      over: AlternateOdds[]
      under: AlternateOdds[]
    }
  }
  
  /** Individual alternate odds */
  export interface AlternateOdds {
    line: number
    price: number
    book: string
    link?: string | null
  }
  
  // ============================================================================
  // UTILITY TYPES
  // ============================================================================
  
  /** Generic API error response */
  export interface ApiError {
    success: false
    error: string
    details?: any
  }
  
  /** Generic success response wrapper */
  export interface ApiSuccess<T> {
    success: true
    data: T
  }
  
  /** Union type for API responses */
  export type ApiResponse<T> = ApiSuccess<T> | ApiError
  
  // ============================================================================
  // CONSTANTS & ENUMS
  // ============================================================================
  
  /** Supported sports */
  export const SUPPORTED_SPORTS = ['nfl', 'nba', 'mlb', 'nhl'] as const
  export type Sport = typeof SUPPORTED_SPORTS[number]
  
  /** Supported scopes */
  export const SUPPORTED_SCOPES = ['pregame', 'live'] as const
  export type Scope = typeof SUPPORTED_SCOPES[number]
  
  /** Supported prop types */
  export const SUPPORTED_PROP_TYPES = ['player', 'game'] as const
  export type PropType = typeof SUPPORTED_PROP_TYPES[number]
  
  /** Default column order */
  export const DEFAULT_COLUMN_ORDER: ColumnType[] = [
    'datetime',
    'entity', 
    'best-odds',
    'average-odds',
    'opening-odds',
    'sportsbook'
  ]
  
  /** Default visible columns */
  export const DEFAULT_VISIBLE_COLUMNS: ColumnType[] = [
    'datetime',
    'entity',
    'best-odds',
    'average-odds',
    'sportsbook'
  ]
  
  // ============================================================================
  // TYPE GUARDS
  // ============================================================================
  
  /** Type guard for API success response */
  export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccess<T> {
    return response.success === true
  }
  
  /** Type guard for API error response */
  export function isApiError<T>(response: ApiResponse<T>): response is ApiError {
    return response.success === false
  }
  
  /** Type guard for player prop item */
  export function isPlayerProp(item: OddsScreenItem): boolean {
    return item.entity.type === 'player'
  }
  
  /** Type guard for game prop item */
  export function isGameProp(item: OddsScreenItem): boolean {
    return item.entity.type === 'game'
  }
  