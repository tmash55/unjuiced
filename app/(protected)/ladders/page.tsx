"use client";

import React from "react";
import { useMarkets, usePlayers, useFindSid, useLadderFamily } from "@/hooks/use-ladders";
import type { Sport } from "@/libs/ladders/client";
import { ToolHeading } from "@/components/common/tool-heading";
import { ToolSubheading } from "@/components/common/tool-subheading";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { FiltersBar, FiltersBarSection, FiltersBarDivider } from "@/components/common/filters-bar";
import { ChevronsUpDown, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LaddersFilters } from "@/components/ladders/ladders-filters";
import { getAllActiveSportsbooks } from "@/lib/data/sportsbooks";
import { LadderRow } from "@/components/ladders/ladder-row";
import { LadderBuilderPanel, type LadderSelection } from "@/components/ladders/ladder-builder-panel";
import { getMarketsForSport, formatMarketLabel } from "@/lib/data/markets";
import { getStandardAbbreviation } from "@/lib/data/team-mappings";
import { toast } from "sonner";
import { ArrowTrendUp } from "@/components/icons";

export default function LaddersPage() {
  // Initialize state with defaults (no URL params)
  const [sport, setSport] = React.useState<Sport>("nfl");
  const [mkt, setMkt] = React.useState<string>("");
  const [query, setQuery] = React.useState<string>("");
  const [ent, setEnt] = React.useState<string>("");
  const [selectedPlayer, setSelectedPlayer] = React.useState<ComboboxOption | null>(null);
  // Exclude Bodog and Bovada from Ladders due to data accuracy issues
  const [selectedBooks, setSelectedBooks] = React.useState<string[]>(() => 
    getAllActiveSportsbooks()
      .filter(b => b.id !== 'bodog' && b.id !== 'bovada')
      .map(b => b.id)
  );
  const [ladderSelections, setLadderSelections] = React.useState<LadderSelection[]>([]);
  const [sideFilter, setSideFilter] = React.useState<'over' | 'under'>('over');
  const [marketType, setMarketType] = React.useState<'game' | 'player'>('player'); // Default to player since game is disabled
  const [ladderGap, setLadderGap] = React.useState<number>(0);
  const [multiBookOnly, setMultiBookOnly] = React.useState<boolean>(false);
  const [singleBookMode, setSingleBookMode] = React.useState<string | null>(null); // null = show best odds, string = show specific book only
  
  const { data: mktsData } = useMarkets(sport);
  const [scope, setScope] = React.useState<'pregame' | 'live'>('pregame');
  const { data: playersData, isLoading: playersLoading } = usePlayers(sport, mkt || undefined, query || undefined, scope);
  const { data: findData } = useFindSid(sport, ent || undefined, mkt || undefined);

  // Game market keys (same as odds screen)
  const gameMarketKeys = React.useMemo(() => new Set([
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
    // NHL game markets
    'moneyline_3way', 'total_goals', 'total_goals_reg', 'total_goals_odd_even',
    'puck_line', 'puck_line_reg', 'draw_no_bet', 'both_teams_to_score', 'both_teams_to_score_2',
    'first_team_to_score', 'first_team_to_score_3way', 'last_team_to_score_3way',
    'away_total_goals', 'away_total_goals_reg', 'home_total_goals', 'home_total_goals_reg',
    'p1_moneyline', 'p1_moneyline_3way', 'p1_total_goals', 'p1_total_goals_odd_even',
    'p1_puck_line', 'p1_10m_total_goals', 'p1_5m_total_goals', 'p1_btts',
    'p1_first_team_to_score_3way', 'p1_home_total_goals', 'p1_away_total_goals',
    'p2_moneyline', 'p2_moneyline_3way', 'p2_puck_line', 'p2_total_goals',
    'p2_total_goals_odd_even', 'p2_btts', 'p2_10m_total_goals', 'p2_5m_total_goals',
    'p3_moneyline', 'p3_moneyline_3way', 'p3_puck_line', 'p3_total_goals', 'p3_total_goals_odd_even',
    'race_to_2_goals_3way_reg', 'race_to_3_goals_3way_reg', 'race_to_4_goals_3way_reg', 'race_to_5_goals_3way_reg',
  ]), []);

  // Helper to determine if a market is a game market
  const isGameMarket = React.useCallback((marketKey: string) => {
    return gameMarketKeys.has(marketKey);
  }, [gameMarketKeys]);

  // Gap options for dropdown
  const gapOptions = React.useMemo(() => [
    { value: 0, label: 'All Lines' },
    { value: 1, label: 'Every 1' },
    { value: 5, label: 'Every 5' },
    { value: 10, label: 'Every 10' },
    { value: 25, label: 'Every 25' },
    { value: 50, label: 'Every 50' },
  ], []);
  const sid = findData?.sids?.[0];
  const { family, error, isLoading } = useLadderFamily(sport, sid);

  // Mobile detection (same as arb-table)
  const isMobile = React.useCallback(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth < 768;
  }, []);

  // Smart link selection: mobile → desktop → fallback
  const getBestLink = React.useCallback((desktopUrl?: string | null, mobileUrl?: string | null) => {
    // If on mobile and mobile link exists (and not empty string), use it
    if (isMobile() && mobileUrl && mobileUrl !== '') return mobileUrl;
    
    // Otherwise use desktop link
    if (desktopUrl) return desktopUrl;
    
    // No link available
    return null;
  }, [isMobile]);

  // Helper function to get team logo URL
  const getTeamLogoUrl = React.useCallback((teamName: string): string => {
    if (!teamName) return '';
    const abbr = getStandardAbbreviation(teamName, sport);
    return `/team-logos/${sport}/${abbr.toUpperCase()}.svg`;
  }, [sport]);

  // Helper function to check if sport has team logos available
  const hasTeamLogos = React.useCallback((sportKey: string): boolean => {
    const sportsWithLogos = ['nfl', 'nhl', 'nba', 'ncaaf'];
    return sportsWithLogos.includes(sportKey.toLowerCase());
  }, []);

  // Helper to get team name/abbreviation from ev data
  const getTeamDisplay = React.useCallback((teamData: any): string => {
    if (!teamData) return '';
    if (typeof teamData === 'string') return teamData;
    return teamData.abbr || teamData.name || '';
  }, []);

  // Sport options for combobox
  const sportOptions: ComboboxOption[] = React.useMemo(() => [
    { value: "nfl", label: "NFL" },
    { value: "nba", label: "NBA" },
    { value: "nhl", label: "NHL" },
    { value: "ncaaf", label: "NCAAF" },
  ], []);

  const selectedSport = React.useMemo(() => 
    sportOptions.find(o => o.value === sport) || null,
    [sportOptions, sport]
  );

  // Market options for combobox with filtering and proper labels
  const marketOptions: ComboboxOption[] = React.useMemo(() => {
    const markets = mktsData?.mkts || [];
    const sportKey = `${sport === 'nfl' || sport === 'ncaaf' ? 'football' : sport === 'nba' ? 'basketball' : sport === 'nhl' ? 'icehockey' : sport}_${sport}`;
    const allMarkets = getMarketsForSport(sportKey);
    
    return markets
      .filter(m => {
        const isGame = isGameMarket(m);
        return marketType === 'game' ? isGame : !isGame;
      })
      .map(m => {
        // Find the market definition to get the proper label
        const marketDef = allMarkets.find(def => def.apiKey === m || def.value === m);
        return {
          value: m,
          label: marketDef?.label || m.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        };
      });
  }, [mktsData, marketType, sport, isGameMarket]);

  const selectedMarket = React.useMemo(() => 
    marketOptions.find(o => o.value === mkt) || null,
    [marketOptions, mkt]
  );

  // Player options for combobox
  const playerOptions: ComboboxOption[] = React.useMemo(() => 
    (playersData?.players || []).map(p => ({
      value: p.ent,
      label: (
        <span className="flex items-center gap-2">
          {p.name || p.ent}
          {p.team && hasTeamLogos(sport) && (
            <img
              src={getTeamLogoUrl(p.team)}
              alt={p.team}
              className={cn('object-contain', sport === 'ncaaf' ? 'h-4 w-4' : 'h-5 w-5')}
              onError={(e) => {
                // Fallback to text abbreviation if logo fails to load
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  e.currentTarget.style.display = 'none';
                  const abbr = document.createElement('span');
                  abbr.className = 'text-xs text-neutral-500';
                  abbr.textContent = `(${p.team})`;
                  parent.appendChild(abbr);
                }
              }}
            />
          )}
          {p.team && !hasTeamLogos(sport) && (
            <span className="text-xs text-neutral-500">({p.team})</span>
          )}
        </span>
      ),
      right: p.position ? <span className="text-xs text-neutral-500">{p.position}</span> : undefined,
    })),
    [playersData, sport, hasTeamLogos, getTeamLogoUrl]
  );

  // Ladder builder handlers
  const handleAddToBuilder = React.useCallback((line: number, side: 'over' | 'under', book: string, price: number, link?: string | null) => {
    // Check if this exact leg already exists (same line, side, and book)
    setLadderSelections(prev => {
      const isDuplicate = prev.some(
        selection => selection.line === line && selection.side === side && selection.book === book
      );
      
      if (isDuplicate) {
        // Format line for display (e.g., 1.5 over -> 2+)
        const displayLine = side === 'over' ? `${Math.ceil(line)}+` : line.toString();
        toast.error(`This leg is already in your builder`, {
          description: `${displayLine} ${side} is already added`
        });
        return prev; // Don't add duplicate
      }
      
      const newSelection: LadderSelection = {
        id: `${line}-${side}-${book}-${Date.now()}`,
        line,
        side,
        book,
        price,
        link
      };
      
      return [...prev, newSelection];
    });
  }, []);

  const handleRemoveFromBuilder = React.useCallback((id: string) => {
    setLadderSelections(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleClearBuilder = React.useCallback(() => {
    setLadderSelections([]);
  }, []);

  return (
    <div className="w-full overflow-x-hidden">
      <div className="mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <ToolHeading>Ladder Builder</ToolHeading>
          <ToolSubheading>Browse ladders by sport, market, and player. Updates live.</ToolSubheading>
        </div>

      {/* Controls Section - Pregame/Live Toggle (Desktop only) */}
      <div className="mb-6 hidden md:flex items-center justify-between gap-3">
        {/* Left side: Toggle + Text */}
        <div className="flex items-center gap-3">
          {/* Pregame/Live Toggle */}
          <div className="mode-toggle">
            <button
              type="button"
              onClick={() => setScope('pregame')}
              className={cn(scope === 'pregame' && 'active')}
            >
              Pre-Game
            </button>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="cursor-not-allowed opacity-50"
            >
              Live
              <span className="ml-1 text-xs opacity-60">Soon</span>
            </button>
          </div>

          {/* Info Text */}
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Showing upcoming games
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-8 w-full">
        <div className="sticky top-14 z-40 w-full">
          <FiltersBar useDots={true}>
            {/* Mobile Layout (< md) - Stacked */}
            <div className="block md:hidden w-full space-y-3">
              {/* Row 1: Sport + Pre-Game/Live Toggle */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Combobox
                    selected={selectedSport}
                    setSelected={(opt) => {
                      if (opt) {
                        const newSport = opt.value as Sport;
                        setSport(newSport);
                        setMkt("");
                        setEnt("");
                        setSelectedPlayer(null);
                      }
                    }}
                    options={sportOptions}
                    matchTriggerWidth
                    caret={<ChevronsUpDown className="h-4 w-4 text-neutral-400" />}
                    buttonProps={{
                      className: "h-10 w-full",
                      textWrapperClassName: "text-sm font-medium",
                    }}
                  />
                </div>
                <div className="mode-toggle flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setScope('pregame')}
                    className={cn(scope === 'pregame' && 'active')}
                  >
                    Pre-Game
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Coming soon"
                    className="cursor-not-allowed opacity-50"
                  >
                    Live
                    <span className="ml-1 text-xs opacity-60">Soon</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Market Type + Market */}
              <div className="flex items-center gap-3">
                <div className="mode-toggle flex-shrink-0">
                  <button
                    type="button"
                    disabled
                    className="opacity-50 cursor-not-allowed"
                  >
                    Game
                    <span className="ml-1 text-xs opacity-60">Soon</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarketType('player')}
                    className={cn(marketType === 'player' && 'active')}
                  >
                    Player
                  </button>
                </div>
                <div className="flex-1 min-w-[240px]">
                  <Combobox
                    selected={selectedMarket}
                    setSelected={(opt) => {
                      const newMarket = opt?.value || "";
                      setMkt(newMarket);
                      setEnt("");
                      setSelectedPlayer(null);
                    }}
                    options={marketOptions}
                    matchTriggerWidth
                    caret={<ChevronsUpDown className="h-4 w-4 text-neutral-400" />}
                    buttonProps={{
                      className: "h-10 w-full",
                      textWrapperClassName: "text-sm font-medium",
                    }}
                  />
                </div>
              </div>

              {/* Row 3: Player + Filters */}
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 min-w-0">
                  <Combobox
                    selected={selectedPlayer}
                    setSelected={(opt) => {
                      setSelectedPlayer(opt);
                      const newPlayer = opt?.value || "";
                      setEnt(newPlayer);
                    }}
                    options={playerOptions}
                    onSearchChange={(v) => setQuery(v)}
                    searchPlaceholder="Search player..."
                    matchTriggerWidth
                    icon={<User className="h-4 w-4 text-neutral-500" />}
                    caret={<ChevronsUpDown className="h-4 w-4 text-neutral-400" />}
                    buttonProps={{
                      className: "h-10 w-full",
                      textWrapperClassName: "text-sm font-medium truncate",
                    }}
                    emptyState={
                      playersLoading ? (
                        <div className="py-6 text-center text-sm text-neutral-500">Loading players...</div>
                      ) : !mkt ? (
                        <div className="py-6 text-center text-sm text-neutral-500">Select a market first</div>
                      ) : undefined
                    }
                  />
                </div>
                <LaddersFilters 
                  selectedBooks={selectedBooks}
                  onSelectedBooksChange={setSelectedBooks}
                  ladderGap={ladderGap}
                  onLadderGapChange={setLadderGap}
                  multiBookOnly={multiBookOnly}
                  onMultiBookOnlyChange={setMultiBookOnly}
                  className="flex-shrink-0"
                />
              </div>
            </div>

            {/* Desktop Layout (>= md) - Single Row */}
            <div className="hidden md:flex w-full items-center gap-3">
              <FiltersBarSection align="left">
                {/* Sport Selector */}
                <div className="w-32">
                  <Combobox
                    selected={selectedSport}
                    setSelected={(opt) => {
                      if (opt) {
                        setSport(opt.value as Sport);
                        setMkt("");
                        setEnt("");
                        setSelectedPlayer(null);
                      }
                    }}
                    options={sportOptions}
                    matchTriggerWidth
                    caret={<ChevronsUpDown className="h-4 w-4 text-neutral-400" />}
                    buttonProps={{
                      className: "h-10",
                      textWrapperClassName: "text-sm font-medium",
                    }}
                  />
                </div>

                <FiltersBarDivider />

                {/* Market Type Toggle */}
                <div className="mode-toggle flex-shrink-0">
                  <button
                    type="button"
                    disabled
                    className="opacity-50 cursor-not-allowed"
                  >
                    Game
                    <span className="ml-1 text-xs opacity-60">Soon</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarketType('player')}
                    className={cn(marketType === 'player' && 'active')}
                  >
                    Player
                  </button>
                </div>

                <FiltersBarDivider />

                {/* Market Selector */}
                <div className="min-w-[240px]">
                  <Combobox
                    selected={selectedMarket}
                    setSelected={(opt) => {
                      const newMarket = opt?.value || "";
                      setMkt(newMarket);
                      setEnt("");
                      setSelectedPlayer(null);
                    }}
                    options={marketOptions}
                    matchTriggerWidth
                    caret={<ChevronsUpDown className="h-4 w-4 text-neutral-400" />}
                    buttonProps={{
                      className: "h-10",
                      textWrapperClassName: "text-sm font-medium",
                    }}
                  />
                </div>

                <FiltersBarDivider />

                {/* Player Selector */}
                <div className="min-w-[320px]">
                  <Combobox
                    selected={selectedPlayer}
                    setSelected={(opt) => {
                      setSelectedPlayer(opt);
                      const newPlayer = opt?.value || "";
                      setEnt(newPlayer);
                    }}
                    options={playerOptions}
                    onSearchChange={(v) => setQuery(v)}
                    searchPlaceholder="Search player..."
                    matchTriggerWidth
                    icon={<User className="h-4 w-4 text-neutral-500" />}
                    caret={<ChevronsUpDown className="h-4 w-4 text-neutral-400" />}
                    buttonProps={{
                      className: "h-10",
                      textWrapperClassName: "text-sm font-medium truncate",
                    }}
                    emptyState={
                      playersLoading ? (
                        <div className="py-6 text-center text-sm text-neutral-500">Loading players...</div>
                      ) : !mkt ? (
                        <div className="py-6 text-center text-sm text-neutral-500">Select a market first</div>
                      ) : undefined
                    }
                  />
                </div>
              </FiltersBarSection>

              <FiltersBarSection align="right">
                {/* Filters Button */}
                <LaddersFilters 
                  selectedBooks={selectedBooks}
                  onSelectedBooksChange={setSelectedBooks}
                  ladderGap={ladderGap}
                  onLadderGapChange={setLadderGap}
                  multiBookOnly={multiBookOnly}
                  onMultiBookOnlyChange={setMultiBookOnly}
                />
              </FiltersBarSection>
            </div>
          </FiltersBar>
        </div>
      </div>

      {/* Ladder table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {!sid ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] sm:min-h-[500px] px-4 sm:px-6 py-8 sm:py-12">
            <div className="max-w-2xl w-full">
              {/* Header */}
              <div className="text-center mb-8 sm:mb-12">
                <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-brand/20 to-brand/5 mb-4">
                  <ArrowTrendUp className="w-7 h-7 sm:w-8 sm:h-8 text-brand" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white mb-2 px-4">
                  Build Your Perfect Ladder
                </h2>
                <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 px-4">
                  Compare alternate lines across sportsbooks to find the best value
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-4 sm:space-y-6">
                {/* Step 1 */}
                <div className="flex gap-3 sm:gap-4 items-start p-4 sm:p-6 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 hover:border-brand/50 dark:hover:border-brand/50 transition-colors">
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs sm:text-sm">
                    1
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white mb-1">
                      Select a Market
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                      Choose a prop type like "Passing Yards", "Receptions", or "Player Points"
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3 sm:gap-4 items-start p-4 sm:p-6 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 hover:border-brand/50 dark:hover:border-brand/50 transition-colors">
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs sm:text-sm">
                    2
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white mb-1">
                      Pick a Player
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                      Search or browse available players for your selected market
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3 sm:gap-4 items-start p-4 sm:p-6 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 hover:border-brand/50 dark:hover:border-brand/50 transition-colors">
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs sm:text-sm">
                    3
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-white mb-1">
                      Compare & Build
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
                      View all alternate lines with best odds, add to your ladder, and one-click to open bets
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Tip */}
              <div className="mt-6 sm:mt-8 p-3 sm:p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                      Pro Tip
                    </p>
                    <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-400">
                      Lines highlighted in <span className="font-semibold text-brand">blue</span> are primary markets, while <span className="font-semibold" style={{ color: 'var(--tertiary)' }}>purple</span> indicates the best value plays based on market movement.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : error === 'not_found' ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center max-w-md px-4">
              <div className="text-neutral-900 dark:text-neutral-100 font-medium mb-2">No Alternates Available</div>
              <div className="text-neutral-500 dark:text-neutral-400 text-sm">
                This player/market combination doesn't have alternate lines available yet. Try selecting a different player or market.
              </div>
            </div>
          </div>
        ) : isLoading || !family ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-400 mx-auto mb-3" />
              <div className="text-neutral-500 dark:text-neutral-400 text-sm">Loading ladder...</div>
            </div>
          </div>
        ) : (Array.isArray(family?.lines) && family.lines.length > 0 ? (
          <div className="flex flex-col h-[calc(100vh-180px)] w-full overflow-x-hidden">
            {/* Sticky Family Header */}
            <div className="sticky top-0 z-20 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 backdrop-blur-sm w-full">
              {/* Player Info Row */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 px-4 sm:px-6 py-4">
                {/* Left: Player Info - Hero Row Layout */}
                <div className="flex flex-col gap-2">
                  {/* Row 1: Player Name + Position + Matchup */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-lg font-bold text-neutral-900 dark:text-white">
                      {family.player || family.ent}
                    </span>
                    {family.position && (
                      <span className="inline-flex items-center rounded-md bg-[#202630] dark:bg-[#202630] px-2.5 py-0.5 text-xs font-medium text-blue-400">
                        {family.position}
                      </span>
                    )}
                    {family.ev && family.ev.away && family.ev.home && (
                      <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        <span>{getTeamDisplay(family.ev.away)}</span>
                        <span className="text-neutral-400">@</span>
                        <span>{getTeamDisplay(family.ev.home)}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Row 2: Team + Market + Game Time */}
                  <div className="flex items-center gap-3 flex-wrap text-sm text-neutral-600 dark:text-neutral-400">
                    {family.team && (
                      <>
                        {hasTeamLogos(sport) ? (
                          <div className="flex items-center gap-1.5">
                            <img
                              src={getTeamLogoUrl(family.team)}
                              alt={family.team}
                              className={cn('object-contain opacity-80', sport === 'ncaaf' ? 'h-4 w-4' : 'h-4 w-4')}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            <span>{family.team}</span>
                          </div>
                        ) : (
                          <span>{family.team}</span>
                        )}
                        <span className="text-neutral-400">•</span>
                      </>
                    )}
                    <span className="text-xs font-medium uppercase tracking-wide">
                      {formatMarketLabel(family.mkt)}
                    </span>
                    {family.ev && family.ev.dt && (
                      <>
                        <span className="text-neutral-400">•</span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-500">
                          {new Date(family.ev.dt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZoneName: 'short'
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Right: Controls - Stack on mobile, row on desktop */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  {/* Legend - Hide on mobile */}
                  <div className="hidden md:flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sm bg-brand"></div>
                      <span className="text-neutral-600 dark:text-neutral-400">Primary</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sm" style={{ background: 'var(--tertiary)' }}></div>
                      <span className="text-neutral-600 dark:text-neutral-400">Best Value</span>
                    </div>
                  </div>
                  
                  {/* Primary Line - Hide on mobile */}
                  {family.primary_ln != null && (
                    <div className="hidden md:block text-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                      Primary Line: <span className="font-semibold text-neutral-900 dark:text-white">{family.primary_ln}</span>
                    </div>
                  )}
                  
                  {/* Filters Row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Over/Under Toggle */}
                    <div className="mode-toggle">
                      <button
                        type="button"
                        onClick={() => {
                          setSideFilter('over');
                        }}
                        className={cn(sideFilter === 'over' && 'active')}
                      >
                        Over
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSideFilter('under');
                        }}
                        className={cn(sideFilter === 'under' && 'active')}
                      >
                        Under
                      </button>
                    </div>
                    
                    {/* Gap Filter Dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                        Show:
                      </label>
                      <select
                        value={ladderGap}
                        onChange={(e) => {
                          const newGap = Number(e.target.value);
                          setLadderGap(newGap);
                        }}
                        className="h-8 min-w-[120px] rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600"
                      >
                        {gapOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Add All Button */}
            <div className="px-4 sm:px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/30">
              <button
                onClick={() => {
                  // Helper to get best odds for a side
                  const getBestForAddAll = (row: any, side: 'over' | 'under') => {
                    const best = row.best?.[side];
                    if (best && best.book && selectedBooks.includes(best.book)) {
                      const bk = best.book;
                      const offer = row.books?.[bk]?.[side] || {};
                      const price = best.price ?? offer.price ?? offer.odds?.am;
                      const link = getBestLink(offer.u, offer.m);
                      return { book: bk, price, link };
                    }
                    // Fallback: find best from selected books
                    let candidate: any = null;
                    for (const [bk, v] of Object.entries(row.books || {})) {
                      if (!selectedBooks.includes(bk)) continue;
                      const offer: any = (v as any)?.[side];
                      if (!offer) continue;
                      const price = offer.price ?? offer.odds?.am;
                      if (price == null) continue;
                      if (!candidate || price > candidate.price) {
                        const link = getBestLink(offer.u, offer.m);
                        candidate = { book: bk, price, link };
                      }
                    }
                    return candidate;
                  };

                  // Filter lines using the same logic as rendering
                  const filteredLines = [...(family.lines || [])]
                    .slice()
                    .sort((a: any, b: any) => (a.ln ?? 0) - (b.ln ?? 0))
                    .filter((row: any) => {
                      const availableBooks = Object.keys(row.books || {});
                      const validBooks = availableBooks.filter(bk => bk !== 'bodog' && bk !== 'bovada');
                      if (validBooks.length === 0) return false;
                      
                      if (ladderGap > 0) {
                        const roundedLine = Math.round(row.ln);
                        if (roundedLine % ladderGap !== 0) return false;
                      }
                      
                      if (multiBookOnly) {
                        const booksWithOdds = Object.entries(row.books || {})
                          .filter(([bk, v]: [string, any]) => {
                            if (!selectedBooks.includes(bk)) return false;
                            const offer = (v as any)?.[sideFilter];
                            return offer && (offer.price != null || offer.odds?.am != null);
                          });
                        if (booksWithOdds.length < 2) return false;
                      }
                      
                      return true;
                    });
                  
                  // Add all filtered lines
                  const newSelections: LadderSelection[] = [];
                  filteredLines.forEach((row: any) => {
                    const bestOdds = getBestForAddAll(row, sideFilter);
                    if (bestOdds && bestOdds.price) {
                      newSelections.push({
                        line: row.ln,
                        side: sideFilter,
                        book: bestOdds.book,
                        price: bestOdds.price,
                        id: `${row.ln}-${sideFilter}-${bestOdds.book}-${Date.now()}-${Math.random()}`,
                        link: bestOdds.link
                      });
                    }
                  });
                  
                  // Add to ladder selections (avoiding duplicates)
                  setLadderSelections(prev => {
                    const combined = [...prev];
                    newSelections.forEach(newSel => {
                      const exists = combined.some(s => 
                        s.line === newSel.line && 
                        s.side === newSel.side && 
                        s.book === newSel.book
                      );
                      if (!exists) {
                        combined.push(newSel);
                      }
                    });
                    return combined;
                  });
                }}
                className="flex items-center justify-center gap-2 w-full rounded-lg bg-brand/10 hover:bg-brand/20 text-brand px-4 py-2 text-sm font-semibold transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add All Visible Lines to Ladder
              </button>
            </div>
            
            {/* Scrollable Ladder Container */}
            <div className="flex-1 overflow-y-auto">
              {/* Ladder Container with Connected Rungs */}
              <div className="border-l-2 border-r-2 border-neutral-300 dark:border-neutral-700 rounded-lg overflow-hidden">
              {/* Ladder Rows */}
              {(() => {
                // First, deduplicate lines by line number (keep first occurrence)
                const linesSeen = new Map<number, any>();
                const duplicateCount = new Map<number, number>();
                
                (family.lines || []).forEach((row: any) => {
                  if (!linesSeen.has(row.ln)) {
                    linesSeen.set(row.ln, row);
                  } else {
                    // Track duplicates for logging
                    duplicateCount.set(row.ln, (duplicateCount.get(row.ln) || 1) + 1);
                  }
                });
                
                const deduplicatedLines = Array.from(linesSeen.values());
                
                // Log duplicates if any were found
                if (duplicateCount.size > 0 && process.env.NODE_ENV === 'development') {
                  const totalDuplicates = Array.from(duplicateCount.values()).reduce((sum, count) => sum + count, 0);
                  console.warn(`[LADDERS] Removed ${totalDuplicates} duplicate ladder lines`);
                  console.warn('[LADDERS] Duplicate lines:', Array.from(duplicateCount.entries()).slice(0, 5));
                }
                
                // Then filter and sort the lines
                const filteredLines = deduplicatedLines
                  .slice()
                  .sort((a: any, b: any) => (a.ln ?? 0) - (b.ln ?? 0))
                  .filter((row: any) => {
                    // Exclude lines that ONLY have odds from Bodog/Bovada (data accuracy issues)
                    const availableBooks = Object.keys(row.books || {});
                    const validBooks = availableBooks.filter(bk => bk !== 'bodog' && bk !== 'bovada');
                    
                    // If no valid books have odds for this line, exclude it
                    if (validBooks.length === 0) {
                      return false;
                    }
                    
                    // Filter by ladder gap
                    if (ladderGap > 0) {
                      const line = row.ln;
                      // For decimal lines (e.g., 24.5, 149.5), round to nearest whole number
                      const roundedLine = Math.round(line);
                      // Check if rounded line is a multiple of the gap (e.g., 10, 20, 30 for gap=10)
                      // OR if the line itself is a multiple (for whole numbers)
                      const isMultiple = (line % ladderGap === 0) || (roundedLine % ladderGap === 0);
                      if (!isMultiple) {
                        return false;
                      }
                    }
                    
                    // Filter by multi-book only
                    if (multiBookOnly) {
                      const bookCount = Object.keys(row.books || {}).filter(bk => 
                        selectedBooks.includes(bk)
                      ).length;
                      if (bookCount < 2) {
                        return false;
                      }
                    }
                    
                    return true;
                  });

                // Helper: Convert American odds to decimal odds
                const americanToDecimal = (american: number): number => {
                  if (american > 0) {
                    return (american / 100) + 1;
                  } else {
                    return (100 / Math.abs(american)) + 1;
                  }
                };
                
                // Helper to calculate average from selected books
                const calculateAverageForRow = (row: any, side: 'over' | 'under'): number | undefined => {
                  const books = Object.entries(row.books || {})
                    .filter(([bk]) => selectedBooks.includes(bk))
                    .map(([bk, v]: [string, any]) => {
                      const offer = (v as any)?.[side];
                      return offer?.price ?? offer?.odds?.am;
                    })
                    .filter((p): p is number => p != null && !Number.isNaN(p));
                  
                  if (books.length === 0) return undefined;
                  
                  // Convert American odds to implied probabilities, average them, then convert back
                  const avgProbability = books.reduce((sum, price) => {
                    const probability = price > 0 
                      ? 100 / (price + 100) 
                      : Math.abs(price) / (Math.abs(price) + 100);
                    return sum + probability;
                  }, 0) / books.length;
                  
                  // Convert back to American odds
                  const avgPrice = avgProbability >= 0.5 
                    ? Math.round(-(avgProbability / (1 - avgProbability)) * 100)
                    : Math.round(((1 - avgProbability) / avgProbability) * 100);
                  
                  return avgPrice;
                };
                
                // Helper to get best odds from selected books only
                const getBestFromSelectedBooks = (row: any, side: 'over' | 'under'): number | undefined => {
                  let bestPrice: number | undefined;
                  
                  // First check if API's best is from a selected book
                  const apiBest = row.best?.[side];
                  if (apiBest && apiBest.book && selectedBooks.includes(apiBest.book)) {
                    bestPrice = apiBest.price;
                  }
                  
                  // Also check all selected books to find the true best
                  for (const [bk, v] of Object.entries(row.books || {})) {
                    if (!selectedBooks.includes(bk)) continue;
                    const offer: any = (v as any)?.[side];
                    if (!offer) continue;
                    const price = offer.price ?? offer.odds?.am;
                    if (price != null && (bestPrice === undefined || price > bestPrice)) {
                      bestPrice = price;
                    }
                  }
                  
                  return bestPrice;
                };
                
                // Calculate best value line (highest profit uplift percentage)
                // Must use selected-books-only best AND averages
                let bestValueLine: number | null = null;
                let highestValue = 0;
                
                for (const row of filteredLines) {
                  const bestPrice = getBestFromSelectedBooks(row, sideFilter); // Use selected books best
                  const avg = calculateAverageForRow(row, sideFilter); // Use selected books average
                  
                  if (bestPrice && avg) {
                    // Convert to decimal odds
                    const decBest = americanToDecimal(bestPrice);
                    const decAvg = americanToDecimal(avg);
                    
                    // Calculate profit per $1 staked
                    const profitBest = decBest - 1;
                    const profitAvg = decAvg - 1;
                    
                    // Value = profit uplift
                    const value = (profitBest / profitAvg) - 1;
                    
                    if (value > highestValue) {
                      highestValue = value;
                      bestValueLine = row.ln;
                    }
                  }
                }

                return filteredLines.map((row: any, idx: number) => {

                  // Prepare best odds for each side
                  const getBest = (side: "over" | "under") => {
                    const best = row.best?.[side];
                    if (best && best.book && selectedBooks.includes(best.book)) {
                      const bk = best.book;
                      const offer = row.books?.[bk]?.[side] || {};
                      const price = best.price ?? offer.price ?? offer.odds?.am;
                      // Use smart link selection based on device
                      const link = getBestLink(offer.u, offer.m);
                      return { book: bk, price, link };
                    }
                    let candidate: any = null;
                    for (const [bk, v] of Object.entries(row.books || {})) {
                      if (!selectedBooks.includes(bk)) continue;
                      const offer: any = (v as any)?.[side];
                      if (!offer) continue;
                      const price = offer.price ?? offer.odds?.am;
                      if (price == null) continue;
                      if (!candidate || price > candidate.price) {
                        // Use smart link selection based on device
                        const link = getBestLink(offer.u, offer.m);
                        candidate = { book: bk, price, link };
                      }
                    }
                    return candidate;
                  };

                  // Prepare all books data
                  const allBooks = Object.entries(row.books || {})
                    .filter(([bk]) => selectedBooks.includes(bk))
                    .map(([bk, v]: [string, any]) => {
                      const overOffer = v?.over;
                      const underOffer = v?.under;
                      
                      return {
                        book: bk,
                        over: overOffer ? {
                          price: overOffer.price ?? overOffer.odds?.am,
                          // Use smart link selection based on device
                          link: getBestLink(overOffer.u, overOffer.m)
                        } : undefined,
                        under: underOffer ? {
                          price: underOffer.price ?? underOffer.odds?.am,
                          // Use smart link selection based on device
                          link: getBestLink(underOffer.u, underOffer.m)
                        } : undefined
                      };
                    })
                    .filter(b => b.over || b.under);

                  const bestOver = getBest("over");
                  const bestUnder = getBest("under");
                  
                  // Calculate average from selected books only (not global average)
                  const calculateAverage = (side: 'over' | 'under'): number | undefined => {
                    const validPrices = allBooks
                      .map(b => b[side]?.price)
                      .filter((p): p is number => p != null && !Number.isNaN(p));
                    
                    if (validPrices.length === 0) return undefined;
                    
                    // Convert American odds to implied probabilities, average them, then convert back
                    const avgProbability = validPrices.reduce((sum, price) => {
                      const probability = price > 0 
                        ? 100 / (price + 100) 
                        : Math.abs(price) / (Math.abs(price) + 100);
                      return sum + probability;
                    }, 0) / validPrices.length;
                    
                    // Convert back to American odds
                    const avgPrice = avgProbability >= 0.5 
                      ? Math.round(-(avgProbability / (1 - avgProbability)) * 100)
                      : Math.round(((1 - avgProbability) / avgProbability) * 100);
                    
                    return avgPrice;
                  };
                  
                  const avgOver = calculateAverage('over');
                  const avgUnder = calculateAverage('under');

                  // Get next line's odds for payout jump calculation
                  const nextRow = filteredLines[idx + 1];
                  let nextLineOdds: number | undefined;
                  if (nextRow) {
                    const nextBest = nextRow.best?.[sideFilter];
                    if (nextBest?.price) {
                      nextLineOdds = nextBest.price;
                    } else {
                      // Fallback: find best from books
                      for (const [bk, v] of Object.entries(nextRow.books || {})) {
                        if (!selectedBooks.includes(bk)) continue;
                        const offer: any = (v as any)?.[sideFilter];
                        const price = offer?.price ?? offer?.odds?.am;
                        if (price != null && (!nextLineOdds || price > nextLineOdds)) {
                          nextLineOdds = price;
                        }
                      }
                    }
                  }

                  return (
                    <LadderRow
                      key={row.ln}
                      line={row.ln}
                      bestOver={bestOver}
                      bestUnder={bestUnder}
                      avgOver={avgOver}
                      avgUnder={avgUnder}
                      allBooks={allBooks}
                      isEven={idx % 2 === 0}
                      onAddToBuilder={handleAddToBuilder}
                      sideFilter={sideFilter}
                      nextLineOdds={nextLineOdds}
                      isBestValue={row.ln === bestValueLine}
                      isPrimaryLine={row.ln === family.primary_ln}
                      marketName={typeof selectedMarket?.label === 'string' ? selectedMarket.label : undefined}
                    />
                  );
                });
              })()}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-neutral-900 dark:text-neutral-100 font-medium mb-2">No Alternates Available</div>
              <div className="text-neutral-500 dark:text-neutral-400 text-sm">No alternate lines found for this selection.</div>
            </div>
          </div>
        ))}
      </div>

      {/* Ladder Builder Panel */}
      <LadderBuilderPanel
        selections={ladderSelections}
        onRemove={handleRemoveFromBuilder}
        onClear={handleClearBuilder}
        playerName={family?.player || family?.ent}
        market={family?.mkt}
      />
      </div>
    </div>
  );
}


