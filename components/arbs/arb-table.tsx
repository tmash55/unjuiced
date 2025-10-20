
"use client";

import React, { useMemo, useState } from "react";
import type { ArbRow } from "@/lib/arb-schema";
import { ArrowUpDown, Zap, ExternalLink } from "lucide-react";
import { sportsbooks } from "@/lib/data/sportsbooks";
import { Tooltip } from "@/components/tooltip";

const SB_MAP = new Map(sportsbooks.map((sb) => [sb.id.toLowerCase(), sb]));
const norm = (s?: string) => (s || "").toLowerCase();

type SortBy = "roi" | "time" | "game";

export function ArbTable({ rows, ids, changes, added, totalBetAmount }: { rows: ArbRow[]; ids: string[]; changes: Map<string, { roi?: "up"|"down"; o?: "up"|"down"; u?: "up"|"down" }>; added?: Set<string>; totalBetAmount?: number }) {
  const [sortBy, setSortBy] = useState<SortBy>("roi");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [customWagers, setCustomWagers] = useState<Record<string, { over: string; under: string }>>({});

  const sortedPairs = useMemo(() => {
    const pairs = rows.map((r, i) => ({ r, id: ids[i] }));
    const getTime = (r: ArbRow) => Date.parse(String(r.ev?.dt || "")) || 0;
    const getGame = (r: ArbRow) => `${r.ev?.away?.abbr || ""} @ ${r.ev?.home?.abbr || ""}`.toLowerCase();
    const getRoi = (r: ArbRow) => (r.roi_bps || 0) / 100; // percent
    const dir = sortDir === "asc" ? 1 : -1;
    return [...pairs].sort((a, b) => {
      if (sortBy === "roi") return (getRoi(a.r) - getRoi(b.r)) * dir;
      if (sortBy === "time") return (getTime(a.r) - getTime(b.r)) * dir;
      return getGame(a.r) < getGame(b.r) ? -1 * dir : getGame(a.r) > getGame(b.r) ? 1 * dir : 0;
    });
  }, [rows, ids, sortBy, sortDir]);

  if (!rows?.length) {
    return <div className="text-sm text-muted-foreground">No arbs yet.</div>;
  }

  const toggleSort = (col: SortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir(col === "game" ? "asc" : "desc"); }
  };

  const logo = (id?: string) => {
    const sb = SB_MAP.get(norm(id));
    return sb?.logo;
  };
  const bookName = (id?: string) => {
    const sb = SB_MAP.get(norm(id));
    return sb?.name || (id || "");
  };
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
  const isSpread = (mkt?: string) => /spread|handicap|run[_ ]?line|puck[_ ]?line|goal[_ ]?line/i.test(String(mkt||''));
  const isMoneyline = (mkt?: string) => /moneyline|\bml\b/i.test(String(mkt||''));
  const extractPlayer = (name?: string) => {
    if (!name) return '';
    // e.g., "Wan'dale Robinson Over 49.5" -> "Wan'dale Robinson"
    return name.replace(/\s+(Over|Under).*$/i, '').trim();
  };
  const formatPlayerShort = (full?: string) => {
    if (!full) return '';
    const tokens = full.trim().replace(/\s+/g, ' ').split(' ');
    if (tokens.length === 0) return '';
    const suffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'vi']);
    let end = tokens.length - 1;
    // drop suffix like Jr., Sr., II, etc
    if (suffixes.has(tokens[end].toLowerCase())) end -= 1;
    if (end < 1) {
      const firstOnly = tokens[0];
      return `${firstOnly}, ${firstOnly.charAt(0).toUpperCase()}`;
    }
    const first = tokens[0];
    // support common multi-word last-name prefixes
    const prev = tokens[end - 1]?.toLowerCase();
    let last = tokens[end].replace(/[,]+/g, '');
    const lastPrefixes = new Set(['st.', 'st', 'de', 'la', 'le', 'del', 'della', 'di', 'da', 'van', 'von', 'mc', 'mac']);
    if (lastPrefixes.has(prev)) {
      last = tokens[end - 1] + ' ' + last;
      // handle "de la" specifically
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
    // Spread / run line / puck line: prefer vendor label (team +/- line), compress to use abbrs
    if (isSpread(r.mkt)) {
      const raw = side === "over" ? (r.o?.name || "") : (r.u?.name || "");
      if (raw) return compressTeamInText(raw, r);
      const line = Number(r.ln);
      const abs = Math.abs(line);
      const home = r.ev?.home?.abbr || r.ev?.home?.name || "Home";
      const away = r.ev?.away?.abbr || r.ev?.away?.name || "Away";
      if (!Number.isFinite(line)) return side === "over" ? home : away;
      if (side === "over") {
        // Assume line is home-centric: home gets line as-is
        const sign = line >= 0 ? "+" : "";
        return `${home} ${sign}${line}`;
      } else {
        // away gets the opposite sign
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
    } catch {void 0;}
  };

  const handleDualBet = (r: ArbRow) => {
    try {
      const overUrl = r.o?.u || getBookFallbackUrl(r.o?.bk);
      const underUrl = r.u?.u || getBookFallbackUrl(r.u?.bk);
      if (overUrl) window.open(overUrl, '_blank', 'noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes');
      if (underUrl) setTimeout(() => { window.open(underUrl, '_blank', 'noopener,noreferrer,width=1200,height=800,scrollbars=yes,resizable=yes'); }, 100);
    } catch {void 0;}
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
  const calculatePayout = (odds: number, wager: number) => odds > 0 ? wager + (wager * odds / 100) : wager + (wager * 100 / Math.abs(odds));
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
  const getBetPlan = (r: ArbRow, rowId: string) => {
    const custom = customWagers[rowId];
    if (custom && (custom.over || custom.under)) {
      const overStake = Math.max(0, parseFloat(custom.over || '0'));
      const underStake = Math.max(0, parseFloat(custom.under || '0'));
      const total = overStake + underStake;
      const profit = calculateProfit(Number(r.o?.od || 0), Number(r.u?.od || 0), overStake, underStake);
      return { overStake, underStake, total, profit };
    }
    const total = typeof totalBetAmount === 'number' ? totalBetAmount : 200;
    const overDec = toDecimal(Number(r.o?.od || 0));
    const underDec = toDecimal(Number(r.u?.od || 0));
    const overStake = (total * underDec) / (overDec + underDec);
    const underStake = total - overStake;
    const overPayout = overStake * overDec;
    const underPayout = underStake * underDec;
    const profit = Math.min(overPayout, underPayout) - total;
    return { overStake, underStake, total, profit };
  };

  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="min-w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: 112 }} />
          <col style={{ width: 300 }} />
          <col style={{ width: 112 }} />
          <col />
          <col style={{ width: 200 }} />
          <col style={{ width: 120 }} />
        </colgroup>
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 w-[112px] text-center">
              <button type="button" onClick={() => toggleSort("roi")} className="inline-flex items-center gap-1">
                ROI % <ArrowUpDown className={`h-3.5 w-3.5 ${sortBy === "roi" ? "opacity-100" : "opacity-40"} ${sortBy === "roi" && sortDir === "asc" ? "rotate-180" : ""}`} />
              </button>
            </th>
            <th className="p-2 text-center border-l border-gray-200 dark:border-slate-700">
              <button type="button" onClick={() => toggleSort("game")} className="inline-flex items-center gap-1">
                Game <ArrowUpDown className={`h-3.5 w-3.5 ${sortBy === "game" ? "opacity-100" : "opacity-40"} ${sortBy === "game" && sortDir === "asc" ? "rotate-180" : ""}`} />
              </button>
            </th>
            <th className="p-2 text-center w-[112px] border-l border-gray-200 dark:border-slate-700">
              <button type="button" onClick={() => toggleSort("time")} className="inline-flex items-center gap-1">
                Time <ArrowUpDown className={`h-3.5 w-3.5 ${sortBy === "time" ? "opacity-100" : "opacity-40"} ${sortBy === "time" && sortDir === "asc" ? "rotate-180" : ""}`} />
              </button>
            </th>
            <th className="p-2 text-center border-l border-gray-200 dark:border-slate-700">Market</th>
            <th className="p-2 text-center w-[160px] border-l border-gray-200 dark:border-slate-700">Bet Size</th>
            <th className="p-2 text-center w-[120px] border-l border-gray-200 dark:border-slate-700">Profit</th>
          </tr>
        </thead>
        <tbody>
          {sortedPairs.map(({ r, id }) => {
            const ch = changes.get(id) || {};
            const roiPct = ((r.roi_bps || 0) / 100).toFixed(2);
            const d = r.ev?.dt ? new Date(r.ev.dt) : null;
            const dateStr = d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' }) : 'TBD';
            const timeStr = d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
            const overLogo = logo(r.o?.bk);
            const underLogo = logo(r.u?.bk);
            const plan = getBetPlan(r, id);
            const isNew = added?.has(id);
            const hasChange = ch && Object.keys(ch).length > 0;
            const isHighlighted = isNew || hasChange;
            return (
            <tr key={id} className={`border-t`}>
              <td className={`p-2 text-center`}>
                <span className="inline-flex items-center justify-center font-bold text-base px-3 py-1.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">+{roiPct}%</span>
              </td>
              <td className={`p-2 whitespace-nowrap border-l border-gray-200 dark:border-slate-700`}>
                <div className="font-semibold text-foreground">{formatGameTitle(r)}</div>
                <div className="text-xs text-muted-foreground">{r.ev?.away?.abbr} @ {r.ev?.home?.abbr}</div>
              </td>
              <td className={`p-2 whitespace-nowrap text-center border-l border-gray-200 dark:border-slate-700`}>
                {(r as any).ev?.live ? (
                  <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-medium">Live</span>
                  </div>
                ) : (
                  <>
                    <div className="font-medium">{dateStr}</div>
                    {timeStr && <div className="text-xs text-muted-foreground">{timeStr}</div>}
                  </>
                )}
              </td>
              <td className={`p-2 whitespace-nowrap border-l border-gray-200 dark:border-slate-700 align-top`}>
                <div className={`w-full rounded-md ${isHighlighted ? 'ring-2 ring-emerald-400/40' : ''}`}>
                  <div className="mb-2">
                    <div className="flex items-center justify-center gap-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/40">
                        <span className="text-xs font-semibold text-foreground">{(() => {
                          const label = humanizeMarket(r.mkt);
                          // For moneyline/spread-style markets, show only the market label
                          if (isMoneyline(r.mkt) || isSpread(r.mkt)) return label;
                          const player = extractPlayer(r.o?.name) || extractPlayer(r.u?.name);
                          const short = formatPlayerShort(player);
                          return short ? `${label} - ${short}` : label;
                        })()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative pr-10">
                    <div className="space-y-2 pr-1">
                    <div className="flex items-center justify-between rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/40 px-2 py-2">
                      <div className="flex items-center gap-2">
                        {overLogo && <img src={overLogo} alt={r.o?.bk || ''} className="h-6 w-6 object-contain" />}
                        <div>
                          <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{getSideLabel("over", r)}</div>
                          <div className="text-xs text-muted-foreground">{bookName(r.o?.bk)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold">{formatOdds(Number(r.o?.od || 0))}</div>
                        {(r.o?.u || getBookFallbackUrl(r.o?.bk)) && (
                          <Tooltip content={`Place bet on ${bookName(r.o?.bk)}`}>
                            <button
                              type="button"
                              onClick={() => openLink(r.o?.bk, r.o?.u)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/40 px-2 py-2">
                      <div className="flex items-center gap-2">
                        {underLogo && <img src={underLogo} alt={r.u?.bk || ''} className="h-6 w-6 object-contain" />}
                        <div>
                          <div className="text-sm font-medium text-red-600 dark:text-red-400">{getSideLabel("under", r)}</div>
                          <div className="text-xs text-muted-foreground">{bookName(r.u?.bk)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-red-600 dark:text-red-400 font-bold">{formatOdds(Number(r.u?.od || 0))}</div>
                        {(r.u?.u || getBookFallbackUrl(r.u?.bk)) && (
                          <Tooltip content={`Place bet on ${bookName(r.u?.bk)}`}>
                            <button
                              type="button"
                              onClick={() => openLink(r.u?.bk, r.u?.u)}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    </div>
                    <Tooltip content="Open both bets">
                      <button
                        type="button"
                        onClick={() => handleDualBet(r)}
                        className="absolute right-0 top-0 bottom-0 w-10 inline-flex flex-col items-center justify-center rounded-md bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-1 transition-all shadow-sm hover:shadow-md"
                      >
                        <Zap className="h-4 w-4 fill-white" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </td>
              <td className={`p-2 text-center whitespace-nowrap border-l border-gray-200 dark:border-slate-700 align-top`}>
                {/* spacer to align with market header pill: clone the pill invisibly for exact height */}
                <div className="mb-2 flex items-center justify-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-transparent invisible">
                    <span className="text-xs font-semibold">&nbsp;</span>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700 shadow-sm inline-block text-left min-w-[200px] mx-auto -mt-px">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Over Bet</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">$</span>
                        <input 
                          type="text"
                          value={customWagers[id]?.over ?? Math.round(plan.overStake).toString()} 
                          onChange={(e) => {
                            const value = e.target.value;
                            console.log('Over input changed:', value, 'for id:', id);
                            setCustomWagers(prev => {
                              const newState = {
                                ...prev,
                                [id]: {
                                  over: value,
                                  under: prev[id]?.under ?? Math.round(plan.underStake).toString()
                                }
                              };
                              console.log('New customWagers state:', newState);
                              return newState;
                            });
                          }}
                          onFocus={() => console.log('Over input focused')}
                          onBlur={() => console.log('Over input blurred')}
                          className="h-7 w-20 text-sm font-medium bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-right px-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Under Bet</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">$</span>
                        <input 
                          type="text"
                          value={customWagers[id]?.under ?? Math.round(plan.underStake).toString()} 
                          onChange={(e) => {
                            const value = e.target.value;
                            setCustomWagers(prev => ({
                              ...prev,
                              [id]: {
                                over: prev[id]?.over ?? Math.round(plan.overStake).toString(),
                                under: value
                              }
                            }));
                          }}
                          className="h-7 w-20 text-sm font-medium bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-right px-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        />
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-600 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Total</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{currency(plan.total)}</span>
                  </div>
                </div>
              </td>
              <td className={`p-2 text-center whitespace-nowrap border-l border-gray-200 dark:border-slate-700 align-middle`}>
                <div className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xl">{currency(plan.profit)}</div>
                <div className="text-xs text-muted-foreground">{roiPct}% ROI</div>
              </td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}
