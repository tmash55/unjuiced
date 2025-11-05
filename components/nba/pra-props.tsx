'use client';

import { NBAProp } from '@/types/nba';
import { DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function PRAProps({ props, market, lastUpdated }: PRAPropsProps) {
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
      <div className="text-sm text-neutral-600 dark:text-neutral-400">
        Showing {todayProps.length} PRA prop{todayProps.length !== 1 ? 's' : ''} for today's games • Sorted by highest line
        {lastUpdated && (
          <span className="ml-2">
            • Updated {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="overflow-auto max-h-[1000px]">
        <table className="w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="bg-neutral-50 dark:bg-neutral-900 text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-2 py-2 sm:px-4 sm:py-3 text-left border-t border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                Player
              </th>
              <th className="hidden md:table-cell bg-neutral-50 dark:bg-neutral-900 text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-2 py-2 sm:px-4 sm:py-3 text-left border-t border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                Matchup
              </th>
              <th className="bg-neutral-50 dark:bg-neutral-900 text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 px-2 py-2 sm:px-4 sm:py-3 text-center border-t border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                PRA Line
              </th>
            </tr>
          </thead>
          <tbody>
            {todayProps.map((prop, index) => {
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

              // Zebra striping
              const rowBg = index % 2 === 0
                ? 'bg-white dark:bg-neutral-900'
                : 'bg-[#f0f9ff] dark:bg-[#17202B]';

              return (
                <tr
                  key={prop.sid || `prop-${index}`}
                  className={cn(
                    rowBg,
                    'hover:[background:color-mix(in_oklab,var(--primary)_5%,var(--card))] transition-colors'
                  )}
                >
                  {/* Player column */}
                  <td className="px-2 py-3 sm:px-4 sm:py-3 border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                    <div className="flex items-center gap-3">
                      <img
                        src={getTeamLogoUrl(prop.team)}
                        alt={prop.team}
                        className="w-6 h-6 object-contain shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        {/* Player name */}
                        <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {prop.player}
                        </div>
                        
                        {/* Matchup info - only visible on mobile (md:hidden) */}
                        <div className="md:hidden mt-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="flex items-center gap-1">
                              <img
                                src={getTeamLogoUrl(awayTeam)}
                                alt={awayTeam}
                                className="w-3.5 h-3.5 object-contain"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                {awayTeam}
                              </span>
                            </div>
                            <span className="text-xs text-neutral-400 dark:text-neutral-600">@</span>
                            <div className="flex items-center gap-1">
                              <img
                                src={getTeamLogoUrl(homeTeam)}
                                alt={homeTeam}
                                className="w-3.5 h-3.5 object-contain"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                {homeTeam}
                              </span>
                            </div>
                            {gameTime && (
                              <>
                                <span className="text-xs text-neutral-400 dark:text-neutral-600">•</span>
                                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                                  {gameTime}
                                </span>
                              </>
                            )}
                          </div>
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

                  {/* Line column */}
                  <td className="px-2 py-3 sm:px-4 sm:py-3 text-center border-b border-r border-neutral-200/30 dark:border-neutral-800/30">
                    <div className="text-center font-bold text-lg text-primary">
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
