'use client';

import { useNBASchedule } from '@/hooks/use-nba-schedule';
import { GameEvent } from '@/types/nba';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GameScheduleBarProps {
  onGameSelect?: (gameId: string | null) => void;
  selectedGameId?: string | null;
}

export function GameScheduleBar({ onGameSelect, selectedGameId }: GameScheduleBarProps) {
  const { events, connected, error } = useNBASchedule();

  if (error) {
    return (
      <div className="border-b border-border bg-muted/20 px-4 py-3">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!connected && events.length === 0) {
    return (
      <div className="border-b border-border bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading games...</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="border-b border-border bg-muted/20 px-4 py-3">
        <p className="text-sm text-muted-foreground">No games today</p>
      </div>
    );
  }

  // Sort: Live games first, then scheduled, then final
  const sortedEvents = [...events].sort((a, b) => {
    if (a.live && !b.live) return -1;
    if (!a.live && b.live) return 1;
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });

  return (
    <div className="border-b border-border bg-muted/20">
      <ScrollArea className="w-full">
        <div className="flex gap-2 px-4 py-3">
          {/* "All Games" filter button */}
          <button
            onClick={() => onGameSelect?.(null)}
            className={`flex-shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              selectedGameId === null
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-accent'
            }`}
          >
            All Games
          </button>

          {/* Individual game cards */}
          {sortedEvents.map((event) => (
            <GameCard
              key={event.eid}
              event={event}
              isSelected={selectedGameId === event.eid}
              onSelect={() => onGameSelect?.(event.eid)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function GameCard({
  event,
  isSelected,
  onSelect,
}: {
  event: GameEvent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isLive = event.live;
  const isFinal = !isLive && event.homeScore !== undefined;
  const isScheduled = !isLive && event.homeScore === undefined;

  return (
    <button
      onClick={onSelect}
      className={`flex-shrink-0 rounded-lg border px-4 py-2 text-left transition-colors ${
        isSelected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card hover:bg-accent'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Live indicator */}
        {isLive && (
          <span className="relative mt-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
          </span>
        )}

        <div className="space-y-1">
          {/* Teams */}
          <div className="text-sm font-semibold">
            {event.away.abbr} @ {event.home.abbr}
          </div>

          {/* Score or Time */}
          {isLive && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono font-bold">
                {event.awayScore}-{event.homeScore}
              </span>
              {event.period && event.clock && (
                <span className="text-muted-foreground">
                  Q{event.period} {event.clock}
                </span>
              )}
            </div>
          )}

          {isFinal && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono">
                {event.awayScore}-{event.homeScore}
              </span>
              <span className="text-muted-foreground">Final</span>
            </div>
          )}

          {isScheduled && (
            <div className="text-xs text-muted-foreground">
              {format(new Date(event.start), 'h:mm a')}
            </div>
          )}

          {/* Odds */}
          {(event.spread || event.total) && (
            <div className="flex gap-2 text-xs text-muted-foreground">
              {event.spread && <span>{event.spread}</span>}
              {event.total && <span>O/U {event.total}</span>}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

