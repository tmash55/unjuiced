"use client";

import { motion } from "motion/react";
import { Tooltip } from "@/components/tooltip";
import { cn } from "@/lib/utils";

export type ExpandedOddsOffer = {
  bookId: string;
  price: number;
  priceDecimal?: number | null;
  priceFormatted?: string | null;
  link?: string | null;
  mobileLink?: string | null;
  limits?: { max?: number | null } | null;
  evPercent?: number;
  isSharpRef?: boolean;
  includedInAverage?: boolean;
  averageExclusionReason?: string | null;
};

type Accent = "emerald" | "amber";

type ExpandedOddsComparisonProps = {
  accent?: Accent;
  isDimmed?: boolean;
  dimmedLabel?: string;
  selectionLabel: string;
  sideLabel: string;
  line?: string | number | null;
  marketLabel?: string | null;
  bestPriceLabel: string;
  bestBookLabel: string;
  referenceLabel?: string;
  referenceValue?: string;
  isOverSide: boolean;
  overRowLabel: string;
  underRowLabel: string;
  overOffers: ExpandedOddsOffer[];
  underOffers: ExpandedOddsOffer[];
  getBookName: (bookId?: string) => string;
  getBookLogo: (bookId?: string) => string | undefined;
  onOpenOffer: (bookId: string, offer: ExpandedOddsOffer) => void;
  showEvPercent?: boolean;
  showSharpRef?: boolean;
  sortByCurrentSide?: boolean;
};

const accentClasses = {
  emerald: {
    dot: "bg-emerald-500 animate-pulse",
    text: "text-emerald-600 dark:text-emerald-400",
    headerText: "text-emerald-500",
    softBg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    bestBg: "bg-emerald-50/30 dark:bg-emerald-950/10",
    bestStrongBg: "bg-emerald-100/50 dark:bg-emerald-900/20",
    cellBestBg: "bg-emerald-50 dark:bg-emerald-950/30",
    hover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
  },
  amber: {
    dot: "bg-amber-500 animate-pulse",
    text: "text-amber-600 dark:text-amber-400",
    headerText: "text-amber-500",
    softBg: "bg-amber-50/50 dark:bg-amber-950/20",
    bestBg: "bg-amber-50/30 dark:bg-amber-950/10",
    bestStrongBg: "bg-amber-100/50 dark:bg-amber-900/20",
    cellBestBg: "bg-amber-50 dark:bg-amber-950/30",
    hover: "hover:bg-amber-100 dark:hover:bg-amber-900/40",
  },
} satisfies Record<Accent, Record<string, string>>;

function formatOdds(odds: number | null | undefined) {
  if (odds === null || odds === undefined || !Number.isFinite(odds)) return "—";
  return odds > 0 ? `+${odds}` : String(odds);
}

function toDecimal(odds: number) {
  if (!Number.isFinite(odds) || odds === 0) return 0;
  return odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;
}

function offerDecimal(offer: ExpandedOddsOffer) {
  return offer.priceDecimal && Number.isFinite(offer.priceDecimal)
    ? offer.priceDecimal
    : toDecimal(offer.price);
}

function americanToImpliedProb(odds: number) {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

function impliedProbToAmerican(probability: number) {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    return null;
  }
  if (probability <= 0.5) return Math.round(100 / probability - 100);
  return Math.round((-100 * probability) / (1 - probability));
}

function averageAmerican(offers: ExpandedOddsOffer[]) {
  const averageOffers = offers.filter(
    (offer) => offer.includedInAverage !== false,
  );
  if (averageOffers.length === 0) return null;
  const avgProb =
    averageOffers.reduce(
      (sum, offer) => sum + americanToImpliedProb(offer.price),
      0,
    ) / averageOffers.length;
  return impliedProbToAmerican(avgProb);
}

function bestOffer(offers: ExpandedOddsOffer[]) {
  if (offers.length === 0) return null;
  return offers.reduce((best, offer) =>
    offerDecimal(offer) > offerDecimal(best) ? offer : best,
  );
}

export function ExpandedOddsComparison({
  accent = "emerald",
  isDimmed = false,
  dimmedLabel,
  selectionLabel,
  sideLabel,
  line,
  marketLabel,
  bestPriceLabel,
  bestBookLabel,
  referenceLabel = "Fair",
  referenceValue,
  isOverSide,
  overRowLabel,
  underRowLabel,
  overOffers,
  underOffers,
  getBookName,
  getBookLogo,
  onOpenOffer,
  showEvPercent = true,
  showSharpRef = true,
  sortByCurrentSide = true,
}: ExpandedOddsComparisonProps) {
  const classes = accentClasses[accent];
  const currentSideOffers = isOverSide ? overOffers : underOffers;
  const overMap = new Map(overOffers.map((offer) => [offer.bookId, offer]));
  const underMap = new Map(underOffers.map((offer) => [offer.bookId, offer]));
  const currentSideMap = new Map(
    currentSideOffers.map((offer) => [offer.bookId, offer]),
  );
  const allBookIds = new Set<string>();
  overOffers.forEach((offer) => allBookIds.add(offer.bookId));
  underOffers.forEach((offer) => allBookIds.add(offer.bookId));

  const sortedBookIds = Array.from(allBookIds).sort((a, b) => {
    if (!sortByCurrentSide) return a.localeCompare(b);
    return (
      offerDecimal(
        currentSideMap.get(b) || ({ price: 0 } as ExpandedOddsOffer),
      ) -
      offerDecimal(currentSideMap.get(a) || ({ price: 0 } as ExpandedOddsOffer))
    );
  });

  const bestOver = bestOffer(overOffers);
  const bestUnder = bestOffer(underOffers);
  const bestOverDecimal = bestOver ? offerDecimal(bestOver) : null;
  const bestUnderDecimal = bestUnder ? offerDecimal(bestUnder) : null;
  const avgOver = averageAmerican(overOffers);
  const avgUnder = averageAmerican(underOffers);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isDimmed ? 0.5 : 1 }}
      transition={{ delay: 0.1 }}
      className={cn(
        "border-b border-neutral-200 bg-gradient-to-b from-neutral-50 to-neutral-100/80 dark:border-neutral-800 dark:from-neutral-900 dark:to-neutral-950",
        isDimmed && "pointer-events-none grayscale select-none",
      )}
    >
      <div className="flex w-full flex-col items-center">
        <div className="flex w-full flex-col gap-2 border-b border-neutral-200/60 bg-neutral-100/90 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 dark:border-neutral-800/60 dark:bg-neutral-950">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                isDimmed ? "bg-amber-500" : classes.dot,
              )}
            />
            <span className="truncate text-sm font-bold text-neutral-900 dark:text-white">
              {selectionLabel}
            </span>
            {line !== null && line !== undefined && (
              <span className="shrink-0 text-xs text-neutral-600 dark:text-neutral-400">
                {sideLabel} {line}
              </span>
            )}
            {marketLabel && (
              <span className="hidden truncate text-xs text-neutral-500 sm:inline">
                {marketLabel}
              </span>
            )}
            {isDimmed && dimmedLabel && (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                {dimmedLabel}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
            <span className={cn("font-bold", classes.headerText)}>
              {bestPriceLabel}
            </span>
            <span className="text-neutral-400 dark:text-neutral-600">@</span>
            <span className="text-neutral-700 dark:text-neutral-300">
              {bestBookLabel}
            </span>
            {referenceValue && (
              <>
                <span className="h-3 w-px bg-neutral-300 dark:bg-neutral-700" />
                <span>
                  {referenceLabel}:{" "}
                  <strong className={classes.text}>{referenceValue}</strong>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex w-full justify-center">
          <div className="flex max-w-full">
            <div className="w-28 flex-shrink-0 border-r border-neutral-200/60 bg-white/30 dark:border-neutral-800/60 dark:bg-black/20">
              <div className="h-12 border-b border-neutral-200/40 dark:border-neutral-800/40" />
              <div
                className={cn(
                  "flex h-14 items-center border-b border-neutral-200/40 px-4 dark:border-neutral-800/40",
                  isOverSide && classes.softBg,
                )}
              >
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "max-w-[88px] truncate text-sm font-semibold tracking-tight",
                      isOverSide
                        ? classes.text
                        : "text-neutral-700 dark:text-neutral-300",
                    )}
                    title={overRowLabel}
                  >
                    {overRowLabel}
                  </span>
                  {line !== null && line !== undefined && (
                    <span className="-mt-0.5 text-[10px] text-neutral-400 dark:text-neutral-500">
                      {line}
                    </span>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "flex h-14 items-center px-4",
                  !isOverSide && classes.softBg,
                )}
              >
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "max-w-[88px] truncate text-sm font-semibold tracking-tight",
                      !isOverSide
                        ? classes.text
                        : "text-neutral-700 dark:text-neutral-300",
                    )}
                    title={underRowLabel}
                  >
                    {underRowLabel}
                  </span>
                  {line !== null && line !== undefined && (
                    <span className="-mt-0.5 text-[10px] text-neutral-400 dark:text-neutral-500">
                      {line}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div
              className={cn(
                "w-20 flex-shrink-0 border-r border-neutral-200/60 dark:border-neutral-800/60",
                classes.bestBg,
              )}
            >
              <div className="flex h-12 items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40">
                <span
                  className={cn(
                    "text-[10px] font-bold tracking-widest uppercase",
                    classes.text,
                  )}
                >
                  Best
                </span>
              </div>
              <div
                className={cn(
                  "flex h-14 items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40",
                  isOverSide && classes.bestStrongBg,
                )}
              >
                {bestOver && (
                  <Tooltip
                    content={`Best odds at ${getBookName(bestOver.bookId)}`}
                  >
                    <div className="flex items-center gap-1">
                      {getBookLogo(bestOver.bookId) && (
                        <img
                          src={getBookLogo(bestOver.bookId)}
                          alt=""
                          className="h-4 w-4 object-contain opacity-60"
                        />
                      )}
                      <span className={cn("text-sm font-bold", classes.text)}>
                        {bestOver.priceFormatted || formatOdds(bestOver.price)}
                      </span>
                    </div>
                  </Tooltip>
                )}
              </div>
              <div
                className={cn(
                  "flex h-14 items-center justify-center",
                  !isOverSide && classes.bestStrongBg,
                )}
              >
                {bestUnder && (
                  <Tooltip
                    content={`Best odds at ${getBookName(bestUnder.bookId)}`}
                  >
                    <div className="flex items-center gap-1">
                      {getBookLogo(bestUnder.bookId) && (
                        <img
                          src={getBookLogo(bestUnder.bookId)}
                          alt=""
                          className="h-4 w-4 object-contain opacity-60"
                        />
                      )}
                      <span className={cn("text-sm font-bold", classes.text)}>
                        {bestUnder.priceFormatted ||
                          formatOdds(bestUnder.price)}
                      </span>
                    </div>
                  </Tooltip>
                )}
              </div>
            </div>

            <div className="w-16 flex-shrink-0 border-r border-neutral-200/60 dark:border-neutral-800/60">
              <div className="flex h-12 items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40">
                <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase dark:text-neutral-500">
                  Avg
                </span>
              </div>
              <div className="flex h-14 items-center justify-center border-b border-neutral-200/40 dark:border-neutral-800/40">
                <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {formatOdds(avgOver)}
                </span>
              </div>
              <div className="flex h-14 items-center justify-center">
                <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {formatOdds(avgUnder)}
                </span>
              </div>
            </div>

            <div className="scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-400 dark:hover:scrollbar-thumb-neutral-600 scrollbar-track-transparent flex-1 overflow-x-auto">
              <div className="inline-flex min-w-full">
                {sortedBookIds.map((bookId) => {
                  const bookLogo = getBookLogo(bookId);
                  const overOffer = overMap.get(bookId);
                  const underOffer = underMap.get(bookId);
                  const isOverBest =
                    !!overOffer &&
                    bestOverDecimal !== null &&
                    offerDecimal(overOffer) === bestOverDecimal;
                  const isUnderBest =
                    !!underOffer &&
                    bestUnderDecimal !== null &&
                    offerDecimal(underOffer) === bestUnderDecimal;

                  return (
                    <div
                      key={bookId}
                      className="w-[72px] flex-shrink-0 border-r border-neutral-100 transition-colors last:border-r-0 hover:bg-neutral-100/50 dark:border-neutral-800/40 dark:hover:bg-neutral-800/30"
                    >
                      <div className="flex h-12 items-center justify-center border-b border-neutral-200/40 px-2 dark:border-neutral-800/40">
                        <Tooltip content={getBookName(bookId)}>
                          {bookLogo ? (
                            <img
                              src={bookLogo}
                              alt={bookId}
                              className="h-6 w-6 object-contain opacity-90 transition-opacity hover:opacity-100"
                            />
                          ) : (
                            <span className="truncate text-[10px] font-medium text-neutral-500">
                              {getBookName(bookId)?.slice(0, 6)}
                            </span>
                          )}
                        </Tooltip>
                      </div>

                      {[
                        {
                          offer: overOffer,
                          isBest: isOverBest,
                          activeSide: isOverSide,
                        },
                        {
                          offer: underOffer,
                          isBest: isUnderBest,
                          activeSide: !isOverSide,
                        },
                      ].map(({ offer, isBest, activeSide }, index) => (
                        <div
                          key={`${bookId}-${index}`}
                          className={cn(
                            "flex h-14 flex-col items-center justify-center border-b border-neutral-200/40 last:border-b-0 dark:border-neutral-800/40",
                            isBest && classes.cellBestBg,
                            offer?.isSharpRef &&
                              "bg-amber-50/50 dark:bg-amber-900/10",
                          )}
                        >
                          {offer ? (
                            <>
                              <button
                                type="button"
                                data-no-row-toggle="true"
                                onClick={() => onOpenOffer(bookId, offer)}
                                className={cn(
                                  "rounded px-2 py-0.5 text-sm font-semibold tabular-nums transition-all hover:scale-105",
                                  classes.hover,
                                  isBest
                                    ? `${classes.text} font-bold`
                                    : "text-neutral-700 dark:text-neutral-300",
                                )}
                              >
                                {offer.priceFormatted ||
                                  formatOdds(offer.price)}
                              </button>
                              {showEvPercent &&
                                activeSide &&
                                offer.evPercent !== undefined &&
                                offer.evPercent > 0 &&
                                !offer.isSharpRef && (
                                  <span
                                    className={cn(
                                      "text-[9px] font-bold tabular-nums",
                                      classes.text,
                                    )}
                                  >
                                    +{offer.evPercent.toFixed(1)}%
                                  </span>
                                )}
                              {showSharpRef && offer.isSharpRef && (
                                <Tooltip content="Reference book used for fair odds calculation">
                                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                    REF
                                  </span>
                                </Tooltip>
                              )}
                              {offer.limits?.max && (
                                <span className="text-[9px] font-medium text-neutral-500 dark:text-neutral-400">
                                  Max $
                                  {offer.limits.max >= 1000
                                    ? `${(offer.limits.max / 1000).toFixed(0)}k`
                                    : offer.limits.max}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-neutral-300 dark:text-neutral-700">
                              —
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
