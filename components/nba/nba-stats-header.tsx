'use client';

import { LiveStatsResponse } from '@/types/nba';
import { formatDistanceToNow } from 'date-fns';

interface NBAStatsHeaderProps {
  metadata?: LiveStatsResponse['metadata'];
  lastUpdated?: string;
  isLoading?: boolean;
}

export function NBAStatsHeader({ metadata, lastUpdated, isLoading }: NBAStatsHeaderProps) {
  const gamesLive = metadata?.gamesLive || 0;
  const gamesScheduled = metadata?.gamesScheduled || 0;
  const gamesFinal = metadata?.gamesFinal || 0;
  const hasAnyGames = gamesLive + gamesScheduled + gamesFinal > 0;

  const lastUpdatedText = lastUpdated
    ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })
    : 'Never';

  // Debug logging
  console.log('[NBAStatsHeader] Metadata:', {
    gamesLive,
    gamesScheduled,
    gamesFinal,
    hasAnyGames,
    metadata
  });

  return (
    <div className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              🏀 King of the Court
            </h1>
            <p className="text-sm text-muted-foreground">
              NBA PRA Leaderboard (Points + Rebounds + Assists)
            </p>
          </div>

          {/* Stats Summary */}
          <div className="flex items-center gap-4 text-sm">
            {gamesLive > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                </span>
                <span className="font-medium">{gamesLive} Live</span>
              </div>
            )}
            
            {gamesScheduled > 0 && (
              <div className="font-medium text-muted-foreground">
                {gamesScheduled} Scheduled
              </div>
            )}
            
            {gamesFinal > 0 && (
              <div className="text-muted-foreground">
                {gamesFinal} Final
              </div>
            )}
            
            {!hasAnyGames && (
              <div className="text-xs text-muted-foreground">
                No games today
              </div>
            )}

            <div className="h-4 w-px bg-border" />

            <div className="flex items-center gap-1.5">
              {isLoading && (
                <svg
                  className="h-3 w-3 animate-spin text-muted-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              <span className="text-xs text-muted-foreground">
                Updated {lastUpdatedText}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

