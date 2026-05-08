"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import { BarChart3, Check, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  LineHistoryApiRequest,
  LineHistoryBookData,
  LineHistoryContext,
} from "@/lib/odds/line-history";

type LineMovementSide = "over" | "under";

interface InlineLineMovementCardProps {
  sport: string;
  eventId: string | null;
  market: string;
  marketDisplay?: string | null;
  playerName?: string | null;
  team?: string | null;
  activeLine: number | null;
  lines: number[];
  selectedBookId: string | null;
  selectedSide: LineMovementSide;
  selectedPrice: number | null;
  bestPrice?: number | null;
  bookIds: string[];
  selectionMode?: "over-under" | "yes-no";
  currentPricesByBook?: Record<string, number>;
  oddIdsByBook?: Record<string, string>;
  onBookChange: (book: string | null) => void;
  onLineChange: (line: number) => void;
  onSideChange: (side: LineMovementSide) => void;
  onOpenFull?: (context: LineHistoryContext) => void;
  className?: string;
}

export function InlineLineMovementCard({
  sport,
  eventId,
  market,
  marketDisplay,
  playerName,
  team,
  activeLine,
  lines,
  selectedBookId,
  selectedSide,
  selectedPrice,
  bestPrice = null,
  bookIds,
  selectionMode = "over-under",
  currentPricesByBook = {},
  oddIdsByBook = {},
  onBookChange,
  onLineChange,
  onSideChange,
  onOpenFull,
  className,
}: InlineLineMovementCardProps) {
  const [movementData, setMovementData] =
    useState<LineHistoryBookData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const selectedBookName =
    selectedBookId ? getBookDisplayName(selectedBookId) : null;

  const context = useMemo<LineHistoryContext | null>(() => {
    if (!eventId || activeLine === null) return null;

    const bestBookId = selectedBookId ?? bookIds[0] ?? null;
    const compareBookIds = [
      selectedBookId,
      ...bookIds.filter((book) => book !== selectedBookId),
    ].filter((book): book is string => !!book);

    return {
      source: "edge",
      sport,
      eventId,
      market,
      marketDisplay,
      side:
        selectionMode === "yes-no"
          ? selectedSide === "over"
            ? "yes"
            : "no"
          : selectedSide,
      line: activeLine,
      playerName: playerName ?? undefined,
      team: team ?? undefined,
      bestBookId,
      compareBookIds,
      allBookIds: bookIds,
      currentPricesByBook,
      oddIdsByBook,
    };
  }, [
    activeLine,
    bookIds,
    currentPricesByBook,
    eventId,
    market,
    marketDisplay,
    oddIdsByBook,
    playerName,
    selectedBookId,
    selectedSide,
    selectionMode,
    sport,
    team,
  ]);

  useEffect(() => {
    if (!context || !selectedBookId) {
      setMovementData(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const payload: LineHistoryApiRequest = {
      context,
      books: [selectedBookId],
    };

    fetch("/api/v2/odds/line-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load line movement");
        return res.json() as Promise<{ books?: LineHistoryBookData[] }>;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setMovementData(data.books?.[0] ?? null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setMovementData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [context, selectedBookId]);

  const entries = useMemo(
    () =>
      [...(movementData?.entries ?? [])]
        .filter((entry) => typeof entry.price === "number")
        .sort((a, b) => a.timestamp - b.timestamp),
    [movementData?.entries],
  );

  const firstPrice = entries[0]?.price ?? movementData?.olv.price ?? null;
  const lastPrice =
    movementData?.currentPrice ??
    entries[entries.length - 1]?.price ??
    selectedPrice ??
    bestPrice ??
    null;
  const lowPrice =
    entries.length > 0
      ? Math.min(...entries.map((entry) => entry.price))
      : lastPrice;
  const move =
    firstPrice !== null && lastPrice !== null
      ? getAmericanOddsMove(firstPrice, lastPrice)
      : null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-neutral-200/70 bg-gradient-to-br from-white via-neutral-50/40 to-neutral-50/70 shadow-sm ring-1 ring-black/[0.03] dark:border-neutral-800/70 dark:from-neutral-900/80 dark:via-neutral-900/55 dark:to-neutral-950/45 dark:ring-white/[0.03]",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-neutral-200/70 px-3 py-2.5 dark:border-neutral-800/70">
        <div className="text-[10px] font-black tracking-[0.16em] text-neutral-600 uppercase dark:text-neutral-400">
          Line Movement
        </div>
        <button
          type="button"
          onClick={() => context && onOpenFull?.(context)}
          disabled={!context || !selectedBookId}
          className="flex items-center gap-1 rounded-lg border border-neutral-200/80 bg-neutral-50/80 px-2 py-1 text-[10px] font-black tracking-[0.12em] text-neutral-500 uppercase transition-all hover:text-neutral-900 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-800/80 dark:bg-neutral-950/60 dark:text-neutral-400 dark:hover:text-white"
        >
          Full
          <BarChart3 className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-3 p-3">
        <div className="grid grid-cols-[1fr_74px_72px] items-center gap-2">
          <div className="min-w-0">
            <div className="mb-1 text-[9px] font-black tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-500">
              Book
            </div>
            <BookDropdown
              books={bookIds}
              selectedBookId={selectedBookId}
              onChange={onBookChange}
            />
          </div>

          <label>
            <div className="mb-1 text-[9px] font-black tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-500">
              Line
            </div>
            <select
              value={activeLine ?? ""}
              onChange={(event) => onLineChange(Number(event.target.value))}
              className="h-9 w-full rounded-lg border border-neutral-200/80 bg-neutral-50/80 px-2 text-xs font-black text-neutral-950 outline-none transition-colors hover:border-neutral-300 dark:border-neutral-800/80 dark:bg-neutral-950/60 dark:text-white"
            >
              {lines.map((line) => (
                <option key={line} value={line}>
                  {formatDecimal(line)}+
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="mb-1 text-[9px] font-black tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-500">
              Side
            </div>
            <select
              value={selectedSide}
              onChange={(event) =>
                onSideChange(event.target.value as LineMovementSide)
              }
              className="h-9 w-full rounded-lg border border-neutral-200/80 bg-neutral-50/80 px-2 text-xs font-black text-neutral-950 outline-none transition-colors hover:border-neutral-300 dark:border-neutral-800/80 dark:bg-neutral-950/60 dark:text-white"
            >
              <option value="over">
                {selectionMode === "yes-no" ? "Y" : "O"}
              </option>
              <option value="under">
                {selectionMode === "yes-no" ? "N" : "U"}
              </option>
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-neutral-200/70 bg-gradient-to-br from-neutral-50 via-white/40 to-neutral-50/80 p-3 shadow-inner dark:border-neutral-800/70 dark:from-neutral-950/60 dark:via-neutral-900/40 dark:to-neutral-950/70">
          <MiniLineMovementChart
            entries={entries}
            isLoading={isLoading}
            currentPrice={lastPrice}
          />

          <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg border border-neutral-200/70 dark:border-neutral-800/70">
            <LineMovementStat label="Open" value={formatOdds(firstPrice)} />
            <LineMovementStat label="Last" value={formatOdds(lastPrice)} />
            <LineMovementStat
              label="Move"
              value={formatSignedMove(move)}
              tone={move !== null && move >= 0 ? "up" : "down"}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-black tracking-[0.14em] uppercase">
            <span className="text-neutral-500 dark:text-neutral-500">
              Low{" "}
              <span className="text-neutral-800 tabular-nums dark:text-neutral-200">
                {formatOdds(lowPrice)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-brand">
              <CheckCircle2 className="h-3 w-3" />
              {entries.length} Line {entries.length === 1 ? "Entry" : "Entries"}
            </span>
          </div>
        </div>

        <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-500">
          Synced to live {selectedBookName ?? "book"} price{" "}
          <span className="font-black text-neutral-800 tabular-nums dark:text-neutral-200">
            {formatOdds(selectedPrice ?? bestPrice ?? null)}
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniLineMovementChart({
  entries,
  currentPrice,
  isLoading,
}: {
  entries: Array<{ price: number; timestamp: number }>;
  currentPrice: number | null;
  isLoading: boolean;
}) {
  const gradientId = `line-move-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  if (isLoading) {
    return (
      <div className="h-[150px] animate-pulse rounded-lg bg-neutral-200/60 dark:bg-neutral-800/60" />
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-[150px] items-center justify-center rounded-lg border border-dashed border-neutral-200 text-xs font-bold text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
        No line movement yet.
      </div>
    );
  }

  const width = 292;
  const height = 150;
  const padX = 28;
  const padTop = 14;
  const padBottom = 28;
  const prices = [
    ...entries.map((entry) => entry.price),
    ...(currentPrice !== null ? [currentPrice] : []),
  ];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(1, max - min);
  const firstTs = entries[0].timestamp;
  const lastTs = entries[entries.length - 1].timestamp;
  const tsSpan = Math.max(1, lastTs - firstTs);
  const y = (price: number) =>
    padTop + ((max - price) / span) * (height - padTop - padBottom);
  const x = (timestamp: number) =>
    padX + ((timestamp - firstTs) / tsSpan) * (width - padX * 2);
  const points = entries.map((entry) => [x(entry.timestamp), y(entry.price)]);
  const linePath = points
    .map(([px, py], index) => `${index === 0 ? "M" : "L"} ${px} ${py}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${
    height - padBottom
  } L ${points[0][0]} ${height - padBottom} Z`;
  const yTicks = Array.from(new Set([max, Math.round((max + min) / 2), min]));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[150px] w-full">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={padX}
            x2={width - padX}
            y1={y(tick)}
            y2={y(tick)}
            stroke="currentColor"
            className="text-neutral-200 dark:text-neutral-800"
            strokeDasharray="2 2"
          />
          <text
            x={4}
            y={y(tick) + 4}
            className="fill-neutral-400 text-[9px] font-bold dark:fill-neutral-500"
          >
            {formatOdds(tick)}
          </text>
        </g>
      ))}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke="rgb(16 185 129)" strokeWidth="2.5" />
      {points.map(([px, py], index) => (
        <circle
          key={`${px}-${py}-${index}`}
          cx={px}
          cy={py}
          r={index === points.length - 1 ? 4 : 3}
          fill="rgb(16 185 129)"
          stroke="rgb(15 23 42)"
          strokeWidth="1.5"
        />
      ))}
      <text
        x={padX}
        y={height - 8}
        className="fill-neutral-400 text-[9px] font-black dark:fill-neutral-500"
      >
        {compactTimeAgo(firstTs)}
      </text>
      <text
        x={width / 2}
        y={height - 8}
        textAnchor="middle"
        className="fill-neutral-400 text-[9px] font-black dark:fill-neutral-500"
      >
        {entries.length > 2
          ? compactTimeAgo(entries[Math.floor(entries.length / 2)].timestamp)
          : ""}
      </text>
      <text
        x={width - padX}
        y={height - 8}
        textAnchor="end"
        className="fill-neutral-400 text-[9px] font-black dark:fill-neutral-500"
      >
        {compactTimeAgo(lastTs)}
      </text>
    </svg>
  );
}

function LineMovementStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="border-r border-neutral-200/70 px-3 py-2 last:border-r-0 dark:border-neutral-800/70">
      <div className="text-[9px] font-black tracking-[0.14em] text-neutral-500 uppercase dark:text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm font-black text-neutral-950 tabular-nums dark:text-white",
          tone === "up" && "text-emerald-600 dark:text-emerald-400",
          tone === "down" && "text-red-500 dark:text-red-400",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function BookDropdown({
  books,
  selectedBookId,
  onChange,
}: {
  books: string[];
  selectedBookId: string | null;
  onChange: (book: string | null) => void;
}) {
  const selectedName = selectedBookId
    ? getBookDisplayName(selectedBookId)
    : "Select book";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-neutral-200/80 bg-neutral-50/80 px-2 text-xs font-black text-neutral-950 outline-none transition-colors hover:border-neutral-300 dark:border-neutral-800/80 dark:bg-neutral-950/60 dark:text-white"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {selectedBookId && <BookLogo book={selectedBookId} size={16} />}
            <span className="truncate">{selectedName}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-500 dark:text-neutral-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-[280px] overflow-y-auto p-1"
      >
        {books.map((book) => {
          const isSelected = book === selectedBookId;
          return (
            <DropdownMenuItem
              key={book}
              onSelect={() => onChange(book)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 text-xs font-bold",
                isSelected && "bg-brand/10 text-brand focus:bg-brand/15 focus:text-brand",
              )}
            >
              <BookLogo book={book} size={16} />
              <span className="flex-1 truncate">{getBookDisplayName(book)}</span>
              {isSelected && <Check className="h-3.5 w-3.5 text-brand" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BookLogo({ book, size = 16 }: { book: string; size?: number }) {
  const sportsbook = getSportsbookById(book);
  const logo = sportsbook?.image?.light ?? null;
  if (!logo) {
    return (
      <span
        aria-hidden="true"
        className="shrink-0 rounded-sm bg-neutral-200 dark:bg-neutral-700"
        style={{ height: size, width: size }}
      />
    );
  }
  return (
    <img
      src={logo}
      alt={sportsbook?.name ?? book}
      className="shrink-0 object-contain"
      style={{ height: size, width: size }}
    />
  );
}

function getBookDisplayName(book: string) {
  return getSportsbookById(book)?.name ?? book;
}

function formatOdds(price: number | null) {
  if (price === null || price === undefined) return "—";
  return price > 0 ? `+${price}` : String(price);
}

function formatSignedMove(value: number | null) {
  if (value === null || value === undefined) return "—";
  if (value === 0) return "+0";
  return value > 0 ? `+${value}` : String(value);
}

function normalizeAmericanOddsForMove(price: number) {
  // Treat +100 and -100 as the same even-money point. Without this, moving
  // from +100 to -106 displays as -206 even though the market moved 6 cents.
  return price > 0 ? price - 200 : price;
}

function getAmericanOddsMove(open: number, last: number) {
  return normalizeAmericanOddsForMove(last) - normalizeAmericanOddsForMove(open);
}

function formatDecimal(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function compactTimeAgo(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  if (!Number.isFinite(diffMs) || diffMs < 0) return "Now";
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return minutes <= 1 ? "Now" : `-${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `-${hours}h`;
  const days = Math.round(hours / 24);
  return `-${days}d`;
}
