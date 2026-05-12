"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import type { ArbRow } from "@/lib/arb-schema";
import { Tooltip } from "@/components/tooltip";
import { cn } from "@/lib/utils";

type ArbRiskKind = "prediction-over" | "injury";

type ArbRiskInfo = {
  kind: ArbRiskKind;
  label: string;
  title: string;
  body: string;
  details: string[];
};

function normalizeBook(id?: string): string {
  return String(id || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function titleCaseStatus(status?: string): string {
  const clean = String(status || "Injury")
    .replace(/[_-]+/g, " ")
    .trim();
  return clean.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getArbRiskInfo(row: ArbRow): ArbRiskInfo | null {
  const flags = new Set(row.risk_flags || []);
  const hasInjury = Boolean(row.inj);
  const overBook = normalizeBook(row.o?.bk);
  const overBookType = String(row.o?.bt || "").toLowerCase();
  const inferredPredictionOverRisk =
    hasInjury &&
    (overBookType === "prediction" ||
      overBook === "polymarket" ||
      overBook === "polymarketus");
  const hasPredictionOverRisk =
    flags.has("prediction_over_injury_risk") ||
    flags.has("polymarket_over_injury_risk") ||
    inferredPredictionOverRisk;

  if (!hasInjury && !hasPredictionOverRisk) return null;

  const status = titleCaseStatus(row.inj?.st);
  const player = row.inj?.name || row.ent || "This player";
  const teamPos = [row.inj?.team, row.inj?.pos].filter(Boolean).join(" ");
  const updated = formatDateTime(row.inj?.upd);
  const details = [
    row.inj?.notes,
    teamPos ? `${teamPos}` : null,
    row.inj?.src ? `Source: ${row.inj.src}` : null,
    updated ? `Updated: ${updated}` : null,
  ].filter(Boolean) as string[];

  if (hasPredictionOverRisk) {
    const isPolymarket =
      flags.has("polymarket_over_injury_risk") ||
      overBook === "polymarket" ||
      overBook === "polymarketus";
    return {
      kind: "prediction-over",
      label: isPolymarket ? "Polymarket injury risk" : "Prediction injury risk",
      title: `${isPolymarket ? "Polymarket" : "Prediction market"} over risk`,
      body: `${player} is ${status.toLowerCase()}. Some prediction markets can grade the over as a loss if the player is ruled out. Confirm the market rules before placing this arb.`,
      details,
    };
  }

  return {
    kind: "injury",
    label: status,
    title: `${status} injury tag`,
    body: `${player} has an injury designation. Double-check availability and book rules before placing both sides.`,
    details,
  };
}

function RiskTooltipContent({ info }: { info: ArbRiskInfo }) {
  return (
    <div className="max-w-[280px] p-3 text-left">
      <div className="text-sm font-semibold text-neutral-900 dark:text-white">
        {info.title}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
        {info.body}
      </p>
      {info.details.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-neutral-200 pt-2 text-[11px] leading-relaxed text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          {info.details.map((detail) => (
            <div key={detail}>{detail}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ArbRiskIndicator({
  row,
  variant = "badge",
  className,
}: {
  row: ArbRow;
  variant?: "badge" | "icon";
  className?: string;
}) {
  const info = getArbRiskInfo(row);
  if (!info) return null;

  const isPredictionRisk = info.kind === "prediction-over";
  const Icon = isPredictionRisk ? ShieldAlert : AlertTriangle;

  if (variant === "icon") {
    return (
      <Tooltip content={<RiskTooltipContent info={info} />}>
        <span
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
            isPredictionRisk
              ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
              : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25",
            className,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={<RiskTooltipContent info={info} />}>
      <span
        className={cn(
          "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-normal",
          isPredictionRisk
            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200"
            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
          className,
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{info.label}</span>
      </span>
    </Tooltip>
  );
}
