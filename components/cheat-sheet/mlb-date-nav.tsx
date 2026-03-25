"use client";

import { useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useMlbGameDates } from "@/hooks/use-mlb-game-dates";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getTodayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

interface MlbDateNavProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  /** Override available dates instead of fetching from mlb_games */
  availableDates?: string[];
}

export function MlbDateNav({ selectedDate, onDateChange, availableDates: externalDates }: MlbDateNavProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const gameDates = useMlbGameDates();
  const availableDates = externalDates ?? gameDates;

  let currentIdx = availableDates.indexOf(selectedDate);
  if (currentIdx === -1) {
    currentIdx = availableDates.findIndex((d) => d > selectedDate);
    if (currentIdx === -1) currentIdx = availableDates.length;
  }

  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < availableDates.length - 1;

  const goPrev = () => {
    if (hasPrev) onDateChange(availableDates[currentIdx - 1]);
  };
  const goNext = () => {
    if (currentIdx < availableDates.length - 1) {
      onDateChange(availableDates[currentIdx + 1]);
    } else if (currentIdx === availableDates.length && availableDates.length > 0) {
      onDateChange(availableDates[availableDates.length - 1]);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={goPrev}
        disabled={!hasPrev}
        className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4 text-neutral-500" />
      </button>
      <button
        onClick={() => dateInputRef.current?.showPicker()}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
        {formatShortDate(selectedDate)}
      </button>
      <input
        ref={dateInputRef}
        type="date"
        value={selectedDate}
        min={getTodayET()}
        onChange={(e) => {
          if (e.target.value) onDateChange(e.target.value);
        }}
        className="sr-only"
        tabIndex={-1}
      />
      <button
        onClick={goNext}
        disabled={!hasNext}
        className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4 text-neutral-500" />
      </button>
    </div>
  );
}
