'use client';

import { useState, useEffect } from 'react';
import { useHistoricalStats } from '@/hooks/use-nba-stats';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { LiveLeaderboard } from './live-leaderboard';
import { Button } from '@/components/button';

// Helper to get NBA team logo URL
const getTeamLogoUrl = (tricode: string): string => {
  if (!tricode) return '';
  return `/team-logos/nba/${tricode.toUpperCase()}.svg`;
};

export function HistoricalBrowser() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [latestDate, setLatestDate] = useState<string | null>(null);

  // Fetch the latest game date from the database (avoids timezone issues)
  useEffect(() => {
    fetch('/api/nba/latest-date')
      .then(res => res.json())
      .then(data => {
        if (data.latestDate) {
          setLatestDate(data.latestDate);
          
          // Default to yesterday (one day before latest)
          const latest = new Date(data.latestDate + 'T12:00:00Z');
          latest.setUTCDate(latest.getUTCDate() - 1);
          const year = latest.getUTCFullYear();
          const month = String(latest.getUTCMonth() + 1).padStart(2, '0');
          const day = String(latest.getUTCDate()).padStart(2, '0');
          const yesterday = `${year}-${month}-${day}`;
          
          setSelectedDate(yesterday);
        }
      })
      .catch(err => console.error('Failed to fetch latest date:', err));
  }, []);

  const { data, isLoading, error } = useHistoricalStats(
    selectedDate || null, 
    selectedGameId || undefined
  );

  // Generate list of available dates (Nov 3, 2025 onwards) - all in UTC
  // Exclude today since it's not historic yet
  const availableDates = [];
  const startDate = new Date('2025-11-03T00:00:00Z');
  const endDate = latestDate ? new Date(latestDate + 'T00:00:00Z') : new Date();
  // Go back one day from latest to exclude today
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  
  for (let d = new Date(endDate); d >= startDate; d.setUTCDate(d.getUTCDate() - 1)) {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    availableDates.push(`${year}-${month}-${day}`);
  }

  if (!selectedDate) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading dates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <label htmlFor="date-select" className="text-sm font-medium">
            Select Date:
          </label>
          <select
            id="date-select"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedGameId(null);
            }}
            className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {availableDates.map((date) => (
              <option key={date} value={date} className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
                {format(new Date(date + 'T12:00:00Z'), 'MMM d, yyyy')}
              </option>
            ))}
          </select>
        </div>

        {selectedGameId && (
          <Button
            variant="outline"
            text="Clear Game Filter"
            onClick={() => setSelectedGameId(null)}
            className="h-9 w-auto"
          />
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading historical data...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load historical data. Please try again.
          </p>
        </div>
      )}

      {/* Game Summaries */}
      {data && !selectedGameId && data.games.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Games</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.games.map((game) => {
              // Parse matchup to extract team tricodes (format: "LAL vs POR" or "LAL @ POR")
              const matchupParts = game.matchup.split(/\s+(?:vs|@)\s+/);
              const awayTeam = matchupParts[0]?.trim();
              const homeTeam = matchupParts[1]?.trim();
              
              // Parse final score (format: "123-115")
              const scoreParts = game.final_score.split('-');
              const awayScore = scoreParts[0]?.trim();
              const homeScore = scoreParts[1]?.trim();
              
              return (
                <button
                  key={game.game_id}
                  onClick={() => setSelectedGameId(game.game_id)}
                  className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 text-left transition-colors hover:border-neutral-300 dark:hover:border-neutral-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                      FINAL
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {/* Away Team */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <img
                          src={getTeamLogoUrl(awayTeam)}
                          alt={awayTeam}
                          className="w-6 h-6 object-contain shrink-0"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <span className="font-semibold text-sm">{awayTeam}</span>
                      </div>
                      <span className={`text-lg font-bold tabular-nums ${
                        parseInt(awayScore) > parseInt(homeScore) ? 'text-primary' : 'text-neutral-600 dark:text-neutral-400'
                      }`}>
                        {awayScore}
                      </span>
                    </div>
                    
                    {/* Home Team */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <img
                          src={getTeamLogoUrl(homeTeam)}
                          alt={homeTeam}
                          className="w-6 h-6 object-contain shrink-0"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <span className="font-semibold text-sm">{homeTeam}</span>
                      </div>
                      <span className={`text-lg font-bold tabular-nums ${
                        parseInt(homeScore) > parseInt(awayScore) ? 'text-primary' : 'text-neutral-600 dark:text-neutral-400'
                      }`}>
                        {homeScore}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      Top: {game.top_performer}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* No Data State */}
      {data && data.games.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            No games found for this date.
          </p>
        </div>
      )}

      {/* Leaderboard */}
      {data && data.leaderboard.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {selectedGameId ? 'Game Stats' : 'Daily Leaders'}
          </h3>
          <LiveLeaderboard
            players={data.leaderboard}
            isLoading={isLoading}
            selectedGameId={selectedGameId}
          />
        </div>
      )}
    </div>
  );
}

