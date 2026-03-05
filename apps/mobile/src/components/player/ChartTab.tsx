import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Image, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HitRateProfileV2, PlayerBoxScoreGame } from "@unjuiced/types";
import type { TeammateOut, PlayTypeData } from "@unjuiced/api";
import type { PlayerOutInfo } from "@/src/hooks/use-players-out-for-filter";
import { getNbaTeamLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";
import { GameDetailModal } from "./GameDetailModal";
import {
  CHART_HEIGHT, CHART_BAR_W, CHART_BAR_GAP,
  type ChartPeriod, PERIOD_COUNTS,
  fmtPct, fmtLine, fmtOdds, fmtDate, barColor, hitColor, mktTab,
  injuryBorderColor, injuryBgColor, getGameStat, getHitRate, getHitRateFraction, average,
  rankColor, rankBgColor
} from "./constants";

interface ChartTabProps {
  profile: HitRateProfileV2;
  chartMarket: string;
  chartLine: number | null;
  selectedLine: number | null;
  allGames: PlayerBoxScoreGame[];
  seasonSummary: any;
  playerInfo: any;
  teammatesOutByGame: Map<string, TeammateOut[]>;
  teammateSeasonStats?: Map<number, PlayerOutInfo>;
  dvpRankByTeam?: Map<string, number>;
  topPlayType?: PlayTypeData | null;
  lineHitRatesForSelected: { l5: number | null; l10: number | null; l20: number | null; szn: number | null } | null;
  bsLoading: boolean;
  chartPeriod: ChartPeriod;
  onChartPeriodChange: (p: ChartPeriod) => void;
  bestOverPrice?: number | null;
  oppAbbr?: string | null;
  homeAway?: "H" | "A" | null;
  filterH2H?: boolean;
  onFilterH2HChange?: (v: boolean) => void;
  onLineChange?: (line: number) => void;
}

export function ChartTab({
  profile, chartMarket, chartLine, selectedLine, allGames, seasonSummary,
  playerInfo, teammatesOutByGame, teammateSeasonStats, dvpRankByTeam, topPlayType, lineHitRatesForSelected,
  bsLoading, chartPeriod, onChartPeriodChange,
  bestOverPrice, oppAbbr, homeAway,
  filterH2H = false, onFilterH2HChange, onLineChange
}: ChartTabProps) {
  const [selectedGameIdx, setSelectedGameIdx] = useState<number | null>(null);

  // Filter state
  const [filterHomeAway, setFilterHomeAway] = useState<"all" | "H" | "A">("all");
  const [filterResult, setFilterResult] = useState<"all" | "W" | "L" | "W10" | "L10">("all");
  const [filterMinMinutes, setFilterMinMinutes] = useState(false);
  const [filterHighUsage, setFilterHighUsage] = useState(false);
  const [filterHighFGA, setFilterHighFGA] = useState(false);
  const [filterTeammateOutIds, setFilterTeammateOutIds] = useState<Set<number>>(new Set());
  const [filterDvp, setFilterDvp] = useState<"all" | "tough" | "neutral" | "weak">("all");
  const [activeSheet, setActiveSheet] = useState<"homeAway" | "result" | "matchup" | "more" | null>(null);
  const [compactView, setCompactView] = useState(false);
  const [showDvpDots, setShowDvpDots] = useState(false);
  const [lineInputText, setLineInputText] = useState(chartLine != null ? fmtLine(chartLine) : "");
  // Sync local input text when chartLine changes externally (arrows, prop change)
  useEffect(() => {
    setLineInputText(chartLine != null ? fmtLine(chartLine) : "");
  }, [chartLine]);

  const toggleTeammateFilter = (pid: number) => {
    setFilterTeammateOutIds(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
    setSelectedGameIdx(null);
  };

  const anyFilterActive = filterHomeAway !== "all" || filterResult !== "all" ||
    filterMinMinutes || filterHighUsage || filterHighFGA || filterTeammateOutIds.size > 0 || filterH2H || filterDvp !== "all";

  const resetFilters = () => {
    setFilterHomeAway("all");
    setFilterResult("all");
    setFilterDvp("all");
    setFilterMinMinutes(false);
    setFilterHighUsage(false);
    setFilterHighFGA(false);
    setFilterTeammateOutIds(new Set());
    onFilterH2HChange?.(false);
    setActiveSheet(null);
  };

  // Injured teammates aggregated across all games with stats
  const injuredTeammates = useMemo(() => {
    // Build a set of gameIds where each teammate was out, keep latest reason
    const tmGameIds = new Map<number, Set<string>>();
    const tmInfo = new Map<number, TeammateOut>();
    for (const [gameId, mates] of teammatesOutByGame) {
      for (const m of mates) {
        if (!tmGameIds.has(m.player_id)) {
          tmGameIds.set(m.player_id, new Set());
        }
        tmInfo.set(m.player_id, m);
        tmGameIds.get(m.player_id)!.add(gameId);
      }
    }

    // For each teammate, compute stats from matching games
    const overallAvg = allGames.length > 0
      ? allGames.reduce((sum, g) => sum + getGameStat(g, chartMarket), 0) / allGames.length
      : 0;
    const overallMin = allGames.length > 0
      ? allGames.reduce((sum, g) => sum + g.minutes, 0) / allGames.length
      : 0;

    const results: {
      info: TeammateOut; count: number;
      avgStat: number; avgMin: number;
      statDiff: number; minDiff: number;
      hitRate: number | null;
      reason: string | null;
      sznPts: number | null; sznReb: number | null; sznAst: number | null;
      gamesOutTotal: number | null;
    }[] = [];

    for (const [pid, gameIds] of tmGameIds) {
      const info = tmInfo.get(pid)!;
      const matchingGames = allGames.filter(g => {
        const nid = String(g.gameId).replace(/^0+/, "");
        return gameIds.has(nid);
      });
      if (!matchingGames.length) continue;

      const avgStat = matchingGames.reduce((sum, g) => sum + getGameStat(g, chartMarket), 0) / matchingGames.length;
      const avgMin = matchingGames.reduce((sum, g) => sum + g.minutes, 0) / matchingGames.length;
      const hr = matchingGames.length >= 3 ? getHitRate(matchingGames, chartMarket, chartLine) : null;
      const szn = teammateSeasonStats?.get(pid);
      results.push({
        info, count: matchingGames.length,
        avgStat, avgMin,
        statDiff: avgStat - overallAvg,
        minDiff: avgMin - overallMin,
        hitRate: hr,
        reason: info.reason,
        sznPts: szn?.avg_pts ?? null,
        sznReb: szn?.avg_reb ?? null,
        sznAst: szn?.avg_ast ?? null,
        gamesOutTotal: szn?.games_out ?? null,
      });
    }

    // Sort: injury status priority (OUT/Questionable first), then by teammate's own season avg pts desc
    const statusPriority = (reason: string | null): number => {
      if (!reason) return 4;
      const r = reason.toLowerCase();
      if (r === "out" || r.includes("out")) return 0;
      if (r === "questionable" || r.includes("questionable")) return 1;
      if (r === "doubtful" || r.includes("doubtful")) return 2;
      if (r === "probable" || r.includes("probable")) return 3;
      return 4;
    };

    return results.sort((a, b) => {
      const aPri = statusPriority(a.reason);
      const bPri = statusPriority(b.reason);
      if (aPri !== bPri) return aPri - bPri;
      // Within same status, sort by teammate's own season stats (most impactful player first)
      const aImpact = (a.sznPts ?? 0) + (a.sznReb ?? 0) + (a.sznAst ?? 0);
      const bImpact = (b.sznPts ?? 0) + (b.sznReb ?? 0) + (b.sznAst ?? 0);
      if (bImpact !== aImpact) return bImpact - aImpact;
      // Fallback: most games missed
      return b.count - a.count;
    });
  }, [teammatesOutByGame, allGames, chartMarket, chartLine, teammateSeasonStats]);

  // Filtered games
  const filteredGames = useMemo(() => {
    let games = allGames;
    if (filterHomeAway !== "all") games = games.filter(g => g.homeAway === filterHomeAway);
    if (filterResult === "W") games = games.filter(g => g.result === "W");
    else if (filterResult === "L") games = games.filter(g => g.result === "L");
    else if (filterResult === "W10") games = games.filter(g => g.result === "W" && g.margin >= 10);
    else if (filterResult === "L10") games = games.filter(g => g.result === "L" && g.margin <= -10);
    if (filterMinMinutes) games = games.filter(g => g.minutes >= 25);
    if (filterHighUsage) games = games.filter(g => g.usagePct >= 25);
    if (filterHighFGA) games = games.filter(g => g.fga >= 15);
    if (filterH2H && oppAbbr) games = games.filter(g => g.opponentAbbr === oppAbbr);
    if (filterDvp !== "all" && dvpRankByTeam && dvpRankByTeam.size > 0) {
      games = games.filter(g => {
        const rank = dvpRankByTeam.get(g.opponentAbbr);
        if (rank == null) return false;
        if (filterDvp === "tough") return rank <= 10;
        if (filterDvp === "neutral") return rank >= 11 && rank <= 20;
        if (filterDvp === "weak") return rank >= 21;
        return true;
      });
    }
    if (filterTeammateOutIds.size > 0) {
      games = games.filter(g => {
        const normalizedId = String(g.gameId).replace(/^0+/, "");
        const mates = teammatesOutByGame.get(normalizedId);
        if (!mates) return false;
        const outIds = new Set(mates.map(m => m.player_id));
        // Game must have ALL selected teammates out
        for (const pid of filterTeammateOutIds) {
          if (!outIds.has(pid)) return false;
        }
        return true;
      });
    }
    return games;
  }, [allGames, filterHomeAway, filterResult, filterDvp, dvpRankByTeam, filterMinMinutes, filterHighUsage, filterHighFGA, filterH2H, oppAbbr, filterTeammateOutIds, teammatesOutByGame]);

  const periodCount = PERIOD_COUNTS[chartPeriod];
  const chartGames = useMemo(() => {
    const source = anyFilterActive ? filteredGames : allGames;
    const sliced = periodCount ? source.slice(0, periodCount) : source;
    return sliced.slice().reverse();
  }, [filteredGames, allGames, anyFilterActive, periodCount]);

  const chartValues = useMemo(() => chartGames.map((g) => getGameStat(g, chartMarket)), [chartGames, chartMarket]);
  // Use all-games max so chart scale stays stable across period/filter changes
  const allGameValues = useMemo(() => allGames.map((g) => getGameStat(g, chartMarket)), [allGames, chartMarket]);
  const chartMax = useMemo(() => Math.max(1, ...allGameValues, chartLine ?? 0) * 1.3, [allGameValues, chartLine]);
  const lineY = useMemo(() => {
    if (chartLine == null || !Number.isFinite(chartLine)) return null;
    // Offset by half the line wrap height (20px) so the visible line
    // aligns with the mathematical position, not the wrap's bottom edge
    return (chartLine / chartMax) * CHART_HEIGHT - 10;
  }, [chartLine, chartMax]);

  const statAvg = useMemo(() => average(chartValues), [chartValues]);
  // Full season avg for comparison when viewing a subset
  const fullSeasonAvg = useMemo(() => {
    const allValues = allGames.map(g => getGameStat(g, chartMarket));
    return average(allValues);
  }, [allGames, chartMarket]);

  // Show season comparison when chart is showing a subset
  const showSeasonComparison = chartPeriod !== "SZN" || anyFilterActive;

  // Hit rate fractions for display
  const hitRateFractions = useMemo(() => {
    const source = anyFilterActive ? filteredGames : allGames;
    return {
      l5: getHitRateFraction(source.slice(0, 5), chartMarket, chartLine),
      l10: getHitRateFraction(source.slice(0, 10), chartMarket, chartLine),
      l20: getHitRateFraction(source.slice(0, 20), chartMarket, chartLine),
      szn: getHitRateFraction(source, chartMarket, chartLine),
    };
  }, [allGames, filteredGames, anyFilterActive, chartMarket, chartLine]);

  // Filtered season averages
  const filteredSeasonAvgs = useMemo(() => {
    if (!anyFilterActive) return null;
    const games = filteredGames;
    if (!games.length) return null;
    const avg = (fn: (g: PlayerBoxScoreGame) => number) =>
      games.reduce((sum, g) => sum + fn(g), 0) / games.length;
    return {
      avgPoints: avg(g => g.pts),
      avgRebounds: avg(g => g.reb),
      avgAssists: avg(g => g.ast),
      avgThrees: avg(g => g.fg3m),
      avgMinutes: avg(g => g.minutes),
    };
  }, [filteredGames, anyFilterActive]);

  // Filtered hit rates
  const filteredHitRates = useMemo(() => {
    if (!anyFilterActive || !chartLine) return null;
    const source = filteredGames;
    return {
      l5: getHitRate(source.slice(0, 5), chartMarket, chartLine),
      l10: getHitRate(source.slice(0, 10), chartMarket, chartLine),
      l20: getHitRate(source.slice(0, 20), chartMarket, chartLine),
      szn: getHitRate(source, chartMarket, chartLine),
    };
  }, [filteredGames, anyFilterActive, chartMarket, chartLine]);

  // Bar animations
  const barAnims = useRef<Animated.Value[]>([]);
  const animKey = useRef("");
  useEffect(() => {
    const key = `${chartPeriod}-${chartMarket}-${chartGames.length}-${anyFilterActive}`;
    if (key === animKey.current) return;
    animKey.current = key;
    barAnims.current = chartGames.map(() => new Animated.Value(0));
    const anims = barAnims.current.map((anim, i) =>
      Animated.timing(anim, { toValue: 1, duration: 300, delay: i * 30, useNativeDriver: false })
    );
    Animated.parallel(anims).start();
  }, [chartPeriod, chartMarket, chartGames.length]);

  const chartScrollRef = useRef<ScrollView>(null);
  const needsScroll = chartGames.length > 10;

  // Game detail modal data
  const selectedGame = selectedGameIdx != null ? chartGames[selectedGameIdx] : null;
  const modalTeammatesOut = useMemo(() => {
    if (!selectedGame) return [];
    const normalizedId = String(selectedGame.gameId).replace(/^0+/, "");
    return teammatesOutByGame.get(normalizedId) ?? [];
  }, [selectedGame, teammatesOutByGame]);

  return (
    <>
      {/* Avg + Line Adjuster + Compact Toggle */}
      {statAvg != null || chartLine != null ? (
        <View style={s.avgRow}>
          {statAvg != null ? (
            <View style={s.avgChip}>
              <Text style={s.avgChipLabel}>AVG:</Text>
              <Text style={s.avgChipValue}>{statAvg.toFixed(1)}</Text>
            </View>
          ) : null}
          {showSeasonComparison && fullSeasonAvg != null ? (
            <View style={s.avgChipMuted}>
              <Text style={s.avgChipLabelMuted}>SZN:</Text>
              <Text style={s.avgChipValueMuted}>{fullSeasonAvg.toFixed(1)}</Text>
            </View>
          ) : null}
          {bestOverPrice != null ? (
            <View style={s.oddsChip}>
              <Text style={s.oddsChipLabel}>O</Text>
              <Text style={s.oddsChipValue}>{fmtOdds(bestOverPrice)}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {chartLine != null && onLineChange ? (
            <View style={s.lineAdjuster}>
              <Pressable
                onPress={() => { if (chartLine > 0.5) onLineChange(chartLine - 0.5); }}
                hitSlop={8}
                style={s.lineAdjustBtn}
              >
                <Ionicons name="chevron-down" size={14} color={brandColors.textSecondary} />
              </Pressable>
              <TextInput
                style={s.lineAdjustInput}
                keyboardType="decimal-pad"
                returnKeyType="done"
                selectTextOnFocus
                value={lineInputText}
                onChangeText={setLineInputText}
                onSubmitEditing={() => {
                  const v = parseFloat(lineInputText);
                  if (Number.isFinite(v) && v > 0) onLineChange(v);
                  else setLineInputText(fmtLine(chartLine));
                }}
                onBlur={() => {
                  const v = parseFloat(lineInputText);
                  if (Number.isFinite(v) && v > 0) onLineChange(v);
                  else setLineInputText(fmtLine(chartLine));
                }}
              />
              <Pressable
                onPress={() => onLineChange(chartLine + 0.5)}
                hitSlop={8}
                style={s.lineAdjustBtn}
              >
                <Ionicons name="chevron-up" size={14} color={brandColors.textSecondary} />
              </Pressable>
            </View>
          ) : null}
          {chartGames.length >= 20 ? (
            <Pressable onPress={() => setCompactView(v => !v)} style={[s.compactToggle, compactView && s.compactToggleActive]}>
              <Ionicons name={compactView ? "expand-outline" : "contract-outline"} size={14} color={compactView ? brandColors.primary : brandColors.textMuted} />
            </Pressable>
          ) : null}
          {dvpRankByTeam && dvpRankByTeam.size > 0 && !compactView ? (
            <Pressable onPress={() => setShowDvpDots(v => !v)} style={[s.dvpToggle, showDvpDots && s.dvpToggleActive]}>
              <View style={s.dvpToggleDotsPreview}>
                <View style={[s.dvpToggleMiniDot, { backgroundColor: "#EF4444" }]} />
                <View style={[s.dvpToggleMiniDot, { backgroundColor: "#F59E0B" }]} />
                <View style={[s.dvpToggleMiniDot, { backgroundColor: "#22C55E" }]} />
              </View>
              <Text style={[s.dvpToggleText, showDvpDots && s.dvpToggleTextActive]}>DvP</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* THE CHART */}
      {bsLoading && !allGames.length ? (
        <View style={[s.chartContainer, { height: CHART_HEIGHT + 60, alignItems: "center", justifyContent: "center" }]}>
          <ActivityIndicator size="small" color={brandColors.primary} />
        </View>
      ) : chartGames.length > 0 ? (
        <View style={s.chartContainer}>
          <View style={s.chartYAxis}>
            <Text style={s.yLabel}>{Math.round(chartMax)}</Text>
            <Text style={s.yLabel}>{Math.round(chartMax / 2)}</Text>
            <Text style={s.yLabel}>0</Text>
          </View>

          <View style={s.chartMain}>
            {/* ── Chart area ── */}
            <View style={{ position: "relative" }}>
              {/* Grid lines + market line overlay (absolute, sized to bar area) */}
              <View style={s.chartBarZone} pointerEvents="none">
                {[0.25, 0.5, 0.75].map((pct) => (
                  <View key={pct} style={[s.gridLine, { bottom: pct * CHART_HEIGHT }]} />
                ))}

                {lineY != null ? (
                  <View style={[s.chartLineWrap, { bottom: lineY }]}>
                    <View style={s.chartLineBadge}>
                      <Text style={s.chartLineBadgeText}>{fmtLine(chartLine)}</Text>
                      {bestOverPrice != null ? (
                        <Text style={s.chartLineOddsText}> O {fmtOdds(bestOverPrice)}</Text>
                      ) : null}
                    </View>
                    <View style={s.chartLineSolid} />
                  </View>
                ) : null}
              </View>

              {/* Bars + footer (natural flow, not clipped) */}
              {compactView ? (
                <View style={[s.compactBars, { height: CHART_HEIGHT }]}>
                  {chartGames.map((game, i) => renderCompactBar(game, i, chartMarket, chartLine, chartMax, barAnims, selectedGameIdx, setSelectedGameIdx))}
                </View>
              ) : needsScroll ? (
                <ScrollView
                  ref={chartScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onContentSizeChange={() => chartScrollRef.current?.scrollToEnd({ animated: false })}
                  contentContainerStyle={{ paddingRight: 4 }}
                >
                  <View style={{ width: (chartGames.length + (oppAbbr ? 1 : 0)) * (CHART_BAR_W + CHART_BAR_GAP) }}>
                    <View style={[s.chartBars, { height: CHART_HEIGHT }]}>
                      {chartGames.map((game, i) => renderBar(game, i, chartMarket, chartLine, chartMax, barAnims, selectedGameIdx, setSelectedGameIdx, true, dvpRankByTeam, showDvpDots))}
                      {oppAbbr ? renderUpcomingBar(oppAbbr, chartLine, chartMax, true) : null}
                    </View>
                    <View style={s.chartFooterRow}>
                      {chartGames.map((game) => renderBarFooter(game, true, dvpRankByTeam, showDvpDots))}
                      {oppAbbr ? renderUpcomingFooter(oppAbbr, true, dvpRankByTeam, showDvpDots) : null}
                    </View>
                  </View>
                </ScrollView>
              ) : (
                <View>
                  <View style={[s.chartBars, { height: CHART_HEIGHT }]}>
                    {chartGames.map((game, i) => renderBar(game, i, chartMarket, chartLine, chartMax, barAnims, selectedGameIdx, setSelectedGameIdx, false, dvpRankByTeam, showDvpDots))}
                    {oppAbbr ? renderUpcomingBar(oppAbbr, chartLine, chartMax, false) : null}
                  </View>
                  <View style={s.chartFooterRow}>
                    {chartGames.map((game) => renderBarFooter(game, false, dvpRankByTeam, showDvpDots))}
                    {oppAbbr ? renderUpcomingFooter(oppAbbr, false, dvpRankByTeam, showDvpDots) : null}
                  </View>
                </View>
              )}

              {/* Compact view timeline below bars */}
              {compactView ? <CompactTimeline games={chartGames} /> : null}
            </View>
          </View>
        </View>
      ) : anyFilterActive ? (
        <View style={s.emptyFilterState}>
          {/* Ghost chart bars */}
          <View style={s.ghostChart}>
            {[0.45, 0.7, 0.55, 0.85, 0.3, 0.65, 0.5].map((h, i) => (
              <View key={i} style={[s.ghostBar, { height: h * (CHART_HEIGHT * 0.55), opacity: 0.08 + i * 0.015 }]} />
            ))}
            <View style={s.ghostLine} />
          </View>
          <Text style={s.emptyFilterTitle}>No matching games</Text>
          <Text style={s.emptyFilterText}>Try adjusting your filters</Text>
          <Pressable onPress={resetFilters} style={s.clearFiltersBtn}>
            <Ionicons name="close-circle-outline" size={14} color={brandColors.primary} />
            <Text style={s.clearFiltersBtnText}>Clear Filters</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Game Detail Modal */}
      {selectedGame ? (
        <GameDetailModal
          game={selectedGame}
          chartMarket={chartMarket}
          chartLine={chartLine}
          teammatesOut={modalTeammatesOut}
          allGames={allGames}
          teammatesOutByGame={teammatesOutByGame}
          teammateSeasonStats={teammateSeasonStats}
          visible
          onClose={() => setSelectedGameIdx(null)}
        />
      ) : null}

      {/* Hit Rate Stats Row (tap to switch period) */}
      <View style={s.hitRateRow}>
        {([
          { period: "L5" as ChartPeriod, pct: filteredHitRates?.l5 ?? lineHitRatesForSelected?.l5 ?? profile.last_5_pct, frac: hitRateFractions.l5 },
          { period: "L10" as ChartPeriod, pct: filteredHitRates?.l10 ?? lineHitRatesForSelected?.l10 ?? profile.last_10_pct, frac: hitRateFractions.l10 },
          { period: "L20" as ChartPeriod, pct: filteredHitRates?.l20 ?? lineHitRatesForSelected?.l20 ?? profile.last_20_pct, frac: hitRateFractions.l20 },
          { period: "SZN" as ChartPeriod, pct: filteredHitRates?.szn ?? lineHitRatesForSelected?.szn ?? profile.season_pct, frac: hitRateFractions.szn },
        ]).map(({ period, pct, frac }) => {
          const active = chartPeriod === period;
          return (
            <Pressable
              key={period}
              onPress={() => { onChartPeriodChange(period); setSelectedGameIdx(null); }}
              style={[s.hitRateItem, active && s.hitRateItemActive]}
            >
              <Text style={[s.hitRateLabel, active && s.hitRateLabelActive]}>{period}</Text>
              <Text style={[active ? s.hitRateValueLarge : s.hitRateValue, { color: hitColor(pct) }]}>
                {fmtPct(pct)}
              </Text>
              {frac.total > 0 ? (
                <Text style={s.hitRateFraction}>{frac.hits}/{frac.total}</Text>
              ) : null}
            </Pressable>
          );
        })}
        {(profile as any).h2h_pct != null ? (
          <Pressable
            onPress={() => { onFilterH2HChange?.(!filterH2H); setSelectedGameIdx(null); }}
            style={[s.hitRateItem, filterH2H && s.hitRateItemActive]}
          >
            <Text style={[s.hitRateLabel, filterH2H && s.hitRateLabelActive]}>H2H</Text>
            <Text style={[filterH2H ? s.hitRateValueLarge : s.hitRateValue, { color: hitColor((profile as any).h2h_pct) }]}>
              {fmtPct((profile as any).h2h_pct)}
            </Text>
            {(profile as any).h2h_games ? (
              <Text style={s.hitRateFraction}>{(profile as any).h2h_games}g</Text>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      {/* Injured Teammates */}
      {injuredTeammates.length > 0 ? (
        <View style={s.injuredSection}>
          <View style={s.injuredHeader}>
            <Text style={s.injuredSectionTitle}>INJURED TEAMMATES</Text>
            {filterTeammateOutIds.size > 0 ? (
              <Text style={s.injuredActiveCount}>{filterTeammateOutIds.size} selected</Text>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.injuredScroll}>
            {injuredTeammates.map(({ info, count, statDiff, minDiff, hitRate, reason, sznPts, sznReb, sznAst, gamesOutTotal }) => {
              const active = filterTeammateOutIds.has(info.player_id);
              const borderC = injuryBorderColor(reason);
              const hasSznStats = sznPts != null || sznReb != null || sznAst != null;
              const hasImpact = count >= 3;
              const diffPositive = statDiff > 0;
              return (
                <Pressable
                  key={info.player_id}
                  onPress={() => toggleTeammateFilter(info.player_id)}
                  style={[
                    s.injuredCard,
                    { borderColor: active ? borderC : `${borderC}40`, backgroundColor: active ? injuryBgColor(reason) : brandColors.panelBackground }
                  ]}
                >
                  <View style={s.injuredCardTop}>
                    <View>
                      <Image
                        source={{ uri: `https://cdn.nba.com/headshots/nba/latest/260x190/${info.player_id}.png` }}
                        style={[s.injuredHeadshot, { borderWidth: 1.5, borderColor: borderC }]}
                      />
                      <View style={[s.injuredStatusDot, { backgroundColor: borderC }]} />
                    </View>
                    <View style={s.injuredCardInfo}>
                      <Text style={[s.injuredName, active && { color: borderC }]} numberOfLines={1}>
                        {info.name}
                      </Text>
                      <View style={s.injuredMeta}>
                        {info.position ? <Text style={s.injuredPos}>{info.position}</Text> : null}
                        {reason ? (
                          <Text style={[s.injuredReasonTag, { color: borderC }]} numberOfLines={1}>
                            {shortenReason(reason)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  {hasSznStats ? (
                    <View style={s.injuredSznStats}>
                      {sznPts != null ? (
                        <Text style={s.injuredSznItem}>
                          <Text style={s.injuredSznVal}>{sznPts.toFixed(1)}</Text>
                          <Text style={s.injuredSznLabel}> PTS</Text>
                        </Text>
                      ) : null}
                      {sznReb != null ? (
                        <>
                          <Text style={s.injuredSznSep}>·</Text>
                          <Text style={s.injuredSznItem}>
                            <Text style={s.injuredSznVal}>{sznReb.toFixed(1)}</Text>
                            <Text style={s.injuredSznLabel}> REB</Text>
                          </Text>
                        </>
                      ) : null}
                      {sznAst != null ? (
                        <>
                          <Text style={s.injuredSznSep}>·</Text>
                          <Text style={s.injuredSznItem}>
                            <Text style={s.injuredSznVal}>{sznAst.toFixed(1)}</Text>
                            <Text style={s.injuredSznLabel}> AST</Text>
                          </Text>
                        </>
                      ) : null}
                    </View>
                  ) : null}
                  {hasImpact ? (
                    <>
                      <Text style={s.injuredWhenOutLabel}>When out ({gamesOutTotal ?? count}g)</Text>
                      <View style={s.injuredCardStats}>
                        <View style={s.injuredStatItem}>
                          <Text style={[s.injuredStatDiff, { color: diffPositive ? brandColors.success : brandColors.error }]}>
                            {diffPositive ? "+" : ""}{statDiff.toFixed(1)}
                          </Text>
                          <Text style={s.injuredStatLabel}>{mktTab(chartMarket)}</Text>
                        </View>
                        <View style={s.injuredStatDivider} />
                        <View style={s.injuredStatItem}>
                          <Text style={[s.injuredStatDiff, { color: minDiff > 0 ? brandColors.success : minDiff < 0 ? brandColors.error : brandColors.textMuted }]}>
                            {minDiff > 0 ? "+" : ""}{minDiff.toFixed(0)}
                          </Text>
                          <Text style={s.injuredStatLabel}>MIN</Text>
                        </View>
                        {hitRate != null ? (
                          <>
                            <View style={s.injuredStatDivider} />
                            <View style={s.injuredStatItem}>
                              <Text style={[s.injuredStatValue, { color: hitColor(hitRate) }]}>
                                {hitRate}%
                              </Text>
                              <Text style={s.injuredStatLabel}>HIT</Text>
                            </View>
                          </>
                        ) : null}
                      </View>
                    </>
                  ) : gamesOutTotal != null ? (
                    <Text style={s.injuredWhenOutLabel}>Missed {gamesOutTotal}g this season</Text>
                  ) : count > 0 ? (
                    <Text style={s.injuredWhenOutLabel}>Out for {count}g</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Suggested Filters */}
      {(homeAway || oppAbbr || dvpRankByTeam?.size || topPlayType) ? (() => {
        const dvpRank = profile?.matchup?.matchup_rank ?? null;
        const dvpQuality = profile?.matchup?.matchup_quality ?? null;
        // Determine which DvP bucket the current opponent falls in
        const dvpBucket: "tough" | "neutral" | "weak" | null =
          dvpRank != null ? (dvpRank <= 10 ? "tough" : dvpRank <= 20 ? "neutral" : "weak") : null;
        const dvpLabel = dvpBucket === "tough" ? "Tough Def (1-10)" : dvpBucket === "weak" ? "Weak Def (21-30)" : dvpBucket === "neutral" ? "Avg Def (11-20)" : null;
        const dvpColor = dvpBucket === "tough" ? "#EF4444" : dvpBucket === "weak" ? "#22C55E" : "#F59E0B";
        const isDvpActive = dvpBucket != null && filterDvp === dvpBucket;
        const isHomeAwayActive = homeAway != null && filterHomeAway === homeAway;
        const isMinutesActive = filterMinMinutes;
        return (
          <View style={s.suggestedSection}>
            <Text style={s.suggestedLabel}>SUGGESTED</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestedScroll}>
              {dvpRank != null && dvpBucket ? (
                <Pressable
                  onPress={() => { setFilterDvp(prev => prev === dvpBucket ? "all" : dvpBucket); setSelectedGameIdx(null); }}
                  style={[s.suggestedPill, { borderColor: isDvpActive ? dvpColor : `${dvpColor}30` },
                    isDvpActive && { backgroundColor: `${dvpColor}18` }]}
                >
                  <Ionicons name="shield" size={11} color={dvpColor} />
                  <Text style={[s.suggestedPillText, { color: dvpColor }]}>
                    {dvpLabel} · #{dvpRank} {mktTab(chartMarket)}
                  </Text>
                  {isDvpActive ? <Ionicons name="close-circle" size={13} color={dvpColor} style={{ marginLeft: 2 }} /> : null}
                </Pressable>
              ) : null}
              {topPlayType && topPlayType.opponent_def_rank != null ? (() => {
                const ptRank = topPlayType.opponent_def_rank;
                const ptColor = topPlayType.matchup_color === "green" ? "#22C55E" : topPlayType.matchup_color === "red" ? "#EF4444" : "#F59E0B";
                const ptRating = topPlayType.matchup_rating === "favorable" ? "Weak" : topPlayType.matchup_rating === "tough" ? "Tough" : "Avg";
                const ptBucket = topPlayType.matchup_rating === "favorable" ? "weak" : topPlayType.matchup_rating === "tough" ? "tough" : "neutral";
                const isPtActive = filterDvp === ptBucket;
                return (
                  <Pressable
                    onPress={() => { setFilterDvp(prev => prev === ptBucket ? "all" : ptBucket); setSelectedGameIdx(null); }}
                    style={[s.suggestedPill, { borderColor: isPtActive ? ptColor : `${ptColor}30` },
                      isPtActive && { backgroundColor: `${ptColor}18` }]}
                  >
                    <Ionicons name="analytics" size={11} color={ptColor} />
                    <Text style={[s.suggestedPillText, { color: ptColor }]}>
                      {topPlayType.display_name} · #{ptRank} {ptRating}
                    </Text>
                    {isPtActive ? <Ionicons name="close-circle" size={13} color={ptColor} style={{ marginLeft: 2 }} /> : null}
                  </Pressable>
                );
              })() : null}
              {homeAway ? (
                <Pressable
                  onPress={() => { setFilterHomeAway(prev => prev === homeAway ? "all" : homeAway); setSelectedGameIdx(null); }}
                  style={[s.suggestedPill, { borderColor: isHomeAwayActive ? brandColors.warning : "rgba(251, 191, 36, 0.25)" },
                    isHomeAwayActive && { backgroundColor: "rgba(251, 191, 36, 0.15)" }]}
                >
                  <Ionicons name="flash" size={11} color={brandColors.warning} />
                  <Text style={s.suggestedPillText}>
                    {homeAway === "H" ? "Home" : "Away"} Games
                  </Text>
                  {isHomeAwayActive ? <Ionicons name="close-circle" size={13} color={brandColors.warning} style={{ marginLeft: 2 }} /> : null}
                </Pressable>
              ) : null}
              {allGames.length >= 20 ? (
                <Pressable
                  onPress={() => { setFilterMinMinutes(prev => !prev); setSelectedGameIdx(null); }}
                  style={[s.suggestedPill, { borderColor: isMinutesActive ? brandColors.warning : "rgba(251, 191, 36, 0.25)" },
                    isMinutesActive && { backgroundColor: "rgba(251, 191, 36, 0.15)" }]}
                >
                  <Ionicons name="flash" size={11} color={brandColors.warning} />
                  <Text style={s.suggestedPillText}>Full Minutes (25+)</Text>
                  {isMinutesActive ? <Ionicons name="close-circle" size={13} color={brandColors.warning} style={{ marginLeft: 2 }} /> : null}
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        );
      })() : null}

      {/* Filter Pills */}
      <View style={s.filterSection}>
        <View style={s.filterHeader}>
          <Text style={s.filterSectionTitle}>FILTERS</Text>
          {anyFilterActive ? (
            <Pressable onPress={resetFilters} style={s.resetPill}>
              <Ionicons name="close" size={12} color={brandColors.error} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
          <Pressable
            onPress={() => setActiveSheet("homeAway")}
            style={[s.filterPill, filterHomeAway !== "all" && s.filterPillActive]}
          >
            <Text style={[s.filterPillText, filterHomeAway !== "all" && s.filterPillTextActive]}>
              {filterHomeAway === "all" ? "Home/Away" : filterHomeAway === "H" ? "Home" : "Away"}
            </Text>
            <Ionicons name="chevron-down" size={12} color={filterHomeAway !== "all" ? brandColors.primary : brandColors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => setActiveSheet("result")}
            style={[s.filterPill, filterResult !== "all" && s.filterPillActive]}
          >
            <Text style={[s.filterPillText, filterResult !== "all" && s.filterPillTextActive]}>
              {filterResult === "all" ? "Result" : filterResult === "W" ? "Wins" : filterResult === "L" ? "Losses" : filterResult === "W10" ? "Won by 10+" : "Lost by 10+"}
            </Text>
            <Ionicons name="chevron-down" size={12} color={filterResult !== "all" ? brandColors.primary : brandColors.textMuted} />
          </Pressable>

          {dvpRankByTeam && dvpRankByTeam.size > 0 ? (
            <Pressable
              onPress={() => setActiveSheet("matchup")}
              style={[s.filterPill, filterDvp !== "all" && s.filterPillActive]}
            >
              <Text style={[s.filterPillText, filterDvp !== "all" && s.filterPillTextActive]}>
                {filterDvp === "all" ? "Matchup" : filterDvp === "tough" ? "Tough Def" : filterDvp === "neutral" ? "Avg Def" : "Weak Def"}
              </Text>
              <Ionicons name="chevron-down" size={12} color={filterDvp !== "all" ? brandColors.primary : brandColors.textMuted} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setActiveSheet("more")}
            style={[s.filterPill, (filterMinMinutes || filterHighUsage || filterHighFGA) && s.filterPillActive]}
          >
            <Text style={[s.filterPillText, (filterMinMinutes || filterHighUsage || filterHighFGA) && s.filterPillTextActive]}>
              More{(filterMinMinutes ? 1 : 0) + (filterHighUsage ? 1 : 0) + (filterHighFGA ? 1 : 0) > 0 ? ` (${(filterMinMinutes ? 1 : 0) + (filterHighUsage ? 1 : 0) + (filterHighFGA ? 1 : 0)})` : ""}
            </Text>
            <Ionicons name="chevron-down" size={12} color={(filterMinMinutes || filterHighUsage || filterHighFGA) ? brandColors.primary : brandColors.textMuted} />
          </Pressable>
        </ScrollView>

        {/* Filtered games count */}
        {anyFilterActive ? (
          <Text style={s.filteredCount}>
            {filteredGames.length} of {allGames.length} games{statAvg != null ? ` · AVG ${statAvg.toFixed(1)}` : ""}
          </Text>
        ) : null}
      </View>

      {/* BottomSheets */}
      <BottomSheet visible={activeSheet === "homeAway"} onClose={() => setActiveSheet(null)} title="Home / Away">
        <View style={s.sheetOptions}>
          {([["all", "All Games"], ["H", "Home"], ["A", "Away"]] as const).map(([val, label]) => (
            <Pressable
              key={val}
              onPress={() => { setFilterHomeAway(val); setActiveSheet(null); setSelectedGameIdx(null); }}
              style={[s.sheetOption, filterHomeAway === val && s.sheetOptionActive]}
            >
              <Text style={[s.sheetOptionText, filterHomeAway === val && s.sheetOptionTextActive]}>{label}</Text>
              {filterHomeAway === val ? <Ionicons name="checkmark" size={18} color={brandColors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={activeSheet === "result"} onClose={() => setActiveSheet(null)} title="Result">
        <View style={s.sheetOptions}>
          {([["all", "All Games"], ["W", "Wins"], ["L", "Losses"], ["W10", "Won by 10+"], ["L10", "Lost by 10+"]] as const).map(([val, label]) => (
            <Pressable
              key={val}
              onPress={() => { setFilterResult(val); setActiveSheet(null); setSelectedGameIdx(null); }}
              style={[s.sheetOption, filterResult === val && s.sheetOptionActive]}
            >
              <Text style={[s.sheetOptionText, filterResult === val && s.sheetOptionTextActive]}>{label}</Text>
              {filterResult === val ? <Ionicons name="checkmark" size={18} color={brandColors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={activeSheet === "matchup"} onClose={() => setActiveSheet(null)} title="Defense Quality (DvP)">
        <View style={s.sheetOptions}>
          {([["all", "All Games", null], ["tough", "Tough Defense (1-10)", "#EF4444"], ["neutral", "Average Defense (11-20)", "#F59E0B"], ["weak", "Weak Defense (21-30)", "#22C55E"]] as const).map(([val, label, color]) => (
            <Pressable
              key={val}
              onPress={() => { setFilterDvp(val); setActiveSheet(null); setSelectedGameIdx(null); }}
              style={[s.sheetOption, filterDvp === val && s.sheetOptionActive]}
            >
              <View style={s.sheetOptionRow}>
                {color ? <View style={[s.dvpDot, { backgroundColor: color }]} /> : null}
                <Text style={[s.sheetOptionText, filterDvp === val && s.sheetOptionTextActive]}>{label}</Text>
              </View>
              {filterDvp === val ? <Ionicons name="checkmark" size={18} color={brandColors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={activeSheet === "more"} onClose={() => setActiveSheet(null)} title="More Filters">
        <View style={s.sheetOptions}>
          <Pressable
            onPress={() => { setFilterMinMinutes(v => !v); setSelectedGameIdx(null); }}
            style={[s.sheetOption, filterMinMinutes && s.sheetOptionActive]}
          >
            <Text style={[s.sheetOptionText, filterMinMinutes && s.sheetOptionTextActive]}>Minutes 25+</Text>
            {filterMinMinutes ? <Ionicons name="checkmark" size={18} color={brandColors.primary} /> : null}
          </Pressable>
          <Pressable
            onPress={() => { setFilterHighUsage(v => !v); setSelectedGameIdx(null); }}
            style={[s.sheetOption, filterHighUsage && s.sheetOptionActive]}
          >
            <Text style={[s.sheetOptionText, filterHighUsage && s.sheetOptionTextActive]}>Usage 25%+</Text>
            {filterHighUsage ? <Ionicons name="checkmark" size={18} color={brandColors.primary} /> : null}
          </Pressable>
          <Pressable
            onPress={() => { setFilterHighFGA(v => !v); setSelectedGameIdx(null); }}
            style={[s.sheetOption, filterHighFGA && s.sheetOptionActive]}
          >
            <Text style={[s.sheetOptionText, filterHighFGA && s.sheetOptionTextActive]}>High FGA (15+)</Text>
            {filterHighFGA ? <Ionicons name="checkmark" size={18} color={brandColors.primary} /> : null}
          </Pressable>
        </View>
      </BottomSheet>

      {/* DvP Info Row */}
      {profile?.matchup?.matchup_rank != null && oppAbbr ? (() => {
        const mRank = profile.matchup.matchup_rank;
        const mQuality = profile.matchup.matchup_quality;
        const mAllowed = (profile.matchup as any).avg_allowed;
        const defLabel = mRank <= 10 ? "Tough D" : mRank <= 20 ? "Avg D" : "Weak D";
        const dotColor = rankColor(mRank);
        const bgColor = rankBgColor(mRank);
        return (
          <View style={s.dvpInfoRow}>
            <View style={[s.dvpInfoPill, { borderColor: `${dotColor}40`, backgroundColor: bgColor }]}>
              <View style={[s.dvpInfoDot, { backgroundColor: dotColor }]} />
              <Text style={[s.dvpInfoText, { color: dotColor }]}>
                {defLabel} #{mRank} {mktTab(chartMarket)}
              </Text>
            </View>
            {mAllowed != null ? (
              <Text style={s.dvpInfoAllowedText}>
                vs {oppAbbr} allows {typeof mAllowed === "number" ? mAllowed.toFixed(1) : mAllowed} {mktTab(chartMarket)}/g
              </Text>
            ) : null}
          </View>
        );
      })() : null}

      {/* Season Averages */}
      {(filteredSeasonAvgs || seasonSummary) ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>{anyFilterActive ? "Filtered Averages" : "Season Averages"}</Text>
          <View style={s.seasonGrid}>
            {[
              { label: "PTS", value: (filteredSeasonAvgs ?? seasonSummary).avgPoints.toFixed(1), szn: seasonSummary?.avgPoints },
              { label: "REB", value: (filteredSeasonAvgs ?? seasonSummary).avgRebounds.toFixed(1), szn: seasonSummary?.avgRebounds },
              { label: "AST", value: (filteredSeasonAvgs ?? seasonSummary).avgAssists.toFixed(1), szn: seasonSummary?.avgAssists },
              { label: "3PM", value: (filteredSeasonAvgs ?? seasonSummary).avgThrees.toFixed(1), szn: seasonSummary?.avgThrees },
              { label: "MIN", value: (filteredSeasonAvgs ?? seasonSummary).avgMinutes.toFixed(0), szn: seasonSummary?.avgMinutes }
            ].map((item) => (
              <View key={item.label} style={s.seasonItem}>
                <Text style={s.seasonValue}>{item.value}</Text>
                {anyFilterActive && item.szn != null ? (
                  <Text style={s.seasonCompare}>szn {item.label === "MIN" ? item.szn.toFixed(0) : item.szn.toFixed(1)}</Text>
                ) : null}
                <Text style={s.seasonLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

    </>
  );
}

/* ─── BottomSheet ─── */

function shortenReason(reason: string): string {
  const r = reason.toLowerCase();
  if (r.includes("injury") || r.includes("illness")) return "Out";
  if (r.startsWith("dnd")) return "DNP";
  if (r === "inactive") return "Inactive";
  if (r === "out") return "Out";
  if (r === "doubtful") return "Doubtful";
  if (r === "questionable") return "GTD";
  if (r === "probable") return "Probable";
  // Capitalize first letter, truncate
  const short = reason.length > 10 ? reason.slice(0, 9) + "…" : reason;
  return short.charAt(0).toUpperCase() + short.slice(1).toLowerCase();
}

function BottomSheet({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.sheetOverlay} onPress={onClose}>
        <Pressable style={s.sheetContent} onPress={(e) => e.stopPropagation()}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={s.sheetClose}>
              <Ionicons name="close" size={20} color={brandColors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView bounces={false}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── Combo Market Helpers ─── */

interface ComboSegment { value: number; label: string }

const COMBO_MARKETS = new Set([
  "player_points_rebounds_assists",
  "player_points_rebounds",
  "player_points_assists",
  "player_rebounds_assists",
  "player_blocks_steals"
]);

function getComboSegments(game: PlayerBoxScoreGame, market: string): ComboSegment[] | null {
  switch (market) {
    case "player_points_rebounds_assists":
      return [{ value: game.pts, label: "P" }, { value: game.reb, label: "R" }, { value: game.ast, label: "A" }];
    case "player_points_rebounds":
      return [{ value: game.pts, label: "P" }, { value: game.reb, label: "R" }];
    case "player_points_assists":
      return [{ value: game.pts, label: "P" }, { value: game.ast, label: "A" }];
    case "player_rebounds_assists":
      return [{ value: game.reb, label: "R" }, { value: game.ast, label: "A" }];
    case "player_blocks_steals":
      return [{ value: game.blk, label: "B" }, { value: game.stl, label: "S" }];
    default:
      return null;
  }
}

/* ─── Bar Renderer ─── */

function renderBar(
  game: PlayerBoxScoreGame, i: number, chartMarket: string,
  chartLine: number | null, chartMax: number,
  barAnims: React.MutableRefObject<Animated.Value[]>,
  selectedGameIdx: number | null, setSelectedGameIdx: (v: number | null) => void,
  fixed: boolean,
  dvpRankByTeam?: Map<string, number>,
  showDvpDots?: boolean
) {
  const val = getGameStat(game, chartMarket);
  const fullH = Math.max(4, (val / chartMax) * CHART_HEIGHT);
  const colors = barColor(val, chartLine);
  const anim = barAnims.current[i];
  const animH = anim ? anim.interpolate({ inputRange: [0, 1], outputRange: [0, fullH] }) : fullH;
  const oppLg = getNbaTeamLogoUrl(game.opponentAbbr);
  const segments = COMBO_MARKETS.has(chartMarket) ? getComboSegments(game, chartMarket) : null;
  const nonZeroSegments = segments?.filter(seg => seg.value > 0) ?? null;

  return (
    <Pressable
      key={game.gameId}
      onPress={() => setSelectedGameIdx(selectedGameIdx === i ? null : i)}
      style={[fixed ? s.chartColFixed : s.chartCol, selectedGameIdx === i && s.chartColSelected]}
    >
      <Text style={[s.chartBarValue, { color: colors.text }]}>{val}</Text>
      {nonZeroSegments && nonZeroSegments.length > 1 ? (
        <Animated.View style={[fixed ? s.chartBarFixed : s.chartBar, { height: animH, backgroundColor: "transparent", overflow: "hidden" }]}>
          {nonZeroSegments.map((seg, idx) => {
            const pct = val > 0 ? (seg.value / val) * 100 : 0;
            const isLast = idx === nonZeroSegments.length - 1;
            const opacity = 0.65 + idx * 0.15;
            return (
              <View
                key={seg.label}
                style={{
                  flex: pct,
                  backgroundColor: colors.bar,
                  opacity,
                  borderTopWidth: idx > 0 ? 0.5 : 0,
                  borderTopColor: "rgba(255,255,255,0.30)",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 2,
                  borderBottomLeftRadius: isLast ? 4 : 0,
                  borderBottomRightRadius: isLast ? 4 : 0,
                  borderTopLeftRadius: idx === 0 ? 4 : 0,
                  borderTopRightRadius: idx === 0 ? 4 : 0,
                }}
              >
                {pct > 15 ? (
                  <Text style={s.segmentLabel}>{seg.value}{seg.label}</Text>
                ) : null}
              </View>
            );
          })}
        </Animated.View>
      ) : (
        <Animated.View style={[fixed ? s.chartBarFixed : s.chartBar, { height: animH, backgroundColor: colors.bar }]} />
      )}
    </Pressable>
  );
}

/* ─── Upcoming Game Bar ─── */

function renderUpcomingBar(
  oppAbbr: string, chartLine: number | null, chartMax: number, fixed: boolean
) {
  const targetH = chartLine != null ? (chartLine / chartMax) * CHART_HEIGHT : CHART_HEIGHT * 0.5;

  return (
    <View key="upcoming" style={[fixed ? s.chartColFixed : s.chartCol, { opacity: 0.5 }]}>
      <Text style={[s.chartBarValue, { color: brandColors.textMuted }]}>?</Text>
      <View style={[fixed ? s.upcomingBarFixed : s.upcomingBar, { height: targetH }]} />
    </View>
  );
}

/* ─── Bar Footer (date + logo, rendered in separate row below chart) ─── */

function renderBarFooter(
  game: PlayerBoxScoreGame, fixed: boolean,
  dvpRankByTeam?: Map<string, number>, showDvpDots?: boolean
) {
  const oppLg = getNbaTeamLogoUrl(game.opponentAbbr);
  return (
    <View key={game.gameId} style={fixed ? s.chartFooterColFixed : s.chartFooterCol}>
      <Text style={s.chartDate}>{fmtDate(game.date)}</Text>
      {showDvpDots && dvpRankByTeam ? (() => {
        const rank = dvpRankByTeam.get(game.opponentAbbr);
        if (rank == null) return null;
        return <View style={[s.dvpBarDot, { backgroundColor: rankColor(rank) }]} />;
      })() : null}
      {oppLg ? <Image source={{ uri: oppLg }} style={s.chartOppLogo} /> : <Text style={s.chartOpp}>{game.opponentAbbr}</Text>}
    </View>
  );
}

function renderUpcomingFooter(
  oppAbbr: string, fixed: boolean,
  dvpRankByTeam?: Map<string, number>, showDvpDots?: boolean
) {
  const oppLg = getNbaTeamLogoUrl(oppAbbr);
  return (
    <View key="upcoming-footer" style={[fixed ? s.chartFooterColFixed : s.chartFooterCol, { opacity: 0.5 }]}>
      <Text style={s.chartDate}>{new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}</Text>
      {showDvpDots && dvpRankByTeam ? (() => {
        const rank = dvpRankByTeam.get(oppAbbr);
        if (rank == null) return null;
        return <View style={[s.dvpBarDot, { backgroundColor: rankColor(rank) }]} />;
      })() : null}
      {oppLg ? <Image source={{ uri: oppLg }} style={s.chartOppLogo} /> : <Text style={s.chartOpp}>{oppAbbr}</Text>}
    </View>
  );
}

/* ─── Compact Bar Renderer ─── */

function renderCompactBar(
  game: PlayerBoxScoreGame, i: number, chartMarket: string,
  chartLine: number | null, chartMax: number,
  barAnims: React.MutableRefObject<Animated.Value[]>,
  selectedGameIdx: number | null, setSelectedGameIdx: (v: number | null) => void
) {
  const val = getGameStat(game, chartMarket);
  const fullH = Math.max(2, (val / chartMax) * CHART_HEIGHT);
  const colors = barColor(val, chartLine);
  const anim = barAnims.current[i];
  const animH = anim ? anim.interpolate({ inputRange: [0, 1], outputRange: [0, fullH] }) : fullH;

  return (
    <Pressable
      key={game.gameId}
      onPress={() => setSelectedGameIdx(selectedGameIdx === i ? null : i)}
      style={[s.compactCol, selectedGameIdx === i && { opacity: 0.7 }]}
    >
      <Animated.View style={[s.compactBar, { height: animH, backgroundColor: colors.bar }]} />
    </Pressable>
  );
}

/* ─── Compact Timeline ─── */

function CompactTimeline({ games }: { games: PlayerBoxScoreGame[] }) {
  if (games.length < 5) return null;

  // Pick ~5 evenly spaced date markers across the timeline
  const count = games.length;
  const numLabels = Math.min(5, Math.max(3, Math.floor(count / 8)));
  const step = (count - 1) / (numLabels - 1);
  const markers: { index: number; date: string; opp: string }[] = [];

  for (let i = 0; i < numLabels; i++) {
    const idx = Math.round(i * step);
    const game = games[idx];
    if (!game) continue;
    const dt = new Date(game.date);
    const date = dt.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
    const opp = `${game.homeAway === "A" ? "@" : ""}${game.opponentAbbr}`;
    markers.push({ index: idx, date, opp });
  }

  return (
    <View style={s.compactTimeline}>
      {markers.map((m, i) => {
        // Position as percentage of the full width
        const leftPct = count > 1 ? (m.index / (count - 1)) * 100 : 50;
        return (
          <View key={i} style={[s.compactTimeMarker, { left: `${leftPct}%` }]}>
            <View style={s.compactTimeTick} />
            <Text style={s.compactTimeDate}>{m.date}</Text>
            <Text style={s.compactTimeOpp}>{m.opp}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* ─── Styles ─── */

const s = StyleSheet.create({
  /* avg row */
  avgRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginTop: 4 },
  avgChip: {
    flexDirection: "row", alignItems: "center", gap: 3
  },
  avgChipLabel: { color: brandColors.textMuted, fontSize: 12, fontWeight: "600" },
  avgChipValue: { color: brandColors.textPrimary, fontSize: 14, fontWeight: "800" },
  avgChipMuted: {
    flexDirection: "row", alignItems: "center", gap: 3
  },
  avgChipLabelMuted: { color: "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: "600" },
  avgChipValueMuted: { color: "rgba(255,255,255,0.30)", fontSize: 12, fontWeight: "700" },
  oddsChip: {
    flexDirection: "row", alignItems: "center", gap: 3
  },
  oddsChipLabel: { color: "rgba(34, 197, 94, 0.6)", fontSize: 11, fontWeight: "700" },
  oddsChipValue: { color: "rgba(34, 197, 94, 0.7)", fontSize: 12, fontWeight: "800" },

  /* line adjuster */
  lineAdjuster: {
    flexDirection: "row", alignItems: "center", gap: 2
  },
  lineAdjustBtn: {
    width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center"
  },
  lineAdjustInput: {
    color: brandColors.textPrimary, fontSize: 15, fontWeight: "800",
    minWidth: 36, textAlign: "center",
    paddingHorizontal: 4, paddingVertical: 0
  },

  /* compact toggle */
  compactToggle: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center"
  },
  compactToggleActive: {
    backgroundColor: "rgba(34, 197, 94, 0.10)"
  },

  /* compact bars */
  compactBars: { flexDirection: "row", alignItems: "flex-end", gap: 1 },
  compactCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  compactBar: { width: "85%", borderRadius: 2, minHeight: 2 },

  /* compact timeline */
  compactTimeline: {
    height: 30, position: "relative", marginTop: 4
  },
  compactTimeMarker: {
    position: "absolute", top: 0, alignItems: "center",
    transform: [{ translateX: -20 }], width: 40
  },
  compactTimeTick: {
    width: 1, height: 4, backgroundColor: "rgba(255,255,255,0.15)", marginBottom: 2
  },
  compactTimeDate: {
    color: brandColors.textMuted, fontSize: 8, fontWeight: "600"
  },
  compactTimeOpp: {
    color: "rgba(255,255,255,0.25)", fontSize: 7, fontWeight: "500"
  },

  /* chart */
  chartContainer: {
    flexDirection: "row", marginHorizontal: 16, marginTop: 8,
    padding: 12, paddingBottom: 8
  },
  chartYAxis: { width: 28, height: CHART_HEIGHT, justifyContent: "space-between", alignItems: "flex-end", paddingRight: 4 },
  yLabel: { color: brandColors.textMuted, fontSize: 10, fontWeight: "600" },
  chartMain: { flex: 1 },
  chartBarZone: { position: "absolute", top: 0, left: 0, right: 0, height: CHART_HEIGHT, zIndex: 1 },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.04)", zIndex: 0 },
  chartLineWrap: {
    position: "absolute", left: -28, right: 0, flexDirection: "row", alignItems: "center", zIndex: 10, height: 20
  },
  chartLineSolid: { flex: 1, height: 1.5, backgroundColor: "rgba(255,255,255,0.25)" },
  chartLineBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, marginRight: 4 },
  chartLineBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  chartLineOddsText: { color: "rgba(34, 197, 94, 0.80)", fontSize: 9, fontWeight: "700" },
  chartBars: { flexDirection: "row", alignItems: "flex-end", gap: CHART_BAR_GAP },
  chartCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", position: "relative" },
  chartColFixed: { width: CHART_BAR_W, alignItems: "center", justifyContent: "flex-end", position: "relative" },
  chartColSelected: { opacity: 0.7 },
  chartBarValue: { fontSize: 11, fontWeight: "800" },
  chartBar: { width: "85%", borderRadius: 4, minHeight: 4 },
  chartBarFixed: { width: CHART_BAR_W - 4, borderRadius: 4, minHeight: 4 },
  segmentLabel: { color: "rgba(255,255,255,0.90)", fontSize: 8, fontWeight: "700", textAlign: "center" },
  chartDate: { color: brandColors.textMuted, fontSize: 9, fontWeight: "600", marginTop: 4 },
  chartOpp: { color: brandColors.textMuted, fontSize: 8, fontWeight: "600" },
  chartOppLogo: { width: 14, height: 14, borderRadius: 7, marginTop: 2 },
  chartFooterRow: { flexDirection: "row", gap: CHART_BAR_GAP, marginTop: 2 },
  chartFooterCol: { flex: 1, alignItems: "center" },
  chartFooterColFixed: { width: CHART_BAR_W, alignItems: "center" },
  upcomingBar: {
    width: "85%", borderRadius: 4, minHeight: 4,
    borderWidth: 1.5, borderStyle: "dashed", borderColor: brandColors.textMuted,
    backgroundColor: "rgba(123, 140, 167, 0.08)"
  },
  upcomingBarFixed: {
    width: CHART_BAR_W - 4, borderRadius: 4, minHeight: 4,
    borderWidth: 1.5, borderStyle: "dashed", borderColor: brandColors.textMuted,
    backgroundColor: "rgba(123, 140, 167, 0.08)"
  },

  /* empty filter state */
  emptyFilterState: {
    height: CHART_HEIGHT + 80, marginHorizontal: 16, marginTop: 8,
    alignItems: "center", justifyContent: "flex-end", gap: 6,
    borderRadius: 12, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.015)", paddingBottom: 16
  },
  ghostChart: {
    flexDirection: "row", alignItems: "flex-end", gap: 6,
    paddingHorizontal: 20, marginBottom: 12, position: "relative"
  },
  ghostBar: {
    width: 22, borderRadius: 4,
    backgroundColor: brandColors.textMuted
  },
  ghostLine: {
    position: "absolute", left: 0, right: 0, bottom: "40%",
    height: 1.5, backgroundColor: "rgba(255,255,255,0.06)"
  },
  emptyFilterTitle: { color: brandColors.textSecondary, fontSize: 14, fontWeight: "700" },
  emptyFilterText: { color: brandColors.textMuted, fontSize: 12, fontWeight: "500" },
  clearFiltersBtn: {
    flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4,
    borderRadius: 20, borderWidth: 1, borderColor: brandColors.primary,
    paddingHorizontal: 14, paddingVertical: 7
  },
  clearFiltersBtnText: { color: brandColors.primary, fontSize: 13, fontWeight: "700" },

  /* hit rate row */
  hitRateRow: {
    flexDirection: "row", alignItems: "stretch", marginHorizontal: 16, marginTop: 4,
    borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground
  },
  hitRateItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRightWidth: 0.5, borderRightColor: brandColors.border },
  hitRateItemActive: { backgroundColor: "rgba(34, 197, 94, 0.08)" },
  hitRateLabel: { color: brandColors.textMuted, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  hitRateLabelActive: { color: "#22C55E" },
  hitRateValue: { fontSize: 14, fontWeight: "800", marginTop: 1 },
  hitRateValueLarge: { fontSize: 16, fontWeight: "800", marginTop: 1 },
  hitRateFraction: { color: brandColors.textMuted, fontSize: 9, fontWeight: "600", marginTop: 1 },

  /* sections */
  section: { paddingHorizontal: 16, gap: 8, marginTop: 12 },
  sectionTitle: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "700" },

  /* season averages */
  seasonGrid: { flexDirection: "row", gap: 3 },
  seasonItem: {
    flex: 1, alignItems: "center", backgroundColor: brandColors.panelBackgroundAlt, borderRadius: 8, paddingVertical: 8
  },
  seasonValue: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "700" },
  seasonCompare: { color: brandColors.textMuted, fontSize: 9, fontWeight: "500", marginTop: 1 },
  seasonLabel: { color: brandColors.textMuted, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  emptyText: { color: brandColors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 12 },

  /* injured teammates */
  injuredSection: { paddingHorizontal: 16, marginTop: 12 },
  injuredHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  injuredSectionTitle: {
    color: brandColors.textMuted, fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.8
  },
  injuredActiveCount: { color: brandColors.primary, fontSize: 10, fontWeight: "700" },
  injuredScroll: { gap: 8, paddingRight: 16 },
  injuredCard: {
    width: 155, borderRadius: 12, borderWidth: 1.5,
    padding: 10, gap: 8
  },
  injuredCardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  injuredHeadshot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  injuredStatusDot: {
    position: "absolute", bottom: -1, right: -1,
    width: 8, height: 8, borderRadius: 4,
    borderWidth: 1.5, borderColor: brandColors.panelBackground
  },
  injuredCardInfo: { flex: 1, gap: 2 },
  injuredName: { color: brandColors.textPrimary, fontSize: 12, fontWeight: "700" },
  injuredReasonTag: { fontSize: 9, fontWeight: "700", flexShrink: 1 },
  injuredSznStats: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: -2 },
  injuredSznItem: { fontSize: 11 },
  injuredSznVal: { color: brandColors.textPrimary, fontSize: 11, fontWeight: "700" },
  injuredSznLabel: { color: brandColors.textMuted, fontSize: 9, fontWeight: "600" },
  injuredSznSep: { color: "rgba(255,255,255,0.15)", fontSize: 9 },
  injuredWhenOutLabel: {
    color: brandColors.textMuted, fontSize: 9, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.3
  },
  injuredMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  injuredPos: {
    color: brandColors.textMuted, fontSize: 9, fontWeight: "700",
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 3,
    paddingHorizontal: 3, paddingVertical: 1, overflow: "hidden"
  },
  injuredCount: { color: brandColors.textMuted, fontSize: 9, fontWeight: "500" },
  injuredCardStats: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 4
  },
  injuredStatItem: { flex: 1, alignItems: "center", gap: 1 },
  injuredStatValue: { color: brandColors.textPrimary, fontSize: 13, fontWeight: "800" },
  injuredStatDiff: { fontSize: 13, fontWeight: "800" },
  injuredStatLabel: { color: brandColors.textMuted, fontSize: 8, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  injuredStatDivider: { width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.06)" },

  /* suggested filters */
  suggestedSection: { paddingHorizontal: 16, marginTop: 10 },
  suggestedLabel: {
    color: brandColors.textMuted, fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6
  },
  suggestedScroll: { gap: 6, paddingRight: 8 },
  suggestedPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(251, 191, 36, 0.25)",
    backgroundColor: "rgba(251, 191, 36, 0.08)", paddingHorizontal: 12, paddingVertical: 7
  },
  suggestedPillText: { color: brandColors.warning, fontSize: 12, fontWeight: "600" },

  /* filter pills */
  filterSection: { paddingHorizontal: 16, marginTop: 10 },
  filterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  filterSectionTitle: {
    color: brandColors.textMuted, fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.8
  },
  filterScroll: { gap: 6, paddingRight: 8 },
  filterPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 20, borderWidth: 1, borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground, paddingHorizontal: 12, paddingVertical: 7
  },
  filterPillActive: { borderColor: brandColors.primary, backgroundColor: brandColors.primarySoft },
  filterPillText: { color: brandColors.textSecondary, fontSize: 13, fontWeight: "600" },
  filterPillTextActive: { color: brandColors.primary },
  resetPill: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1, borderColor: "rgba(248, 113, 113, 0.3)",
    alignItems: "center", justifyContent: "center"
  },
  filteredCount: {
    color: brandColors.textMuted, fontSize: 12, fontWeight: "600", marginTop: 6
  },

  /* bottom sheet */
  sheetOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end"
  },
  sheetContent: {
    backgroundColor: brandColors.appBackground, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40, maxHeight: "60%"
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: brandColors.border,
    alignSelf: "center", marginTop: 10, marginBottom: 8
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: brandColors.border
  },
  sheetTitle: { color: brandColors.textPrimary, fontSize: 17, fontWeight: "700" },
  sheetClose: { padding: 4 },
  sheetOptions: { paddingHorizontal: 16, paddingTop: 8 },
  sheetOption: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2
  },
  sheetOptionActive: { backgroundColor: brandColors.primarySoft },
  sheetOptionText: { color: brandColors.textPrimary, fontSize: 15, fontWeight: "500" },
  sheetOptionTextActive: { color: brandColors.primary, fontWeight: "700" },
  sheetOptionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dvpDot: { width: 8, height: 8, borderRadius: 4 },

  /* dvp bar dots */
  dvpBarDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },

  /* dvp toggle in avg row */
  dvpToggle: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)"
  },
  dvpToggleActive: {
    borderColor: "rgba(34, 197, 94, 0.4)", backgroundColor: "rgba(34, 197, 94, 0.08)"
  },
  dvpToggleDotsPreview: { flexDirection: "row", gap: 2 },
  dvpToggleMiniDot: { width: 4, height: 4, borderRadius: 2 },
  dvpToggleText: { color: brandColors.textMuted, fontSize: 10, fontWeight: "700" },
  dvpToggleTextActive: { color: brandColors.primary },

  /* dvp info row */
  dvpInfoRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, marginTop: 10
  },
  dvpInfoPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 5
  },
  dvpInfoDot: { width: 7, height: 7, borderRadius: 3.5 },
  dvpInfoText: { fontSize: 12, fontWeight: "700" },
  dvpInfoAllowedText: { color: brandColors.textMuted, fontSize: 12, fontWeight: "500" }
});
