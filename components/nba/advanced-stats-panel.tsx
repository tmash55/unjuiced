'use client';

import { useState } from 'react';
import { useAdvancedStats } from '@/hooks/use-nba-stats';
import { AdvancedStatType } from '@/types/nba';
import { FiltersBar } from '@/components/common/filters-bar';
import { cn } from '@/lib/utils';
import { Trophy, Zap, TrendingUp } from 'lucide-react';

export function AdvancedStatsPanel() {
  const [activeTab, setActiveTab] = useState<AdvancedStatType>('elite_club');

  const { data: eliteData, isLoading: eliteLoading } = useAdvancedStats('elite_club', 'latest', 20);
  const { data: efficiencyData, isLoading: efficiencyLoading } = useAdvancedStats('efficiency', 'latest', 20);
  const { data: praPerMinData, isLoading: praPerMinLoading } = useAdvancedStats('pra_per_min', 'latest', 20);

  const tabs = [
    { id: 'elite_club' as AdvancedStatType, label: 'Elite Club', icon: Trophy },
    { id: 'pra_per_min' as AdvancedStatType, label: 'PRA/Min', icon: Zap },
    { id: 'efficiency' as AdvancedStatType, label: 'Efficiency', icon: TrendingUp },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Advanced Stats</h2>
        <p className="text-sm text-muted-foreground">
          Elite performances, efficiency leaders, and more
        </p>
      </div>

      {/* Custom tabs styled like FiltersBar with purple accent */}
      <FiltersBar className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/80 dark:border-purple-800/80">
        <div className="flex gap-2 w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  'hover:bg-purple-100/80 dark:hover:bg-purple-900/40',
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white shadow-sm hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700'
                    : 'text-neutral-700 dark:text-neutral-300'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </FiltersBar>

      {/* Tab Content */}
      {activeTab === 'elite_club' && (
        <div className="mt-4 space-y-4">
          {eliteLoading && <LoadingState />}
          {eliteData && (
            <>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{eliteData.description}</p>
              <div className="space-y-2">
                {eliteData.players.map((player, index) => (
                  <div
                    key={`${player.player_name}-${player.game_date}`}
                    className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 font-bold text-purple-600 dark:text-purple-400">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{player.player_name}</span>
                          {player.tier === 'Legendary' && (
                            <Trophy className="h-4 w-4 text-yellow-500" />
                          )}
                          {player.tier === 'Elite' && (
                            <Zap className="h-4 w-4 text-purple-500" />
                          )}
                        </div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          {player.team_tricode} • {player.stat_line}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{player.pra}</div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400">PRA</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'pra_per_min' && (
        <div className="mt-4 space-y-4">
          {praPerMinLoading && <LoadingState />}
          {praPerMinData && (
            <>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{praPerMinData.description}</p>
              <div className="space-y-2">
                {praPerMinData.players.map((player, index) => (
                  <div
                    key={`${player.player_name}-${player.game_id}`}
                    className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 font-bold text-purple-600 dark:text-purple-400">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold">{player.player_name}</div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          {player.team_tricode} • {player.stat_line} • {player.minutes} min
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {player.pra_per_minute?.toFixed(2)}
                      </div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400">PRA/Min</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'efficiency' && (
        <div className="mt-4 space-y-4">
          {efficiencyLoading && <LoadingState />}
          {efficiencyData && (
            <>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{efficiencyData.description}</p>
              <div className="space-y-2">
                {efficiencyData.players.map((player, index) => (
                  <div
                    key={`${player.player_name}-${player.game_id}`}
                    className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 font-bold text-purple-600 dark:text-purple-400">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold">{player.player_name}</div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          {player.team_tricode} • {player.stat_line} • {player.fg_pct}% FG
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{player.pra}</div>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400">PRA</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading stats...</p>
      </div>
    </div>
  );
}

