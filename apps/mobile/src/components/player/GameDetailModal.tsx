import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PlayerBoxScoreGame } from "@unjuiced/types";
import type { TeammateOut } from "@unjuiced/api";
import type { PlayerOutInfo } from "@/src/hooks/use-players-out-for-filter";
import { getNbaTeamLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";
import {
  fmtDateShort,
  getGameStat,
  mktTab,
  injuryBorderColor,
  BAR_HIT,
  BAR_MISS,
  BAR_PUSH,
} from "./constants";

const SCREEN_H = Dimensions.get("window").height;
const SHEET_MAX = SCREEN_H * 0.88;
const DISMISS_VY = 0.5;
const DISMISS_DY_PCT = 0.35;

interface GameDetailModalProps {
  game: PlayerBoxScoreGame;
  chartMarket: string;
  chartLine: number | null;
  teammatesOut: TeammateOut[];
  allGames: PlayerBoxScoreGame[];
  teammatesOutByGame: Map<string, TeammateOut[]>;
  teammateSeasonStats?: Map<number, PlayerOutInfo>;
  visible: boolean;
  onClose: () => void;
}

/* ─── Stat helpers ─── */

function statIsActive(market: string, stat: string): boolean {
  const map: Record<string, string[]> = {
    player_points: ["PTS"],
    player_rebounds: ["REB"],
    player_assists: ["AST"],
    player_steals: ["STL"],
    player_blocks: ["BLK"],
    player_turnovers: ["TOV"],
    player_threes_made: ["PTS"],
    player_fgm: ["PTS"],
    player_blocks_steals: ["STL", "BLK"],
    player_points_assists: ["PTS", "AST"],
    player_points_rebounds: ["PTS", "REB"],
    player_rebounds_assists: ["REB", "AST"],
    player_points_rebounds_assists: ["PTS", "REB", "AST"],
  };
  return map[market]?.includes(stat) ?? false;
}

function showShooting(market: string): boolean {
  return [
    "player_points",
    "player_threes_made",
    "player_fgm",
    "player_points_rebounds",
    "player_points_assists",
    "player_points_rebounds_assists",
  ].includes(market);
}

function advChipColor(label: string, val: number): string {
  if (label === "TS%" || label === "EFG%") {
    if (val >= 60) return BAR_HIT;
    if (val >= 50) return brandColors.textPrimary;
    return BAR_MISS;
  }
  if (label === "OFF") return val >= 115 ? BAR_HIT : val >= 105 ? brandColors.textPrimary : BAR_MISS;
  if (label === "DEF") return val <= 105 ? BAR_HIT : val <= 115 ? brandColors.textPrimary : BAR_MISS;
  if (label === "NET") return val > 0 ? BAR_HIT : val === 0 ? brandColors.textPrimary : BAR_MISS;
  if (label === "PIE") return val >= 15 ? BAR_HIT : val >= 8 ? brandColors.textPrimary : BAR_MISS;
  return brandColors.textPrimary;
}

function effBarPct(made: number, att: number): number {
  if (att === 0) return 0;
  return Math.min((made / att) * 100, 100);
}

function effBarColor(pct: number): string {
  if (pct >= 50) return BAR_HIT;
  if (pct >= 35) return BAR_PUSH;
  return BAR_MISS;
}

/* ─── Component ─── */

export function GameDetailModal({
  game,
  chartMarket,
  chartLine,
  teammatesOut,
  allGames,
  teammatesOutByGame,
  teammateSeasonStats,
  visible,
  onClose,
}: GameDetailModalProps) {
  const sg = game;
  const sv = getGameStat(sg, chartMarket);
  const isDNP = sg.minutes === 0;
  const sHit = chartLine != null && !isDNP ? (sv > chartLine ? true : sv < chartLine ? false : null) : null;
  const sColor = isDNP
    ? brandColors.textMuted
    : sHit === true
      ? BAR_HIT
      : sHit === false
        ? BAR_MISS
        : chartLine != null
          ? BAR_PUSH
          : brandColors.textPrimary;

  const hitLabel =
    sHit === true ? "HIT" : sHit === false ? "MISS" : chartLine != null && !isDNP ? "PUSH" : null;
  const hitPillBg =
    sHit === true
      ? "rgba(34,197,94,0.15)"
      : sHit === false
        ? "rgba(239,68,68,0.15)"
        : "rgba(245,158,11,0.15)";
  const hitPillColor = sHit === true ? BAR_HIT : sHit === false ? BAR_MISS : BAR_PUSH;

  const sgOppLogo = getNbaTeamLogoUrl(sg.opponentAbbr);

  // ─── Animation values ───
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);
  const sheetHeight = useRef(SHEET_MAX);

  const animateOpen = useCallback(() => {
    translateY.setValue(SCREEN_H);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 28,
        stiffness: 300,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_H,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [translateY, backdropOpacity, onClose]);

  useEffect(() => {
    if (visible) animateOpen();
  }, [visible, animateOpen]);

  // ─── PanResponder ───
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8 && scrollY.current <= 0,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_, gs) => {
        const clamped = Math.max(0, gs.dy);
        translateY.setValue(clamped);
        backdropOpacity.setValue(Math.max(0, 1 - clamped / sheetHeight.current));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.vy > DISMISS_VY || gs.dy > sheetHeight.current * DISMISS_DY_PCT) {
          animateClose();
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 300 }),
            Animated.timing(backdropOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (_, gs) => {
        const clamped = Math.max(0, gs.dy);
        translateY.setValue(clamped);
        backdropOpacity.setValue(Math.max(0, 1 - clamped / sheetHeight.current));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.vy > DISMISS_VY || gs.dy > sheetHeight.current * DISMISS_DY_PCT) {
          animateClose();
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 28, stiffness: 300 }),
            Animated.timing(backdropOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  // ─── Teammate impact stats (unchanged logic) ───
  const teammateStats = useMemo(() => {
    if (!teammatesOut.length || !allGames.length)
      return new Map<number, { gamesOut: number; avgStat: number; avgMin: number; hitPct: number | null } | null>();
    const totalGames = allGames.length;
    const overallAvgMin = allGames.reduce((s, g) => s + g.minutes, 0) / totalGames;
    const result = new Map<
      number,
      { gamesOut: number; avgStat: number; avgMin: number; hitPct: number | null } | null
    >();

    for (const tm of teammatesOut) {
      const tmGames: PlayerBoxScoreGame[] = [];
      for (const [gameId, mates] of teammatesOutByGame) {
        if (mates.some((m) => m.player_id === tm.player_id)) {
          const match = allGames.find((g) => String(g.gameId).replace(/^0+/, "") === gameId);
          if (match) tmGames.push(match);
        }
      }

      if (!tmGames.length || tmGames.length < 3) {
        result.set(tm.player_id, null);
        continue;
      }
      if (totalGames > 5 && tmGames.length / totalGames >= 0.8) {
        result.set(tm.player_id, null);
        continue;
      }

      const avgStat = tmGames.reduce((s, g) => s + getGameStat(g, chartMarket), 0) / tmGames.length;
      const avgMin = tmGames.reduce((s, g) => s + g.minutes, 0) / tmGames.length;
      const minDiff = Math.abs(avgMin - overallAvgMin);
      if (minDiff < 1 && tmGames.length < 8) {
        result.set(tm.player_id, null);
        continue;
      }

      const hitPct =
        chartLine != null
          ? Math.round(
              (tmGames.filter((g) => getGameStat(g, chartMarket) >= chartLine).length / tmGames.length) * 100
            )
          : null;
      result.set(tm.player_id, { gamesOut: tmGames.length, avgStat, avgMin, hitPct });
    }
    return result;
  }, [teammatesOut, allGames, teammatesOutByGame, chartMarket, chartLine]);

  // ─── Advanced stats data ───
  const advStats = useMemo(() => {
    if (isDNP) return [];
    const items: { label: string; value: string; raw: number }[] = [];
    items.push({ label: "TS%", value: `${Math.round(sg.tsPct * 100)}%`, raw: sg.tsPct * 100 });
    items.push({ label: "EFG%", value: `${Math.round(sg.efgPct * 100)}%`, raw: sg.efgPct * 100 });
    items.push({ label: "OFF", value: String(Math.round(sg.offRating)), raw: sg.offRating });
    items.push({ label: "DEF", value: String(Math.round(sg.defRating)), raw: sg.defRating });
    items.push({
      label: "NET",
      value: `${sg.netRating > 0 ? "+" : ""}${Math.round(sg.netRating)}`,
      raw: sg.netRating,
    });
    items.push({ label: "PIE", value: `${Math.round(sg.pie * 100)}%`, raw: sg.pie * 100 });
    items.push({ label: "PACE", value: String(Math.round(sg.pace)), raw: sg.pace });
    return items;
  }, [sg, isDNP]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={animateClose}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={animateClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[s.sheet, { transform: [{ translateY }] }]}
        onLayout={(e) => {
          sheetHeight.current = e.nativeEvent.layout.height;
        }}
      >
        {/* Drag handle */}
        <View {...handlePanResponder.panHandlers} style={s.handleZone}>
          <View style={s.handleBar} />
        </View>

        {/* Header — also draggable */}
        <View {...handlePanResponder.panHandlers} style={s.header}>
          <View style={s.headerLeft}>
            {sgOppLogo ? <Image source={{ uri: sgOppLogo }} style={s.oppLogo} /> : null}
            <Text style={s.headerTitle}>
              {fmtDateShort(sg.date)} {sg.homeAway === "H" ? "vs" : "@"} {sg.opponentAbbr}
            </Text>
          </View>
          <View style={s.headerRight}>
            <View style={[s.resultBadge, sg.result === "W" ? s.resultW : s.resultL]}>
              <Text style={[s.resultText, sg.result === "W" ? s.resultTextW : s.resultTextL]}>
                {sg.result}
                {sg.margin > 0 ? `+${sg.margin}` : sg.margin}
              </Text>
            </View>
            <Pressable onPress={animateClose} hitSlop={10} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={brandColors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={s.body}
          contentContainerStyle={s.bodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          {...panResponder.panHandlers}
        >
          {isDNP ? (
            <View style={s.dnpBanner}>
              <Ionicons name="information-circle" size={16} color={brandColors.warning} />
              <Text style={s.dnpText}>Did Not Play</Text>
            </View>
          ) : null}

          {/* ─── Hero Stat Block ─── */}
          <View style={s.heroCard}>
            <View style={s.heroRow1}>
              <View style={s.heroStatWrap}>
                <Text style={[s.heroStatVal, { color: sColor }]}>{sv}</Text>
                <Text style={s.heroStatLabel}>{mktTab(chartMarket)}</Text>
              </View>
              {hitLabel && chartLine != null ? (
                <View style={[s.hitPill, { backgroundColor: hitPillBg }]}>
                  <View style={[s.hitDot, { backgroundColor: hitPillColor }]} />
                  <Text style={[s.hitText, { color: hitPillColor }]}>
                    {hitLabel} ({sHit === false ? "under" : sHit === true ? "above" : "at"} {chartLine % 1 === 0 ? chartLine : chartLine.toFixed(1)})
                  </Text>
                </View>
              ) : null}
            </View>
            {!isDNP ? (
              <View style={s.heroRow2}>
                <Text style={s.heroMeta}>
                  TS% {Math.round(sg.tsPct * 100)}%
                </Text>
                <Text style={s.heroSep}>·</Text>
                <Text style={s.heroMeta}>
                  USG {Math.round(sg.usagePct * 100)}%
                </Text>
                <Text style={s.heroSep}>·</Text>
                <Text
                  style={[
                    s.heroMeta,
                    { color: sg.plusMinus >= 0 ? brandColors.success : brandColors.error },
                  ]}
                >
                  +/- {sg.plusMinus > 0 ? "+" : ""}
                  {sg.plusMinus}
                </Text>
              </View>
            ) : null}
          </View>

          {!isDNP ? (
            <>
              {/* ─── Stats Grid 4×2 ─── */}
              <View style={s.gridWrap}>
                <View style={s.gridRow}>
                  <GridCell label="PTS" value={sg.pts} active={statIsActive(chartMarket, "PTS")} />
                  <GridCell label="REB" value={sg.reb} active={statIsActive(chartMarket, "REB")} />
                  <GridCell label="AST" value={sg.ast} active={statIsActive(chartMarket, "AST")} />
                  <GridCell label="STL" value={sg.stl} active={statIsActive(chartMarket, "STL")} />
                </View>
                <View style={s.gridRow}>
                  <GridCell label="BLK" value={sg.blk} active={statIsActive(chartMarket, "BLK")} />
                  <GridCell label="TOV" value={sg.tov} active={statIsActive(chartMarket, "TOV")} />
                  <GridCell label="MIN" value={Math.round(sg.minutes)} active={false} />
                  <GridCell label="FOUL" value={sg.fouls} active={false} />
                </View>
              </View>

              {/* ─── Potential Rebounds (rebounds market only) ─── */}
              {chartMarket === "player_rebounds" && sg.potentialReb > 0 ? (
                <View style={s.contextRow}>
                  <Text style={s.contextLabel}>Reb Chances</Text>
                  <Text style={s.contextVal}>{sg.potentialReb}</Text>
                </View>
              ) : null}

              {/* ─── Shooting Pills ─── */}
              {showShooting(chartMarket) ? (
                <View style={s.shootingRow}>
                  <ShootingPill label="FG" made={sg.fgm} att={sg.fga} pct={sg.fgPct} />
                  <ShootingPill label="3PT" made={sg.fg3m} att={sg.fg3a} pct={sg.fg3Pct} />
                  <ShootingPill label="FT" made={sg.ftm} att={sg.fta} pct={sg.ftPct} />
                </View>
              ) : null}

              {/* ─── Advanced Stats ─── */}
              {advStats.length > 0 ? (
                <>
                  <Text style={s.sectionLabel}>Advanced</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.advRow}
                  >
                    {advStats.map((chip) => (
                      <View
                        key={chip.label}
                        style={[
                          s.advChip,
                          {
                            backgroundColor: `${advChipColor(chip.label, chip.raw)}11`,
                            borderColor: `${advChipColor(chip.label, chip.raw)}33`,
                          },
                        ]}
                      >
                        <Text style={[s.advChipLabel, { color: brandColors.textMuted }]}>
                          {chip.label}
                        </Text>
                        <Text
                          style={[s.advChipVal, { color: advChipColor(chip.label, chip.raw) }]}
                        >
                          {chip.value}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </>
              ) : null}

              {/* ─── Game Context ─── */}
              <View style={s.contextRow}>
                <Text style={s.contextLabel}>
                  {sg.homeAway === "H" ? "Home" : "Away"}
                </Text>
                <Text style={s.contextVal}>
                  {sg.teamScore} - {sg.opponentScore}
                </Text>
              </View>
            </>
          ) : null}

          {/* ─── Teammates Out (unchanged) ─── */}
          {teammatesOut.length > 0
            ? (() => {
                const sorted = [...teammatesOut].sort((a, b) => {
                  const sa = teammateSeasonStats?.get(a.player_id);
                  const sb = teammateSeasonStats?.get(b.player_id);
                  const ia = teammateStats.get(a.player_id);
                  const ib = teammateStats.get(b.player_id);
                  const aHas = sa || ia;
                  const bHas = sb || ib;
                  if (aHas && !bHas) return -1;
                  if (!aHas && bHas) return 1;
                  const aGames = sa?.games_out ?? ia?.gamesOut ?? 0;
                  const bGames = sb?.games_out ?? ib?.gamesOut ?? 0;
                  return bGames - aGames;
                });
                const relevant = sorted.filter(
                  (tm) =>
                    teammateStats.get(tm.player_id) != null ||
                    teammateSeasonStats?.get(tm.player_id) != null
                );
                const display = relevant.length > 0 ? relevant : sorted;
                if (!display.length) return null;
                return (
                  <>
                    <View style={s.divider} />
                    <View style={s.tmOutHeader}>
                      <Text style={s.tmOutTitle}>Teammates Out</Text>
                      {display.length < teammatesOut.length ? (
                        <Text style={s.tmOutMore}>
                          +{teammatesOut.length - display.length} bench
                        </Text>
                      ) : null}
                    </View>
                    {display.slice(0, 5).map((tm) => {
                      const sznStats = teammateSeasonStats?.get(tm.player_id);
                      const impactStats = teammateStats.get(tm.player_id);
                      const borderC = injuryBorderColor(tm.reason);
                      const gamesOut = sznStats?.games_out ?? impactStats?.gamesOut ?? null;
                      return (
                        <View key={tm.player_id} style={s.tmOutRow}>
                          <View>
                            <Image
                              source={{
                                uri: `https://cdn.nba.com/headshots/nba/latest/260x190/${tm.player_id}.png`,
                              }}
                              style={[s.tmOutAvatar, { borderColor: borderC }]}
                            />
                            <View style={[s.tmOutDot, { backgroundColor: borderC }]} />
                          </View>
                          <View style={s.tmOutInfo}>
                            <View style={s.tmOutNameRow}>
                              <Text style={s.tmOutName} numberOfLines={1}>
                                {tm.name}
                              </Text>
                              {tm.position ? (
                                <Text style={s.tmOutPos}>{tm.position}</Text>
                              ) : null}
                            </View>
                            {sznStats ? (
                              <View style={s.tmOutStats}>
                                {sznStats.avg_pts != null ? (
                                  <Text style={s.tmOutStatItem}>
                                    <Text style={s.tmOutStatVal}>
                                      {sznStats.avg_pts.toFixed(1)}
                                    </Text>
                                    <Text style={s.tmOutStatLabel}> PTS</Text>
                                  </Text>
                                ) : null}
                                {sznStats.avg_reb != null ? (
                                  <>
                                    <Text style={s.tmOutStatSep}>·</Text>
                                    <Text style={s.tmOutStatItem}>
                                      <Text style={s.tmOutStatVal}>
                                        {sznStats.avg_reb.toFixed(1)}
                                      </Text>
                                      <Text style={s.tmOutStatLabel}> REB</Text>
                                    </Text>
                                  </>
                                ) : null}
                                {sznStats.avg_ast != null ? (
                                  <>
                                    <Text style={s.tmOutStatSep}>·</Text>
                                    <Text style={s.tmOutStatItem}>
                                      <Text style={s.tmOutStatVal}>
                                        {sznStats.avg_ast.toFixed(1)}
                                      </Text>
                                      <Text style={s.tmOutStatLabel}> AST</Text>
                                    </Text>
                                  </>
                                ) : null}
                                {gamesOut != null ? (
                                  <Text style={s.tmOutGames}>(missed {gamesOut}g)</Text>
                                ) : null}
                              </View>
                            ) : impactStats ? (
                              <View style={s.tmOutStats}>
                                <Text style={s.tmOutStatItem}>
                                  <Text style={s.tmOutStatVal}>
                                    {impactStats.avgMin.toFixed(0)}
                                  </Text>
                                  <Text style={s.tmOutStatLabel}> MIN</Text>
                                </Text>
                                <Text style={s.tmOutStatSep}>·</Text>
                                <Text style={s.tmOutStatItem}>
                                  <Text style={s.tmOutStatVal}>
                                    {impactStats.avgStat.toFixed(1)}
                                  </Text>
                                  <Text style={s.tmOutStatLabel}> {mktTab(chartMarket)}</Text>
                                </Text>
                                {gamesOut != null ? (
                                  <Text style={s.tmOutGames}>(missed {gamesOut}g)</Text>
                                ) : null}
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </>
                );
              })()
            : null}

          {/* Bottom padding */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/* ─── Grid Cell ─── */

function GridCell({ label, value, active }: { label: string; value: number; active: boolean }) {
  return (
    <View style={[s.gridCell, active && s.gridCellActive]}>
      <Text style={[s.gridVal, active && s.gridValActive]}>{value}</Text>
      <Text style={[s.gridLabel, active && s.gridLabelActive]}>{label}</Text>
    </View>
  );
}

/* ─── Shooting Pill ─── */

function ShootingPill({
  label,
  made,
  att,
  pct,
}: {
  label: string;
  made: number;
  att: number;
  pct: number;
}) {
  const pctVal = Math.round(pct * 100);
  const barW = effBarPct(made, att);
  const barC = effBarColor(pctVal);
  return (
    <View style={s.shootPill}>
      <Text style={s.shootLabel}>{label}</Text>
      <Text style={s.shootVal}>
        {made}/{att}
      </Text>
      <Text style={[s.shootPct, { color: barC }]}>{pctVal}%</Text>
      <View style={s.shootBarBg}>
        <View style={[s.shootBarFill, { width: `${barW}%`, backgroundColor: barC }]} />
      </View>
    </View>
  );
}

/* ─── Styles ─── */

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SHEET_MAX,
    backgroundColor: brandColors.panelBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: brandColors.border,
  },
  handleZone: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  oppLogo: { width: 24, height: 24, borderRadius: 12 },
  headerTitle: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resultW: { backgroundColor: "rgba(34,197,94,0.15)" },
  resultL: { backgroundColor: "rgba(248,113,113,0.15)" },
  resultText: { fontSize: 13, fontWeight: "800" },
  resultTextW: { color: brandColors.success },
  resultTextL: { color: brandColors.error },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  // Body
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },

  // DNP
  dnpBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(251,191,36,0.1)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  dnpText: { color: brandColors.warning, fontSize: 14, fontWeight: "700" },

  // Hero
  heroCard: {
    backgroundColor: brandColors.panelBackgroundAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  heroRow1: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroStatWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  heroStatVal: {
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -1,
  },
  heroStatLabel: {
    color: brandColors.textMuted,
    fontSize: 15,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  hitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  hitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hitText: {
    fontSize: 11,
    fontWeight: "700",
  },
  heroRow2: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
  },
  heroMeta: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  heroSep: {
    color: "rgba(255,255,255,0.15)",
    fontSize: 13,
  },

  // Stats Grid
  gridWrap: {
    marginBottom: 16,
    gap: 2,
  },
  gridRow: {
    flexDirection: "row",
    gap: 2,
  },
  gridCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  gridCellActive: {
    backgroundColor: brandColors.primarySoft,
  },
  gridVal: {
    color: brandColors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  gridValActive: {
    color: brandColors.primary,
  },
  gridLabel: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  gridLabelActive: {
    color: brandColors.primary,
  },

  // Shooting
  shootingRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  shootPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  shootLabel: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  shootVal: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  shootPct: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  shootBarBg: {
    width: "100%",
    height: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 1,
    marginTop: 6,
    overflow: "hidden",
  },
  shootBarFill: {
    height: 2,
    borderRadius: 1,
  },

  // Advanced
  sectionLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  advRow: {
    gap: 6,
    paddingBottom: 16,
  },
  advChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 56,
  },
  advChipLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  advChipVal: {
    fontSize: 14,
    fontWeight: "800",
  },

  // Game Context
  contextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 4,
  },
  contextLabel: {
    color: brandColors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  contextVal: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: brandColors.border,
    marginVertical: 10,
  },

  // Teammates Out (unchanged styles)
  tmOutHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  tmOutTitle: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tmOutMore: { color: brandColors.warning, fontSize: 10, fontWeight: "600" },
  tmOutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  tmOutAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: brandColors.panelBackgroundAlt,
    borderWidth: 1.5,
  },
  tmOutDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: brandColors.panelBackground,
  },
  tmOutInfo: { flex: 1, gap: 2 },
  tmOutNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tmOutName: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  tmOutPos: {
    color: brandColors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: "hidden",
  },
  tmOutStats: { flexDirection: "row", alignItems: "center", gap: 4 },
  tmOutStatItem: { fontSize: 12 },
  tmOutStatVal: {
    color: brandColors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  tmOutStatLabel: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  tmOutStatSep: { color: "rgba(255,255,255,0.15)", fontSize: 10 },
  tmOutGames: { color: brandColors.textMuted, fontSize: 10, fontWeight: "500" },
});
