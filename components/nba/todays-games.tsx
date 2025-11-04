'use client';

import { NBAGame } from '@/types/nba';
import { Clock } from 'lucide-react';

interface TodaysGamesProps {
  games: NBAGame[];
  date: string;
  summary: {
    live: number;
    scheduled: number;
    final: number;
  };
}

// Helper to get NBA team logo URL
const getTeamLogoUrl = (tricode: string): string => {
  if (!tricode) return '';
  return `/team-logos/nba/${tricode.toUpperCase()}.svg`;
};

export function TodaysGames({ games }: TodaysGamesProps) {
  if (games.length === 0) {
    return (
      <div className="text-center py-16">
        <Clock className="h-12 w-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Games Scheduled</h3>
        <p className="text-neutral-600 dark:text-neutral-400">Check back later for upcoming games</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {games.map(game => (
        <GameCard key={game.game_id} game={game} />
      ))}
    </div>
  );
}

function GameCard({ game }: { game: NBAGame }) {
  const isLive = game.is_live;
  const isFinal = game.is_final;

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              LIVE
            </span>
          )}
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {game.display_time}
          </span>
        </div>
        {isFinal && (
          <span className="text-xs font-medium px-2 py-1 rounded bg-green-500/10 text-green-600 dark:text-green-400">
            FINAL
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Away Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img
              src={getTeamLogoUrl(game.away_team.tricode)}
              alt={game.away_team.tricode}
              className="w-10 h-10 object-contain shrink-0"
              onError={(e) => {
                // Fallback to text if logo fails to load
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLDivElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-full items-center justify-center font-bold text-xs shrink-0 hidden">
              {game.away_team.tricode}
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{game.away_team.name}</div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">{game.away_team.record}</div>
            </div>
          </div>
          <div className={`text-2xl font-bold tabular-nums ml-3 ${
            isLive || isFinal ? (game.away_team.score > game.home_team.score ? 'text-primary' : 'text-neutral-600 dark:text-neutral-400') : ''
          }`}>
            {game.away_team.score || '0'}
          </div>
        </div>

        {/* Home Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img
              src={getTeamLogoUrl(game.home_team.tricode)}
              alt={game.home_team.tricode}
              className="w-10 h-10 object-contain shrink-0"
              onError={(e) => {
                // Fallback to text if logo fails to load
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLDivElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-full items-center justify-center font-bold text-xs shrink-0 hidden">
              {game.home_team.tricode}
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">{game.home_team.name}</div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">{game.home_team.record}</div>
            </div>
          </div>
          <div className={`text-2xl font-bold tabular-nums ml-3 ${
            isLive || isFinal ? (game.home_team.score > game.away_team.score ? 'text-primary' : 'text-neutral-600 dark:text-neutral-400') : ''
          }`}>
            {game.home_team.score || '0'}
          </div>
        </div>
      </div>
    </div>
  );
}

