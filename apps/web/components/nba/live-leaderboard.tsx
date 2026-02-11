'use client';

import { useState, useMemo, useEffect } from 'react';
import { PlayerStat } from '@/types/nba';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';
import { Crown } from '@/components/icons/crown';
import { formatNBATime, formatGameTime } from '@/lib/utils';

// Helper to get NBA team logo URL
const getTeamLogoUrl = (tricode: string): string => {
  if (!tricode) return '';
  return `/team-logos/nba/${tricode.toUpperCase()}.svg`;
};

interface LiveLeaderboardProps {
  players: PlayerStat[];
  isLoading?: boolean;
  selectedGameId?: string | null;
  searchQuery?: string;
  hideFinishedNonContenders?: boolean;
}

type SortField = 'pra' | 'points' | 'rebounds' | 'assists' | 'fg_pct' | 'plus_minus';
type SortDirection = 'asc' | 'desc';

export function LiveLeaderboard({ players, isLoading, selectedGameId, searchQuery = '', hideFinishedNonContenders = false }: LiveLeaderboardProps) {
  const [sortField, setSortField] = useState<SortField>('pra');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [starredPlayers, setStarredPlayers] = useState<Set<string>>(new Set());
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  // Load starred players from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('nba-starred-players');
      if (stored) {
        const parsed = JSON.parse(stored);
        setStarredPlayers(new Set(parsed));
        console.log('[LiveLeaderboard] Loaded starred players from localStorage:', parsed);
      }
    } catch (e) {
      console.error('[LiveLeaderboard] Failed to parse starred players:', e);
    }
    setHasLoadedFromStorage(true);
  }, []);

  // Save starred players to localStorage when changed (only after initial load)
  useEffect(() => {
    if (hasLoadedFromStorage) {
      const playersArray = Array.from(starredPlayers);
      localStorage.setItem('nba-starred-players', JSON.stringify(playersArray));
      console.log('[LiveLeaderboard] Saved starred players to localStorage:', playersArray);
    }
  }, [starredPlayers, hasLoadedFromStorage]);

  // Toggle star for a player
  const toggleStar = (playerName: string) => {
    setStarredPlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerName)) {
        newSet.delete(playerName);
      } else {
        newSet.add(playerName);
      }
      return newSet;
    });
  };

  // Filter by selected game and search query
  const filteredPlayers = useMemo(() => {
    let filtered = players;
    
    // Filter by selected game
    if (selectedGameId) {
      filtered = filtered.filter(p => p.game_id === selectedGameId);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.player_name.toLowerCase().includes(query) ||
        p.team_tricode.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [players, selectedGameId, searchQuery]);

  // Calculate PRA-based ranks (always based on PRA, not current sort field)
  const playersWithPRARanks = useMemo(() => {
    // Always sort by PRA descending to get true PRA ranks
    const allSortedByPRA = [...players].sort((a, b) => b.pra - a.pra);

    // Count how many players have each PRA score
    const praCountMap = new Map<number, number>();
    allSortedByPRA.forEach((player) => {
      const count = praCountMap.get(player.pra) || 0;
      praCountMap.set(player.pra, count + 1);
    });

    // Find the first rank for each PRA score (for ties)
    const praToRankMap = new Map<number, number>();
    let currentRank = 1;
    allSortedByPRA.forEach((player, index) => {
      if (!praToRankMap.has(player.pra)) {
        praToRankMap.set(player.pra, currentRank);
      }
      // Skip ranks for tied players (e.g., if 3 players tied for 5th, next is 8th)
      const tiedCount = praCountMap.get(player.pra) || 1;
      if (index + 1 === praToRankMap.get(player.pra)! + tiedCount - 1) {
        currentRank = index + 2;
      }
    });

    // Assign PRA ranks (tied players get the same rank)
    const ranksMap = new Map<string, number>();
    const praScoreMap = new Map<string, number>();
    const isTiedMap = new Map<string, boolean>();
    
    allSortedByPRA.forEach((player) => {
      const key = `${player.game_id}-${player.player_name}`;
      const rank = praToRankMap.get(player.pra) || 1;
      const isTied = (praCountMap.get(player.pra) || 0) > 1;
      
      ranksMap.set(key, rank);
      praScoreMap.set(key, player.pra);
      isTiedMap.set(key, isTied);
    });

    return { ranksMap, praScoreMap, isTiedMap };
  }, [players]);

  // Find the highest PRA score for tie detection
  const highestPRA = useMemo(() => {
    if (players.length === 0) return 0;
    return Math.max(...players.map(p => p.pra));
  }, [players]);

  // Apply "Contenders" filter: hide finished players outside top 3
  const contendersFilteredPlayers = useMemo(() => {
    if (!hideFinishedNonContenders) {
      return filteredPlayers;
    }
    
    return filteredPlayers.filter((player) => {
      const playerKey = `${player.game_id}-${player.player_name}`;
      const praRank = playersWithPRARanks.ranksMap.get(playerKey) || 999;
      const isGameFinished = player.game_status === 3; // Final
      
      // Keep player if:
      // 1. Game is not finished (still in progress or scheduled), OR
      // 2. Game is finished AND player is in top 3
      return !isGameFinished || praRank <= 3;
    });
  }, [filteredPlayers, hideFinishedNonContenders, playersWithPRARanks]);

  // Sort filtered players with starred players at the top
  const sortedPlayers = useMemo(() => {
    return [...contendersFilteredPlayers].sort((a, b) => {
      // Starred players come first
      const aStarred = starredPlayers.has(a.player_name);
      const bStarred = starredPlayers.has(b.player_name);
      
      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;
      
      // Within starred or non-starred groups, sort by selected field
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case 'pra':
          aVal = a.pra;
          bVal = b.pra;
          break;
        case 'points':
          aVal = a.points;
          bVal = b.points;
          break;
        case 'rebounds':
          aVal = a.rebounds;
          bVal = b.rebounds;
          break;
        case 'assists':
          aVal = a.assists;
          bVal = b.assists;
          break;
        case 'fg_pct':
          aVal = a.fg_pct || 0;
          bVal = b.fg_pct || 0;
          break;
        case 'plus_minus':
          aVal = a.plus_minus || 0;
          bVal = b.plus_minus || 0;
          break;
      }

      if (sortDirection === 'desc') {
        return bVal > aVal ? 1 : -1;
      } else {
        return aVal > bVal ? 1 : -1;
      }
    });
  }, [contendersFilteredPlayers, sortField, sortDirection, starredPlayers]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' ? (
      <ChevronDown className="ml-1 inline h-4 w-4" />
    ) : (
      <ChevronUp className="ml-1 inline h-4 w-4" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Loading State */}
      {isLoading && sortedPlayers.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading leaderboard...</p>
          </div>
        </div>
      )}

      {/* No Results State */}
      {!isLoading && sortedPlayers.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {searchQuery.trim() ? `No players found matching "${searchQuery}"` : 'No players found. Check back when games start!'}
            </p>
          </div>
        </div>
      )}

      {/* Legend - Show above table */}
      {sortedPlayers.length > 0 && (
        <div className="px-6 py-3 border-y border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-900/30">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-600 dark:text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              <span>Currently on court</span>
            </div>
            <div className="flex items-center gap-2">
              <Crown className="h-3.5 w-3.5 text-yellow-500" />
              <span>1st place / Top PRA</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-yellow-400" />
              <span>Starred player</span>
            </div>
          </div>
        </div>
      )}

      {/* Table with Scroll Area - Only show when we have results */}
      {sortedPlayers.length > 0 && (
        <div className="relative overflow-auto max-h-[1000px]">
          <table className="w-full border-separate border-spacing-0">
            <thead className="bg-neutral-50 dark:bg-neutral-900 sticky top-0 z-10">
            <tr>
              <th className="bg-neutral-50 dark:bg-neutral-900 border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-2 sm:px-4 sm:py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-10">
                <Star className="h-3.5 w-3.5 mx-auto" />
              </th>
              <th className="bg-neutral-50 dark:bg-neutral-900 border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider w-12">
                #
              </th>
            <th className="bg-neutral-50 dark:bg-neutral-900 border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Player
            </th>
            <th className="bg-neutral-50 dark:bg-neutral-900 border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-2 sm:px-4 sm:py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Matchup
            </th>
            <th 
              className="bg-neutral-50 dark:bg-neutral-900 border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-2 sm:px-4 sm:py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => handleSort('points')}
            >
              <div className="flex items-center justify-center gap-1">
                <span>PTS</span>
                <SortIcon field="points" />
              </div>
            </th>
            <th 
              className="bg-neutral-50 dark:bg-neutral-900 border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-2 sm:px-4 sm:py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => handleSort('rebounds')}
            >
              <div className="flex items-center justify-center gap-1">
                <span>REB</span>
                <SortIcon field="rebounds" />
              </div>
            </th>
            <th 
              className="bg-neutral-50 dark:bg-neutral-900 border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-2 sm:px-4 sm:py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => handleSort('assists')}
            >
              <div className="flex items-center justify-center gap-1">
                <span>AST</span>
                <SortIcon field="assists" />
              </div>
            </th>
            <th 
              className="bg-neutral-50 dark:bg-neutral-900 border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-2 sm:px-4 sm:py-3 text-center text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => handleSort('pra')}
            >
              <div className="flex items-center justify-center gap-1">
                <span>PRA</span>
                <SortIcon field="pra" />
              </div>
            </th>
            <th className="bg-neutral-50 dark:bg-neutral-900 border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-2 sm:px-4 sm:py-3 text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              MIN
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player, index) => {
            const playerKey = `${player.game_id}-${player.player_name}`;
            const praRank = playersWithPRARanks.ranksMap.get(playerKey) || index + 1;
            const isTied = playersWithPRARanks.isTiedMap.get(playerKey) || false;
            const playerPRA = player.pra;
            const isTiedForFirst = playerPRA === highestPRA;
            
            return (
              <PlayerRow
                key={playerKey}
                player={player}
                rank={praRank}
                isTied={isTied}
                rowIndex={index}
                isExpanded={expandedRow === playerKey}
                isStarred={starredPlayers.has(player.player_name)}
                isTiedForFirst={isTiedForFirst}
                onToggleExpand={() =>
                  setExpandedRow(
                    expandedRow === playerKey
                      ? null
                      : playerKey
                  )
                }
                onToggleStar={() => toggleStar(player.player_name)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  rank,
  isTied,
  rowIndex,
  isExpanded,
  isStarred,
  isTiedForFirst,
  onToggleExpand,
  onToggleStar,
}: {
  player: PlayerStat;
  rank: number;
  isTied: boolean;
  rowIndex: number;
  isExpanded: boolean;
  isStarred: boolean;
  isTiedForFirst: boolean;
  onToggleExpand: () => void;
  onToggleStar: () => void;
}) {
  // Special styling for first place (or tied for first in PRA)
  const isFirstPlace = isTiedForFirst;
  
  // Zebra striping matching odds-table with special treatment for first place
  const rowBg = isFirstPlace
    ? 'bg-gradient-to-r from-yellow-50/50 to-amber-50/30 dark:from-yellow-900/10 dark:to-amber-900/5'
    : rowIndex % 2 === 0 
    ? 'bg-white dark:bg-neutral-900' 
    : 'bg-[#f0f9ff] dark:bg-[#17202B]';

  return (
    <>
      <tr
        className={`transition-all duration-200 ${
          isFirstPlace 
            ? 'hover:from-yellow-100/60 hover:to-amber-100/40 dark:hover:from-yellow-900/20 dark:hover:to-amber-900/10 border-l-2 border-l-yellow-400 dark:border-l-yellow-500' 
            : 'hover:[background:color-mix(in_oklab,var(--primary)_5%,var(--card))]'
        } ${rowBg}`}
      >
        {/* Star Column */}
        <td 
          className="border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-1.5 sm:px-4 sm:py-2 text-center cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
        >
          <Star 
            className={`h-4 w-4 mx-auto transition-colors ${
              isStarred 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-neutral-300 dark:text-neutral-600 hover:text-yellow-400'
            }`}
          />
        </td>

        {/* Rank Column */}
        <td 
          className="border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-1.5 sm:px-4 sm:py-2 text-sm font-medium cursor-pointer"
          onClick={onToggleExpand}
        >
          {isTiedForFirst || rank === 1 ? (
            <div className="flex items-center justify-center">
              <Crown className="text-yellow-500" />
            </div>
          ) : rank === 2 ? (
            <div className="flex items-center justify-center">
              <Crown className="text-neutral-400" />
            </div>
          ) : rank === 3 ? (
            <div className="flex items-center justify-center">
              <Crown className="text-orange-600" />
            </div>
          ) : (
            <div className="text-center">{isTied ? `T${rank}` : rank}</div>
          )}
        </td>
        
        {/* Player Column */}
        <td 
          className="border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-1.5 sm:px-4 sm:py-2 text-sm cursor-pointer"
          onClick={onToggleExpand}
        >
          <div className="flex items-center gap-3">
            <img
              src={getTeamLogoUrl(player.team_tricode)}
              alt={player.team_tricode}
              className="w-9 h-9 object-contain shrink-0"
              onError={(e) => {
                // Fallback to text if logo fails to load
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">{player.player_name}</span>
                {player.oncourt && player.game_status !== 3 && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>
        
        {/* Matchup Column */}
        <td 
          className="border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-1.5 sm:px-4 sm:py-2 text-sm cursor-pointer"
          onClick={onToggleExpand}
        >
          <div className="flex flex-col gap-1">
            {/* Matchup with team logos and scores */}
            {(() => {
              const teams = player.matchup.split('@').map(t => t.trim());
              const awayTeam = teams[0] || '';
              const homeTeam = teams[1] || '';
              const showScores = player.game_status === 2 || player.game_status === 3; // Live or Final
              
              return (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1">
                      {showScores && (
                        <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mr-1">
                          {player.away_team_score || 0}
                        </span>
                      )}
                      <img
                        src={getTeamLogoUrl(awayTeam)}
                        alt={awayTeam}
                        className="w-4 h-4 object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{awayTeam}</span>
                    </div>
                    <span className="text-sm text-neutral-400 dark:text-neutral-600">@</span>
                    <div className="flex items-center gap-1">
                      <img
                        src={getTeamLogoUrl(homeTeam)}
                        alt={homeTeam}
                        className="w-4 h-4 object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{homeTeam}</span>
                      {showScores && (
                        <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 ml-1">
                          {player.home_team_score || 0}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-600 dark:text-neutral-400">
                    {formatGameTime(player.game_time)}
                  </div>
                </>
              );
            })()}
          </div>
        </td>
        
        {/* Stats Columns */}
        <td 
          className="border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-1.5 sm:px-4 sm:py-2 text-sm text-center font-mono cursor-pointer"
          onClick={onToggleExpand}
        >
          {player.points}
        </td>
        <td 
          className="border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-1.5 sm:px-4 sm:py-2 text-sm text-center font-mono cursor-pointer"
          onClick={onToggleExpand}
        >
          {player.rebounds}
        </td>
        <td 
          className="border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-1.5 sm:px-4 sm:py-2 text-sm text-center font-mono cursor-pointer"
          onClick={onToggleExpand}
        >
          {player.assists}
        </td>
        <td 
          className="border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-1.5 sm:px-4 sm:py-2 text-sm text-center font-mono font-bold text-primary cursor-pointer"
          onClick={onToggleExpand}
        >
          {player.pra}
        </td>
        <td 
          className="border-b border-r border-neutral-200/30 dark:border-neutral-800/30 px-2 py-1.5 sm:px-4 sm:py-2 text-sm text-center font-mono cursor-pointer"
          onClick={onToggleExpand}
        >
          {formatNBATime(player.minutes)}
        </td>
      </tr>

      {/* Expanded row with advanced stats */}
      {isExpanded && (
        <tr className="bg-neutral-50 dark:bg-neutral-800/50">
          <td colSpan={9} className="border-b border-neutral-200/30 dark:border-neutral-800/30 px-2 py-3 sm:px-4 sm:py-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
              <StatItem
                label="FG%"
                value={player.fg_pct ? `${player.fg_pct}%` : 'N/A'}
              />
              <StatItem
                label="FGM-FGA"
                value={`${player.field_goals_made || 0}-${player.field_goals_attempted || 0}`}
              />
              <StatItem
                label="3PM"
                value={player.three_pointers_made || 0}
              />
              <StatItem label="STL" value={player.steals || 0} />
              <StatItem label="BLK" value={player.blocks || 0} />
              <StatItem
                label="+/-"
                value={player.plus_minus || 0}
                className={
                  (player.plus_minus || 0) > 0
                    ? 'text-green-600 dark:text-green-400'
                    : (player.plus_minus || 0) < 0
                    ? 'text-red-600 dark:text-red-400'
                    : ''
                }
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function StatItem({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="text-center">
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className={`text-sm font-medium font-mono ${className || 'text-neutral-900 dark:text-neutral-100'}`}>{value}</div>
    </div>
  );
}

