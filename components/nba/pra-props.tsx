'use client';

import { useMemo } from 'react';
import { NBAProp } from '@/types/nba';
import { DollarSign, RefreshCw } from 'lucide-react';
import { Button } from '@/components/button';
import { createColumnHelper } from '@tanstack/react-table';
import { Table, useTable } from '@/components/table';
import { cn } from '@/lib/utils';
import { sportsbooks } from '@/lib/data/sportsbooks';

// Create sportsbook map for quick lookups
const SB_MAP = new Map(sportsbooks.map((sb) => [sb.id.toLowerCase(), sb]));
const norm = (s?: string) => (s || "").toLowerCase();

// Helper to get NBA team logo URL
const getTeamLogoUrl = (tricode: string): string => {
  if (!tricode) return '';
  return `/team-logos/nba/${tricode.toUpperCase()}.svg`;
};

interface PRAPropsProps {
  props: NBAProp[];
  market: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: string;
}

const columnHelper = createColumnHelper<NBAProp>();

export function PRAProps({ props, market, onRefresh, isRefreshing, lastUpdated }: PRAPropsProps) {
  // Format odds display
  const formatOdds = (odds: number | null | undefined) => {
    if (!odds || typeof odds !== 'number') return '-';
    if (odds > 0) return `+${odds}`;
    return odds.toString();
  };

  // Find best book to display (DraftKings first, then closest to -110)
  const findBestOdds = (prop: NBAProp) => {
    const books = prop.books;
    
    // If books is an object, convert to array of entries
    let bookEntries: [string, any][] = [];
    if (books && typeof books === 'object') {
      if (Array.isArray(books)) {
        bookEntries = books.map((b: any) => [b.bk || b.book || b.id || 'unknown', b]);
      } else {
        bookEntries = Object.entries(books);
      }
    }
    
    // First, check for DraftKings
    const dkEntry = bookEntries.find(([name]) => name.toLowerCase() === 'draftkings');
    if (dkEntry && dkEntry[1]?.over && dkEntry[1]?.under) {
      return {
        bookId: 'draftkings',
        book: 'DraftKings',
        over: dkEntry[1].over.price,
        under: dkEntry[1].under.price,
      };
    }
    
    // If no DraftKings, find book with odds closest to -110
    let closestBook = null;
    let smallestDiff = Infinity;
    
    for (const [bookName, bookData] of bookEntries) {
      if (!bookData?.over?.price || !bookData?.under?.price) continue;
      
      const avgOdds = (Math.abs(bookData.over.price + 110) + Math.abs(bookData.under.price + 110)) / 2;
      
      if (avgOdds < smallestDiff) {
        smallestDiff = avgOdds;
        closestBook = {
          bookId: bookName.toLowerCase(),
          book: bookName.charAt(0).toUpperCase() + bookName.slice(1),
          over: bookData.over.price,
          under: bookData.under.price,
        };
      }
    }
    
    return closestBook || { bookId: null, book: null, over: null, under: null };
  };

  const columns = useMemo(() => [
    columnHelper.accessor('player', {
      id: 'player',
      header: 'Player',
      size: 250,
      cell: (info) => {
        const prop = info.row.original;
        return (
          <div className="flex items-center gap-3">
            <img
              src={getTeamLogoUrl(prop.team)}
              alt={prop.team}
              className="w-6 h-6 object-contain shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                {prop.player}
              </div>
              <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                {prop.team}
              </div>
            </div>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'matchup',
      header: 'Matchup',
      size: 150,
      cell: (info) => {
        const prop = info.row.original;
        
        // Try to get matchup from ev block first, fallback to event string
        let matchup = '';
        let gameTime = '';
        
        if (prop.ev) {
          // Build matchup from ev data
          matchup = `${prop.ev.away.abbr} @ ${prop.ev.home.abbr}`;
          
          // Format the game time from dt (ISO string)
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
          // Fallback to parsing event string
          const parts = prop.event.split('•');
          matchup = parts[0]?.trim() || prop.event;
          gameTime = parts[1]?.trim() || '';
        }
        
        return (
          <div className="min-w-0">
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
              {matchup}
            </div>
            {gameTime && (
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                {gameTime}
              </div>
            )}
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
        );
      },
    }),
    columnHelper.accessor('line', {
      id: 'line',
      header: () => <div className="text-center">Line</div>,
      size: 80,
      cell: (info) => (
        <div className="text-center font-bold text-lg text-primary">
          {info.getValue()}
        </div>
      ),
    }),
  ], []);

  const tableProps = useTable({
    data: props,
    columns,
  });

  if (props.length === 0) {
    return (
      <div className="text-center py-16">
        <DollarSign className="h-12 w-12 text-neutral-400 dark:text-neutral-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Props Available</h3>
        <p className="text-neutral-600 dark:text-neutral-400">Props will appear when games are available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          Showing {props.length} PRA prop{props.length !== 1 ? 's' : ''} • Sorted by highest line
          {lastUpdated && (
            <span className="ml-2">
              • Updated {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
        {onRefresh && (
          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            variant="outline"
            className="gap-2 text-sm px-3 py-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>

      <div className="rounded-xl border-[2px] border-neutral-200 dark:border-neutral-700 overflow-hidden bg-white dark:bg-neutral-900 shadow-sm">
        <Table
          {...tableProps}
          className="w-full [&_td]:border-l [&_td]:border-b [&_td]:border-neutral-200 dark:[&_td]:border-neutral-700 [&_th]:border-l [&_th]:border-b [&_th]:border-neutral-200 dark:[&_th]:border-neutral-700"
          containerClassName="max-h-[calc(100vh-300px)] overflow-auto"
        />
      </div>
    </div>
  );
}
