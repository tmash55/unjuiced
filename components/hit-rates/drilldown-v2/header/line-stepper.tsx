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
}

// Premium +/- stepper for the prop line. Active "custom" state is brand-tinted
// with a subtle ring + reset affordance — clear visual diff from the default.
// Buttons get a press-feel via `active:scale-95` + brand-tint on hover.
export function LineStepper({
  value,
  defaultValue,
  onChange,
  onReset,
  step = 0.5,
  min = 0.5,
}: LineStepperProps) {
  const isCustom = Math.abs(value - defaultValue) > 1e-6;

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        aria-label="Decrease line"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200/80 bg-white text-neutral-500 shadow-sm transition-all hover:border-brand/40 hover:text-brand active:scale-95 dark:border-neutral-700/80 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-brand"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <div
        className={cn(
          "inline-flex items-baseline gap-1.5 rounded-lg px-3 py-1 transition-all duration-200",
          isCustom
            ? "bg-brand/10 ring-1 ring-brand/30 dark:bg-brand/15"
            : "bg-transparent ring-1 ring-transparent"
        )}
      >
        <span className="text-xl font-black leading-none tabular-nums text-neutral-900 dark:text-white lg:text-2xl">
          {formatLine(value)}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
          Line
        </span>
      </div>

      <button
        type="button"
        onClick={() => onChange(value + step)}
        aria-label="Increase line"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-200/80 bg-white text-neutral-500 shadow-sm transition-all hover:border-brand/40 hover:text-brand active:scale-95 dark:border-neutral-700/80 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-brand"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {isCustom && (
        <Tooltip content={`Reset to ${formatLine(defaultValue)}`} side="top">
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset to default line"
            className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 active:scale-95 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function formatLine(value: number): string {
  // Half points should always render with a trailing .5; whole numbers without.
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
