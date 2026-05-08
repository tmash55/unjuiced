"use client";

import React from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/tooltip";

interface LineStepperProps {
  /** The currently displayed line (custom value if user adjusted, otherwise default). */
  value: number;
  /** The prop's original line. Used to detect the "custom" state and offer a reset. */
  defaultValue: number;
  onChange: (value: number) => void;
  onReset: () => void;
  /** Step size — sports props always step by 0.5 unless told otherwise. */
  step?: number;
  min?: number;
  /** "default" = compact inline stepper. "hero" = oversized value with market cap above. */
  size?: "default" | "hero";
  /** Short market label shown above the value in hero mode (e.g. "PTS+REB", "3PM"). */
  marketLabel?: string;
}

// Premium +/- stepper for the prop line. Active "custom" state is brand-tinted
// with a subtle ring + reset affordance — clear visual diff from the default.
// Hero variant promotes the value to ~text-3xl/4xl with a market label cap, used
// in the drilldown command-bar so the line reads as the page's anchor metric.
export function LineStepper({
  value,
  defaultValue,
  onChange,
  onReset,
  step = 0.5,
  min = 0.5,
  size = "default",
  marketLabel,
}: LineStepperProps) {
  const isCustom = Math.abs(value - defaultValue) > 1e-6;
  const isHero = size === "hero";

  if (isHero) {
    return (
      <div className="grid grid-cols-[3rem_1.75rem_5rem_1.75rem_1.75rem] items-center gap-1.5">
        <span className="justify-self-end text-[10px] font-bold tracking-[0.16em] text-neutral-400 uppercase dark:text-neutral-500">
          {marketLabel}
        </span>
        <StepperButton
          icon="minus"
          onClick={() => onChange(Math.max(min, value - step))}
          ariaLabel="Decrease line"
        />
        <div
          className={cn(
            "inline-flex h-9 w-20 items-center justify-center rounded-lg transition-all duration-200",
            isCustom
              ? "bg-brand/10 ring-brand/30 dark:bg-brand/15 ring-1"
              : "bg-transparent ring-1 ring-transparent",
          )}
        >
          <span
            className={cn(
              "text-2xl leading-none font-black tracking-tight tabular-nums",
              isCustom ? "text-brand" : "text-neutral-900 dark:text-white",
            )}
          >
            {formatLine(value)}
          </span>
        </div>
        <StepperButton
          icon="plus"
          onClick={() => onChange(value + step)}
          ariaLabel="Increase line"
        />
        <span className="inline-flex h-7 w-7 items-center justify-center">
          {isCustom && (
            <Tooltip
              content={`Reset to ${formatLine(defaultValue)}`}
              side="top"
            >
              <button
                type="button"
                onClick={onReset}
                aria-label="Reset to default line"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 active:scale-95 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </Tooltip>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        aria-label="Decrease line"
        className={cn(
          "hover:border-brand/40 hover:text-brand dark:hover:text-brand inline-flex shrink-0 items-center justify-center rounded-md border border-neutral-200/80 bg-white text-neutral-500 shadow-sm transition-all active:scale-95 dark:border-neutral-700/80 dark:bg-neutral-900 dark:text-neutral-400",
          "h-8 w-8",
        )}
      >
        <Minus className="h-3 w-3" />
      </button>

      <div
        className={cn(
          "inline-flex items-baseline gap-1.5 rounded-lg transition-all duration-200",
          "px-3 py-1",
          isCustom
            ? "bg-brand/10 ring-brand/30 dark:bg-brand/15 ring-1"
            : "bg-transparent ring-1 ring-transparent",
        )}
      >
        <span className="text-xl leading-none font-black text-neutral-900 tabular-nums lg:text-2xl dark:text-white">
          {formatLine(value)}
        </span>
        <span className="text-[10px] font-bold tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-400">
          Line
        </span>
      </div>

      <button
        type="button"
        onClick={() => onChange(value + step)}
        aria-label="Increase line"
        className={cn(
          "hover:border-brand/40 hover:text-brand dark:hover:text-brand inline-flex shrink-0 items-center justify-center rounded-md border border-neutral-200/80 bg-white text-neutral-500 shadow-sm transition-all active:scale-95 dark:border-neutral-700/80 dark:bg-neutral-900 dark:text-neutral-400",
          "h-8 w-8",
        )}
      >
        <Plus className="h-3 w-3" />
      </button>

      {isCustom && (
        <Tooltip content={`Reset to ${formatLine(defaultValue)}`} side="top">
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset to default line"
            className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 active:scale-95 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function StepperButton({
  icon,
  onClick,
  ariaLabel,
}: {
  icon: "minus" | "plus";
  onClick: () => void;
  ariaLabel: string;
}) {
  const Icon = icon === "minus" ? Minus : Plus;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="hover:border-brand/40 hover:text-brand dark:hover:text-brand inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neutral-200/80 bg-white text-neutral-500 shadow-sm transition-all active:scale-95 dark:border-neutral-700/80 dark:bg-neutral-900 dark:text-neutral-400"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function formatLine(value: number): string {
  // Half points should always render with a trailing .5; whole numbers without.
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
