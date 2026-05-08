"use client";

import {
  ArrowDown,
  CalendarClock,
  HeartPulse,
  Radio,
  Stethoscope,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InjuryReportTooltipData {
  playerName?: string | null;
  status?: string | null;
  notes?: string | null;
  updatedAt?: string | null;
  returnDate?: string | null;
  source?: string | null;
  rawStatus?: string | null;
}

export function hasReportableInjury(status?: string | null) {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return !["active", "available", "healthy"].includes(normalized);
}

export function isGLeagueAssignment(notes?: string | null) {
  if (!notes) return false;
  const normalized = notes.toLowerCase();
  return (
    normalized.includes("g league") ||
    normalized.includes("g-league") ||
    normalized.includes("gleague")
  );
}

export function formatInjuryStatus(
  status?: string | null,
  rawStatus?: string | null,
) {
  const value = rawStatus || status;
  if (!value) return "Status pending";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getInjuryStatusTone(
  status?: string | null,
  notes?: string | null,
) {
  if (isGLeagueAssignment(notes)) {
    return {
      icon: ArrowDown,
      labelClass: "text-sky-300",
      badgeClass: "border-sky-400/25 bg-sky-400/12 text-sky-200",
      railClass: "bg-sky-400",
      dotClass: "bg-sky-400",
    };
  }

  const normalized = status?.toLowerCase() ?? "";
  if (normalized === "out") {
    return {
      icon: HeartPulse,
      labelClass: "text-rose-300",
      badgeClass: "border-rose-400/25 bg-rose-400/12 text-rose-200",
      railClass: "bg-rose-400",
      dotClass: "bg-rose-400",
    };
  }
  if (
    normalized === "questionable" ||
    normalized === "doubtful" ||
    normalized === "gtd" ||
    normalized === "game time decision" ||
    normalized === "day_to_day"
  ) {
    return {
      icon: HeartPulse,
      labelClass: "text-amber-300",
      badgeClass: "border-amber-400/25 bg-amber-400/12 text-amber-200",
      railClass: "bg-amber-400",
      dotClass: "bg-amber-400",
    };
  }
  if (normalized === "probable") {
    return {
      icon: HeartPulse,
      labelClass: "text-emerald-300",
      badgeClass: "border-emerald-400/25 bg-emerald-400/12 text-emerald-200",
      railClass: "bg-emerald-400",
      dotClass: "bg-emerald-400",
    };
  }

  return {
    icon: HeartPulse,
    labelClass: "text-neutral-300",
    badgeClass: "border-neutral-500/30 bg-neutral-500/15 text-neutral-200",
    railClass: "bg-neutral-400",
    dotClass: "bg-neutral-400",
  };
}

function formatRelativeTimestamp(value?: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;

  const diffMs = Date.now() - timestamp;
  const tense = diffMs >= 0 ? "ago" : "from now";
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) return `just now`;
  if (absMs < hour) return `${Math.round(absMs / minute)}m ${tense}`;
  if (absMs < day) return `${Math.round(absMs / hour)}h ${tense}`;
  return `${Math.round(absMs / day)}d ${tense}`;
}

function formatExactTimestamp(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeNotes(notes?: string | null) {
  if (!notes)
    return {
      reportDate: null as string | null,
      body: null as string | null,
      returnDateFromNotes: null as string | null,
    };

  const returnMatch = notes.match(/\|\s*Return:\s*([^|]+)$/i);
  const withoutReturn = notes.replace(/\s*\|\s*Return:\s*[^|]+$/i, "").trim();
  const dateMatch = withoutReturn.match(
    /^([A-Z][a-z]{2,8}\s+\d{1,2}):\s*(.+)$/,
  );

  return {
    reportDate: dateMatch?.[1] ?? null,
    body: (dateMatch?.[2] ?? withoutReturn).trim() || null,
    returnDateFromNotes: returnMatch?.[1]?.trim() ?? null,
  };
}

function formatInjurySource(source?: string | null) {
  if (!source) return "Injury feed";
  const normalized = source.trim().toLowerCase();
  if (!normalized || normalized === "balldontlie") return "Injury feed";
  return formatInjuryStatus(source);
}

export function InjuryReportTooltipContent({
  playerName,
  status,
  notes,
  updatedAt,
  returnDate,
  source,
  rawStatus,
}: InjuryReportTooltipData) {
  const isGLeague = isGLeagueAssignment(notes);
  const tone = getInjuryStatusTone(status, notes);
  const Icon = isGLeague ? ArrowDown : tone.icon;
  const statusLabel = isGLeague
    ? "G League Assignment"
    : formatInjuryStatus(status, rawStatus);
  const { reportDate, body, returnDateFromNotes } = normalizeNotes(notes);
  const displayReturnDate = returnDate || returnDateFromNotes;
  const relativeUpdated = formatRelativeTimestamp(updatedAt);
  const exactUpdated = formatExactTimestamp(updatedAt);

  return (
    <div className="w-[330px] overflow-hidden rounded-xl bg-neutral-950 text-left text-neutral-100 shadow-2xl ring-1 ring-white/10">
      <div className={cn("h-1 w-full", tone.railClass)} />
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
              tone.badgeClass,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black tracking-[0.18em] text-neutral-500 uppercase">
                Injury Report
              </p>
              {relativeUpdated && (
                <span className="shrink-0 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-bold text-neutral-400">
                  {relativeUpdated}
                </span>
              )}
            </div>
            <p
              className={cn(
                "mt-1 text-sm leading-tight font-black",
                tone.labelClass,
              )}
            >
              {statusLabel}
              {playerName ? (
                <span className="text-neutral-300"> · {playerName}</span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.14em] text-neutral-500 uppercase">
            <Stethoscope className="h-3.5 w-3.5" />
            Latest Note
            {reportDate ? (
              <span className="tracking-normal text-neutral-600 normal-case">
                · {reportDate}
              </span>
            ) : null}
          </div>
          <p className="text-[12px] leading-relaxed font-medium text-pretty text-neutral-200">
            {body || "No additional detail has been reported yet."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ReportMetaItem
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label="Return"
            value={displayReturnDate || "TBD"}
          />
          <ReportMetaItem
            icon={<Radio className="h-3.5 w-3.5" />}
            label="Source"
            value={formatInjurySource(source)}
          />
        </div>

        {exactUpdated && (
          <div className="border-t border-neutral-800 pt-2 text-[10px] font-semibold text-neutral-500">
            Updated {exactUpdated}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportMetaItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[9px] font-black tracking-[0.14em] text-neutral-600 uppercase">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-[11px] font-bold text-neutral-300">
        {value}
      </div>
    </div>
  );
}
