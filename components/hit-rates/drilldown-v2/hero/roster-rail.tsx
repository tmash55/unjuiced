"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";
import { InjuryReportTooltipContent } from "@/components/hit-rates/injury-report-tooltip";
import { Tile } from "../shared/tile";

export type TeammateFilterMode = "with" | "without";
export interface TeammateFilter {
  playerId: string;
  mode: TeammateFilterMode;
  isOpponent?: boolean;
}

export interface RosterTeammate {
  playerId: string;
  name: string;
  position: string | null;
  injuryStatus: string | null;
  /** Free-form injury detail ("knee soreness", "GTD ankle"). Surfaced on
   *  hover over the status badge so users can read the actual reason. */
  injuryNotes: string | null;
  injuryUpdatedAt?: string | null;
  injuryReturnDate?: string | null;
  injurySource?: string | null;
  injuryRawStatus?: string | null;
  /** Team this player belongs to. Used to group/label rows when the rail
   *  shows BOTH the player's team and the opponent. */
  teamAbbr: string;
  /** True when this player is on the opponent team. Drives a subtle visual
   *  distinction so the user can tell which team a row belongs to. */
  isOpponent: boolean;
}

interface RosterRailProps {
  teammates: RosterTeammate[];
  filters: TeammateFilter[];
  onFilterToggle: (filter: TeammateFilter) => void;
  onClearFilters: () => void;
  isLoading?: boolean;
  className?: string;
  compact?: boolean;
}

const STATUS_TONE = (status: string | null) => {
  const s = (status ?? "").toLowerCase();
  if (s === "out")
    return {
      label: "OUT",
      className: "bg-red-500/15 text-red-600 dark:text-red-400",
    };
  if (s === "questionable" || s === "gtd" || s === "game time decision") {
    return {
      label: "GTD",
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  if (s === "doubtful")
    return { label: "DBT", className: "bg-red-500/10 text-red-500" };
  if (s === "probable")
    return {
      label: "PROB",
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    };
  return {
    label: "ACTIVE",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };
};

// Inline dot color for the row's status indicator. Returns null for active
// players (no dot rendered) so non-injured rows stay visually clean.
const STATUS_DOT = (status: string | null): string | null => {
  const s = (status ?? "").toLowerCase();
  if (s === "out") return "bg-red-500 dark:bg-red-400";
  if (s === "doubtful") return "bg-red-400 dark:bg-red-300";
  if (s === "questionable" || s === "gtd" || s === "game time decision") {
    return "bg-amber-500 dark:bg-amber-400";
  }
  if (s === "probable") return "bg-emerald-500 dark:bg-emerald-400";
  return null;
};

const isInjured = (status: string | null): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return s !== "active" && s !== "available";
};

// Human-readable status name for the hover card header. Maps the short
// abbreviations on the badge (OUT/GTD/DBT) back to their full meanings.
const fullStatusLabel = (status: string | null): string => {
  const s = (status ?? "").toLowerCase();
  if (s === "out") return "Out";
  if (s === "doubtful") return "Doubtful";
  if (s === "questionable" || s === "gtd" || s === "game time decision") {
    return "Game-time decision";
  }
  if (s === "probable") return "Probable";
  return "Status";
};

// Right-rail roster panel. Defaults to "Injured Only" — the practical default
// for a betting research view, props.cash style. Toggle in the header opens
// it back up to the full roster. Players from both the active player's team
// and the opponent are grouped together so the user gets a single injury
// report for the matchup.
export function RosterRail({
  teammates,
  filters,
  onFilterToggle,
  onClearFilters,
  isLoading,
  className,
  compact = false,
}: RosterRailProps) {
  const [mode, setMode] = useState<"injured" | "all">("injured");

  const injuredCount = useMemo(
    () => teammates.filter((t) => isInjured(t.injuryStatus)).length,
    [teammates],
  );

  const visible = useMemo(() => {
    const list =
      mode === "injured"
        ? teammates.filter((t) => isInjured(t.injuryStatus))
        : teammates;
    // Sort: injured first within each team (OUT > GTD > DBT > PROB > ACTIVE),
    // then by name. When showing both teams, preserve their grouping by
    // putting player team rows above opponent team rows.
    const statusRank = (status: string | null): number => {
      const s = (status ?? "").toLowerCase();
      if (s === "out") return 0;
      if (s === "doubtful") return 1;
      if (s === "questionable" || s === "gtd" || s === "game time decision")
        return 2;
      if (s === "probable") return 3;
      return 4;
    };
    return [...list].sort((a, b) => {
      if (a.isOpponent !== b.isOpponent) return a.isOpponent ? 1 : -1;
      const sr = statusRank(a.injuryStatus) - statusRank(b.injuryStatus);
      if (sr !== 0) return sr;
      return a.name.localeCompare(b.name);
    });
  }, [teammates, mode]);

  return (
    <Tile
      label={mode === "injured" ? "Injury Report" : "Roster & Injuries"}
      className={className}
      headerRight={
        <div className="flex items-center gap-2">
          {filters.length > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="hover:text-brand text-[10px] font-bold tracking-[0.12em] text-neutral-400 uppercase transition-colors dark:text-neutral-500"
            >
              Clear
            </button>
          )}
          <div className="flex items-center gap-0.5 rounded-md bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
            <ModeButton
              active={mode === "injured"}
              onClick={() => setMode("injured")}
            >
              <span className="inline-flex items-center gap-1">
                Injured
                {injuredCount > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1 text-[8px] font-black tabular-nums",
                      mode === "injured"
                        ? "bg-neutral-950/15 text-neutral-950"
                        : "bg-neutral-300/40 text-neutral-500 dark:bg-neutral-700/60 dark:text-neutral-300",
                    )}
                  >
                    {injuredCount}
                  </span>
                )}
              </span>
            </ModeButton>
            <ModeButton active={mode === "all"} onClick={() => setMode("all")}>
              All
            </ModeButton>
          </div>
        </div>
      }
    >
      <div
        className={cn(
          compact ? "flex h-full min-h-0 flex-col gap-3" : "space-y-3",
        )}
      >
        {/* Active With/Without filters now surface in the chart's "Active"
            row above the bars. Removed the duplicate chip block here. */}

        {/* Teammates list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-8 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800/60"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-3 text-center text-xs font-medium text-neutral-400 dark:text-neutral-500">
            {mode === "injured" ? "No injuries reported" : "Roster unavailable"}
          </div>
        ) : (
          <div
            className={cn(
              "space-y-1.5",
              compact &&
                "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700 min-h-0 flex-1 overflow-y-auto pr-1",
            )}
          >
            {visible.map((t) => {
              const withActive = filters.some(
                (f) =>
                  f.playerId === t.playerId &&
                  f.mode === "with" &&
                  Boolean(f.isOpponent) === t.isOpponent,
              );
              const withoutActive = filters.some(
                (f) =>
                  f.playerId === t.playerId &&
                  f.mode === "without" &&
                  Boolean(f.isOpponent) === t.isOpponent,
              );
              const dotClass = STATUS_DOT(t.injuryStatus);
              return (
                <div
                  key={t.playerId}
                  className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    {/* Status dot — inline with the name. Only renders for
                        injured players; hover surfaces the full status +
                        notes. Saves a row vs the old pill-on-second-line. */}
                    {dotClass && (
                      <Tooltip
                        side="top"
                        content={
                          <InjuryReportTooltipContent
                            playerName={t.name}
                            status={t.injuryStatus}
                            notes={t.injuryNotes}
                            updatedAt={t.injuryUpdatedAt}
                            returnDate={t.injuryReturnDate}
                            source={t.injurySource}
                            rawStatus={t.injuryRawStatus}
                          />
                        }
                        contentClassName="p-0"
                      >
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 cursor-help rounded-full",
                            dotClass,
                          )}
                          aria-label={fullStatusLabel(t.injuryStatus)}
                        />
                      </Tooltip>
                    )}
                    <span className="truncate text-[11px] font-bold text-neutral-900 dark:text-white">
                      {t.name}
                    </span>
                    {/* Team abbreviation — distinguishes player-team rows
                        from opponent-team rows when both are shown. */}
                    <span
                      className={cn(
                        "rounded-sm px-1 py-px text-[9px] font-black tracking-wide",
                        t.isOpponent
                          ? "bg-neutral-200/70 text-neutral-600 dark:bg-neutral-700/60 dark:text-neutral-300"
                          : "bg-brand/10 text-brand dark:bg-brand/15",
                      )}
                    >
                      {t.teamAbbr}
                    </span>
                    {t.position && (
                      <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                        {t.position}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
                    <ToggleButton
                      active={withActive}
                      onClick={() =>
                        onFilterToggle({
                          playerId: t.playerId,
                          mode: "with",
                          isOpponent: t.isOpponent,
                        })
                      }
                    >
                      With
                    </ToggleButton>
                    <ToggleButton
                      active={withoutActive}
                      onClick={() =>
                        onFilterToggle({
                          playerId: t.playerId,
                          mode: "without",
                          isOpponent: t.isOpponent,
                        })
                      }
                    >
                      W/O
                    </ToggleButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Tile>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase transition-all",
        active
          ? "bg-brand text-neutral-950 shadow-sm"
          : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100",
      )}
    >
      {children}
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase transition-all",
        active
          ? "bg-brand text-neutral-950 shadow-sm"
          : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100",
      )}
    >
      {children}
    </button>
  );
}
