'use client';

import { useState, useEffect } from 'react';
import { useTodaysGames, useLiveLeaderboard, useNBAProps } from '@/hooks/use-nba-stats';
import { TodaysGames } from '@/components/nba/todays-games';
import { LiveLeaderboard } from '@/components/nba/live-leaderboard';
import { PRAProps } from '@/components/nba/pra-props';
import { HistoricalBrowser } from '@/components/nba/historical-browser';
import { AdvancedStatsPanel } from '@/components/nba/advanced-stats-panel';
import { FiltersBar, FiltersBarSection } from '@/components/common/filters-bar';
import { Activity, Calendar, TrendingUp, BarChart3, Trophy, Award, Flame, ChevronUp, Filter } from 'lucide-react';
import { Crown } from '@/components/icons/crown';
import { InputSearch } from '@/components/icons/input-search';
import { Tooltip } from '@/components/tooltip';
import { cn } from '@/lib/utils';

type MainTab = 'games' | 'leaderboard' | 'props' | 'historical' | 'advanced';

export default function NBAStatsPage() {
  const [activeTab, setActiveTab] = useState<MainTab>('games'); // Default to games tab
  const [searchQuery, setSearchQuery] = useState('');
  const [hasAutoSwitched, setHasAutoSwitched] = useState(false);
  const [hideFinishedNonContenders, setHideFinishedNonContenders] = useState(false);

  // Fetch data for each tab (polls automatically with specified intervals)
  const { data: gamesData, isLoading: gamesLoading } = useTodaysGames(true); // Always fetch games data to check for live games
  const { data: leaderboardData, isLoading: leaderboardLoading, refetch: refetchLeaderboard, isFetching: leaderboardRefetching } = useLiveLeaderboard('leaderboard', 50, 0, activeTab === 'leaderboard');
  const { data: propsData, isLoading: propsLoading, refetch: refetchProps, isFetching: propsRefetching } = useNBAProps('player_points_rebounds_assists', 'pregame', activeTab === 'props');

  // Check if there are live games
  const hasLiveGames = (gamesData?.summary.live || 0) > 0 || (leaderboardData?.metadata.gamesLive || 0) > 0;

  // Auto-switch to leaderboard if there are live games on initial load
  useEffect(() => {
    if (!hasAutoSwitched && !gamesLoading && gamesData && (gamesData.summary.live || 0) > 0) {
      setActiveTab('leaderboard');
      setHasAutoSwitched(true);
    }
  }, [gamesData, gamesLoading, hasAutoSwitched]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Crown className="h-8 w-8 text-primary" />
                <h1 className="text-4xl font-bold tracking-tight">
                  King of the Court
                </h1>
              </div>
              <p className="mt-2 text-lg text-neutral-600 dark:text-neutral-400">
                Live NBA PRA Leaderboard • Points + Rebounds + Assists
              </p>
            </div>
            {hasLiveGames && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-red-600 dark:text-red-400">
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500"></span>
                <span className="text-sm font-semibold">LIVE GAMES</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Tab Navigation - FiltersBar Style */}
        <FiltersBar>
          <FiltersBarSection align="left">
            <div className="flex flex-wrap gap-2">
              <TabButton
                isActive={activeTab === 'games'}
                onClick={() => setActiveTab('games')}
                icon={<Calendar className="h-4 w-4" />}
                label="Games"
                fullLabel="Today's Games"
              />
              <TabButton
                isActive={activeTab === 'leaderboard'}
                onClick={() => setActiveTab('leaderboard')}
                icon={<Activity className="h-4 w-4" />}
                label="Leaders"
                fullLabel="PRA Leaderboard"
                badge={hasLiveGames ? (
                  <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                ) : undefined}
              />
              <TabButton
                isActive={activeTab === 'props'}
                onClick={() => setActiveTab('props')}
                icon={<TrendingUp className="h-4 w-4" />}
                label="Odds"
                fullLabel="PRA Odds"
              />
              <TabButton
                isActive={activeTab === 'historical'}
                onClick={() => setActiveTab('historical')}
                icon={<Calendar className="h-4 w-4" />}
                label="Historical"
              />
              <TabButton
                isActive={activeTab === 'advanced'}
                onClick={() => setActiveTab('advanced')}
                icon={<BarChart3 className="h-4 w-4" />}
                label="Advanced"
              />
            </div>
          </FiltersBarSection>
        </FiltersBar>

        <div className="mt-6">
          {/* Today's Games Tab */}
          {activeTab === 'games' && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
              {gamesLoading ? (
                <div className="py-12 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                  <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">Loading games...</p>
                </div>
              ) : gamesData ? (
                <>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold">Today&apos;s Schedule</h2>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                      {new Date(gamesData.date + 'T12:00:00Z').toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                  <TodaysGames 
                    games={gamesData.games} 
                    date={gamesData.date}
                    summary={gamesData.summary}
                  />
                </>
              ) : (
                <div className="py-12 text-center text-neutral-600 dark:text-neutral-400">
                  No data available
                </div>
              )}
            </div>
          )}

          {/* PRA Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">Live PRA Leaderboard</h2>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                      {leaderboardData?.metadata.gamesLive ? 
                        `${leaderboardData.metadata.gamesLive} live game${leaderboardData.metadata.gamesLive > 1 ? 's' : ''} • Updates every 20 seconds` :
                        'Latest stats from today'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Search Bar */}
                    <div className="relative">
                      <InputSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 dark:text-neutral-500" />
                      <input
                        type="text"
                        placeholder="Search players..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-64 h-10 pl-10 pr-4 text-sm rounded-lg border border-neutral-200 bg-white text-neutral-900 placeholder-neutral-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder-neutral-400 dark:focus:border-primary"
                      />
                    </div>
                    {/* Hide Finished Non-Contenders Toggle */}
                    <Tooltip content="Hide finished players outside top 3. Shows only players still competing or who finished in the top 3.">
                      <button
                        onClick={() => setHideFinishedNonContenders(!hideFinishedNonContenders)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors h-10",
                          hideFinishedNonContenders
                            ? "border-primary bg-primary text-white hover:bg-primary/90"
                            : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        )}
                      >
                        <Filter className="h-4 w-4" />
                        <span className="hidden sm:inline">Contenders</span>
                      </button>
                    </Tooltip>
                    {/* Refresh Button */}
                    <button
                      onClick={() => refetchLeaderboard()}
                      disabled={leaderboardRefetching}
                      className="flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 transition-colors h-10"
                    >
                      <svg
                        className={cn("h-4 w-4", leaderboardRefetching && "animate-spin")}
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
              {leaderboardLoading ? (
                <div className="py-12 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                  <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">Loading leaderboard...</p>
                </div>
              ) : (leaderboardData?.leaderboard.length || 0) > 0 ? (
                <LiveLeaderboard
                  players={leaderboardData?.leaderboard || []}
                  isLoading={leaderboardLoading}
                  selectedGameId={null}
                  searchQuery={searchQuery}
                  hideFinishedNonContenders={hideFinishedNonContenders}
                />
              ) : (
                <div className="p-12 text-center">
                  <h3 className="text-lg font-semibold">No stats available yet</h3>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                    Player stats will appear once games start
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PRA Props/Odds Tab */}
          {activeTab === 'props' && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold">PRA Betting Odds</h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                  Points + Rebounds + Assists • DraftKings preferred, best available shown
                </p>
              </div>
              {propsLoading && !propsData ? (
                <div className="py-12 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
                  <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">Loading props...</p>
                </div>
              ) : propsData ? (
                <PRAProps 
                  props={propsData.props}
                  market={propsData.metadata.market}
                  onRefresh={() => refetchProps()}
                  isRefreshing={propsRefetching}
                  lastUpdated={propsData.lastUpdated}
                />
              ) : (
                <div className="py-12 text-center text-neutral-600 dark:text-neutral-400">
                  No props available
                </div>
              )}
            </div>
          )}

          {/* Historical Tab */}
          {activeTab === 'historical' && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
              <HistoricalBrowser />
            </div>
          )}

          {/* Advanced Stats Tab */}
          {activeTab === 'advanced' && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
              <AdvancedStatsPanel />
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/50 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">About PRA (Points + Rebounds + Assists)</h3>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            PRA is a combined stat that measures a player&apos;s total offensive production. 
            It&apos;s calculated by adding points, rebounds, and assists. This King of the Court 
            leaderboard tracks who&apos;s dominating the NBA each night with real-time updates.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <Flame className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">Elite Performance</div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">50+ PRA in a game</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Trophy className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">Legendary</div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">60+ PRA in a game</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ChevronUp className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="text-sm font-semibold">On Court</div>
                <div className="text-xs text-neutral-600 dark:text-neutral-400">Currently playing</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({
  isActive,
  onClick,
  icon,
  label,
  fullLabel,
  badge,
}: {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  fullLabel?: string;
  badge?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{fullLabel || label}</span>
      <span className="sm:hidden">{label}</span>
      {badge}
    </button>
  );
}
