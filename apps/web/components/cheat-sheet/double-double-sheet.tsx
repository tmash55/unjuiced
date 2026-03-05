"use client";

import { useState, useMemo } from "react";
import { RefreshCw, AlertCircle, ChevronDown, ChevronUp, Sparkles, BarChart3, Eye, EyeOff } from "lucide-react";
import { useDoubleDoubleSheet, type DoubleDoubleBestPrice, type DoubleDoubleSheetRow } from "@/hooks/use-double-double-sheet";
import { getSportsbookById } from "@/lib/data/sportsbooks";
import { getStandardAbbreviation } from "@/lib/data/team-mappings";
import { americanToImpliedProb, americanToDecimal } from "@/lib/ev/devig";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-media-query";
import { LoadingState } from "@/components/common/loading-state";
import { PlayerQuickViewModal } from "@/components/player-quick-view-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

type SortField = "player" | "sgpPr" | "sgpPa" | "dd" | "startTime";
type SortDirection = "asc" | "desc";

function TeamLogo({ team, className }: { team: string; className?: string }) {
  const abbr = getStandardAbbreviation(team, "nba");
  if (!abbr) return null;
  return (
    <img
      src={`/team-logos/nba/${abbr.toUpperCase()}.svg`}
      alt={abbr}
      className={cn("object-contain", className)}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}

function SortIcon({ field, currentField, direction }: {
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
}) {
  if (field !== currentField) {
    return <ChevronDown className="w-3 h-3 text-neutral-300 dark:text-neutral-600" />;
  }
  return direction === "desc"
    ? <ChevronDown className="w-3 h-3 text-brand" />
    : <ChevronUp className="w-3 h-3 text-brand" />;
}

function BookPill({
  price,
  allPrices,
  isBest,
  isMobile,
}: {
  price: DoubleDoubleBestPrice | null;
  allPrices?: DoubleDoubleBestPrice[];
  isBest?: boolean;
  isMobile: boolean;
}) {
  if (!price) {
    return <span className="inline-flex min-h-8 items-center rounded-md px-2 text-xs text-neutral-400 dark:text-neutral-600">—</span>;
  }

  // Find all books that share the same best price
  const matchingBooks = allPrices
    ? allPrices.filter((p) => p.price === price.price)
    : [price];
  const hasMultiple = matchingBooks.length > 1;

  const inner = (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-all",
        "bg-white dark:bg-neutral-900/95 shadow-sm",
        isBest
          ? "border-brand/45 bg-brand/10 dark:bg-brand/15 shadow-brand/20"
          : "border-neutral-200 dark:border-neutral-700/80",
        hasMultiple && "cursor-pointer"
      )}
    >
      <div className="flex items-center -space-x-1">
        {matchingBooks.slice(0, 3).map((book) => {
          const meta = getSportsbookById(book.book);
          const logo = meta?.image?.light;
          return logo ? (
            <img
              key={book.book}
              src={logo}
              alt={meta?.name || book.book}
              title={meta?.name || book.book}
              className="h-4 w-4 rounded object-contain"
            />
          ) : null;
        })}
        {matchingBooks.length > 3 && (
          <span className="text-[9px] font-semibold text-neutral-500 dark:text-neutral-400 pl-1">
            +{matchingBooks.length - 3}
          </span>
        )}
      </div>
      <span className={cn("text-sm font-bold tabular-nums", isBest ? "text-brand" : "text-neutral-800 dark:text-neutral-100")}>
        {price.priceFormatted}
      </span>
      {price.stale ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" /> : null}
      {hasMultiple && <ChevronDown className="h-3 w-3 text-neutral-400" />}
    </span>
  );

  // Single book: direct link
  if (!hasMultiple) {
    const href = isMobile
      ? (price.mobileLink || price.link)
      : (price.link || price.mobileLink);
    const isHttpLink = href ? /^https?:\/\//i.test(href) : false;

    const pill = !href ? inner : (
      <a
        href={href}
        target={isMobile || !isHttpLink ? undefined : "_blank"}
        rel={isMobile || !isHttpLink ? undefined : "noopener noreferrer"}
        className="inline-flex hover:opacity-90 transition-opacity"
      >
        {inner}
      </a>
    );

    return pill;
  }

  // Multiple books: dropdown to pick which book to bet at
  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="inline-flex hover:opacity-90 transition-opacity">
            {inner}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-[160px]">
          {matchingBooks.map((book) => {
            const meta = getSportsbookById(book.book);
            const logo = meta?.image?.light;
            const href = isMobile
              ? (book.mobileLink || book.link)
              : (book.link || book.mobileLink);
            const isHttpLink = href ? /^https?:\/\//i.test(href) : false;

            return (
              <DropdownMenuItem key={book.book} asChild={!!href}>
                {href ? (
                  <a
                    href={href}
                    target={isMobile || !isHttpLink ? undefined : "_blank"}
                    rel={isMobile || !isHttpLink ? undefined : "noopener noreferrer"}
                    className="flex items-center gap-2"
                  >
                    {logo && <img src={logo} alt={book.book} className="h-4 w-4 rounded object-contain" />}
                    <span className="text-sm font-medium">{meta?.name || book.book}</span>
                    <span className="ml-auto text-xs font-bold tabular-nums text-neutral-500">{book.priceFormatted}</span>
                  </a>
                ) : (
                  <div className="flex items-center gap-2">
                    {logo && <img src={logo} alt={book.book} className="h-4 w-4 rounded object-contain" />}
                    <span className="text-sm font-medium">{meta?.name || book.book}</span>
                    <span className="ml-auto text-xs font-bold tabular-nums text-neutral-500">{book.priceFormatted}</span>
                  </div>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface ValueRec {
  type: "build" | "dd" | "fair";
  edgePct: number;
  combo: "pr" | "pa" | null;
}

const FAIR_THRESHOLD_PCT = 3;

function getValueRec(row: DoubleDoubleSheetRow): ValueRec {
  const ddPrice = row.dd?.price;
  if (ddPrice == null) return { type: "fair", edgePct: 0, combo: null };

  const prPrice = row.sgp_pr?.price;
  const paPrice = row.sgp_pa?.price;

  // Find best SGP combo
  let bestSgpPrice: number | null = null;
  let bestCombo: "pr" | "pa" | null = null;
  const combos: Array<{ price: number | undefined; combo: "pr" | "pa" }> = [
    { price: prPrice ?? undefined, combo: "pr" },
    { price: paPrice ?? undefined, combo: "pa" },
  ];
  for (const c of combos) {
    if (c.price != null && (bestSgpPrice == null || c.price > bestSgpPrice)) {
      bestSgpPrice = c.price;
      bestCombo = c.combo;
    }
  }

  if (bestSgpPrice == null) return { type: "fair", edgePct: 0, combo: null };

  // If SGP price is better than DD → recommend building SGP
  if (bestSgpPrice > ddPrice) {
    const fairProb = americanToImpliedProb(ddPrice);
    const sgpDecimal = americanToDecimal(bestSgpPrice);
    if (fairProb <= 0) return { type: "fair", edgePct: 0, combo: bestCombo };
    const ev = (fairProb * sgpDecimal - 1) * 100;
    if (ev < FAIR_THRESHOLD_PCT) return { type: "fair", edgePct: 0, combo: bestCombo };
    return { type: "build", edgePct: ev, combo: bestCombo };
  }

  // If DD price is better than SGP → recommend betting DD directly
  if (ddPrice > bestSgpPrice) {
    const fairProb = americanToImpliedProb(bestSgpPrice);
    const ddDecimal = americanToDecimal(ddPrice);
    if (fairProb <= 0) return { type: "fair", edgePct: 0, combo: null };
    const ev = (fairProb * ddDecimal - 1) * 100;
    if (ev < FAIR_THRESHOLD_PCT) return { type: "fair", edgePct: 0, combo: bestCombo };
    return { type: "dd", edgePct: ev, combo: null };
  }

  return { type: "fair", edgePct: 0, combo: bestCombo };
}

function ValueBadge({ row }: { row: DoubleDoubleSheetRow }) {
  const rec = getValueRec(row);
  if (rec.type === "fair") {
    return <span className="text-xs text-neutral-400">Fair</span>;
  }

  if (rec.type === "build") {
    return (
      <div className="inline-flex items-center">
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          Build SGP
        </span>
      </div>
    );
  }

  // type === "dd"
  return (
    <div className="inline-flex items-center">
      <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">
        Bet DD
      </span>
    </div>
  );
}

function AllBooksDialog({
  row,
  open,
  onOpenChange,
  isMobile,
}: {
  row: DoubleDoubleSheetRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
}) {
  const allBooks = new Set<string>();
  for (const q of row.allSgpPr ?? []) allBooks.add(q.book);
  for (const q of row.allSgpPa ?? []) allBooks.add(q.book);
  for (const q of row.allDd ?? []) allBooks.add(q.book);

  const prMap = new Map((row.allSgpPr ?? []).map((q) => [q.book, q]));
  const paMap = new Map((row.allSgpPa ?? []).map((q) => [q.book, q]));
  const ddMap = new Map((row.allDd ?? []).map((q) => [q.book, q]));

  // Sort by best P+R price descending
  const bookList = [...allBooks].sort((a, b) => {
    const aPr = prMap.get(a)?.price ?? -Infinity;
    const bPr = prMap.get(b)?.price ?? -Infinity;
    if (bPr !== aPr) return bPr - aPr;
    const aPa = paMap.get(a)?.price ?? -Infinity;
    const bPa = paMap.get(b)?.price ?? -Infinity;
    return bPa - aPa;
  });

  const bestPrPrice = row.sgp_pr?.price ?? null;
  const bestPaPrice = row.sgp_pa?.price ?? null;
  const bestDdPrice = row.dd?.price ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-w-[calc(100%-1rem)] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            {row.team && <TeamLogo team={row.team} className="h-5 w-5" />}
            {row.player}
          </DialogTitle>
          <DialogDescription>{row.matchup}</DialogDescription>
        </DialogHeader>
        <div className="overflow-auto max-h-[60vh] -mx-4 px-4 sm:-mx-6 sm:px-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[10px] sm:text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-700">
                <th className="py-2 pr-2 sm:pr-3 font-semibold w-10 sm:w-auto">Book</th>
                <th className="py-2 px-1.5 sm:px-3 font-semibold text-center">P+R</th>
                <th className="py-2 px-1.5 sm:px-3 font-semibold text-center">P+A</th>
                <th className="py-2 pl-1.5 sm:pl-3 font-semibold text-center">DD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {bookList.map((book) => {
                const meta = getSportsbookById(book);
                const logo = meta?.image?.light;
                const pr = prMap.get(book);
                const pa = paMap.get(book);
                const dd = ddMap.get(book);

                return (
                  <tr key={book} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                    <td className="py-2 pr-2 sm:pr-3">
                      <div className="flex items-center gap-2">
                        {logo ? <img src={logo} alt={meta?.name || book} title={meta?.name || book} className="h-5 w-5 rounded object-contain" /> : null}
                        <span className="hidden sm:inline text-sm font-medium text-neutral-800 dark:text-neutral-200">
                          {meta?.name || book}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-1.5 sm:px-3 text-center">
                      {pr ? (
                        <PriceCell price={pr} isBest={bestPrPrice !== null && pr.price === bestPrPrice} isMobile={isMobile} />
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-1.5 sm:px-3 text-center">
                      {pa ? (
                        <PriceCell price={pa} isBest={bestPaPrice !== null && pa.price === bestPaPrice} isMobile={isMobile} />
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pl-1.5 sm:pl-3 text-center">
                      {dd ? (
                        <PriceCell price={dd} isBest={bestDdPrice !== null && dd.price === bestDdPrice} isMobile={isMobile} />
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PriceCell({
  price,
  isBest,
  isMobile,
}: {
  price: DoubleDoubleBestPrice;
  isBest?: boolean;
  isMobile: boolean;
}) {
  const href = isMobile
    ? (price.mobileLink || price.link)
    : (price.link || price.mobileLink);
  const isHttpLink = href ? /^https?:\/\//i.test(href) : false;

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs sm:text-sm font-bold tabular-nums",
        isBest
          ? "text-brand bg-brand/10"
          : "text-neutral-800 dark:text-neutral-100"
      )}
    >
      {price.priceFormatted}
    </span>
  );

  return href ? (
    <a
      href={href}
      target={isMobile || !isHttpLink ? undefined : "_blank"}
      rel={isMobile || !isHttpLink ? undefined : "noopener noreferrer"}
      className="hover:opacity-80 transition-opacity"
    >
      {content}
    </a>
  ) : (
    content
  );
}

function parseMatchupTeams(matchup: string): { away: string; home: string } | null {
  const parts = matchup.split(" @ ");
  if (parts.length !== 2) return null;
  return { away: parts[0].trim(), home: parts[1].trim() };
}

function MatchupDisplay({ matchup, startTime }: { matchup: string; startTime: string }) {
  const teams = parseMatchupTeams(matchup);
  const timeStr = new Date(startTime).toLocaleString(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (!teams) {
    return (
      <div>
        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{matchup}</div>
        <div className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{timeStr}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-800 dark:text-neutral-200">
        <TeamLogo team={teams.away} className="h-4 w-4" />
        <span>{teams.away}</span>
        <span className="text-neutral-400 dark:text-neutral-500 text-xs">@</span>
        <TeamLogo team={teams.home} className="h-4 w-4" />
        <span>{teams.home}</span>
      </div>
      <div className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400 mt-0.5">{timeStr}</div>
    </div>
  );
}

export function DoubleDoubleSheet() {
  const { data, isLoading, isFetching, error, refetch } = useDoubleDoubleSheet();
  const isMobile = useIsMobile();
  const sheet = data?.data;
  const rows = sheet?.rows || [];

  const [sortField, setSortField] = useState<SortField>("dd");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedPlayer, setSelectedPlayer] = useState<{
    player_name: string;
    event_id: string;
  } | null>(null);
  const [allBooksRow, setAllBooksRow] = useState<DoubleDoubleSheetRow | null>(null);
  const [hideNoSgp, setHideNoSgp] = useState(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredRows = useMemo(() => {
    if (!hideNoSgp) return rows;
    return rows.filter((row) => row.sgp_pr != null || row.sgp_pa != null);
  }, [rows, hideNoSgp]);

  const hiddenCount = rows.length - filteredRows.length;

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case "player":
          aVal = a.player;
          bVal = b.player;
          break;
        case "sgpPr":
          aVal = a.sgp_pr?.price ?? -999999;
          bVal = b.sgp_pr?.price ?? -999999;
          break;
        case "sgpPa":
          aVal = a.sgp_pa?.price ?? -999999;
          bVal = b.sgp_pa?.price ?? -999999;
          break;
        case "dd":
          aVal = a.dd?.price ?? -999999;
          bVal = b.dd?.price ?? -999999;
          break;
        case "startTime":
          aVal = new Date(a.startTime).getTime();
          bVal = new Date(b.startTime).getTime();
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "desc"
          ? bVal.localeCompare(aVal)
          : aVal.localeCompare(bVal);
      }

      const numA = typeof aVal === "number" ? aVal : 0;
      const numB = typeof bVal === "number" ? bVal : 0;
      return sortDirection === "desc" ? numB - numA : numA - numB;
    });
  }, [filteredRows, sortField, sortDirection]);

  if (isLoading) {
    return (
      <LoadingState
        message="Loading Double Double Sheet..."
        compact
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Failed to load double-double sheet
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          <Sparkles className="h-3 w-3 text-brand" />
          Best price per row highlighted
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHideNoSgp((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
              hideNoSgp
                ? "border-brand/40 bg-brand/10 text-brand hover:bg-brand/20"
                : "border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
            title={hideNoSgp ? "Showing only rows with SGP odds" : "Showing all rows"}
          >
            {hideNoSgp ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {hideNoSgp ? `SGP Only${hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ""}` : "Show All"}
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 px-2.5 py-1.5 text-xs font-semibold",
              "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            )}
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 p-6 text-sm text-neutral-500 shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03]">
          No double-double sheet rows are available yet.
        </div>
      ) : isMobile ? (
        /* ── Mobile: Card Layout ── */
        <div className="space-y-2.5">
          {sortedRows.map((row) => {
            const bestPrice = Math.max(
              row.sgp_pr?.price ?? Number.NEGATIVE_INFINITY,
              row.sgp_pa?.price ?? Number.NEGATIVE_INFINITY,
              row.dd?.price ?? Number.NEGATIVE_INFINITY
            );
            const hasBest = Number.isFinite(bestPrice);

            return (
              <div
                key={row.id}
                className="rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden"
              >
                {/* Player header */}
                <div className="flex items-center gap-3 px-3.5 py-3 border-b border-neutral-100 dark:border-neutral-800/60">
                  {row.team && (
                    <TeamLogo team={row.team} className="h-6 w-6 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPlayer({ player_name: row.player, event_id: row.eventId })}
                      className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100 hover:text-brand transition-colors text-left"
                    >
                      {row.player}
                    </button>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {(() => {
                        const teams = parseMatchupTeams(row.matchup);
                        if (!teams) return <span>{row.matchup}</span>;
                        return (
                          <>
                            <TeamLogo team={teams.away} className="h-3 w-3" />
                            <span>{teams.away}</span>
                            <span className="text-neutral-300 dark:text-neutral-600">@</span>
                            <TeamLogo team={teams.home} className="h-3 w-3" />
                            <span>{teams.home}</span>
                          </>
                        );
                      })()}
                      <span className="text-neutral-300 dark:text-neutral-600 mx-0.5">·</span>
                      <span className="tabular-nums">
                        {new Date(row.startTime).toLocaleString(undefined, {
                          weekday: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pricing grid */}
                <div className="grid grid-cols-3 divide-x divide-neutral-100 dark:divide-neutral-800/60">
                  {([
                    { label: "SGP (P+R)", price: row.sgp_pr, all: row.allSgpPr },
                    { label: "SGP (P+A)", price: row.sgp_pa, all: row.allSgpPa },
                    { label: "Double Dbl", price: row.dd, all: row.allDd },
                  ]).map((col) => (
                    <div key={col.label} className="px-2.5 py-2.5 text-center">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 mb-1.5">
                        {col.label}
                      </div>
                      <div className="flex justify-center">
                        <BookPill
                          price={col.price}
                          allPrices={col.all}
                          isBest={hasBest && col.price?.price === bestPrice}
                          isMobile={isMobile}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Value + All Books footer */}
                <div className="flex items-center justify-between px-3.5 py-2 border-t border-neutral-100 dark:border-neutral-800/60">
                  <ValueBadge row={row} />
                  <button
                    type="button"
                    onClick={() => setAllBooksRow(row)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-brand transition-colors"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    All Books
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Desktop: Table Layout ── */
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden shadow-lg ring-1 ring-black/[0.03] dark:ring-white/[0.03] bg-white dark:bg-neutral-900">
          <div className="overflow-auto max-h-[calc(100vh-200px)]">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-neutral-50/95 dark:bg-neutral-800/95 backdrop-blur-sm text-left text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  <th className="h-11 px-4 font-semibold border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[200px] bg-neutral-50/95 dark:bg-neutral-800/95">
                    <button
                      onClick={() => handleSort("player")}
                      className="flex items-center gap-1.5 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                    >
                      Player <SortIcon field="player" currentField={sortField} direction={sortDirection} />
                    </button>
                  </th>
                  <th className="h-11 px-4 font-semibold border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[180px] bg-neutral-50/95 dark:bg-neutral-800/95">
                    <button
                      onClick={() => handleSort("startTime")}
                      className="flex items-center gap-1.5 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                    >
                      Matchup <SortIcon field="startTime" currentField={sortField} direction={sortDirection} />
                    </button>
                  </th>
                  <th className="h-11 px-4 font-semibold border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[110px] bg-neutral-50/95 dark:bg-neutral-800/95">
                    <button
                      onClick={() => handleSort("sgpPr")}
                      className="w-full flex items-center justify-center gap-1.5 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                    >
                      SGP (P+R) <SortIcon field="sgpPr" currentField={sortField} direction={sortDirection} />
                    </button>
                  </th>
                  <th className="h-11 px-4 font-semibold border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[110px] bg-neutral-50/95 dark:bg-neutral-800/95">
                    <button
                      onClick={() => handleSort("sgpPa")}
                      className="w-full flex items-center justify-center gap-1.5 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                    >
                      SGP (P+A) <SortIcon field="sgpPa" currentField={sortField} direction={sortDirection} />
                    </button>
                  </th>
                  <th className="h-11 px-4 font-semibold border-b border-neutral-200/80 dark:border-neutral-700/80 min-w-[110px] bg-neutral-50/95 dark:bg-neutral-800/95">
                    <button
                      onClick={() => handleSort("dd")}
                      className="w-full flex items-center justify-center gap-1.5 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                    >
                      Double Dbl <SortIcon field="dd" currentField={sortField} direction={sortDirection} />
                    </button>
                  </th>
                  <th className="h-11 px-2 font-semibold border-b border-neutral-200/80 dark:border-neutral-700/80 w-10 bg-neutral-50/95 dark:bg-neutral-800/95" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                {sortedRows.map((row, idx) => {
                  const bestPrice = Math.max(
                    row.sgp_pr?.price ?? Number.NEGATIVE_INFINITY,
                    row.sgp_pa?.price ?? Number.NEGATIVE_INFINITY,
                    row.dd?.price ?? Number.NEGATIVE_INFINITY
                  );
                  const hasBest = Number.isFinite(bestPrice);
                  const rowBg = idx % 2 === 0 ? "bg-white dark:bg-neutral-900" : "bg-neutral-50/45 dark:bg-neutral-800/20";

                  return (
                    <tr
                      key={row.id}
                      className={cn(rowBg, "group hover:bg-brand/5 dark:hover:bg-brand/10 transition-colors")}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {row.team && (
                            <TeamLogo team={row.team} className="h-5 w-5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedPlayer({ player_name: row.player, event_id: row.eventId })}
                              className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100 hover:text-brand hover:underline transition-colors text-left"
                            >
                              {row.player}
                            </button>
                            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{row.team || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <MatchupDisplay matchup={row.matchup} startTime={row.startTime} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <BookPill
                          price={row.sgp_pr}
                          allPrices={row.allSgpPr}
                          isBest={hasBest && row.sgp_pr?.price === bestPrice}
                          isMobile={isMobile}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <BookPill
                          price={row.sgp_pa}
                          allPrices={row.allSgpPa}
                          isBest={hasBest && row.sgp_pa?.price === bestPrice}
                          isMobile={isMobile}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <BookPill
                          price={row.dd}
                          allPrices={row.allDd}
                          isBest={hasBest && row.dd?.price === bestPrice}
                          isMobile={isMobile}
                        />
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setAllBooksRow(row)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-neutral-400 hover:text-brand hover:bg-brand/10 transition-colors"
                          title="View all books"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedPlayer && (
        <PlayerQuickViewModal
          player_name={selectedPlayer.player_name}
          event_id={selectedPlayer.event_id}
          open={!!selectedPlayer}
          onOpenChange={(open) => {
            if (!open) setSelectedPlayer(null);
          }}
        />
      )}

      {allBooksRow && (
        <AllBooksDialog
          row={allBooksRow}
          open={!!allBooksRow}
          onOpenChange={(open) => {
            if (!open) setAllBooksRow(null);
          }}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}