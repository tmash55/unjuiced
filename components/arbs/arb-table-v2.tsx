"use client";

import React, { useMemo, useState } from "react";
import type { ArbRow } from "@/lib/arb-schema";
import { createColumnHelper } from "@tanstack/react-table";
import { Table, useTable } from "@/components/table";
import { Zap, ExternalLink, AlertTriangle, Lock, Pin } from "lucide-react";
import { sportsbooks } from "@/lib/data/sportsbooks";
import { cn } from "@/lib/utils";
import { SportIcon } from "@/components/icons/sport-icons";
import { Tooltip } from "@/components/tooltip";

const SB_MAP = new Map(sportsbooks.map((sb) => [sb.id.toLowerCase(), sb]));
const norm = (s?: string) => (s || "").toLowerCase();

interface ArbTableProps {
  rows: ArbRow[];
  ids: string[];
  changes: Map<string, { roi?: "up" | "down"; o?: "up" | "down"; u?: "up" | "down" }>;
  added?: Set<string>;
  totalBetAmount?: number;
  roundBets?: boolean;
  isPro?: boolean;
}

interface ArbRowWithId extends ArbRow {
  _id: string;
  _isNew?: boolean;
  _hasChange?: boolean;
  _isTeaser?: boolean;
  _isPinned?: boolean;
}

const columnHelper = createColumnHelper<ArbRowWithId>();

export function ArbTableV2({ rows, ids, changes, added, totalBetAmount = 200, roundBets = false, isPro = true }: ArbTableProps) {
  const [customWagers, setCustomWagers] = useState<Record<string, { over: string; under: string }>>({});
  const customWagersRef = React.useRef<Record<string, { over: string; under: string }>>({});
  const [pinnedRowId, setPinnedRowId] = useState<string | null>(null);

  const setCustomWagersBoth = React.useCallback((updater: (prev: Record<string, { over: string; under: string }>) => Record<string, { over: string; under: string }>) => {
    setCustomWagers(prev => {
      const next = updater(prev);
      customWagersRef.current = next;
      return next;
    });
  }, []);

  // Utility functions
  const logo = (id?: string) => SB_MAP.get(norm(id))?.logo;
  const bookName = (id?: string) => SB_MAP.get(norm(id))?.name || (id || "");
  
  const getBookFallbackUrl = (id?: string): string | undefined => {
    if (!id) return undefined;
    const sb = SB_MAP.get(norm(id));
    if (!sb) return undefined;
    const base = (sb.affiliate && sb.affiliateLink) ? sb.affiliateLink : (sb.url || undefined);
    if (!base) return undefined;
    if (sb.requiresState && base.includes("{state}")) return base.replace(/\{state\}/g, "nj");
    return base;
  };

  const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());
  
  const humanizeMarket = (mkt?: string) => {
    const s = String(mkt || '')
      .replace(/_/g, ' ')
      .replace(/\bplayer\b\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return titleCase(s);
  };

  const isSpread = (mkt?: string) => /spread|handicap|run[_ ]?line|puck[_ ]?line|goal[_ ]?line/i.test(String(mkt || ''));
  const isMoneyline = (mkt?: string) => /moneyline|\bml\b/i.test(String(mkt || ''));

  const extractPlayer = (name?: string) => {
    if (!name) return '';
    return name.replace(/\s+(Over|Under).*$/i, '').trim();
  };

  const formatPlayerShort = (full?: string) => {
    if (!full) return '';
    const tokens = full.trim().replace(/\s+/g, ' ').split(' ');
    if (tokens.length === 0) return '';
    const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'vi']);
    let end = tokens.length - 1;
    if (suffixes.has(tokens[end].toLowerCase())) end -= 1;
    if (end < 1) {
      const firstOnly = tokens[0];
      return `${firstOnly}, ${firstOnly.charAt(0).toUpperCase()}`;
    }
    const first = tokens[0];
    const prev = tokens[end - 1]?.toLowerCase();
    let last = tokens[end].replace(/[,]+/g, '');
    const lastPrefixes = new Set(['st.', 'st', 'de', 'la', 'le', 'del', 'della', 'di', 'da', 'van', 'von', 'mc', 'mac']);
    if (lastPrefixes.has(prev)) {
      last = tokens[end - 1] + ' ' + last;
      if (end - 2 >= 0 && tokens[end - 2].toLowerCase() === 'de' && tokens[end - 1].toLowerCase() === 'la') {
        last = tokens[end - 2] + ' ' + tokens[end - 1] + ' ' + tokens[end];
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
    if (homeName) out = out.replace(new RegExp(homeName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"), homeAbbr);
    if (awayName) out = out.replace(new RegExp(awayName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"), awayAbbr);
    return out.replace(/\s+/g, " ").trim();
  };

  const getSideLabel = (side: "over" | "under", r: ArbRow) => {
    if (isMoneyline(r.mkt)) return side === "over" ? (r.ev?.home?.abbr || "Home") : (r.ev?.away?.abbr || "Away");
    if (isSpread(r.mkt)) {
      const raw = side === "over" ? (r.o?.name || "") : (r.u?.name || "");
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
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth < 768;
  };

  // Smart link selection: mobile → desktop → fallback
  const getBestLink = (bookId?: string, desktopUrl?: string | null, mobileUrl?: string | null) => {
    // If on mobile and mobile link exists, use it
    if (isMobile() && mobileUrl) return mobileUrl;
    
    // Otherwise use desktop link
    if (desktopUrl) return desktopUrl;
    
    // Fallback to sportsbook homepage
    return getBookFallbackUrl(bookId);
  };

  const openLink = (bookId?: string, desktopUrl?: string | null, mobileUrl?: string | null) => {
    const target = getBestLink(bookId, desktopUrl, mobileUrl);
    if (!target) return;
    try {
      window.open(target, '_blank', 'noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes');
    } catch { void 0; }
  };

  const handleDualBet = (r: ArbRow) => {
    try {
      const overUrl = getBestLink(r.o?.bk, r.o?.u, r.o?.m);
      const underUrl = getBestLink(r.u?.bk, r.u?.u, r.u?.m);
      if (overUrl) window.open(overUrl, '_blank', 'noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes');
      if (underUrl) setTimeout(() => { window.open(underUrl, '_blank', 'noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes'); }, 100);
    } catch { void 0; }
  };

  const formatGameTitle = (r: ArbRow) => {
    if (isMoneyline(r.mkt)) return 'Moneyline';
    if (isSpread(r.mkt)) return 'Spread';
    const player = extractPlayer(r.o?.name) || extractPlayer(r.u?.name);
    const market = humanizeMarket(r.mkt);
    const line = r.ln != null ? ` ${r.ln}` : '';
    return player ? `${player} ${market}${line}` : `${market}${line}`;
  };

  const toDecimal = (od: number) => (od > 0 ? (od / 100) + 1 : (100 / Math.abs(od)) + 1);
  const currency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
  
  const calculatePayout = (odds: number, wager: number) => 
    odds > 0 ? wager + (wager * odds / 100) : wager + (wager * 100 / Math.abs(odds));
  
  const calculateProfit = (overOdds: number, underOdds: number, overWager: number, underWager: number) => {
    const overPayout = calculatePayout(overOdds, overWager);
    const underPayout = calculatePayout(underOdds, underWager);
    const total = overWager + underWager;
    return Math.min(overPayout, underPayout) - total;
  };

  const calculateOptimalWager = (inputWager: number, inputOdds: number, oppositeOdds: number) => {
    const inputDec = toDecimal(inputOdds);
    const oppositeDec = toDecimal(oppositeOdds);
    const opposite = (inputWager * inputDec) / oppositeDec;
    return Math.round(opposite);
  };

  // Handle wager input change - allow free typing
  const handleWagerChange = (key: string, side: 'over' | 'under', value: string) => {
    // Allow empty string and any numeric input (including partial like "1.")
    setCustomWagers(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [side]: value
      }
    }));
  };

  // Calculate the opposite bet when user finishes typing (on blur)
  const handleWagerBlur = (key: string, side: 'over' | 'under', value: string, r: ArbRow) => {
    const input = parseFloat(value);
    
    // If invalid or empty, clear both fields for this row
    if (!value || !isFinite(input) || input <= 0) {
      setCustomWagers(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
      return;
    }

    const overOdds = Number(r.o?.od || 0);
    const underOdds = Number(r.u?.od || 0);
    
    // Calculate the optimal opposite bet
    if (side === 'over') {
      const other = calculateOptimalWager(input, overOdds, underOdds);
      setCustomWagers(prev => ({
        ...prev,
        [key]: {
          over: String(Math.round(input)),
          under: String(other)
        }
      }));
    } else {
      const other = calculateOptimalWager(input, underOdds, overOdds);
      setCustomWagers(prev => ({
        ...prev,
        [key]: {
          over: String(other),
          under: String(Math.round(input))
        }
      }));
    }
  };

  const getBetPlan = (r: ArbRow, rowId: string) => {
    const custom = customWagers[rowId];
    if (custom && (custom.over || custom.under)) {
      const overStake = Math.max(0, parseFloat(custom.over || '0'));
      const underStake = Math.max(0, parseFloat(custom.under || '0'));
      const total = overStake + underStake;
      const profit = calculateProfit(Number(r.o?.od || 0), Number(r.u?.od || 0), overStake, underStake);
      return { overStake, underStake, total, profit };
    }
    const total = totalBetAmount;
    const overDec = toDecimal(Number(r.o?.od || 0));
    const underDec = toDecimal(Number(r.u?.od || 0));
    const overStake = (total * underDec) / (overDec + underDec);
    const underStake = total - overStake;
    const overPayout = overStake * overDec;
    const underPayout = underStake * underDec;
    const profit = Math.min(overPayout, underPayout) - total;
    return { overStake, underStake, total, profit };
  };

  // Local, focus-safe cell for bet size editing. Avoids table-level re-renders on each keystroke.
  function BetSizeCell({ r, id }: { r: ArbRowWithId; id: string }) {
    const plan = getBetPlan(r, id);
    const formatAmount = (n: number) => {
      return roundBets ? String(Math.round(n)) : Number.isFinite(n) ? (Math.round(n * 100) / 100).toFixed(2) : '0.00';
    };
    const [overLocal, setOverLocal] = React.useState<string>(formatAmount(plan.overStake));
    const [underLocal, setUnderLocal] = React.useState<string>(formatAmount(plan.underStake));

    // Sync local state if row id changes
    React.useEffect(() => {
      const p = getBetPlan(r, id);
      setOverLocal(formatAmount(p.overStake));
      setUnderLocal(formatAmount(p.underStake));
    }, [id, roundBets, r]);

    const commitOver = (value: string) => {
      const input = parseFloat(value);
      if (!value || !isFinite(input) || input <= 0) {
        setCustomWagersBoth(prev => {
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
      const overFinal = roundBets ? Math.round(input) : Math.round(input * 100) / 100;
      const underFinal = roundBets ? Math.round(other) : Math.round(other * 100) / 100;
      setCustomWagersBoth(prev => ({
        ...prev,
        [id]: { over: roundBets ? String(overFinal) : overFinal.toFixed(2), under: roundBets ? String(underFinal) : underFinal.toFixed(2) },
      }));
      setOverLocal(roundBets ? String(overFinal) : overFinal.toFixed(2));
      setUnderLocal(roundBets ? String(underFinal) : underFinal.toFixed(2));
    };

    const commitUnder = (value: string) => {
      const input = parseFloat(value);
      if (!value || !isFinite(input) || input <= 0) {
        setCustomWagersBoth(prev => {
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
      const underFinal = roundBets ? Math.round(input) : Math.round(input * 100) / 100;
      const overFinal = roundBets ? Math.round(other) : Math.round(other * 100) / 100;
      setCustomWagersBoth(prev => ({
        ...prev,
        [id]: { over: roundBets ? String(overFinal) : overFinal.toFixed(2), under: roundBets ? String(underFinal) : underFinal.toFixed(2) },
      }));
      setOverLocal(roundBets ? String(overFinal) : overFinal.toFixed(2));
      setUnderLocal(roundBets ? String(underFinal) : underFinal.toFixed(2));
    };

    return (
      <div className="inline-block">
        <div className="bg-neutral-50/50 dark:bg-neutral-800/50 rounded-lg p-2.5 border border-neutral-200/60 dark:border-neutral-700/60 min-w-[170px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Over Bet</span>
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
                    if (isFinite(overOdds) && isFinite(underOdds) && (overOdds !== 0 || underOdds !== 0)) {
                      const other = calculateOptimalWager(n, overOdds, underOdds);
                      const overFinal = roundBets ? Math.round(n) : Math.round(n * 100) / 100;
                      const underFinal = roundBets ? Math.round(other) : Math.round(other * 100) / 100;
                      setUnderLocal(roundBets ? String(underFinal) : underFinal.toFixed(2));
                      setCustomWagersBoth(prev => ({ ...prev, [id]: { over: roundBets ? String(overFinal) : overFinal.toFixed(2), under: roundBets ? String(underFinal) : underFinal.toFixed(2) } }));
                    }
                  }}
                  onBlur={(e) => commitOver(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.target.select();
                    setPinnedRowId(id);
                  }}
                  className="h-6 w-20 text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 rounded px-2 text-right focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Under Bet</span>
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
                    if (isFinite(overOdds) && isFinite(underOdds) && (overOdds !== 0 || underOdds !== 0)) {
                      const other = calculateOptimalWager(n, underOdds, overOdds);
                      const underFinal = roundBets ? Math.round(n) : Math.round(n * 100) / 100;
                      const overFinal = roundBets ? Math.round(other) : Math.round(other * 100) / 100;
                      setOverLocal(roundBets ? String(overFinal) : overFinal.toFixed(2));
                      setCustomWagersBoth(prev => ({ ...prev, [id]: { over: roundBets ? String(overFinal) : overFinal.toFixed(2), under: roundBets ? String(underFinal) : underFinal.toFixed(2) } }));
                    }
                  }}
                  onBlur={(e) => commitUnder(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.target.select();
                    setPinnedRowId(id);
                  }}
                  className="h-6 w-20 text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 rounded px-2 text-right focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                />
              </div>
            </div>
          </div>
          <div className="pt-2 mt-2 border-t border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Total</span>
            <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{currency((parseFloat(overLocal || '0') || 0) + (parseFloat(underLocal || '0') || 0))}</span>
          </div>
        </div>
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
        _hasChange: changes.has(id) && Object.keys(changes.get(id) || {}).length > 0,
        _isTeaser: (r as any)._isTeaser || false,
        _isPinned: isPinned,
      };
    });
    
    // If there's a pinned row, move it to the top
    if (pinnedRowId) {
      const pinnedIndex = mapped.findIndex(row => row._id === pinnedRowId);
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
  const columns = useMemo(() => [
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
                  className="p-1 rounded-md bg-brand/20 hover:bg-brand/30 transition-colors"
                >
                  <Pin className="w-3.5 h-3.5 text-brand" />
                </button>
              </Tooltip>
            )}
            <span className={cn(
              "roi-badge up",
              isHighTier && "shadow-[0_0_12px_rgba(132,204,22,0.4)] ring-1 ring-[var(--accent-strong)]/20"
            )}>
              <span className="caret"></span>
              +{roiPct}%
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
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
              <SportIcon sport={r.lg.sport} className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
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
        
        return (
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-neutral-900 dark:text-white break-words whitespace-normal">{formatGameTitle(r)}</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono tracking-tight whitespace-normal mt-0.5">
                {r.ev?.away?.abbr} @ {r.ev?.home?.abbr}
              </div>
            </div>
            {isHighROI && !isTeaser && (
              <Tooltip content="Caution: High ROI. Double-check market and odds before placing bet.">
                <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
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
        const isToday = d ? (() => {
          const today = new Date();
          return d.getDate() === today.getDate() &&
                 d.getMonth() === today.getMonth() &&
                 d.getFullYear() === today.getFullYear();
        })() : false;
        
        const dateStr = d ? (isToday ? 'Today' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' })) : 'TBD';
        const timeStr = d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
        
        if ((r as any).ev?.live) {
          return (
            <div className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-sm">Live</span>
            </div>
          );
        }
        
        return (
          <div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">{dateStr}</div>
            {timeStr && <div className="text-xs text-neutral-500 dark:text-neutral-500">{timeStr}</div>}
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
                isTeaser && "blur-sm select-none pointer-events-none"
              )}
            >
            {/* Market Label */}
            <div className="mb-2 flex items-center gap-2 pl-2">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-neutral-200/60 bg-neutral-50/50 dark:border-neutral-700/60 dark:bg-neutral-800/50">
                <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  {(() => {
                    const label = humanizeMarket(r.mkt);
                    if (isMoneyline(r.mkt) || isSpread(r.mkt)) return label;
                    const player = extractPlayer(r.o?.name) || extractPlayer(r.u?.name);
                    const short = formatPlayerShort(player);
                    return short ? `${label} - ${short}` : label;
                  })()}
                </span>
              </div>
            </div>

            {/* Over/Under with Dual Bet Button - Grouped Action Card */}
            <div className={cn("market-action-card relative rounded-lg border border-transparent bg-gradient-to-br from-transparent to-transparent transition-all duration-200 pl-2 pr-2 py-2")}>
              <div className="pr-12 space-y-1.5">
                {/* Over Side - Clickable Card */}
                <Tooltip content={`Place bet on ${bookName(r.o?.bk)}`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLink(r.o?.bk, r.o?.u, r.o?.m);
                    }}
                    className="w-full flex items-center justify-between gap-2 rounded-md border border-neutral-200/60 bg-neutral-50/30 px-2.5 py-1.5 dark:border-neutral-700/60 dark:bg-neutral-800/30 hover:bg-neutral-100/50 dark:hover:bg-neutral-700/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {overLogo && <img src={overLogo} alt={r.o?.bk || ''} className="h-5 w-5 shrink-0 object-contain" />}
                      <div className="market-positive text-xs sm:text-sm font-medium truncate">
                        {getSideLabel("over", r)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="market-positive font-bold text-xs sm:text-sm">
                        {formatOdds(Number(r.o?.od || 0))}
                      </span>
                      {r.o?.max != null && (
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          (${r.o.max.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                        </span>
                      )}
                    </div>
                  </button>
                </Tooltip>

                {/* Under Side - Clickable Card */}
                <Tooltip content={`Place bet on ${bookName(r.u?.bk)}`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLink(r.u?.bk, r.u?.u, r.u?.m);
                    }}
                    className="w-full flex items-center justify-between gap-2 rounded-md border border-neutral-200/60 bg-neutral-50/30 px-2.5 py-1.5 dark:border-neutral-700/60 dark:bg-neutral-800/30 hover:bg-neutral-100/50 dark:hover:bg-neutral-700/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {underLogo && <img src={underLogo} alt={r.u?.bk || ''} className="h-5 w-5 shrink-0 object-contain" />}
                      <div className="market-negative text-xs sm:text-sm font-medium truncate">
                        {getSideLabel("under", r)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="market-negative font-bold text-xs sm:text-sm">
                        {formatOdds(Number(r.u?.od || 0))}
                      </span>
                      {r.u?.max != null && (
                        <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          (${r.u.max.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                        </span>
                      )}
                    </div>
                  </button>
                </Tooltip>
              </div>

              {/* Dual Bet Button */}
              <Tooltip content="Open both bets">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDualBet(r); }}
                  className="dual-bet-btn absolute right-2 top-2 bottom-2 w-9 !h-auto"
                >
                  <Zap />
                </button>
              </Tooltip>
            </div>
            </div>
            
            {/* Unlock button - positioned absolutely, NOT blurred */}
            {isTeaser && (
              <div className="absolute inset-0 flex items-center justify-center z-[5] pointer-events-none">
                <Tooltip content="Upgrade to Pro to unlock premium arbitrage opportunities">
                  <button
                    onClick={() => window.location.href = '/pricing'}
                    className="flex items-center gap-2 rounded-lg border-2 border-white/20 px-4 py-2 text-sm font-semibold shadow-xl transition-all hover:scale-105 cursor-pointer pointer-events-auto bg-[var(--tertiary)] text-white dark:text-[var(--on-tertiary)]"
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
        const over = custom?.over != null && custom.over !== '' ? Math.max(0, parseFloat(custom.over)) : undefined;
        const under = custom?.under != null && custom.under !== '' ? Math.max(0, parseFloat(custom.under)) : undefined;
        let profitValue: number;
        if (over !== undefined || under !== undefined) {
          const overOdds = Number(r.o?.od || 0);
          const underOdds = Number(r.u?.od || 0);
          const overStake = over ?? 0;
          const underStake = under ?? 0;
          const overPayout = calculatePayout(overOdds, overStake);
          const underPayout = calculatePayout(underOdds, underStake);
          const total = overStake + underStake;
          profitValue = Math.min(overPayout, underPayout) - total;
        } else {
          const plan = getBetPlan(r, id);
          profitValue = plan.profit;
        }
        const roiPct = ((r.roi_bps || 0) / 100).toFixed(2);

        return (
          <div className="text-center">
            <div className="font-bold text-base bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] bg-clip-text text-transparent tabular-nums">
              {currency(profitValue)}
            </div>
          </div>
        );
      },
    }),
  ], [totalBetAmount, added, changes]);

  // Create table instance with custom sorting that preserves teaser row positions
  const tableProps = useTable({
    data,
    columns,
    getRowId: (row) => row._id,
    enableColumnResizing: false,
    initialSorting: !isPro ? [] : [ // Disable initial sorting for free users (to preserve teaser positions)
      {
        id: "roi",
        desc: true, // Sort by ROI descending (highest first)
      },
    ],
  });

  if (!rows?.length) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-neutral-200 bg-white py-12 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        No arbitrage opportunities found.
      </div>
    );
  }

  return (
    <Table
        {...tableProps}
        sortableColumns={["roi", "time"]}
        resourceName={(plural) => plural ? "opportunities" : "opportunity"}
        className="[&_th]:border-b [&_th]:border-neutral-200 [&_th]:dark:border-neutral-800 [&_td]:border-b [&_td]:border-neutral-200/50 [&_td]:dark:border-neutral-800/50 [&_thead]:table-header-gradient [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10"
        containerClassName="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
        scrollWrapperClassName="max-h-[calc(100vh-180px)] overflow-y-auto"
      thClassName={(columnId) => cn(
        "bg-neutral-50 dark:bg-neutral-900 font-medium text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider backdrop-blur-sm h-14",
        columnId === "roi" && "text-center pr-6",
        columnId === "league" && "pl-6",
        columnId === "game" && "pr-6",
        columnId === "time" && "text-center pl-6 pr-6",
        columnId === "market" && "pl-6 pr-6",
        columnId === "bet-size" && "pl-6 pr-6",
        columnId === "profit" && "text-right pl-6",
      )}
          tdClassName={(columnId, row) => cn(
            // Zebra striping
            row.index % 2 === 0 ? "table-row-even" : "table-row-odd",
            (row.original as ArbRowWithId)._isNew && "bg-emerald-50/30 dark:bg-emerald-950/20",
            // Blur teaser rows but NOT the ROI/Profit columns (to show FOMO)
            (row.original as ArbRowWithId)._isTeaser && columnId !== "roi" && columnId !== "profit" && columnId !== "market" && "blur-sm select-none pointer-events-none",
            // Market column needs to be relative for unlock button positioning
            (row.original as ArbRowWithId)._isTeaser && columnId === "market" && "relative",
            // Add slight backdrop blur behind ROI and Profit for teaser rows
            (row.original as ArbRowWithId)._isTeaser && (columnId === "roi" || columnId === "profit") && "relative backdrop-blur-[2px]",
            columnId === "roi" && "text-center pr-6",
            columnId === "league" && "pl-6",
            columnId === "game" && "pr-6",
            columnId === "time" && "text-center pl-6 pr-6",
            columnId === "market" && "pl-6 pr-6",
            columnId === "bet-size" && "pl-6 pr-6",
            columnId === "profit" && "text-right pl-6",
          )}
          rowProps={(row) => {
            const isTeaser = (row.original as ArbRowWithId)._isTeaser;
            const isPinned = (row.original as ArbRowWithId)._isPinned;
            return {
            className: cn(
                "group/row transition-all duration-200 ease-out",
                !isTeaser && "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:[background:color-mix(in_oklab,var(--primary)_4%,var(--card))]",
                (row.original as ArbRowWithId)._isNew && "bg-emerald-50/20 dark:bg-emerald-950/10",
                isTeaser && "relative bg-gradient-to-r from-[var(--tertiary)]/5 to-[var(--tertiary-strong)]/5 border-l-2 border-[var(--tertiary)]",
                isPinned && "sticky top-14 z-[5] bg-brand/5 dark:bg-brand/10 border-l-2 border-brand shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
              ),
              ...(isTeaser && {
                onClick: (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                }
              })
            };
          }}
    />
  );
}

