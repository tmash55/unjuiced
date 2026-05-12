"use client";

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ArbRow } from "@/lib/arb-schema";
import { createColumnHelper } from "@tanstack/react-table";
import { Table, useTable } from "@/components/table";
import {
  Zap,
  ExternalLink,
  AlertTriangle,
  Lock,
  Pin,
  TrendingUp,
  Calculator,
  X,
  Loader2,
  ChevronRight,
} from "lucide-react";
import {
  getSportsbookById,
  getSportsbookLogo,
  getSportsbookName,
} from "@/lib/data/sportsbooks";
import { cn } from "@/lib/utils";
import { SportIcon } from "@/components/icons/sport-icons";
import { Tooltip } from "@/components/tooltip";
import { motion, AnimatePresence } from "motion/react";
import { useStateLink } from "@/hooks/use-state-link";
import { ArbRiskIndicator } from "@/components/arbs/arb-risk-indicator";
import {
  ExpandedOddsComparison,
  type ExpandedOddsOffer,
} from "@/components/opportunities/expanded-odds-comparison";

interface ArbTableProps {
  rows: ArbRow[];
  ids: string[];
  changes: Map<
    string,
    { roi?: "up" | "down"; o?: "up" | "down"; u?: "up" | "down" }
  >;
  added?: Set<string>;
  totalBetAmount?: number;
  roundTo?: number;
  isPro?: boolean;
}

interface ArbRowWithId extends ArbRow {
  _id: string;
  _isNew?: boolean;
  _hasChange?: boolean;
  _isTeaser?: boolean;
  _isPinned?: boolean;
}

type ArbOddsSide = "over" | "under";

type ArbOddsOffer = {
  book: string;
  side: ArbOddsSide;
  odds: number;
  decimal?: number | null;
  line?: number | null;
  selection?: string | null;
  max?: number | null;
  link?: string | null;
  mobileLink?: string | null;
  updated?: string | null;
  locked?: boolean;
  selected?: boolean;
};

type ArbOddsDetail = {
  source?: "odds_idx" | "row" | string;
  over: ArbOddsOffer[];
  under: ArbOddsOffer[];
};

/** Round a number to the nearest multiple of `step`. 0 = no rounding (2 decimal places). */
function roundStake(n: number, step: number): number {
  if (step <= 0) return Math.round(n * 100) / 100;
  return Math.round(n / step) * step;
}
function formatStake(n: number, step: number): string {
  if (step <= 0) return Number.isFinite(n) ? n.toFixed(2) : "0.00";
  return String(Math.round(n / step) * step);
}

const columnHelper = createColumnHelper<ArbRowWithId>();

function fallbackOddsDetail(row: ArbRow): ArbOddsDetail {
  return {
    source: "row",
    over: [
      {
        book: row.o?.bk,
        side: "over",
        odds: Number(row.o?.od || 0),
        line: row.ln ?? null,
        selection: row.o?.name ?? row.ent ?? null,
        max: row.o?.max ?? null,
        link: row.o?.u ?? null,
        mobileLink: row.o?.m ?? null,
        updated: row.o?.upd ?? null,
        selected: true,
      },
    ].filter((offer) => offer.book && offer.odds) as ArbOddsOffer[],
    under: [
      {
        book: row.u?.bk,
        side: "under",
        odds: Number(row.u?.od || 0),
        line: row.ln ?? null,
        selection: row.u?.name ?? row.ent ?? null,
        max: row.u?.max ?? null,
        link: row.u?.u ?? null,
        mobileLink: row.u?.m ?? null,
        updated: row.u?.upd ?? null,
        selected: true,
      },
    ].filter((offer) => offer.book && offer.odds) as ArbOddsOffer[],
  };
}

const toExpandedOffer = (offer: ArbOddsOffer): ExpandedOddsOffer => ({
  bookId: offer.book,
  price: offer.odds,
  priceDecimal: offer.decimal,
  priceFormatted: offer.odds > 0 ? `+${offer.odds}` : String(offer.odds),
  link: offer.link,
  mobileLink: offer.mobileLink,
  limits: offer.max != null ? { max: offer.max } : null,
});

const isMoneylineOrSpreadMarket = (market?: string) =>
  /moneyline|\bml\b|spread|handicap|run[_ ]?line|puck[_ ]?line|goal[_ ]?line/i.test(
    market || "",
  );

function ArbExpandedSubRow({
  row,
  colSpan,
}: {
  row: ArbRowWithId;
  colSpan: number;
}) {
  const applyState = useStateLink();
  const [detail, setDetail] = React.useState<ArbOddsDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch("/api/arbs/odds-detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ row }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`odds-detail ${res.status}`);
        return (await res.json()) as ArbOddsDetail;
      })
      .then((payload) => setDetail(payload))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError("Showing selected arb legs only");
        setDetail(fallbackOddsDetail(row));
      });

    return () => controller.abort();
  }, [row]);

  const current = detail ?? fallbackOddsDetail(row);
  const isMoneylineOrSpread = isMoneylineOrSpreadMarket(row.mkt);
  const overRowLabel = isMoneylineOrSpread
    ? row.ev?.home?.abbr || "Home"
    : "Over";
  const underRowLabel = isMoneylineOrSpread
    ? row.ev?.away?.abbr || "Away"
    : "Under";
  const selectionLabel =
    row.ent ||
    row.o?.name?.replace(/\s+(Over|Under).*$/i, "").trim() ||
    `${row.ev?.away?.abbr || "Away"} @ ${row.ev?.home?.abbr || "Home"}`;
  const overOffers = current.over.map(toExpandedOffer);
  const underOffers = current.under.map(toExpandedOffer);
  const selectedOver =
    current.over.find((offer) => offer.selected) || current.over[0];
  const selectedBookName = getSportsbookName(selectedOver?.book || row.o?.bk);
  const isOverSide = true;

  const openOffer = (_bookId: string, offer: ExpandedOddsOffer) => {
    const target = offer?.mobileLink || offer?.link;
    if (!target) return;
    const resolved = applyState(target) || target;
    window.open(
      resolved,
      "_blank",
      "noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes",
    );
  };

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <td
        colSpan={colSpan}
        className="border-b border-neutral-200 p-0 dark:border-neutral-800"
      >
        <ExpandedOddsComparison
          accent="emerald"
          isDimmed={!!error}
          dimmedLabel={error || undefined}
          selectionLabel={selectionLabel}
          sideLabel={isMoneylineOrSpread ? "" : "O"}
          line={isMoneylineOrSpread ? null : row.ln}
          marketLabel={row.mkt.replace(/_/g, " ")}
          bestPriceLabel={
            selectedOver?.odds != null
              ? selectedOver.odds > 0
                ? `+${selectedOver.odds}`
                : String(selectedOver.odds)
              : "—"
          }
          bestBookLabel={selectedBookName}
          referenceLabel="Arb"
          referenceValue={`+${((row.roi_bps ?? 0) / 100).toFixed(2)}%`}
          isOverSide
          overRowLabel={overRowLabel}
          underRowLabel={underRowLabel}
          overOffers={overOffers}
          underOffers={underOffers}
          getBookName={getSportsbookName}
          getBookLogo={getSportsbookLogo}
          onOpenOffer={openOffer}
          showEvPercent={false}
          showSharpRef={false}
        />
      </td>
    </motion.tr>
  );
}

export function ArbTableV2({
  rows,
  ids,
  changes,
  added,
  totalBetAmount = 200,
  roundTo = 0,
  isPro = true,
}: ArbTableProps) {
  const applyState = useStateLink();
  const [customWagers, setCustomWagers] = useState<
    Record<string, { over: string; under: string }>
  >({});
  const customWagersRef = React.useRef<
    Record<string, { over: string; under: string }>
  >({});
  const [pinnedRowId, setPinnedRowId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorRowId, setCalculatorRowId] = useState<string | null>(null);
  const [calculatorDefaults, setCalculatorDefaults] = useState({
    overOdds: 0,
    underOdds: 0,
    overStake: 0,
    underStake: 0,
  });
  const [calculatorApplied, setCalculatorApplied] = useState<{
    rowId: string;
    over: string;
    under: string;
  } | null>(null);
  const calculatorSnapshotRef = React.useRef<ArbRowWithId | null>(null);

  const setCustomWagersBoth = React.useCallback(
    (
      updater: (
        prev: Record<string, { over: string; under: string }>,
      ) => Record<string, { over: string; under: string }>,
    ) => {
      setCustomWagers((prev) => {
        const next = updater(prev);
        customWagersRef.current = next;
        return next;
      });
    },
    [],
  );

  const openCalculator = React.useCallback(
    (
      row: ArbRowWithId,
      rowId: string,
      defaults: {
        overOdds: number;
        underOdds: number;
        overStake: number;
        underStake: number;
      },
    ) => {
      calculatorSnapshotRef.current = row;
      setCalculatorRowId(rowId);
      setCalculatorDefaults(defaults);
      setCalculatorOpen(true);
    },
    [],
  );

  const closeCalculator = React.useCallback(() => {
    setCalculatorOpen(false);
  }, []);

  const toggleExpandedRow = React.useCallback((rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const applyCalculatorToRow = React.useCallback(
    (newOver: number, newUnder: number) => {
      if (!calculatorRowId) return;
      const overFinal = roundStake(newOver, roundTo);
      const underFinal = roundStake(newUnder, roundTo);
      const overText = formatStake(overFinal, roundTo);
      const underText = formatStake(underFinal, roundTo);
      setCustomWagersBoth((prev) => ({
        ...prev,
        [calculatorRowId]: {
          over: overText,
          under: underText,
        },
      }));
      setCalculatorApplied({
        rowId: calculatorRowId,
        over: overText,
        under: underText,
      });
    },
    [calculatorRowId, roundTo, setCustomWagersBoth],
  );

  // Utility functions
  const logo = (id?: string) => getSportsbookLogo(id);
  const bookName = (id?: string) => getSportsbookName(id);

  const getBookFallbackUrl = (id?: string): string | undefined => {
    if (!id) return undefined;
    const sb = getSportsbookById(id);
    if (!sb) return undefined;
    const base =
      sb.affiliate && sb.affiliateLink
        ? sb.affiliateLink
        : sb.links.desktop || undefined;
    if (!base) return undefined;
    if (sb.requiresState && base.includes("{state}"))
      return base.replace(/\{state\}/g, "nj");
    return base;
  };

  // Get book URL - prioritizes direct/mobile link, falls back to book homepage
  const getBookUrl = (
    bk?: string,
    directUrl?: string,
    mobileUrl?: string | null,
  ): string | undefined => {
    if (isMobile() && mobileUrl) return mobileUrl;
    if (directUrl) return applyState(directUrl) || directUrl;
    if (mobileUrl) return mobileUrl;
    return getBookFallbackUrl(bk);
  };

  const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());

  const humanizeMarket = (mkt?: string) => {
    const s = String(mkt || "")
      .replace(/_/g, " ")
      .replace(/\bplayer\b\s*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return titleCase(s);
  };

  const isSpread = (mkt?: string) =>
    /spread|handicap|run[_ ]?line|puck[_ ]?line|goal[_ ]?line/i.test(
      String(mkt || ""),
    );
  const isMoneyline = (mkt?: string) =>
    /moneyline|\bml\b/i.test(String(mkt || ""));

  const extractPlayer = (name?: string) => {
    if (!name) return "";
    return name.replace(/\s+(Over|Under).*$/i, "").trim();
  };

  const formatPlayerShort = (full?: string) => {
    if (!full) return "";
    const tokens = full.trim().replace(/\s+/g, " ").split(" ");
    if (tokens.length === 0) return "";
    const suffixes = new Set([
      "jr",
      "jr.",
      "sr",
      "sr.",
      "ii",
      "iii",
      "iv",
      "v",
      "vi",
    ]);
    let end = tokens.length - 1;
    if (suffixes.has(tokens[end].toLowerCase())) end -= 1;
    if (end < 1) {
      const firstOnly = tokens[0];
      return `${firstOnly}, ${firstOnly.charAt(0).toUpperCase()}`;
    }
    const first = tokens[0];
    const prev = tokens[end - 1]?.toLowerCase();
    let last = tokens[end].replace(/[,]+/g, "");
    const lastPrefixes = new Set([
      "st.",
      "st",
      "de",
      "la",
      "le",
      "del",
      "della",
      "di",
      "da",
      "van",
      "von",
      "mc",
      "mac",
    ]);
    if (lastPrefixes.has(prev)) {
      last = tokens[end - 1] + " " + last;
      if (
        end - 2 >= 0 &&
        tokens[end - 2].toLowerCase() === "de" &&
        tokens[end - 1].toLowerCase() === "la"
      ) {
        last = tokens[end - 2] + " " + tokens[end - 1] + " " + tokens[end];
      }
    }
    const firstInitial = first.charAt(0).toUpperCase();
    return `${last}, ${firstInitial}`;
  };

  const formatOdds = (od: number) => (od > 0 ? `+${od}` : String(od));

  const compressTeamInText = (text: string, r: ArbRow) => {
    const homeName = r.ev?.home?.name || "";
    const awayName = r.ev?.away?.name || "";
    const homeAbbr = r.ev?.home?.abbr || homeName;
    const awayAbbr = r.ev?.away?.abbr || awayName;
    let out = text;
    if (homeName)
      out = out.replace(
        new RegExp(homeName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"),
        homeAbbr,
      );
    if (awayName)
      out = out.replace(
        new RegExp(awayName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"),
        awayAbbr,
      );
    return out.replace(/\s+/g, " ").trim();
  };

  const getSideLabel = (side: "over" | "under", r: ArbRow) => {
    if (isMoneyline(r.mkt))
      return side === "over"
        ? r.ev?.home?.abbr || "Home"
        : r.ev?.away?.abbr || "Away";
    if (isSpread(r.mkt)) {
      const raw = side === "over" ? r.o?.name || "" : r.u?.name || "";
      if (raw) return compressTeamInText(raw, r);
      const line = Number(r.ln);
      const home = r.ev?.home?.abbr || r.ev?.home?.name || "Home";
      const away = r.ev?.away?.abbr || r.ev?.away?.name || "Away";
      if (!Number.isFinite(line)) return side === "over" ? home : away;
      if (side === "over") {
        const sign = line >= 0 ? "+" : "";
        return `${home} ${sign}${line}`;
      } else {
        const awayLine = -line;
        const sign = awayLine >= 0 ? "+" : "";
        return `${away} ${sign}${awayLine}`;
      }
    }
    const lineStr = r.ln != null ? String(r.ln) : "";
    return `${side === "over" ? "Over" : "Under"} ${lineStr}`.trim();
  };

  // Detect if user is on mobile device
  const isMobile = () => {
    if (typeof window === "undefined") return false;
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ) || window.innerWidth < 768
    );
  };

  // Smart link selection: mobile → desktop → fallback
  const getBestLink = (
    bookId?: string,
    desktopUrl?: string | null,
    mobileUrl?: string | null,
  ) => {
    // If on mobile and mobile link exists, use it
    if (isMobile() && mobileUrl) return mobileUrl;

    // Otherwise use desktop link – apply user-state replacement
    if (desktopUrl) return applyState(desktopUrl) || desktopUrl;

    // Fallback to sportsbook homepage
    return getBookFallbackUrl(bookId);
  };

  const openLink = (
    bookId?: string,
    desktopUrl?: string | null,
    mobileUrl?: string | null,
  ) => {
    const target = getBestLink(bookId, desktopUrl, mobileUrl);
    if (!target) return;
    try {
      window.open(
        target,
        "_blank",
        "noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes",
      );
    } catch {
      void 0;
    }
  };

  const handleDualBet = (r: ArbRow) => {
    try {
      const overUrl = getBestLink(r.o?.bk, r.o?.u, r.o?.m);
      const underUrl = getBestLink(r.u?.bk, r.u?.u, r.u?.m);
      if (overUrl)
        window.open(
          overUrl,
          "_blank",
          "noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes",
        );
      if (underUrl)
        setTimeout(() => {
          window.open(
            underUrl,
            "_blank",
            "noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes",
          );
        }, 100);
    } catch {
      void 0;
    }
  };

  const formatGameTitle = (r: ArbRow) => {
    if (isMoneyline(r.mkt)) return "Moneyline";
    if (isSpread(r.mkt)) return "Spread";
    const player = extractPlayer(r.o?.name) || extractPlayer(r.u?.name);
    const market = humanizeMarket(r.mkt);
    const line = r.ln != null ? ` ${r.ln}` : "";
    return player ? `${player} ${market}${line}` : `${market}${line}`;
  };

  const toDecimal = (od: number) =>
    od > 0 ? od / 100 + 1 : 100 / Math.abs(od) + 1;
  const currency = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n);

  const calculatePayout = (odds: number, wager: number) =>
    odds > 0
      ? wager + (wager * odds) / 100
      : wager + (wager * 100) / Math.abs(odds);

  const calculateProfit = (
    overOdds: number,
    underOdds: number,
    overWager: number,
    underWager: number,
  ) => {
    const overPayout = calculatePayout(overOdds, overWager);
    const underPayout = calculatePayout(underOdds, underWager);
    const total = overWager + underWager;
    return Math.min(overPayout, underPayout) - total;
  };

  const calculateOptimalWager = (
    inputWager: number,
    inputOdds: number,
    oppositeOdds: number,
  ) => {
    const inputDec = toDecimal(inputOdds);
    const oppositeDec = toDecimal(oppositeOdds);
    const opposite = (inputWager * inputDec) / oppositeDec;
    return Math.round(opposite);
  };

  // Handle wager input change - allow free typing
  const handleWagerChange = (
    key: string,
    side: "over" | "under",
    value: string,
  ) => {
    // Allow empty string and any numeric input (including partial like "1.")
    setCustomWagers((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [side]: value,
      },
    }));
  };

  // Calculate the opposite bet when user finishes typing (on blur)
  const handleWagerBlur = (
    key: string,
    side: "over" | "under",
    value: string,
    r: ArbRow,
  ) => {
    const input = parseFloat(value);

    // If invalid or empty, clear both fields for this row
    if (!value || !isFinite(input) || input <= 0) {
      setCustomWagers((prev) => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
      return;
    }

    const overOdds = Number(r.o?.od || 0);
    const underOdds = Number(r.u?.od || 0);

    // Calculate the optimal opposite bet
    if (side === "over") {
      const other = calculateOptimalWager(input, overOdds, underOdds);
      setCustomWagers((prev) => ({
        ...prev,
        [key]: {
          over: String(Math.round(input)),
          under: String(other),
        },
      }));
    } else {
      const other = calculateOptimalWager(input, underOdds, overOdds);
      setCustomWagers((prev) => ({
        ...prev,
        [key]: {
          over: String(other),
          under: String(Math.round(input)),
        },
      }));
    }
  };

  const getBetPlan = (r: ArbRow, rowId: string) => {
    const overOdds = Number(r.o?.od || 0);
    const underOdds = Number(r.u?.od || 0);
    const custom = customWagers[rowId];
    let overStake: number, underStake: number;

    if (custom && (custom.over || custom.under)) {
      overStake = Math.max(0, parseFloat(custom.over || "0"));
      underStake = Math.max(0, parseFloat(custom.under || "0"));
    } else {
      const total = totalBetAmount;
      const overDec = toDecimal(overOdds);
      const underDec = toDecimal(underOdds);
      overStake = roundStake(
        (total * underDec) / (overDec + underDec),
        roundTo,
      );
      underStake = roundStake(total - overStake, roundTo);
    }

    const total = overStake + underStake;
    const overPayout = calculatePayout(overOdds, overStake);
    const underPayout = calculatePayout(underOdds, underStake);
    const profitIfOver = overPayout - total;
    const profitIfUnder = underPayout - total;
    const profitMin = Math.min(profitIfOver, profitIfUnder);
    const profitMax = Math.max(profitIfOver, profitIfUnder);
    // When not rounded, both sides are equal — show single value
    const profit = profitMin;
    const hasRange = roundTo > 0 && Math.abs(profitMax - profitMin) >= 0.01;

    return {
      overStake,
      underStake,
      total,
      profit,
      profitMin,
      profitMax,
      hasRange,
    };
  };

  // Arb Calculator Modal - allows editing odds and amounts
  // Memoize the component type so stream updates don't remount it (flicker).
  const ArbCalculatorModal = React.useMemo(
    () =>
      function ArbCalculatorModal({
        row,
        isOpen,
        onClose,
        defaultOverOdds,
        defaultUnderOdds,
        defaultOverStake,
        defaultUnderStake,
        onApply,
      }: {
        row: ArbRowWithId;
        isOpen: boolean;
        onClose: () => void;
        defaultOverOdds: number;
        defaultUnderOdds: number;
        defaultOverStake: number;
        defaultUnderStake: number;
        onApply: (overStake: number, underStake: number) => void;
      }) {
        const [overOdds, setOverOdds] = React.useState(String(defaultOverOdds));
        const [underOdds, setUnderOdds] = React.useState(
          String(defaultUnderOdds),
        );
        const [overStake, setOverStake] = React.useState(
          formatStake(defaultOverStake, roundTo),
        );
        const [underStake, setUnderStake] = React.useState(
          formatStake(defaultUnderStake, roundTo),
        );
        const [loadingOver, setLoadingOver] = React.useState(false);
        const [loadingUnder, setLoadingUnder] = React.useState(false);

        // Reset state when modal opens
        React.useEffect(() => {
          if (isOpen) {
            setOverOdds(String(defaultOverOdds));
            setUnderOdds(String(defaultUnderOdds));
            setOverStake(defaultOverStake.toFixed(2));
            setUnderStake(defaultUnderStake.toFixed(2));
            setLoadingOver(false);
            setLoadingUnder(false);
          }
        }, [
          isOpen,
          defaultOverOdds,
          defaultUnderOdds,
          defaultOverStake,
          defaultUnderStake,
        ]);

        // Close on escape
        React.useEffect(() => {
          const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
          };
          if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            document.body.style.overflow = "hidden";
          }
          return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "";
          };
        }, [isOpen, onClose]);

        const parseOdds = (s: string): number => {
          const n = parseInt(s.replace("+", ""), 10);
          return isFinite(n) ? n : 0;
        };

        const overOddsNum = parseOdds(overOdds);
        const underOddsNum = parseOdds(underOdds);
        const overStakeNum = parseFloat(overStake) || 0;
        const underStakeNum = parseFloat(underStake) || 0;
        const totalStake = overStakeNum + underStakeNum;

        const overPayout =
          overOddsNum !== 0 ? calculatePayout(overOddsNum, overStakeNum) : 0;
        const underPayout =
          underOddsNum !== 0 ? calculatePayout(underOddsNum, underStakeNum) : 0;
        const profitIfOver = overPayout - totalStake;
        const profitIfUnder = underPayout - totalStake;
        const profitMin = Math.min(profitIfOver, profitIfUnder);
        const profitMax = Math.max(profitIfOver, profitIfUnder);
        const profit = profitMin;
        const modalHasRange =
          roundTo > 0 && Math.abs(profitMax - profitMin) >= 0.01;
        const guaranteedPayout = Math.min(overPayout, underPayout);
        const roiPercent = totalStake > 0 ? (profit / totalStake) * 100 : 0;

        // Recalculate opposite stake when one side changes
        const recalcFromOver = (
          newOverStake: number,
          oOdds: number,
          uOdds: number,
        ) => {
          if (oOdds === 0 || uOdds === 0) return;
          const opposite = roundStake(
            calculateOptimalWager(newOverStake, oOdds, uOdds),
            roundTo,
          );
          setUnderStake(formatStake(opposite, roundTo));
        };

        const recalcFromUnder = (
          newUnderStake: number,
          oOdds: number,
          uOdds: number,
        ) => {
          if (oOdds === 0 || uOdds === 0) return;
          const opposite = roundStake(
            calculateOptimalWager(newUnderStake, uOdds, oOdds),
            roundTo,
          );
          setOverStake(formatStake(opposite, roundTo));
        };

        // Recalculate stakes when odds change (keeping over stake fixed)
        const handleOverOddsChange = (val: string) => {
          setOverOdds(val);
          const newOverOdds = parseOdds(val);
          if (newOverOdds !== 0 && underOddsNum !== 0 && overStakeNum > 0) {
            const opposite = roundStake(
              calculateOptimalWager(overStakeNum, newOverOdds, underOddsNum),
              roundTo,
            );
            setUnderStake(formatStake(opposite, roundTo));
          }
        };

        const handleUnderOddsChange = (val: string) => {
          setUnderOdds(val);
          const newUnderOdds = parseOdds(val);
          if (overOddsNum !== 0 && newUnderOdds !== 0 && overStakeNum > 0) {
            const opposite = roundStake(
              calculateOptimalWager(overStakeNum, overOddsNum, newUnderOdds),
              roundTo,
            );
            setUnderStake(formatStake(opposite, roundTo));
          }
        };

        const handleApply = () => {
          onApply(overStakeNum, underStakeNum);
          onClose();
        };

        // Open bet with loading state
        const openBet = (
          bk?: string,
          url?: string,
          mobileUrl?: string | null,
          side: "over" | "under" = "over",
        ) => {
          const setLoading = side === "over" ? setLoadingOver : setLoadingUnder;
          setLoading(true);

          // Brief loading state for feedback
          setTimeout(() => {
            const link = getBookUrl(bk, url, mobileUrl);
            if (link) window.open(link, "_blank", "noopener,noreferrer");
            // Reset loading after a moment
            setTimeout(() => setLoading(false), 1000);
          }, 150);
        };

        // Quick presets
        const presets = [100, 200, 300, 500];
        const applyPreset = (total: number) => {
          if (overOddsNum === 0 || underOddsNum === 0) return;
          const overDec = toDecimal(overOddsNum);
          const underDec = toDecimal(underOddsNum);
          const rawOver = (total * underDec) / (overDec + underDec);
          const newOverStake = roundStake(rawOver, roundTo);
          const newUnderStake = roundStake(total - newOverStake, roundTo);
          setOverStake(formatStake(newOverStake, roundTo));
          setUnderStake(formatStake(newUnderStake, roundTo));
        };

        // Don't render if not open or if we're on the server
        if (!isOpen || typeof document === "undefined") return null;

        const overLogo = logo(row.o?.bk);
        const underLogo = logo(row.u?.bk);
        const overBookNm = bookName(row.o?.bk);
        const underBookNm = bookName(row.u?.bk);
        const player = extractPlayer(row.o?.name) || extractPlayer(row.u?.name);
        const market = humanizeMarket(row.mkt);
        const gameTitle = `${row.ev?.away?.abbr || "Away"} @ ${row.ev?.home?.abbr || "Home"}`;

        // Use portal to render modal outside of table DOM hierarchy
        return createPortal(
          <AnimatePresence>
            {isOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                  onClick={onClose}
                />

                {/* Modal */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-2xl dark:border-neutral-800/50 dark:bg-neutral-900">
                    {/* Header */}
                    <div className="flex flex-col border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
                            <Calculator className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h2 className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
                              Arb Calculator
                            </h2>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              Adjust odds & stakes
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={onClose}
                          className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      {/* Market Info */}
                      <div className="flex items-center gap-2 px-5 pb-4 text-xs text-neutral-500 dark:text-neutral-400">
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                          <SportIcon
                            sport={row.lg?.sport?.toLowerCase() || "basketball"}
                            className="h-3 w-3"
                          />
                        </div>
                        <span className="font-medium text-neutral-600 dark:text-neutral-300">
                          {row.lg?.name}
                        </span>
                        <span className="text-neutral-300 dark:text-neutral-700">
                          •
                        </span>
                        <span>{gameTitle}</span>
                        {player && (
                          <>
                            <span className="text-neutral-300 dark:text-neutral-700">
                              •
                            </span>
                            <span className="font-medium text-neutral-700 dark:text-neutral-300">
                              {player}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="px-5 pt-4 pb-3">
                      <div className="flex gap-2">
                        {presets.map((amount) => (
                          <button
                            key={amount}
                            onClick={() => applyPreset(amount)}
                            className={cn(
                              "flex-1 rounded-lg py-2 text-xs font-semibold tabular-nums transition-all duration-150",
                              Math.abs(totalStake - amount) < 1
                                ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900"
                                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700",
                            )}
                          >
                            ${amount}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Odds & Stakes Grid */}
                    <div className="px-5 pb-5">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Over Side */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            {overLogo ? (
                              <img
                                src={overLogo}
                                alt={row.o?.bk || ""}
                                className="h-6 w-6 rounded object-contain"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded bg-neutral-200 dark:bg-neutral-700" />
                            )}
                            <span className="truncate text-sm font-medium text-neutral-700 dark:text-neutral-300">
                              {overBookNm}
                            </span>
                          </div>

                          {/* Odds Input */}
                          <div>
                            <label className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-500">
                              Odds
                            </label>
                            <input
                              type="text"
                              value={overOdds}
                              onChange={(e) =>
                                handleOverOddsChange(e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xl font-bold text-emerald-600 tabular-nums focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-emerald-400"
                            />
                          </div>

                          {/* Stake Input */}
                          <div>
                            <label className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-500">
                              Stake
                            </label>
                            <div className="relative mt-1.5">
                              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-neutral-400 dark:text-neutral-500">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={overStake}
                                onChange={(e) => {
                                  setOverStake(e.target.value);
                                  const n = parseFloat(e.target.value);
                                  if (isFinite(n) && n > 0) {
                                    recalcFromOver(
                                      n,
                                      overOddsNum,
                                      underOddsNum,
                                    );
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pr-3 pl-7 text-base font-bold text-neutral-900 tabular-nums focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                              />
                            </div>
                          </div>

                          {/* Bet Button — draggable link */}
                          <a
                            href={
                              getBookUrl(row.o?.bk, row.o?.u, row.o?.m) || "#"
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            draggable
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!loadingOver) {
                                openBet(row.o?.bk, row.o?.u, row.o?.m, "over");
                              }
                            }}
                            className={cn(
                              "mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold no-underline transition-all duration-150",
                              loadingOver
                                ? "pointer-events-none bg-emerald-700 text-white"
                                : "bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.98]",
                            )}
                          >
                            {loadingOver ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Opening...</span>
                              </>
                            ) : (
                              <>
                                <span>Bet at {overBookNm.split(" ")[0]}</span>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </>
                            )}
                          </a>
                        </div>

                        {/* Under Side */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            {underLogo ? (
                              <img
                                src={underLogo}
                                alt={row.u?.bk || ""}
                                className="h-6 w-6 rounded object-contain"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded bg-neutral-200 dark:bg-neutral-700" />
                            )}
                            <span className="truncate text-sm font-medium text-neutral-700 dark:text-neutral-300">
                              {underBookNm}
                            </span>
                          </div>

                          {/* Odds Input */}
                          <div>
                            <label className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-500">
                              Odds
                            </label>
                            <input
                              type="text"
                              value={underOdds}
                              onChange={(e) =>
                                handleUnderOddsChange(e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xl font-bold text-rose-600 tabular-nums focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-rose-400"
                            />
                          </div>

                          {/* Stake Input */}
                          <div>
                            <label className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-500">
                              Stake
                            </label>
                            <div className="relative mt-1.5">
                              <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-neutral-400 dark:text-neutral-500">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={underStake}
                                onChange={(e) => {
                                  setUnderStake(e.target.value);
                                  const n = parseFloat(e.target.value);
                                  if (isFinite(n) && n > 0) {
                                    recalcFromUnder(
                                      n,
                                      overOddsNum,
                                      underOddsNum,
                                    );
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full rounded-lg border border-neutral-200 bg-white py-2.5 pr-3 pl-7 text-base font-bold text-neutral-900 tabular-nums focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                              />
                            </div>
                          </div>

                          {/* Bet Button — draggable link */}
                          <a
                            href={
                              getBookUrl(row.u?.bk, row.u?.u, row.u?.m) || "#"
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            draggable
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!loadingUnder) {
                                openBet(row.u?.bk, row.u?.u, row.u?.m, "under");
                              }
                            }}
                            className={cn(
                              "mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold no-underline transition-all duration-150",
                              loadingUnder
                                ? "pointer-events-none bg-emerald-700 text-white"
                                : "bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.98]",
                            )}
                          >
                            {loadingUnder ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Opening...</span>
                              </>
                            ) : (
                              <>
                                <span>Bet at {underBookNm.split(" ")[0]}</span>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </>
                            )}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Summary Footer */}
                    <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-800/50">
                      {/* Stats Row */}
                      <div className="mb-4 flex items-center justify-between px-2">
                        <div className="text-center">
                          <div className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                            Total
                          </div>
                          <div className="mt-0.5 text-base font-bold text-neutral-900 tabular-nums dark:text-white">
                            {currency(totalStake)}
                          </div>
                        </div>
                        <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-700" />
                        <div className="text-center">
                          <div className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                            Payout
                          </div>
                          <div className="mt-0.5 text-base font-bold text-neutral-600 tabular-nums dark:text-neutral-300">
                            {currency(guaranteedPayout)}
                          </div>
                        </div>
                        <div className="h-10 w-px bg-neutral-200 dark:bg-neutral-700" />
                        <div className="text-center">
                          <div className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                            Profit
                          </div>
                          <div
                            className={cn(
                              "mt-0.5 text-lg font-bold tabular-nums",
                              profit > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-neutral-500 dark:text-neutral-400",
                            )}
                          >
                            {modalHasRange ? (
                              <>
                                {profit > 0 ? "+" : ""}
                                {currency(profitMin)} – {currency(profitMax)}
                              </>
                            ) : (
                              <>
                                {profit > 0 ? "+" : ""}
                                {currency(profit)}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ROI Badge */}
                      <div
                        className={cn(
                          "mb-4 rounded-xl py-2.5 text-center",
                          roiPercent > 0
                            ? "border border-emerald-200/50 bg-emerald-100 dark:border-emerald-800/30 dark:bg-emerald-900/40"
                            : "border border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800",
                        )}
                      >
                        <span
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            roiPercent > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-neutral-500 dark:text-neutral-400",
                          )}
                        >
                          {roiPercent > 0 ? "+" : ""}
                          {roiPercent.toFixed(2)}% ROI
                        </span>
                      </div>

                      {/* Apply Button */}
                      <button
                        onClick={handleApply}
                        className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
                      >
                        Apply to Table
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        );
      },
    [],
  );

  // Local, focus-safe cell for bet size editing. Avoids table-level re-renders on each keystroke.
  function BetSizeCell({ r, id }: { r: ArbRowWithId; id: string }) {
    const plan = getBetPlan(r, id);
    const formatAmount = (n: number) => {
      return formatStake(n, roundTo);
    };
    const [overLocal, setOverLocal] = React.useState<string>(
      formatAmount(plan.overStake),
    );
    const [underLocal, setUnderLocal] = React.useState<string>(
      formatAmount(plan.underStake),
    );

    // Sync local state if row id changes
    React.useEffect(() => {
      const p = getBetPlan(r, id);
      setOverLocal(formatAmount(p.overStake));
      setUnderLocal(formatAmount(p.underStake));
    }, [id, roundTo, r]);

    React.useEffect(() => {
      if (!calculatorApplied || calculatorApplied.rowId !== id) return;
      setOverLocal(calculatorApplied.over);
      setUnderLocal(calculatorApplied.under);
    }, [calculatorApplied, id]);

    const commitOver = (value: string) => {
      const input = parseFloat(value);
      if (!value || !isFinite(input) || input <= 0) {
        setCustomWagersBoth((prev) => {
          const ns = { ...prev };
          delete ns[id];
          return ns;
        });
        const p = getBetPlan(r, id);
        setOverLocal(String(Math.round(p.overStake)));
        setUnderLocal(String(Math.round(p.underStake)));
        return;
      }
      const overOdds = Number(r.o?.od || 0);
      const underOdds = Number(r.u?.od || 0);
      const other = calculateOptimalWager(input, overOdds, underOdds);
      const overFinal = roundStake(input, roundTo);
      const underFinal = roundStake(other, roundTo);
      setCustomWagersBoth((prev) => ({
        ...prev,
        [id]: {
          over: formatStake(overFinal, roundTo),
          under: formatStake(underFinal, roundTo),
        },
      }));
      setOverLocal(formatStake(overFinal, roundTo));
      setUnderLocal(formatStake(underFinal, roundTo));
    };

    const commitUnder = (value: string) => {
      const input = parseFloat(value);
      if (!value || !isFinite(input) || input <= 0) {
        setCustomWagersBoth((prev) => {
          const ns = { ...prev };
          delete ns[id];
          return ns;
        });
        const p = getBetPlan(r, id);
        setOverLocal(String(Math.round(p.overStake)));
        setUnderLocal(String(Math.round(p.underStake)));
        return;
      }
      const overOdds = Number(r.o?.od || 0);
      const underOdds = Number(r.u?.od || 0);
      const other = calculateOptimalWager(input, underOdds, overOdds);
      const underFinal = roundStake(input, roundTo);
      const overFinal = roundStake(other, roundTo);
      setCustomWagersBoth((prev) => ({
        ...prev,
        [id]: {
          over: formatStake(overFinal, roundTo),
          under: formatStake(underFinal, roundTo),
        },
      }));
      setOverLocal(formatStake(overFinal, roundTo));
      setUnderLocal(formatStake(underFinal, roundTo));
    };

    return (
      <div className="flex items-stretch gap-1.5">
        <div className="min-w-[170px] rounded-lg border border-neutral-200/60 bg-neutral-50/50 p-2.5 dark:border-neutral-700/60 dark:bg-neutral-800/50">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Over Bet
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-neutral-500">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={overLocal}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOverLocal(val);
                    const n = parseFloat(val);
                    if (!val || !isFinite(n) || n <= 0) return;
                    const overOdds = Number(r.o?.od || 0);
                    const underOdds = Number(r.u?.od || 0);
                    if (
                      isFinite(overOdds) &&
                      isFinite(underOdds) &&
                      (overOdds !== 0 || underOdds !== 0)
                    ) {
                      const other = calculateOptimalWager(
                        n,
                        overOdds,
                        underOdds,
                      );
                      const overFinal = roundStake(n, roundTo);
                      const underFinal = roundStake(other, roundTo);
                      setUnderLocal(formatStake(underFinal, roundTo));
                      setCustomWagersBoth((prev) => ({
                        ...prev,
                        [id]: {
                          over: formatStake(overFinal, roundTo),
                          under: formatStake(underFinal, roundTo),
                        },
                      }));
                    }
                  }}
                  onBlur={(e) => commitOver(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.target.select();
                    setPinnedRowId(id);
                  }}
                  className="h-6 w-20 rounded border border-neutral-200/60 bg-white px-2 text-right text-xs font-medium focus:ring-1 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700/60 dark:bg-neutral-900 dark:focus:ring-neutral-600"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                Under Bet
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-neutral-500">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={underLocal}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUnderLocal(val);
                    const n = parseFloat(val);
                    if (!val || !isFinite(n) || n <= 0) return;
                    const overOdds = Number(r.o?.od || 0);
                    const underOdds = Number(r.u?.od || 0);
                    if (
                      isFinite(overOdds) &&
                      isFinite(underOdds) &&
                      (overOdds !== 0 || underOdds !== 0)
                    ) {
                      const other = calculateOptimalWager(
                        n,
                        underOdds,
                        overOdds,
                      );
                      const underFinal = roundStake(n, roundTo);
                      const overFinal = roundStake(other, roundTo);
                      setOverLocal(formatStake(overFinal, roundTo));
                      setCustomWagersBoth((prev) => ({
                        ...prev,
                        [id]: {
                          over: formatStake(overFinal, roundTo),
                          under: formatStake(underFinal, roundTo),
                        },
                      }));
                    }
                  }}
                  onBlur={(e) => commitUnder(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.target.select();
                    setPinnedRowId(id);
                  }}
                  className="h-6 w-20 rounded border border-neutral-200/60 bg-white px-2 text-right text-xs font-medium focus:ring-1 focus:ring-neutral-400 focus:outline-none dark:border-neutral-700/60 dark:bg-neutral-900 dark:focus:ring-neutral-600"
                />
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-neutral-200/60 pt-2 dark:border-neutral-700/60">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Total
            </span>
            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {currency(
                (parseFloat(overLocal || "0") || 0) +
                  (parseFloat(underLocal || "0") || 0),
              )}
            </span>
          </div>
        </div>

        {/* Calculator Button */}
        <Tooltip content="Open calculator to adjust odds">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openCalculator(r, id, {
                overOdds: Number(r.o?.od || 0),
                underOdds: Number(r.u?.od || 0),
                overStake: parseFloat(overLocal) || 0,
                underStake: parseFloat(underLocal) || 0,
              });
            }}
            className="flex w-8 items-center justify-center rounded-lg border border-neutral-200/60 bg-neutral-50/50 transition-colors hover:bg-neutral-100 dark:border-neutral-700/60 dark:bg-neutral-800/50 dark:hover:bg-neutral-700/50"
          >
            <Calculator className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          </button>
        </Tooltip>
      </div>
    );
  }

  // Prepare data with IDs and flags, keeping pinned row at top
  const data = useMemo<ArbRowWithId[]>(() => {
    const mapped = rows.map((r, i) => {
      const id = ids[i];
      const isPinned = id === pinnedRowId;
      return {
        ...r,
        _id: id,
        _isNew: added?.has(id),
        _hasChange:
          changes.has(id) && Object.keys(changes.get(id) || {}).length > 0,
        _isTeaser: (r as any)._isTeaser || false,
        _isPinned: isPinned,
      };
    });

    // If there's a pinned row, move it to the top
    if (pinnedRowId) {
      const pinnedIndex = mapped.findIndex((row) => row._id === pinnedRowId);
      if (pinnedIndex === -1) {
        // Pinned row no longer exists, clear pin
        setPinnedRowId(null);
        return mapped;
      }
      // Move pinned row to front
      const [pinned] = mapped.splice(pinnedIndex, 1);
      return [pinned, ...mapped];
    }

    return mapped;
  }, [rows, ids, added, changes, pinnedRowId]);

  // Define columns
  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => (row.roi_bps || 0) / 100, {
        id: "roi",
        header: "ROI %",
        size: 100,
        enableSorting: true,
        sortingFn: "basic",
        cell: (info) => {
          const roiPct = info.getValue().toFixed(2);
          const roiValue = parseFloat(roiPct);
          const isPinned = (info.row.original as ArbRowWithId)._isPinned;
          const rowId = (info.row.original as ArbRowWithId)._id;

          // High-tier opportunities (>5% ROI) get extra glow
          const isHighTier = roiValue >= 5;

          return (
            <div className="flex items-center gap-2">
              {isPinned && (
                <Tooltip content="Click to unpin this row">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPinnedRowId(null);
                    }}
                    className="bg-brand/20 hover:bg-brand/30 rounded-md p-1 transition-colors"
                  >
                    <Pin className="text-brand h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              )}
              <span
                className={cn(
                  "roi-badge up",
                  isHighTier &&
                    "shadow-[0_0_12px_rgba(132,204,22,0.4)] ring-1 ring-[var(--accent-strong)]/20",
                )}
              >
                <span className="caret"></span>+{roiPct}%
              </span>
            </div>
          );
        },
      }),

      columnHelper.accessor((row) => row.lg?.name || "", {
        id: "league",
        header: "LEAGUE",
        size: 100,
        enableSorting: true,
        sortingFn: "alphanumeric",
        cell: (info) => {
          const r = info.row.original;

          if (!r.lg) {
            return null;
          }
          return (
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                <SportIcon sport={r.lg.sport} className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-semibold tracking-wide text-neutral-600 uppercase dark:text-neutral-400">
                {r.lg.name}
              </span>
            </div>
          );
        },
      }),

      columnHelper.display({
        id: "game",
        header: "GAME",
        size: 250,
        cell: (info) => {
          const r = info.row.original;
          const roiPct = ((r.roi_bps ?? 0) / 100).toFixed(2);
          const isHighROI = (r.roi_bps ?? 0) / 100 > 10;
          const isTeaser = r._isTeaser;
          const isExpanded = expandedRows.has(r._id);

          return (
            <div className="flex items-start gap-2">
              {!isTeaser && (
                <ChevronRight
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-hover/row:text-emerald-500",
                    isExpanded && "rotate-90 text-emerald-500",
                  )}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold break-words whitespace-normal text-neutral-900 dark:text-white">
                  {formatGameTitle(r)}
                </div>
                <div className="mt-0.5 font-mono text-xs tracking-tight whitespace-normal text-neutral-500 dark:text-neutral-400">
                  {r.ev?.away?.abbr} @ {r.ev?.home?.abbr}
                </div>
              </div>
              {!isTeaser && <ArbRiskIndicator row={r} variant="icon" />}
              {isHighROI && !isTeaser && (
                <Tooltip content="Caution: High ROI. Double-check market and odds before placing bet.">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500 dark:text-amber-400" />
                </Tooltip>
              )}
            </div>
          );
        },
      }),

      columnHelper.display({
        id: "time",
        header: "TIME",
        size: 110,
        cell: (info) => {
          const r = info.row.original;
          const d = r.ev?.dt ? new Date(r.ev.dt) : null;

          // Check if the date is today
          const isToday = d
            ? (() => {
                const today = new Date();
                return (
                  d.getDate() === today.getDate() &&
                  d.getMonth() === today.getMonth() &&
                  d.getFullYear() === today.getFullYear()
                );
              })()
            : false;

          const dateStr = d
            ? isToday
              ? "Today"
              : d.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                })
            : "TBD";
          const timeStr = d
            ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : "";

          if ((r as any).ev?.live) {
            return (
              <div className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-sm font-medium">Live</span>
              </div>
            );
          }

          return (
            <div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                {dateStr}
              </div>
              {timeStr && (
                <div className="text-xs text-neutral-500 dark:text-neutral-500">
                  {timeStr}
                </div>
              )}
            </div>
          );
        },
      }),

      columnHelper.display({
        id: "market",
        header: "MARKET",
        size: 350,
        cell: (info) => {
          const r = info.row.original;
          const overLogo = logo(r.o?.bk);
          const underLogo = logo(r.u?.bk);
          const isHighlighted = r._isNew || r._hasChange;
          const isTeaser = r._isTeaser;

          return (
            <div className="relative">
              {/* Content wrapper - blurred for teaser rows only */}
              <div
                className={cn(
                  "rounded-lg",
                  isHighlighted && "ring-1 ring-emerald-500/40",
                  isTeaser && "pointer-events-none blur-sm select-none",
                )}
              >
                {/* Market Label */}
                <div className="mb-2 flex flex-wrap items-center gap-2 pl-2">
                  <div className="inline-flex items-center gap-2 rounded border border-neutral-200/60 bg-neutral-50/50 px-2 py-0.5 dark:border-neutral-700/60 dark:bg-neutral-800/50">
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {(() => {
                        const label = humanizeMarket(r.mkt);
                        if (isMoneyline(r.mkt) || isSpread(r.mkt)) return label;
                        const player =
                          extractPlayer(r.o?.name) || extractPlayer(r.u?.name);
                        const short = formatPlayerShort(player);
                        return short ? `${label} - ${short}` : label;
                      })()}
                    </span>
                  </div>
                  {!isTeaser && <ArbRiskIndicator row={r} />}
                </div>

                {/* Over/Under with Dual Bet Button - Grouped Action Card */}
                <div
                  className={cn(
                    "market-action-card relative rounded-lg border border-transparent bg-gradient-to-br from-transparent to-transparent py-2 pr-2 pl-2 transition-all duration-200",
                  )}
                >
                  <div className="space-y-1.5 pr-12">
                    {/* Over Side - Draggable Link Card */}
                    <Tooltip content={`Place bet on ${bookName(r.o?.bk)}`}>
                      <a
                        href={getBestLink(r.o?.bk, r.o?.u, r.o?.m) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        draggable
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openLink(r.o?.bk, r.o?.u, r.o?.m);
                        }}
                        className="group flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-neutral-200/60 bg-neutral-50/30 px-2.5 py-1.5 no-underline transition-colors hover:bg-neutral-100/50 dark:border-neutral-700/60 dark:bg-neutral-800/30 dark:hover:bg-neutral-700/40"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {overLogo && (
                            <img
                              src={overLogo}
                              alt={r.o?.bk || ""}
                              className="h-5 w-5 shrink-0 object-contain"
                              draggable={false}
                            />
                          )}
                          <div className="market-positive truncate text-xs font-medium sm:text-sm">
                            {getSideLabel("over", r)}
                          </div>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-1.5">
                          <span className="market-positive text-xs font-bold sm:text-sm">
                            {formatOdds(Number(r.o?.od || 0))}
                          </span>
                          {r.o?.max != null && (
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              ($
                              {r.o.max.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                              )
                            </span>
                          )}
                        </div>
                      </a>
                    </Tooltip>

                    {/* Under Side - Draggable Link Card */}
                    <Tooltip content={`Place bet on ${bookName(r.u?.bk)}`}>
                      <a
                        href={getBestLink(r.u?.bk, r.u?.u, r.u?.m) || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        draggable
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openLink(r.u?.bk, r.u?.u, r.u?.m);
                        }}
                        className="group flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-neutral-200/60 bg-neutral-50/30 px-2.5 py-1.5 no-underline transition-colors hover:bg-neutral-100/50 dark:border-neutral-700/60 dark:bg-neutral-800/30 dark:hover:bg-neutral-700/40"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {underLogo && (
                            <img
                              src={underLogo}
                              alt={r.u?.bk || ""}
                              className="h-5 w-5 shrink-0 object-contain"
                              draggable={false}
                            />
                          )}
                          <div className="market-negative truncate text-xs font-medium sm:text-sm">
                            {getSideLabel("under", r)}
                          </div>
                        </div>
                        <div className="ml-2 flex shrink-0 items-center gap-1.5">
                          <span className="market-negative text-xs font-bold sm:text-sm">
                            {formatOdds(Number(r.u?.od || 0))}
                          </span>
                          {r.u?.max != null && (
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              ($
                              {r.u.max.toLocaleString(undefined, {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}
                              )
                            </span>
                          )}
                        </div>
                      </a>
                    </Tooltip>
                  </div>

                  {/* Dual Bet Button */}
                  <Tooltip content="Open both bets">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDualBet(r);
                      }}
                      className="dual-bet-btn absolute top-2 right-2 bottom-2 !h-auto w-9"
                    >
                      <Zap />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Unlock button - positioned absolutely, NOT blurred */}
              {isTeaser && (
                <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
                  <Tooltip content="Upgrade to Sharp to unlock premium arbitrage opportunities">
                    <button
                      onClick={() => (window.location.href = "/pricing")}
                      className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-lg border-2 border-white/20 bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-xl transition-all hover:scale-105 hover:bg-sky-600 dark:bg-sky-500 dark:hover:bg-sky-400"
                    >
                      <Lock className="h-4 w-4" />
                      <span>Unlock</span>
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          );
        },
      }),

      columnHelper.display({
        id: "bet-size",
        header: "BET SIZE",
        size: 200,
        cell: (info) => {
          const r = info.row.original;
          const id = r._id;
          return <BetSizeCell r={r} id={id} />;
        },
      }),

      columnHelper.display({
        id: "profit",
        header: "PROFIT",
        size: 120,
        cell: (info) => {
          const r = info.row.original;
          const id = r._id;
          const custom = customWagersRef.current[id] ?? customWagers[id];
          // Live recompute with custom inputs if present
          const over =
            custom?.over != null && custom.over !== ""
              ? Math.max(0, parseFloat(custom.over))
              : undefined;
          const under =
            custom?.under != null && custom.under !== ""
              ? Math.max(0, parseFloat(custom.under))
              : undefined;
          let profitMin: number,
            profitMax: number,
            hasRange = false;
          if (over !== undefined || under !== undefined) {
            const overOdds = Number(r.o?.od || 0);
            const underOdds = Number(r.u?.od || 0);
            const overStake = over ?? 0;
            const underStake = under ?? 0;
            const overPayout = calculatePayout(overOdds, overStake);
            const underPayout = calculatePayout(underOdds, underStake);
            const total = overStake + underStake;
            const pOver = overPayout - total;
            const pUnder = underPayout - total;
            profitMin = Math.min(pOver, pUnder);
            profitMax = Math.max(pOver, pUnder);
            hasRange = roundTo > 0 && Math.abs(profitMax - profitMin) >= 0.01;
          } else {
            const plan = getBetPlan(r, id);
            profitMin = plan.profitMin;
            profitMax = plan.profitMax;
            hasRange = plan.hasRange;
          }

          return (
            <div className="text-center">
              <div className="bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] bg-clip-text text-base font-bold text-transparent tabular-nums">
                {hasRange ? (
                  <>
                    {currency(profitMin)} – {currency(profitMax)}
                  </>
                ) : (
                  currency(profitMin)
                )}
              </div>
            </div>
          );
        },
      }),
    ],
    [totalBetAmount, roundTo, added, changes, expandedRows],
  );

  // Create table instance with custom sorting that preserves teaser row positions
  const tableProps = useTable({
    data,
    columns,
    getRowId: (row) => row._id,
    enableColumnResizing: false,
    initialSorting: !isPro
      ? []
      : [
          // Disable initial sorting for free users (to preserve teaser positions)
          {
            id: "roi",
            desc: true, // Sort by ROI descending (highest first)
          },
        ],
  });

  if (!rows?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200/80 bg-white py-16 shadow-sm dark:border-neutral-800/50 dark:bg-neutral-900">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-200/50 bg-gradient-to-br from-neutral-100 to-neutral-50 shadow-sm dark:border-neutral-700/50 dark:from-neutral-800 dark:to-neutral-900">
          <TrendingUp className="h-7 w-7 text-neutral-400 dark:text-neutral-500" />
        </div>
        <h3 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          No opportunities found
        </h3>
        <p className="max-w-sm text-center text-sm text-neutral-500 dark:text-neutral-400">
          No arbitrage opportunities match your current filters. Try adjusting
          your sportsbooks or ROI settings.
        </p>
      </div>
    );
  }

  return (
    <>
      <Table
        {...tableProps}
        sortableColumns={["roi", "time"]}
        resourceName={(plural) => (plural ? "opportunities" : "opportunity")}
        className={cn(
          // Global table styles
          "[&_td]:border-b [&_td]:border-neutral-100 [&_td]:dark:border-neutral-800/50",
          // Header row gradient - applied to tr, individual th cells transparent
          "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10",
          "[&_thead_tr]:bg-gradient-to-r [&_thead_tr]:from-neutral-50 [&_thead_tr]:via-neutral-50 [&_thead_tr]:to-neutral-100/50",
          "dark:[&_thead_tr]:from-neutral-900 dark:[&_thead_tr]:via-neutral-900 dark:[&_thead_tr]:to-neutral-800/50",
          "[&_th]:border-b [&_th]:border-neutral-100 [&_th]:dark:border-neutral-800/50",
        )}
        containerClassName="rounded-2xl border border-neutral-200/80 dark:border-neutral-800/50 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden"
        scrollWrapperClassName="max-h-[calc(100vh-180px)] overflow-y-auto"
        thClassName={(columnId) =>
          cn(
            // Individual cell styles - background transparent to show row gradient
            "!bg-transparent font-semibold text-[11px] text-neutral-600 dark:text-neutral-400 uppercase tracking-wider h-12",
            columnId === "roi" && "text-center pr-6",
            columnId === "league" && "pl-6",
            columnId === "game" && "pr-6",
            columnId === "time" && "text-center pl-6 pr-6",
            columnId === "market" && "pl-6 pr-6",
            columnId === "bet-size" && "pl-6 pr-6",
            columnId === "profit" && "text-right pl-6",
          )
        }
        tdClassName={(columnId, row) =>
          cn(
            // Premium zebra striping
            row.index % 2 === 0
              ? "bg-white dark:bg-neutral-900"
              : "bg-neutral-50/50 dark:bg-neutral-800/20",
            // Highlight new rows
            (row.original as ArbRowWithId)._isNew &&
              "!bg-emerald-50/40 dark:!bg-emerald-950/30",
            // Blur teaser rows but NOT the ROI/Profit columns (to show FOMO)
            (row.original as ArbRowWithId)._isTeaser &&
              columnId !== "roi" &&
              columnId !== "profit" &&
              columnId !== "market" &&
              "blur-sm select-none pointer-events-none",
            // Market column needs to be relative for unlock button positioning
            (row.original as ArbRowWithId)._isTeaser &&
              columnId === "market" &&
              "relative",
            // Add slight backdrop blur behind ROI and Profit for teaser rows
            (row.original as ArbRowWithId)._isTeaser &&
              (columnId === "roi" || columnId === "profit") &&
              "relative backdrop-blur-[2px]",
            "py-3",
            columnId === "roi" && "text-center pr-6",
            columnId === "league" && "pl-6",
            columnId === "game" && "pr-6",
            columnId === "time" && "text-center pl-6 pr-6",
            columnId === "market" && "pl-6 pr-6",
            columnId === "bet-size" && "pl-6 pr-6",
            columnId === "profit" && "text-right pl-6",
          )
        }
        rowProps={(row) => {
          const isTeaser = (row.original as ArbRowWithId)._isTeaser;
          const isPinned = (row.original as ArbRowWithId)._isPinned;
          const isExpanded = expandedRows.has(
            (row.original as ArbRowWithId)._id,
          );
          return {
            className: cn(
              "group/row transition-all duration-200 ease-out",
              // Premium hover effect matching Positive EV
              !isTeaser &&
                "cursor-pointer hover:bg-gradient-to-r hover:from-emerald-50/80 hover:to-emerald-50/20 dark:hover:from-emerald-950/40 dark:hover:to-emerald-950/10",
              (row.original as ArbRowWithId)._isNew &&
                "!bg-emerald-50/30 dark:!bg-emerald-950/20",
              isExpanded &&
                "!bg-gradient-to-r !from-emerald-50/80 !to-emerald-50/20 dark:!from-emerald-950/40 dark:!to-emerald-950/10",
              isTeaser &&
                "relative bg-gradient-to-r from-[var(--tertiary)]/5 to-[var(--tertiary-strong)]/5 border-l-2 border-[var(--tertiary)]",
              isPinned &&
                "sticky top-14 z-[5] !bg-gradient-to-r !from-brand/10 !to-brand/5 dark:!from-brand/20 dark:!to-brand/10 border-l-2 border-brand shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]",
            ),
            "aria-expanded": !isTeaser ? isExpanded : undefined,
            ...(isTeaser && {
              onClick: (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
              },
            }),
          };
        }}
        onRowClick={(row) => {
          const original = row.original as ArbRowWithId;
          if (original._isTeaser) return;
          toggleExpandedRow(original._id);
        }}
        renderSubRow={(row, colSpan) => {
          const original = row.original as ArbRowWithId;
          if (original._isTeaser || !expandedRows.has(original._id))
            return null;
          return (
            <AnimatePresence initial={false}>
              <ArbExpandedSubRow row={original} colSpan={colSpan} />
            </AnimatePresence>
          );
        }}
      />

      {calculatorSnapshotRef.current && calculatorRowId && (
        <ArbCalculatorModal
          row={calculatorSnapshotRef.current}
          isOpen={calculatorOpen}
          onClose={closeCalculator}
          defaultOverOdds={calculatorDefaults.overOdds}
          defaultUnderOdds={calculatorDefaults.underOdds}
          defaultOverStake={calculatorDefaults.overStake}
          defaultUnderStake={calculatorDefaults.underStake}
          onApply={applyCalculatorToRow}
        />
      )}
    </>
  );
}
