"use client";

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tile } from "../shared/tile";

export type TeammateFilterMode = "with" | "without";
export interface TeammateFilter {
  playerId: string;
  mode: TeammateFilterMode;
}

export interface RosterTeammate {
  playerId: string;
  name: string;
  position: string | null;
  injuryStatus: string | null;
}

interface RosterRailProps {
  teammates: RosterTeammate[];
  filters: TeammateFilter[];
  onFilterToggle: (filter: TeammateFilter) => void;
  onClearFilters: () => void;
  isLoading?: boolean;
}

const STATUS_TONE = (status: string | null) => {
  const s = (status ?? "").toLowerCase();
  if (s === "out") return { label: "OUT", className: "bg-rose-500/15 text-rose-600 dark:text-rose-400" };
  if (s === "questionable" || s === "gtd" || s === "game time decision") {
    return { label: "GTD", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  }
  if (s === "doubtful") return { label: "DBT", className: "bg-rose-500/10 text-rose-500" };
  if (s === "probable") return { label: "PROB", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  return { label: "ACTIVE", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
};

// Right-rail roster panel. Each teammate row exposes With / Without toggle
// pills — clicking either filters the chart + summary strip to games matching
// that teammate's playing status. Active filters surface as removable chips
// at the top so power users can manage the stack quickly.
export function RosterRail({
  teammates,
  filters,
  onFilterToggle,
  onClearFilters,
  isLoading,
}: RosterRailProps) {
  return (
    <Tile
      label="Roster & Injuries"
      headerRight={
        filters.length > 0 ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400 transition-colors hover:text-brand dark:text-neutral-500"
          >
            Clear
          </button>
        ) : null
      }
    >
      <div className="space-y-3">
        {/* Active filters */}
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {filters.map((f) => {
              const teammate = teammates.find((t) => t.playerId === f.playerId);
              if (!teammate) return null;
              return (
                <button
                  key={f.playerId}
                  type="button"
                  onClick={() => onFilterToggle(f)}
                  className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand ring-1 ring-brand/20 transition-colors hover:bg-brand/15"
                >
                  <span className="uppercase tracking-wider">
                    {f.mode === "with" ? "With" : "W/O"}
                  </span>
                  <span>{lastName(teammate.name)}</span>
                  <X className="h-3 w-3 opacity-70" />
                </button>
              );
            })}
          </div>
        )}

        {/* Teammates list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-800/60" />
            ))}
          </div>
        ) : teammates.length === 0 ? (
          <div className="py-3 text-center text-xs font-medium text-neutral-400 dark:text-neutral-500">
            Roster unavailable
          </div>
        ) : (
          <div className="space-y-1.5">
            {teammates.map((t) => {
              const tone = STATUS_TONE(t.injuryStatus);
              const withActive = filters.some(
                (f) => f.playerId === t.playerId && f.mode === "with"
              );
              const withoutActive = filters.some(
                (f) => f.playerId === t.playerId && f.mode === "without"
              );
              return (
                <div
                  key={t.playerId}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] font-bold text-neutral-900 dark:text-white">
                        {t.name}
                      </span>
                      {t.position && (
                        <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                          {t.position}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 inline-flex items-center rounded-sm px-1 py-px text-[8px] font-black uppercase tracking-[0.12em]",
                        tone.className
                      )}
                    >
                      {tone.label}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-neutral-100/80 p-0.5 dark:bg-neutral-800/60">
                    <ToggleButton
                      active={withActive}
                      onClick={() =>
                        onFilterToggle({ playerId: t.playerId, mode: "with" })
                      }
                    >
                      With
                    </ToggleButton>
                    <ToggleButton
                      active={withoutActive}
                      onClick={() =>
                        onFilterToggle({ playerId: t.playerId, mode: "without" })
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
        "rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider transition-all",
        active
          ? "bg-brand text-neutral-950 shadow-sm"
          : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
      )}
    >
      {children}
    </button>
  );
}

function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
}
