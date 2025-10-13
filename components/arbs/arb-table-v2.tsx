"use client";

import React, { useMemo, useState } from "react";
import type { ArbRow } from "@/lib/arb-schema";
import { createColumnHelper } from "@tanstack/react-table";
import { Table, useTable } from "@/components/table";
import { Zap, ExternalLink } from "lucide-react";
import { sportsbooks } from "@/lib/data/sportsbooks";
import { cn } from "@/lib/utils";

const SB_MAP = new Map(sportsbooks.map((sb) => [sb.id.toLowerCase(), sb]));
const norm = (s?: string) => (s || "").toLowerCase();

interface ArbTableProps {
  rows: ArbRow[];
  ids: string[];
  changes: Map<string, { roi?: "up" | "down"; o?: "up" | "down"; u?: "up" | "down" }>;
  added?: Set<string>;
  totalBetAmount?: number;
}

interface ArbRowWithId extends ArbRow {
  _id: string;
  _isNew?: boolean;
  _hasChange?: boolean;
}

const columnHelper = createColumnHelper<ArbRowWithId>();

export function ArbTableV2({ rows, ids, changes, added, totalBetAmount = 200 }: ArbTableProps) {
  const [customWagers, setCustomWagers] = useState<Record<string, { over: string; under: string }>>({});

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

  const openLink = (bookId?: string, href?: string | null) => {
    const target = href || getBookFallbackUrl(bookId);
    if (!target) return;
    try {
      window.open(target, '_blank', 'noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes');
    } catch { void 0; }
  };

  const handleDualBet = (r: ArbRow) => {
    try {
      const overUrl = r.o?.u || getBookFallbackUrl(r.o?.bk);
      const underUrl = r.u?.u || getBookFallbackUrl(r.u?.bk);
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

  // Prepare data with IDs and flags
  const data = useMemo<ArbRowWithId[]>(() => {
    return rows.map((r, i) => {
      const id = ids[i];
      return {
        ...r,
        _id: id,
        _isNew: added?.has(id),
        _hasChange: changes.has(id) && Object.keys(changes.get(id) || {}).length > 0,
      };
    });
  }, [rows, ids, added, changes]);

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
        return (
          <span className="inline-flex items-center justify-center font-semibold text-sm px-2 py-0.5 rounded border border-emerald-200/60 bg-emerald-50/50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-400">
            +{roiPct}%
          </span>
        );
      },
    }),

    columnHelper.display({
      id: "game",
      header: "Game",
      size: 250,
      cell: (info) => {
        const r = info.row.original;
        return (
          <div>
            <div className="font-medium text-neutral-900 dark:text-white">{formatGameTitle(r)}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {r.ev?.away?.abbr} @ {r.ev?.home?.abbr}
            </div>
          </div>
        );
      },
    }),

    columnHelper.display({
      id: "time",
      header: "Time",
      size: 110,
      cell: (info) => {
        const r = info.row.original;
        const d = r.ev?.dt ? new Date(r.ev.dt) : null;
        const dateStr = d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' }) : 'TBD';
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
            <div className="font-medium text-sm">{dateStr}</div>
            {timeStr && <div className="text-xs text-neutral-500 dark:text-neutral-400">{timeStr}</div>}
          </div>
        );
      },
    }),

    columnHelper.display({
      id: "market",
      header: "Market",
      size: 350,
      cell: (info) => {
        const r = info.row.original;
        const overLogo = logo(r.o?.bk);
        const underLogo = logo(r.u?.bk);
        const isHighlighted = r._isNew || r._hasChange;

        return (
          <div className={cn("rounded-lg", isHighlighted && "ring-1 ring-emerald-500/40")}>
            {/* Market Label */}
            <div className="mb-2 flex items-center gap-2">
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

            {/* Over/Under with Dual Bet Button */}
            <div className="relative pr-12">
              <div className="space-y-1.5">
                {/* Over Side */}
                <div className="flex items-center justify-between rounded-md border border-neutral-200/60 bg-neutral-50/30 px-2.5 py-1.5 dark:border-neutral-700/60 dark:bg-neutral-800/30">
                  <div className="flex items-center gap-2.5">
                    {overLogo && <img src={overLogo} alt={r.o?.bk || ''} className="h-5 w-5 object-contain" />}
                    <div>
                      <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {getSideLabel("over", r)}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">{bookName(r.o?.bk)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                      {formatOdds(Number(r.o?.od || 0))}
                    </div>
                    {(r.o?.u || getBookFallbackUrl(r.o?.bk)) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openLink(r.o?.bk, r.o?.u);
                        }}
                        className="h-6 w-6 inline-flex items-center justify-center rounded border border-neutral-200/60 bg-white hover:bg-neutral-50 dark:border-neutral-700/60 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 transition-colors"
                        title="Open sportsbook"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Under Side */}
                <div className="flex items-center justify-between rounded-md border border-neutral-200/60 bg-neutral-50/30 px-2.5 py-1.5 dark:border-neutral-700/60 dark:bg-neutral-800/30">
                  <div className="flex items-center gap-2.5">
                    {underLogo && <img src={underLogo} alt={r.u?.bk || ''} className="h-5 w-5 object-contain" />}
                    <div>
                      <div className="text-sm font-medium text-red-600 dark:text-red-400">
                        {getSideLabel("under", r)}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">{bookName(r.u?.bk)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-red-600 dark:text-red-400 font-bold text-sm">
                      {formatOdds(Number(r.u?.od || 0))}
                    </div>
                    {(r.u?.u || getBookFallbackUrl(r.u?.bk)) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openLink(r.u?.bk, r.u?.u);
                        }}
                        className="h-6 w-6 inline-flex items-center justify-center rounded border border-neutral-200/60 bg-white hover:bg-neutral-50 dark:border-neutral-700/60 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 transition-colors"
                        title="Open sportsbook"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Dual Bet Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDualBet(r);
                }}
                className="absolute right-0 top-0 bottom-0 w-9 inline-flex flex-col items-center justify-center rounded-md bg-gradient-to-b from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all"
                title="Open both bets"
              >
                <Zap className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      },
    }),

    columnHelper.display({
      id: "betSize",
      header: "Bet Size",
      size: 200,
      cell: (info) => {
        const r = info.row.original;
        const id = r._id;
        const plan = getBetPlan(r, id);

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
                      value={customWagers[id]?.over ?? Math.round(plan.overStake)}
                      onChange={(e) => handleWagerChange(id, 'over', e.target.value)}
                      onBlur={(e) => handleWagerBlur(id, 'over', e.target.value, r)}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => e.target.select()}
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
                      value={customWagers[id]?.under ?? Math.round(plan.underStake)}
                      onChange={(e) => handleWagerChange(id, 'under', e.target.value)}
                      onBlur={(e) => handleWagerBlur(id, 'under', e.target.value, r)}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => e.target.select()}
                      className="h-6 w-20 text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-700/60 rounded px-2 text-right focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-600"
                    />
                  </div>
                </div>
              </div>
              <div className="pt-2 mt-2 border-t border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Total</span>
                <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{currency(plan.total)}</span>
              </div>
            </div>
          </div>
        );
      },
    }),

    columnHelper.display({
      id: "profit",
      header: "Profit",
      size: 120,
      cell: (info) => {
        const r = info.row.original;
        const id = r._id;
        const plan = getBetPlan(r, id);
        const roiPct = ((r.roi_bps || 0) / 100).toFixed(2);

        return (
          <div className="text-center">
            <div className="text-emerald-600 dark:text-emerald-400 font-bold text-base">
              {currency(plan.profit)}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              {roiPct}% ROI
            </div>
          </div>
        );
      },
    }),
  ], [customWagers, totalBetAmount, added, changes]);

  // Create table instance
  const tableProps = useTable({
    data,
    columns,
    getRowId: (row) => row._id,
    enableColumnResizing: false,
    initialSorting: [
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
      className="[&_th]:border-b [&_th]:border-neutral-200 [&_th]:dark:border-neutral-800 [&_td]:border-b [&_td]:border-neutral-200/50 [&_td]:dark:border-neutral-800/50"
      containerClassName="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
      thClassName={(columnId) => cn(
        "bg-neutral-50/50 dark:bg-neutral-900/50 font-medium text-xs uppercase tracking-wide",
        columnId === "roi" && "text-center",
        columnId === "time" && "text-center",
        columnId === "profit" && "text-center",
      )}
      tdClassName={(columnId, row) => cn(
        "bg-white dark:bg-neutral-900",
        (row.original as ArbRowWithId)._isNew && "bg-emerald-50/30 dark:bg-emerald-950/20",
        columnId === "roi" && "text-center",
        columnId === "time" && "text-center",
        columnId === "profit" && "text-center",
      )}
      rowProps={(row) => ({
        className: cn(
          "group/row hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors",
          (row.original as ArbRowWithId)._isNew && "bg-emerald-50/20 dark:bg-emerald-950/10"
        )
      })}
    />
  );
}

