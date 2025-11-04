'use client';

import { useState, useMemo } from 'react';
import { PlayerStat } from '@/types/nba';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LiveLeaderboardProps {
  players: PlayerStat[];
  isLoading?: boolean;
  selectedGameId?: string | null;
}

type SortField = 'pra' | 'points' | 'rebounds' | 'assists' | 'fg_pct' | 'plus_minus';
type SortDirection = 'asc' | 'desc';

export function LiveLeaderboard({ players, isLoading, selectedGameId }: LiveLeaderboardProps) {
  const [sortField, setSortField] = useState<SortField>('pra');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filter by selected game
  const filteredPlayers = useMemo(() => {
    if (!selectedGameId) return players;
    return players.filter(p => p.game_id === selectedGameId);
  }, [players, selectedGameId]);

  // Sort players
  const sortedPlayers = useMemo(() => {
    return [...filteredPlayers].sort((a, b) => {
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
  }, [filteredPlayers, sortField, sortDirection]);

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

  if (isLoading && sortedPlayers.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (sortedPlayers.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">
          No players found. Check back when games start!
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-center">Team</TableHead>
            <TableHead
              className="cursor-pointer text-center hover:bg-accent"
              onClick={() => handleSort('points')}
            >
              PTS <SortIcon field="points" />
            </TableHead>
            <TableHead
              className="cursor-pointer text-center hover:bg-accent"
              onClick={() => handleSort('rebounds')}
            >
              REB <SortIcon field="rebounds" />
            </TableHead>
            <TableHead
              className="cursor-pointer text-center hover:bg-accent"
              onClick={() => handleSort('assists')}
            >
              AST <SortIcon field="assists" />
            </TableHead>
            <TableHead
              className="cursor-pointer text-center font-bold hover:bg-accent"
              onClick={() => handleSort('pra')}
            >
              PRA <SortIcon field="pra" />
            </TableHead>
            <TableHead className="text-center">MIN</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPlayers.map((player, index) => (
            <PlayerRow
              key={`${player.game_id}-${player.player_name}`}
              player={player}
              rank={index + 1}
              isExpanded={expandedRow === `${player.game_id}-${player.player_name}`}
              onToggleExpand={() =>
                setExpandedRow(
                  expandedRow === `${player.game_id}-${player.player_name}`
                    ? null
                    : `${player.game_id}-${player.player_name}`
                )
              }
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PlayerRow({
  player,
  rank,
  isExpanded,
  onToggleExpand,
}: {
  player: PlayerStat;
  rank: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  // Elite performance badges
  const isElite = player.pra >= 50;
  const isLegendary = player.pra >= 60;

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggleExpand}
      >
        <TableCell className="font-medium">
          {rank <= 3 && (
            <span className="mr-1">
              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
            </span>
          )}
          {rank}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
              <span className="font-semibold">{player.player_name}</span>
            {player.oncourt && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
            )}
            {isLegendary && <span className="text-xs">👑</span>}
            {isElite && !isLegendary && <span className="text-xs">⭐</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {player.matchup} • {player.game_time}
            {player.game_date && (
              <span className="ml-2 text-muted-foreground/70">
                {new Date(player.game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-center font-mono font-semibold">
          {player.team_tricode}
        </TableCell>
        <TableCell className="text-center font-mono">{player.points}</TableCell>
        <TableCell className="text-center font-mono">{player.rebounds}</TableCell>
        <TableCell className="text-center font-mono">{player.assists}</TableCell>
        <TableCell className="text-center font-mono font-bold text-primary">
          {player.pra}
        </TableCell>
        <TableCell className="text-center font-mono text-sm">
          {player.minutes}
        </TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1">
            {player.oncourt && (
              <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                On Court
              </span>
            )}
            {player.starter && !player.oncourt && (
              <span className="text-xs text-muted-foreground">Starter</span>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded row with advanced stats */}
      {isExpanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={9}>
            <div className="grid grid-cols-2 gap-4 py-2 sm:grid-cols-4 md:grid-cols-6">
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
          </TableCell>
        </TableRow>
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
    <div className="text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-mono font-semibold ${className}`}>{value}</div>
    </div>
  );
}

