'use client';

import { useState } from 'react';
import { useAdvancedStats } from '@/hooks/use-nba-stats';
import { AdvancedStatType } from '@/types/nba';
import { FiltersBar } from '@/components/common/filters-bar';
import { cn, formatNBATime } from '@/lib/utils';
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

      {/* Custom tabs styled like FiltersBar with tertiary (purple) accent */}
      <FiltersBar className="bg-[color-mix(in_oklab,var(--tertiary)_5%,var(--card))] dark:bg-[color-mix(in_oklab,var(--tertiary)_8%,transparent)] border-[color-mix(in_oklab,var(--tertiary)_25%,var(--border))] dark:border-[color-mix(in_oklab,var(--tertiary)_20%,var(--border))]">
        <div className="flex flex-wrap gap-2 w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all shrink-0',
                  'hover:bg-[color-mix(in_oklab,var(--tertiary)_15%,var(--card))] dark:hover:bg-[color-mix(in_oklab,var(--tertiary)_20%,transparent)]',
                  activeTab === tab.id
                    ? 'bg-[var(--tertiary-strong)] text-white shadow-sm hover:bg-[var(--tertiary-strong)] dark:bg-[var(--tertiary)] dark:hover:bg-[var(--tertiary-strong)]'
                    : 'text-neutral-700 dark:text-neutral-300'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label === 'Elite Club' ? 'Elite' : tab.label}</span>
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--tertiary)_15%,var(--card))] dark:bg-[color-mix(in_oklab,var(--tertiary)_20%,transparent)] font-bold text-[var(--tertiary-strong)] dark:text-[var(--tertiary)]">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{player.player_name}</span>
                          {player.tier === 'Legendary' && (
                            <Trophy className="h-4 w-4 text-yellow-500" />
                          )}
                          {player.tier === 'Elite' && (
                            <Zap className="h-4 w-4 text-[var(--tertiary-strong)]" />
                          )}
                        </div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          {player.team_tricode} • {player.stat_line}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[var(--tertiary-strong)] dark:text-[var(--tertiary)]">{player.pra}</div>
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--tertiary)_15%,var(--card))] dark:bg-[color-mix(in_oklab,var(--tertiary)_20%,transparent)] font-bold text-[var(--tertiary-strong)] dark:text-[var(--tertiary)]">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold">{player.player_name}</div>
                        <div className="text-sm text-neutral-600 dark:text-neutral-400">
                          {player.team_tricode} • {player.stat_line} • {formatNBATime(player.minutes)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[var(--tertiary-strong)] dark:text-[var(--tertiary)]">
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--tertiary)_15%,var(--card))] dark:bg-[color-mix(in_oklab,var(--tertiary)_20%,transparent)] font-bold text-[var(--tertiary-strong)] dark:text-[var(--tertiary)]">
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
                      <div className="text-2xl font-bold text-[var(--tertiary-strong)] dark:text-[var(--tertiary)]">{player.pra}</div>
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--tertiary-strong)] border-t-transparent" />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Loading stats...</p>
      </div>
    </div>
  );
}

