"use client";

import React, { useEffect, useState } from 'react';
import { getLadderAnalytics, type LadderUsageEvent } from '@/lib/ladder-tracking';
import { Loader2 } from 'lucide-react';

interface LadderAnalyticsStats {
  total: number;
  bySport: Record<string, number>;
  byMarket: Record<string, number>;
  topPlayers: Record<string, number>;
  topMarkets: Array<{ market: string; count: number }>;
}

interface LadderUsageRecord {
  sport: string;
  market: string;
  player_name: string | null;
  side: string | null;
  created_at: string;
}

export default function LadderAnalyticsPage() {
  const [stats, setStats] = useState<LadderAnalyticsStats | null>(null);
  const [records, setRecords] = useState<LadderUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [sportFilter, setSportFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    loadAnalytics();
  }, [sportFilter, startDate, endDate]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: {
        startDate?: string;
        endDate?: string;
        sport?: string;
      } = {};
      
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (sportFilter) params.sport = sportFilter;
      
      const data = await getLadderAnalytics(params);
      setStats(data.stats);
      setRecords(data.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
            Ladder Usage Analytics
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Track ladder builder usage for marketing insights
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 mb-6 border border-neutral-200 dark:border-neutral-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Sport
              </label>
              <select
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              >
                <option value="">All Sports</option>
                <option value="nfl">NFL</option>
                <option value="nba">NBA</option>
                <option value="nhl">NHL</option>
                <option value="mlb">MLB</option>
                <option value="ncaaf">NCAAF</option>
                <option value="ncaab">NCAAB</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-400">{error}</p>
          </div>
        ) : stats ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-neutral-200 dark:border-neutral-700">
                <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Total Usage
                </div>
                <div className="text-3xl font-bold text-neutral-900 dark:text-white">
                  {stats.total.toLocaleString()}
                </div>
              </div>
              
              {Object.entries(stats.bySport).map(([sport, count]) => (
                <div
                  key={sport}
                  className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-neutral-200 dark:border-neutral-700"
                >
                  <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    {sport.toUpperCase()}
                  </div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">
                    {count.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Top Markets */}
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 mb-6 border border-neutral-200 dark:border-neutral-700">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
                Top Markets
              </h2>
              <div className="space-y-2">
                {stats.topMarkets.length > 0 ? (
                  stats.topMarkets.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-md"
                    >
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        {item.market}
                      </span>
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {item.count} uses
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-neutral-500 dark:text-neutral-500">
                    No market data available
                  </p>
                )}
              </div>
            </div>

            {/* Top Players */}
            {Object.keys(stats.topPlayers).length > 0 && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 mb-6 border border-neutral-200 dark:border-neutral-700">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
                  Top Players
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(stats.topPlayers)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 15)
                    .map(([player, count]) => (
                      <div
                        key={player}
                        className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-md"
                      >
                        <span className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                          {player}
                        </span>
                        <span className="text-sm text-neutral-600 dark:text-neutral-400 ml-2">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent Records */}
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-neutral-200 dark:border-neutral-700">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
                Recent Usage ({records.length} shown)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        Sport
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        Market
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        Player
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                        Side
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length > 0 ? (
                      records.map((record, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-neutral-100 dark:border-neutral-700/50 hover:bg-neutral-50 dark:hover:bg-neutral-700/30"
                        >
                          <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                            {new Date(record.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-neutral-900 dark:text-white uppercase">
                            {record.sport}
                          </td>
                          <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">
                            {record.market}
                          </td>
                          <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">
                            {record.player_name || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-neutral-600 dark:text-neutral-400">
                            {record.side || '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-500">
                          No records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

