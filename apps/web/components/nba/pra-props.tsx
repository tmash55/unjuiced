'use client';

import { useMemo, useState } from 'react';
import { NBAProp } from '@/types/nba';
import { DollarSign, Shield, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/tooltip';
import { getNBATeamId } from '@/lib/data/team-mappings';
import { useTeamDefenseRanks } from '@/hooks/use-team-defense-ranks';

type SortOption = 'line' | 'dvp-best' | 'dvp-worst';

// Add type for window debug flag
declare global {
  interface Window {
    __propsLogged?: boolean;
  }
}

// Helper to get NBA team logo URL
const getTeamLogoUrl = (tricode: string): string => {
  if (!tricode) return '';
  return `/team-logos/nba/${tricode.toUpperCase()}.svg`;
};

interface PRAPropsProps {
  props: NBAProp[];
  market: string;
  lastUpdated?: string;
}

// Helper to get opponent team from prop
function getOpponentTeam(prop: NBAProp): string | null {
  if (!prop.ev) return null;
  const playerTeam = prop.team?.toUpperCase();
  const homeTeam = prop.ev.home?.abbr?.toUpperCase();
  const awayTeam = prop.ev.away?.abbr?.toUpperCase();
  
  if (!playerTeam || !homeTeam || !awayTeam) return null;
  
  // If player is on home team, opponent is away team and vice versa
  return playerTeam === homeTeam ? awayTeam : homeTeam;
}

// Normalize position to standard 5 positions
function normalizePosition(pos: string | null): string {
  if (!pos) return 'SF'; // Default fallback
  const upper = pos.toUpperCase();
  
  // Direct matches
  if (['PG', 'SG', 'SF', 'PF', 'C'].includes(upper)) return upper;
  
  // Common variations
  if (upper === 'G' || upper === 'GUARD') return 'SG';
  if (upper === 'F' || upper === 'FORWARD') return 'SF';
  if (upper === 'G-F' || upper === 'F-G') return 'SG';
  if (upper === 'F-C' || upper === 'C-F') return 'PF';
  if (upper === 'CENTER') return 'C';
  
  return 'SF'; // Default
}

// DvP Badge component - consistent with other app components
function DvpBadge({ rank, position, avgAllowed }: { rank: number | null; position: string; avgAllowed?: number | null }) {
  if (!rank) return <span className="text-[10px] sm:text-xs text-neutral-400">—</span>;
  
  const getColor = () => {
    if (rank >= 21) return "text-emerald-600 dark:text-emerald-400"; // Good matchup
    if (rank <= 10) return "text-red-500 dark:text-red-400";          // Tough matchup
    return "text-neutral-500 dark:text-neutral-400";                  // Neutral
  };

  const getBgColor = () => {
    if (rank >= 21) return "bg-emerald-500/15 dark:bg-emerald-500/20";
    if (rank <= 10) return "bg-red-500/15 dark:bg-red-500/20";
    return "bg-neutral-200/50 dark:bg-neutral-700/40";
  };

  const getLabel = () => {
    if (rank >= 21) return "Good";
    if (rank <= 10) return "Tough";
    return "Neutral";
  };
  
  // Build tooltip content
  const tooltipContent = avgAllowed 
    ? `${getLabel()} matchup vs ${position}s • Avg ${avgAllowed.toFixed(1)} PRA allowed`
    : `${getLabel()} matchup vs ${position}s`;

  return (
    <Tooltip content={tooltipContent} side="top">
      <div className={cn(
        "flex items-center justify-center min-w-[28px] sm:min-w-[36px] h-6 sm:h-8 rounded-md sm:rounded-lg cursor-help",
        getBgColor()
      )}>
        <span className={cn("text-xs sm:text-sm font-bold tabular-nums", getColor())}>
          {rank}
        </span>
      </div>
    </Tooltip>
  );
}

// DvP Legend component - matches defensive-analysis.tsx
function DvpLegend() {
  return (
    <div className="flex items-center gap-2 sm:gap-3 text-[9px] sm:text-[10px]">
      <div className="flex items-center gap-0.5 sm:gap-1">
        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm bg-red-500" />
        <span className="text-neutral-500 dark:text-neutral-400">
          <span className="hidden sm:inline">Tough </span>(1-10)
        </span>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1">
        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm bg-neutral-400" />
        <span className="text-neutral-500 dark:text-neutral-400">
          <span className="hidden sm:inline">Neutral </span>(11-20)
        </span>
      </div>
      <div className="flex items-center gap-0.5 sm:gap-1">
        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm bg-emerald-500" />
        <span className="text-neutral-500 dark:text-neutral-400">
          <span className="hidden sm:inline">Good </span>(21-30)
        </span>
      </div>
    </div>
  );
}

export function PRAProps({ props, market, lastUpdated }: PRAPropsProps) {
  const [sortBy, setSortBy] = useState<SortOption>('line');
  
  // Filter props to only show games starting today (not tomorrow or later)
  const todayProps = props.filter((prop) => {
    if (!prop.ev?.dt) return true; // Include if no date info
    
    const gameDate = new Date(prop.ev.dt);
    const now = new Date();
    
    // Get start of today (midnight) in local timezone
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Get end of today (11:59:59 PM) in local timezone
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    // Only include games that start today
    return gameDate >= todayStart && gameDate <= todayEnd;
  });
  
  // Get unique opponent teams and their IDs
  const opponentTeams = useMemo(() => {
    const teams: { abbr: string; id: number }[] = [];
    const seen = new Set<string>();
    todayProps.forEach(prop => {
      const opponent = getOpponentTeam(prop);
      if (opponent && !seen.has(opponent)) {
        const teamId = getNBATeamId(opponent);
        if (teamId) {
          teams.push({ abbr: opponent, id: teamId });
          seen.add(opponent);
        }
      }
    });
    return teams;
  }, [todayProps]);
  
  // Fetch defense data for ALL opponent teams (up to 15 to avoid too many requests)
  const team1 = opponentTeams[0];
  const team2 = opponentTeams[1];
  const team3 = opponentTeams[2];
  const team4 = opponentTeams[3];
  const team5 = opponentTeams[4];
  const team6 = opponentTeams[5];
  const team7 = opponentTeams[6];
  const team8 = opponentTeams[7];
  const team9 = opponentTeams[8];
  const team10 = opponentTeams[9];
  const team11 = opponentTeams[10];
  const team12 = opponentTeams[11];
  const team13 = opponentTeams[12];
  const team14 = opponentTeams[13];
  const team15 = opponentTeams[14];
  
  const { positions: def1, isLoading: load1 } = useTeamDefenseRanks({ opponentTeamId: team1?.id ?? null, enabled: !!team1 });
  const { positions: def2, isLoading: load2 } = useTeamDefenseRanks({ opponentTeamId: team2?.id ?? null, enabled: !!team2 });
  const { positions: def3, isLoading: load3 } = useTeamDefenseRanks({ opponentTeamId: team3?.id ?? null, enabled: !!team3 });
  const { positions: def4, isLoading: load4 } = useTeamDefenseRanks({ opponentTeamId: team4?.id ?? null, enabled: !!team4 });
  const { positions: def5, isLoading: load5 } = useTeamDefenseRanks({ opponentTeamId: team5?.id ?? null, enabled: !!team5 });
  const { positions: def6, isLoading: load6 } = useTeamDefenseRanks({ opponentTeamId: team6?.id ?? null, enabled: !!team6 });
  const { positions: def7, isLoading: load7 } = useTeamDefenseRanks({ opponentTeamId: team7?.id ?? null, enabled: !!team7 });
  const { positions: def8, isLoading: load8 } = useTeamDefenseRanks({ opponentTeamId: team8?.id ?? null, enabled: !!team8 });
  const { positions: def9, isLoading: load9 } = useTeamDefenseRanks({ opponentTeamId: team9?.id ?? null, enabled: !!team9 });
  const { positions: def10, isLoading: load10 } = useTeamDefenseRanks({ opponentTeamId: team10?.id ?? null, enabled: !!team10 });
  const { positions: def11, isLoading: load11 } = useTeamDefenseRanks({ opponentTeamId: team11?.id ?? null, enabled: !!team11 });
  const { positions: def12, isLoading: load12 } = useTeamDefenseRanks({ opponentTeamId: team12?.id ?? null, enabled: !!team12 });
  const { positions: def13, isLoading: load13 } = useTeamDefenseRanks({ opponentTeamId: team13?.id ?? null, enabled: !!team13 });
  const { positions: def14, isLoading: load14 } = useTeamDefenseRanks({ opponentTeamId: team14?.id ?? null, enabled: !!team14 });
  const { positions: def15, isLoading: load15 } = useTeamDefenseRanks({ opponentTeamId: team15?.id ?? null, enabled: !!team15 });
  
  const defenseLoading = load1 || load2 || load3 || load4 || load5 || load6 || load7 || load8 || load9 || load10 || load11 || load12 || load13 || load14 || load15;
  
  // Create a map of all defense data by team abbreviation
  const defenseDataByTeam = useMemo(() => {
    const map = new Map<string, typeof def1>();
    if (team1 && def1 && Object.keys(def1).length > 0) map.set(team1.abbr, def1);
    if (team2 && def2 && Object.keys(def2).length > 0) map.set(team2.abbr, def2);
    if (team3 && def3 && Object.keys(def3).length > 0) map.set(team3.abbr, def3);
    if (team4 && def4 && Object.keys(def4).length > 0) map.set(team4.abbr, def4);
    if (team5 && def5 && Object.keys(def5).length > 0) map.set(team5.abbr, def5);
    if (team6 && def6 && Object.keys(def6).length > 0) map.set(team6.abbr, def6);
    if (team7 && def7 && Object.keys(def7).length > 0) map.set(team7.abbr, def7);
    if (team8 && def8 && Object.keys(def8).length > 0) map.set(team8.abbr, def8);
    if (team9 && def9 && Object.keys(def9).length > 0) map.set(team9.abbr, def9);
    if (team10 && def10 && Object.keys(def10).length > 0) map.set(team10.abbr, def10);
    if (team11 && def11 && Object.keys(def11).length > 0) map.set(team11.abbr, def11);
    if (team12 && def12 && Object.keys(def12).length > 0) map.set(team12.abbr, def12);
    if (team13 && def13 && Object.keys(def13).length > 0) map.set(team13.abbr, def13);
    if (team14 && def14 && Object.keys(def14).length > 0) map.set(team14.abbr, def14);
    if (team15 && def15 && Object.keys(def15).length > 0) map.set(team15.abbr, def15);
    return map;
  }, [team1, team2, team3, team4, team5, team6, team7, team8, team9, team10, team11, team12, team13, team14, team15,
      def1, def2, def3, def4, def5, def6, def7, def8, def9, def10, def11, def12, def13, def14, def15]);
  
  // Helper to get DvP rank for a player
  const getDvpRank = (opponentTeam: string | null, position: string | null): number | null => {
    if (!opponentTeam || !position) return null;
    const normalizedPos = normalizePosition(position);
    const teamDefense = defenseDataByTeam.get(opponentTeam);
    if (!teamDefense) return null;
    return teamDefense[normalizedPos]?.player_points_rebounds_assists?.rank ?? null;
  };
  
  // Sort props based on selected sort option
  const sortedProps = useMemo(() => {
    const propsWithRanks = todayProps.map(prop => {
      const opponent = getOpponentTeam(prop);
      const rank = getDvpRank(opponent, prop.position);
      return { prop, rank };
    });
    
    switch (sortBy) {
      case 'dvp-best':
        // Best matchups first (highest rank = weakest defense)
        return propsWithRanks
          .sort((a, b) => {
            if (a.rank === null && b.rank === null) return b.prop.line - a.prop.line;
            if (a.rank === null) return 1;
            if (b.rank === null) return -1;
            return b.rank - a.rank;
          })
          .map(x => x.prop);
      case 'dvp-worst':
        // Worst matchups first (lowest rank = strongest defense)
        return propsWithRanks
          .sort((a, b) => {
            if (a.rank === null && b.rank === null) return b.prop.line - a.prop.line;
            if (a.rank === null) return 1;
            if (b.rank === null) return -1;
            return a.rank - b.rank;
          })
          .map(x => x.prop);
      case 'line':
      default:
        return todayProps.sort((a, b) => b.line - a.line);
    }
  }, [todayProps, sortBy, defenseDataByTeam]);

  if (todayProps.length === 0) {
    return (
      <div className="text-center py-16">
        <DollarSign className="h-12 w-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Props Available</h3>
        <p className="text-neutral-600 dark:text-neutral-400">Props for today's games will appear when available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with count and sort options */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
          Showing {todayProps.length} PRA prop{todayProps.length !== 1 ? 's' : ''} for today's games
          {lastUpdated && (
            <span className="ml-1 sm:ml-2 hidden sm:inline">
              • Updated {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
        
        {/* Sort buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <span className="text-[10px] sm:text-xs text-neutral-500 mr-0.5 sm:mr-1">Sort:</span>
          <button
            onClick={() => setSortBy('line')}
            className={cn(
              "px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-colors",
              sortBy === 'line'
                ? "bg-primary text-white"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            )}
          >
            <span className="flex items-center gap-0.5 sm:gap-1">
              <ArrowUpDown className="w-3 h-3" />
              Line
            </span>
          </button>
          <button
            onClick={() => setSortBy('dvp-best')}
            className={cn(
              "px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-colors",
              sortBy === 'dvp-best'
                ? "bg-emerald-600 text-white"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
            )}
          >
            <span className="flex items-center gap-0.5 sm:gap-1">
              <TrendingUp className="w-3 h-3" />
              <span className="hidden sm:inline">Best Matchups</span>
              <span className="sm:hidden">Best</span>
            </span>
          </button>
          <button
            onClick={() => setSortBy('dvp-worst')}
            className={cn(
              "px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-md transition-colors",
              sortBy === 'dvp-worst'
                ? "bg-red-600 text-white"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-red-100 dark:hover:bg-red-900/30"
            )}
          >
            <span className="flex items-center gap-0.5 sm:gap-1">
              <TrendingDown className="w-3 h-3" />
              <span className="hidden sm:inline">Worst Matchups</span>
              <span className="sm:hidden">Worst</span>
            </span>
          </button>
        </div>
      </div>

      {/* Legend Bar - above table */}
      <div className="px-2 sm:px-4 py-2 sm:py-2.5 border border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-neutral-50 to-neutral-100/50 dark:from-neutral-800/50 dark:to-neutral-800/30 rounded-t-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2">
          <p className="text-[9px] sm:text-[10px] text-neutral-500 dark:text-neutral-400">
            <span className="hidden sm:inline">DvP = Defense vs Position • How opponent ranks at defending this position for PRA</span>
            <span className="sm:hidden">DvP = Defense vs Position rank for PRA</span>
          </p>
          <DvpLegend />
        </div>
      </div>

      <div className="overflow-auto max-h-[1000px] border-x border-b border-neutral-200 dark:border-neutral-700 rounded-b-lg">
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="bg-neutral-50 dark:bg-neutral-900 text-[10px] sm:text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-2 py-2 sm:px-4 sm:py-3 text-left border-t border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                Player
              </th>
              <th className="hidden md:table-cell bg-neutral-50 dark:bg-neutral-900 text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-2 py-2 sm:px-4 sm:py-3 text-left border-t border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                Matchup
              </th>
              <th className="bg-neutral-50 dark:bg-neutral-900 text-[10px] sm:text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-1.5 py-2 sm:px-4 sm:py-3 text-center border-t border-b border-r border-neutral-200/30 dark:border-neutral-800/30 w-[60px] sm:w-auto">
                <Tooltip content="Defense vs Position - how the opponent ranks at defending this position for PRA" side="top">
                  <div className="flex items-center justify-center gap-0.5 sm:gap-1 cursor-help">
                    <Shield className="w-3 h-3 hidden sm:block" />
                    <span>DvP</span>
                  </div>
                </Tooltip>
              </th>
              <th className="bg-neutral-50 dark:bg-neutral-900 text-[10px] sm:text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-1.5 py-2 sm:px-4 sm:py-3 text-center border-t border-b border-r border-neutral-200/30 dark:border-neutral-800/30 w-[60px] sm:w-auto">
                <span className="sm:hidden">Line</span>
                <span className="hidden sm:inline">PRA Line</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedProps.map((prop, index) => {
              // Get matchup info
              let awayTeam = '';
              let homeTeam = '';
              let gameTime = '';
              
              if (prop.ev) {
                awayTeam = prop.ev.away.abbr;
                homeTeam = prop.ev.home.abbr;
                if (prop.ev.dt) {
                  const date = new Date(prop.ev.dt);
                  gameTime = date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZoneName: 'short'
                  });
                }
              } else {
                const parts = prop.event.split('•');
                const matchupText = parts[0]?.trim() || prop.event;
                const teams = matchupText.split('@').map(t => t.trim());
                awayTeam = teams[0] || '';
                homeTeam = teams[1] || '';
                gameTime = parts[1]?.trim() || '';
              }

              // Get opponent team for this prop
              const opponentTeam = getOpponentTeam(prop);
              const playerPosition = normalizePosition(prop.position);
              const dvpRank = getDvpRank(opponentTeam, prop.position);
              
              // Get avg allowed for tooltip
              const getAvgAllowed = () => {
                if (!opponentTeam) return null;
                const teamDefense = defenseDataByTeam.get(opponentTeam);
                if (!teamDefense) return null;
                return teamDefense[playerPosition]?.player_points_rebounds_assists?.avgAllowed ?? null;
              };
              const avgAllowed = getAvgAllowed();

              // Row styling - simpler zebra striping
              const rowBg = index % 2 === 0
                ? 'bg-white dark:bg-neutral-900'
                : 'bg-neutral-50/50 dark:bg-neutral-800/30';

              // Left border color for quick scanning (matches legend colors)
              const borderColor = dvpRank && dvpRank >= 21 
                ? 'border-l-3 border-l-emerald-500' 
                : dvpRank && dvpRank <= 10 
                  ? 'border-l-3 border-l-red-500'
                  : 'border-l-3 border-l-transparent';

              return (
                <tr
                  key={prop.sid || `prop-${index}`}
                  className={cn(
                    rowBg,
                    borderColor,
                    'hover:[background:color-mix(in_oklab,var(--primary)_5%,var(--card))] transition-colors'
                  )}
                >
                  {/* Player column */}
                  <td className="px-2 py-2 sm:px-4 sm:py-3 border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <img
                        src={getTeamLogoUrl(prop.team)}
                        alt={prop.team}
                        className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        {/* Player name and position */}
                        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                          <span className="font-medium text-sm sm:text-base text-neutral-900 dark:text-neutral-100 truncate">
                            {prop.player}
                          </span>
                          {prop.position && (
                            <span className="text-[9px] sm:text-[10px] px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-medium shrink-0">
                              {playerPosition}
                            </span>
                          )}
                        </div>
                        
                        {/* Matchup info - only visible on mobile (md:hidden) - no game time */}
                        <div className="md:hidden mt-0.5 flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span>{awayTeam}</span>
                          <span className="text-neutral-400 dark:text-neutral-600">@</span>
                          <span>{homeTeam}</span>
                          {prop.ev?.live && (
                            <>
                              <span className="text-neutral-400 dark:text-neutral-600 mx-0.5">•</span>
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                              </span>
                              <span className="text-[10px] font-medium text-red-500">LIVE</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Matchup column - hidden on mobile */}
                  <td className="hidden md:table-cell px-2 py-3 sm:px-4 sm:py-3 border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                    <div className="min-w-0">
                      {/* Matchup with team logos */}
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <img
                            src={getTeamLogoUrl(awayTeam)}
                            alt={awayTeam}
                            className="w-4 h-4 object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {awayTeam}
                          </span>
                        </div>
                        <span className="text-neutral-400 dark:text-neutral-600">@</span>
                        <div className="flex items-center gap-1.5">
                          <img
                            src={getTeamLogoUrl(homeTeam)}
                            alt={homeTeam}
                            className="w-4 h-4 object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {homeTeam}
                          </span>
                        </div>
                      </div>
                      
                      {/* Game time */}
                      {gameTime && (
                        <div className="text-xs text-neutral-600 dark:text-neutral-400">
                          {gameTime}
                        </div>
                      )}
                      
                      {/* Live indicator */}
                      {prop.ev?.live && (
                        <div className="inline-flex items-center gap-1 mt-1">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                          </span>
                          <span className="text-[10px] font-medium text-red-600 dark:text-red-400">LIVE</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* DvP (Defense vs Position) column */}
                  <td className="px-1.5 py-2 sm:px-3 sm:py-2 text-center border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                    {opponentTeam ? (
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        {/* Opponent logo - hidden on small mobile */}
                        <Tooltip content={`Playing vs ${opponentTeam}`} side="top">
                          <img
                            src={getTeamLogoUrl(opponentTeam)}
                            alt={opponentTeam}
                            className="hidden sm:block w-5 h-5 object-contain cursor-help shrink-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </Tooltip>
                        {defenseLoading ? (
                          <div className="w-8 h-6 sm:w-[52px] sm:h-[38px] bg-neutral-200 dark:bg-neutral-700 rounded-md animate-pulse" />
                        ) : (
                          <DvpBadge rank={dvpRank} position={playerPosition} avgAllowed={avgAllowed} />
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>

                  {/* Line column */}
                  <td className="px-1.5 py-2 sm:px-4 sm:py-3 text-center border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                    <div className="text-center font-bold text-base sm:text-lg text-primary">
                      {prop.line}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
