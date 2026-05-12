"use client";

import React, { useMemo, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { motion } from "motion/react";
import { Table, useTable } from "@/components/table";
import { SportIcon } from "@/components/icons/sport-icons";
import { Tooltip } from "@/components/tooltip";
import { ArbRiskIndicator } from "@/components/arbs/arb-risk-indicator";
import {
  getSportsbookById,
  getSportsbookLogo,
  getSportsbookName,
} from "@/lib/data/sportsbooks";
import type { MiddleChangeMap } from "@/hooks/use-middles-view";
import type { MiddleLeg, MiddleRow } from "@/lib/middles-schema";
import { cn } from "@/lib/utils";
import { useStateLink } from "@/hooks/use-state-link";

type MiddleRowWithId = MiddleRow & {
  _id: string;
  _isNew?: boolean;
};

const columnHelper = createColumnHelper<MiddleRowWithId>();

function formatBps(bps?: number): string {
  const pct = Number(bps || 0) / 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function formatOdds(odds?: number): string {
  if (!Number.isFinite(Number(odds))) return "—";
  const n = Number(odds);
  return n > 0 ? `+${n}` : String(n);
}

function titleCase(value?: string): string {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\bplayer\b\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatEvent(row: MiddleRow): string {
  const away = row.ev?.away?.abbr || row.ev?.away?.name || "Away";
  const home = row.ev?.home?.abbr || row.ev?.home?.name || "Home";
  return `${away} @ ${home}`;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUpdated(value?: string | number): string {
  if (!value) return "—";
  const date =
    typeof value === "number"
      ? new Date(value > 10_000_000_000 ? value : value * 1000)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function sideLabel(side: "over" | "under", row: MiddleRow): string {
  const line = side === "over" ? row.lo : row.hi;
  return `${side === "over" ? "Over" : "Under"} ${line}`;
}

function legSelectionName(leg: MiddleLeg, row: MiddleRow): string {
  return leg.name || `${row.ent || titleCase(row.mkt)} ${formatOdds(leg.od)}`;
}

function normalizeBookInitials(book?: string): string {
  return String(book || "?")
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 3);
}

function BookLogo({
  bookId,
  className,
}: {
  bookId?: string;
  className?: string;
}) {
  const logo = getSportsbookLogo(bookId);
  if (logo) {
    return (
      <img
        src={logo}
        alt={getSportsbookName(bookId)}
        className={cn("h-6 w-6 rounded-md object-contain", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 text-[9px] font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
        className,
      )}
    >
      {normalizeBookInitials(bookId)}
    </span>
  );
}

function MetricPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber" | "rose" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-1.5",
        tone === "emerald" &&
          "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200",
        tone === "amber" &&
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200",
        tone === "rose" &&
          "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200",
        tone === "neutral" &&
          "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200",
      )}
    >
      <div className="text-[10px] font-medium text-current/65">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function LegButton({
  side,
  row,
  leg,
  change,
  onOpen,
}: {
  side: "over" | "under";
  row: MiddleRow;
  leg: MiddleLeg;
  change?: "up" | "down";
  onOpen: (leg: MiddleLeg) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(leg)}
      className={cn(
        "flex min-w-[180px] items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-left transition hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700 dark:hover:bg-neutral-900",
        change === "up" && "bg-emerald-50 dark:bg-emerald-500/10",
        change === "down" && "bg-rose-50 dark:bg-rose-500/10",
      )}
    >
      <BookLogo bookId={leg.bk} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-neutral-900 dark:text-white">
          {getSportsbookName(leg.bk)}
        </span>
        <span className="block truncate font-mono text-xs text-neutral-500 dark:text-neutral-400">
          {sideLabel(side, row)} · {formatOdds(leg.od)}
        </span>
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
    </button>
  );
}

function MiddleExpandedSubRow({
  row,
  colSpan,
  onOpen,
}: {
  row: MiddleRowWithId;
  colSpan: number;
  onOpen: (leg: MiddleLeg) => void;
}) {
  const overStake = Number(row.stake?.o_bps ?? 5000) / 100;
  const underStake = Number(row.stake?.u_bps ?? 5000) / 100;
  const isPredictionOver =
    String(row.o?.bt || "").toLowerCase() === "prediction" ||
    /polymarket|kalshi/i.test(row.o?.bk || "");
  const hasPredictionInjuryRisk = Boolean(row.inj && isPredictionOver);

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <td
        colSpan={colSpan}
        className="border-b border-neutral-200 bg-neutral-50/80 p-0 dark:border-neutral-800 dark:bg-neutral-950/70"
      >
        <div className="grid gap-4 p-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {row.ent || formatEvent(row)}
                </div>
                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {titleCase(row.mkt)} · middle window {row.lo} to {row.hi}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <MetricPill
                  label="Middle hit"
                  value={formatBps(row.middle_bps)}
                  tone="emerald"
                />
                <MetricPill
                  label="If missed"
                  value={formatBps(row.worst_case_bps)}
                  tone={row.worst_case_bps < 0 ? "amber" : "neutral"}
                />
                <MetricPill label="Score" value={formatBps(row.score_bps)} />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <MetricPill
                label={`Below ${row.lo}`}
                value={formatBps(row.low_side_bps ?? row.worst_case_bps)}
                tone={
                  (row.low_side_bps ?? row.worst_case_bps) < 0
                    ? "amber"
                    : "neutral"
                }
              />
              <MetricPill
                label={`${row.lo} to ${row.hi}`}
                value={formatBps(row.middle_bps)}
                tone="emerald"
              />
              <MetricPill
                label={`Above ${row.hi}`}
                value={formatBps(row.high_side_bps ?? row.worst_case_bps)}
                tone={
                  (row.high_side_bps ?? row.worst_case_bps) < 0
                    ? "amber"
                    : "neutral"
                }
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-neutral-600 dark:text-neutral-300">
                  Suggested stake split
                </span>
                <span className="font-mono text-neutral-500 dark:text-neutral-400">
                  Over {overStake.toFixed(1)}% / Under {underStake.toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="bg-emerald-500"
                  style={{ width: `${Math.max(0, Math.min(100, overStake))}%` }}
                />
                <div
                  className="bg-neutral-400 dark:bg-neutral-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, underStake))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ["over", row.o],
                ["under", row.u],
              ].map(([side, leg]) => (
                <button
                  key={side as string}
                  type="button"
                  onClick={() => onOpen(leg as MiddleLeg)}
                  className="flex items-center gap-3 rounded-md border border-neutral-200 bg-white p-3 text-left transition hover:border-neutral-300 hover:bg-neutral-50 active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
                >
                  <BookLogo
                    bookId={(leg as MiddleLeg).bk}
                    className="h-8 w-8"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-white">
                      {getSportsbookName((leg as MiddleLeg).bk)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {legSelectionName(leg as MiddleLeg, row)}
                    </span>
                    <span className="mt-1 block font-mono text-xs font-semibold text-neutral-900 dark:text-white">
                      {formatOdds((leg as MiddleLeg).od)}
                      {(leg as MiddleLeg).max != null
                        ? ` · max $${(leg as MiddleLeg).max}`
                        : ""}
                    </span>
                  </span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-neutral-400" />
                </button>
              ))}
            </div>

            {(row.inj || row.risk_flags?.length) && (
              <div
                className={cn(
                  "rounded-md border p-3 text-xs",
                  hasPredictionInjuryRisk
                    ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200"
                    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200",
                )}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {hasPredictionInjuryRisk ? (
                    <ShieldAlert className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  {hasPredictionInjuryRisk
                    ? "Prediction market over risk"
                    : "Injury context"}
                </div>
                <p className="mt-1.5 leading-relaxed">
                  {hasPredictionInjuryRisk
                    ? "The over leg is a prediction market and this player has an injury designation. Some markets can grade the over as a loss if the player is ruled out, so confirm the market rules before placing this middle."
                    : `${row.inj?.name || row.ent || "This player"} is tagged ${String(row.inj?.st || "injured").replace(/_/g, " ")}. Double-check availability before betting both sides.`}
                </p>
                {row.inj?.notes && (
                  <p className="mt-1 opacity-80">{row.inj.notes}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </motion.tr>
  );
}

export function MiddlesTable({
  rows,
  ids,
  changes,
  added,
}: {
  rows: MiddleRow[];
  ids: string[];
  changes: MiddleChangeMap;
  added?: Set<string>;
}) {
  const applyState = useStateLink();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const data = useMemo(
    () =>
      rows.map((row, index) => ({
        ...row,
        _id: ids[index] || `${row.eid}:${row.pair}:${row.mkt}:${index}`,
        _isNew: added?.has(ids[index]),
      })),
    [added, ids, rows],
  );

  const openLeg = React.useCallback(
    (leg: MiddleLeg) => {
      const fallback = getSportsbookById(leg.bk)?.links?.desktop;
      const target = leg.u || leg.m || fallback;
      if (!target) return;
      const resolved = applyState(target) || target;
      window.open(
        resolved,
        "_blank",
        "noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes",
      );
    },
    [applyState],
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "expand",
        header: "",
        size: 44,
        cell: ({ row }) => {
          const id = row.original._id;
          const expanded = expandedRows.has(id);
          return (
            <ChevronRight
              className={cn(
                "h-4 w-4 text-neutral-400 transition-transform",
                expanded && "rotate-90 text-neutral-700 dark:text-neutral-200",
              )}
            />
          );
        },
      }),
      columnHelper.accessor((row) => row.sp || row.lg?.id || "", {
        id: "league",
        header: "League",
        minSize: 96,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <SportIcon
              sport={row.original.sp || row.original.lg?.id || ""}
              className="h-4 w-4"
            />
            <span className="font-medium text-neutral-700 uppercase dark:text-neutral-200">
              {row.original.lg?.id || row.original.sp || "—"}
            </span>
            {row.original.ev?.live && (
              <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-300">
                Live
              </span>
            )}
          </div>
        ),
      }),
      columnHelper.display({
        id: "event",
        header: "Event",
        minSize: 180,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-neutral-900 dark:text-white">
              {formatEvent(row.original)}
            </div>
            <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              {formatDate(row.original.ev?.dt)}
            </div>
          </div>
        ),
      }),
      columnHelper.display({
        id: "market",
        header: "Market",
        minSize: 220,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-neutral-900 dark:text-white">
                {row.original.ent || titleCase(row.original.mkt)}
              </span>
              <ArbRiskIndicator row={row.original as any} variant="icon" />
            </div>
            <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              {titleCase(row.original.mkt)} · {row.original.lo} to{" "}
              {row.original.hi}
            </div>
          </div>
        ),
      }),
      columnHelper.display({
        id: "middle",
        header: "Middle",
        minSize: 170,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <div className="text-[10px] font-medium opacity-75">
                Middle hit
              </div>
              <div className="font-mono text-sm font-bold tabular-nums">
                {formatBps(row.original.middle_bps)}
              </div>
            </div>
            <Tooltip content="Line gap between the over and under legs">
              <div className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                gap {row.original.gap}
              </div>
            </Tooltip>
          </div>
        ),
      }),
      columnHelper.display({
        id: "miss",
        header: "Miss",
        minSize: 130,
        cell: ({ row }) => (
          <div
            className={cn(
              "inline-flex rounded-md px-2 py-1 font-mono text-sm font-semibold tabular-nums",
              row.original.worst_case_bps < 0
                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
            )}
          >
            {formatBps(row.original.worst_case_bps)}
          </div>
        ),
      }),
      columnHelper.display({
        id: "legs",
        header: "Odds",
        minSize: 390,
        cell: ({ row }) => {
          const change = changes.get(row.original._id);
          return (
            <div className="flex items-center gap-2">
              <LegButton
                side="over"
                row={row.original}
                leg={row.original.o}
                change={change?.o}
                onOpen={openLeg}
              />
              <LegButton
                side="under"
                row={row.original}
                leg={row.original.u}
                change={change?.u}
                onOpen={openLeg}
              />
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "age",
        header: "Age",
        minSize: 90,
        cell: ({ row }) => (
          <div className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
            {formatUpdated(
              row.original.lu || row.original.ls || row.original.ts,
            )}
          </div>
        ),
      }),
    ],
    [changes, expandedRows, openLeg],
  );

  const tableProps = useTable({
    data,
    columns,
    getRowId: (row) => row._id,
    initialSorting: [{ id: "middle", desc: true }],
    onRowClick: (row) => {
      const id = row.original._id;
      setExpandedRows((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    rowProps: (row) => ({
      className: cn(
        row.original._isNew &&
          "[&_td]:bg-emerald-50/60 dark:[&_td]:bg-emerald-500/10",
        expandedRows.has(row.original._id) &&
          "[&_td]:bg-neutral-50 dark:[&_td]:bg-neutral-900/60",
      ),
    }),
    renderSubRow: (row, visibleColumnCount) =>
      expandedRows.has(row.original._id) ? (
        <MiddleExpandedSubRow
          row={row.original}
          colSpan={visibleColumnCount}
          onOpen={openLeg}
        />
      ) : null,
    emptyState: (
      <div className="flex flex-col items-center gap-3 px-4 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
          <SlidersHorizontal className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold text-neutral-900 dark:text-white">
            No middles match these filters
          </div>
          <p className="mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
            Try lowering the minimum gap or widening the miss-side loss filter.
          </p>
        </div>
      </div>
    ),
    containerClassName: "rounded-lg",
    thClassName: "bg-neutral-50 dark:bg-neutral-950",
  });

  return <Table {...tableProps} />;
}
