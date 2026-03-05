import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQueries } from "@tanstack/react-query";
import type { HitRateSortField, HitRateProfileV2, HitRatesV2Response } from "@unjuiced/types";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/providers/auth-provider";
import { getNbaTeamLogoUrl, getSportsbookLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";
import { streakColor } from "@/src/components/player/constants";
import PlanGate from "@/src/components/plan-gate/PlanGate";
import { PLAN_GATE_FEATURES } from "@/src/components/plan-gate/plan-gate-config";

/* ─── Sport config ─── */

type SportId = "nba" | "mlb" | "nfl" | "nhl";

const SPORT_OPTIONS: Array<{
  id: SportId;
  label: string;
  icon: string;
  enabled: boolean;
  emptyTitle: string;
  emptySubtitle: string;
}> = [
  { id: "nba", label: "NBA", icon: "basketball-outline", enabled: true, emptyTitle: "", emptySubtitle: "" },
  { id: "mlb", label: "MLB", icon: "baseball-outline", enabled: false, emptyTitle: "MLB props coming soon", emptySubtitle: "We're building hit rates for MLB. Stay tuned for launch." },
  { id: "nfl", label: "NFL", icon: "american-football-outline", enabled: false, emptyTitle: "NFL props coming soon", emptySubtitle: "NFL hit rates are on the roadmap. Check back later." },
  { id: "nhl", label: "NHL", icon: "snow-outline", enabled: false, emptyTitle: "NHL props coming soon", emptySubtitle: "NHL hit rates are on the roadmap. Check back later." },
];

/* ─── constants ─── */

const SCREEN_H = Dimensions.get("window").height;
const DRAWER_MAX = SCREEN_H * 0.85;
const DISMISS_VY = 0.5;
const DISMISS_DY_PCT = 0.35;

const MARKET_OPTIONS: Array<{ id: string; label: string; short: string }> = [
  { id: "player_points", label: "Points", short: "PTS" },
  { id: "player_rebounds", label: "Rebounds", short: "REB" },
  { id: "player_assists", label: "Assists", short: "AST" },
  { id: "player_points_rebounds_assists", label: "PRA", short: "PRA" },
  { id: "player_points_rebounds", label: "P+R", short: "P+R" },
  { id: "player_points_assists", label: "P+A", short: "P+A" },
  { id: "player_rebounds_assists", label: "R+A", short: "R+A" },
  { id: "player_threes_made", label: "3-Pointers", short: "3PM" },
  { id: "player_steals", label: "Steals", short: "STL" },
  { id: "player_blocks", label: "Blocks", short: "BLK" },
  { id: "player_blocks_steals", label: "Blk+Stl", short: "B+S" },
];

/** Grid for the filter drawer */
const MARKET_GRID = MARKET_OPTIONS;

const MIN_HIT_OPTIONS = [0, 60, 70, 80];

const QUICK_SORT_OPTIONS: Array<{ field: HitRateSortField; label: string }> = [
  { field: "l5Pct", label: "L5" },
  { field: "l10Pct", label: "L10" },
  { field: "l20Pct", label: "L20" },
  { field: "h2hPct", label: "H2H" },
  { field: "seasonPct", label: "SZN" },
];

const MATCHUP_OPTIONS: Array<{ value: string; label: string; rank: string; color: string }> = [
  { value: "favorable", label: "Easy", rank: "1–10", color: "#22C55E" },
  { value: "neutral", label: "Moderate", rank: "11–20", color: "#F59E0B" },
  { value: "unfavorable", label: "Hard", rank: "21–30", color: "#EF4444" },
];

/* ─── Default state ─── */

const DEFAULT_MARKET = "player_points";
const DEFAULT_SORT: HitRateSortField = "l10Pct";
const DEFAULT_SORT_DIR: "asc" | "desc" = "desc";
const DEFAULT_MIN_HIT = 0;
const DEFAULT_HAS_ODDS = false;

/* ─── helpers ─── */

function formatPct(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

function formatOdds(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return value > 0 ? `+${value}` : String(value);
}

function formatLine(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function isCompletedGame(row: HitRateProfileV2): boolean {
  return String(row.game_status ?? "").toLowerCase().includes("final");
}

function getPlayerName(row: HitRateProfileV2): string {
  return row.player_name || row.nba_players_hr?.name || "Unknown";
}

function getGameKey(row: HitRateProfileV2): string {
  if (row.game_id) return row.game_id;
  return `${row.game_date ?? "D"}:${row.team_abbr ?? "T"}:${row.opponent_team_abbr ?? "O"}`;
}

function getGameLabel(row: HitRateProfileV2): string {
  const team = row.team_abbr ?? "TM";
  const opp = row.opponent_team_abbr ?? "OPP";
  if (row.home_away === "H") return `${opp} @ ${team}`;
  if (row.home_away === "A") return `${team} @ ${opp}`;
  return `${team} vs ${opp}`;
}

function hasGameStarted(row: HitRateProfileV2): boolean {
  const status = String(row.game_status ?? "").toLowerCase().trim();
  if (!status) return false;
  if (status.includes("final")) return true;
  const timeMatch = status.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*et$/i);
  if (!timeMatch) return true;
  if (!row.game_date) return false;
  const [, hours, minutes, period] = timeMatch;
  let hour = Number(hours);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;
  const scheduled = new Date(
    `${row.game_date}T${String(hour).padStart(2, "0")}:${minutes}:00-05:00`
  );
  if (!Number.isFinite(scheduled.getTime())) return false;
  return Date.now() >= scheduled.getTime();
}

function hitColor(pct: number | null | undefined): string {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return brandColors.textMuted;
  if (pct >= 70) return brandColors.success;
  if (pct >= 55) return brandColors.textPrimary;
  if (pct >= 40) return brandColors.warning;
  return brandColors.error;
}

function dvpColor(quality: string | null | undefined): string {
  if (quality === "favorable") return "#22C55E";
  if (quality === "unfavorable" || quality === "tough") return "#EF4444";
  if (quality === "neutral") return "#F59E0B";
  return brandColors.textMuted;
}

const MARKET_DISPLAY: Record<string, string> = {
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_points_rebounds_assists: "Pts + Reb + Ast",
  player_points_rebounds: "Pts + Reb",
  player_points_assists: "Pts + Ast",
  player_rebounds_assists: "Reb + Ast",
  player_threes_made: "Threes",
  player_steals: "Steals",
  player_blocks: "Blocks",
  player_blocks_steals: "Blk + Stl",
};

function mktShort(market: string): string {
  return MARKET_DISPLAY[market] ?? market.replace("player_", "").replace(/_/g, " ");
}

type GameFilterOption = {
  key: string;
  label: string;
  started: boolean;
  completed: boolean;
  awayAbbr: string;
  homeAbbr: string;
  gameTime: string | null;
};

/* ─── Filter Drawer ─── */

function FilterDrawer({
  visible,
  onClose,
  selectedMarkets,
  toggleMarket,
  gameOptions,
  selectedGameKeys,
  toggleGameFilter,
  clearGameFilter,
  minHitRate,
  setMinHitRate,
  hasOddsOnly,
  setHasOddsOnly,
  matchupFilter,
  toggleMatchup,
  resultCount,
  isNonDefault,
  onReset,
}: {
  visible: boolean;
  onClose: () => void;
  selectedMarkets: string[];
  toggleMarket: (m: string) => void;
  gameOptions: GameFilterOption[];
  selectedGameKeys: string[];
  toggleGameFilter: (key: string) => void;
  clearGameFilter: () => void;
  minHitRate: number;
  setMinHitRate: (v: number) => void;
  hasOddsOnly: boolean;
  setHasOddsOnly: (v: boolean) => void;
  matchupFilter: string[];
  toggleMatchup: (v: string) => void;
  resultCount: number;
  isNonDefault: boolean;
  onReset: () => void;
}) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);
  const sheetHeight = useRef(DRAWER_MAX);
  const [gamesExpanded, setGamesExpanded] = useState(false);

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

  // Content PanResponder — only intercepts when scrolled to top
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

  // Drag handle — always captures
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

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={animateClose}>
      {/* Backdrop */}
      <Animated.View style={[ds.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={animateClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[ds.sheet, { transform: [{ translateY }] }]}
        onLayout={(e) => { sheetHeight.current = e.nativeEvent.layout.height; }}
      >
        {/* Drag handle */}
        <View {...handlePanResponder.panHandlers} style={ds.handleZone}>
          <View style={ds.handleBar} />
        </View>

        {/* Header */}
        <View {...handlePanResponder.panHandlers} style={ds.header}>
          <Text style={ds.headerTitle}>Filters</Text>
          <Pressable onPress={animateClose} hitSlop={10} style={ds.closeBtn}>
            <Ionicons name="close" size={20} color={brandColors.textMuted} />
          </Pressable>
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={ds.body}
          contentContainerStyle={ds.bodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          {...panResponder.panHandlers}
        >
          {/* ── Props (Market) ── */}
          <Text style={ds.sectionTitle}>Props</Text>
          <View style={ds.marketGrid}>
            {MARKET_GRID.map((opt) => {
              const active = selectedMarkets.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => toggleMarket(opt.id)}
                  style={[ds.marketCell, active && ds.marketCellActive]}
                >
                  <Text style={[ds.marketCellText, active && ds.marketCellTextActive]}>
                    {opt.short}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Games ── */}
          <Pressable
            onPress={() => setGamesExpanded((c) => !c)}
            style={ds.sectionHeaderRow}
          >
            <Text style={ds.sectionTitle}>Games</Text>
            <Ionicons
              name={gamesExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={brandColors.textMuted}
            />
          </Pressable>
          {gamesExpanded ? (
            <View style={ds.gamesSectionOuter}>
              <ScrollView
                style={ds.gamesScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                bounces={false}
              >
                <Pressable
                  onPress={clearGameFilter}
                  style={[ds.gameChip, selectedGameKeys.length === 0 && ds.gameChipActive]}
                >
                  <Text style={[ds.gameChipText, selectedGameKeys.length === 0 && ds.gameChipTextActive]}>
                    All upcoming
                  </Text>
                </Pressable>
                {gameOptions.map((game) => {
                  const active = selectedGameKeys.includes(game.key);
                  const awayLogo = getNbaTeamLogoUrl(game.awayAbbr);
                  const homeLogo = getNbaTeamLogoUrl(game.homeAbbr);
                  return (
                    <Pressable
                      key={game.key}
                      onPress={() => toggleGameFilter(game.key)}
                      style={[ds.gameRow, active && ds.gameRowActive]}
                    >
                      <View style={ds.gameLogos}>
                        {awayLogo ? <Image source={{ uri: awayLogo }} style={ds.gameLogo} /> : null}
                        <Text style={[ds.gameLabel, active && ds.gameLabelActive, game.started && !active && ds.gameLabelMuted]}>
                          {game.label}
                        </Text>
                        {homeLogo ? <Image source={{ uri: homeLogo }} style={ds.gameLogo} /> : null}
                      </View>
                      <View style={ds.gameRight}>
                        {game.completed ? (
                          <Text style={ds.gameBadgeFinal}>FINAL</Text>
                        ) : game.started ? (
                          <Text style={ds.gameBadgeLive}>LIVE</Text>
                        ) : game.gameTime ? (
                          <Text style={ds.gameTime}>{game.gameTime}</Text>
                        ) : null}
                        {active ? <Ionicons name="checkmark" size={18} color={brandColors.primary} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* ── Hit Rate ── */}
          <Text style={ds.sectionTitle}>Hit Rate</Text>
          <View style={ds.chipRow}>
            {MIN_HIT_OPTIONS.map((val) => {
              const active = minHitRate === val;
              return (
                <Pressable
                  key={`hr-${val}`}
                  onPress={() => setMinHitRate(val)}
                  style={[ds.chip, active && ds.chipActive]}
                >
                  <Text style={[ds.chipText, active && ds.chipTextActive]}>
                    {val === 0 ? "Any" : `${val}%+`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Odds ── */}
          <Text style={ds.sectionTitle}>Odds</Text>
          <View style={ds.toggleRow}>
            <Text style={ds.toggleLabel}>Has Odds Only</Text>
            <Switch
              value={hasOddsOnly}
              onValueChange={setHasOddsOnly}
              trackColor={{ false: "rgba(255,255,255,0.1)", true: brandColors.primary }}
              thumbColor="#FFF"
            />
          </View>

          {/* ── Matchup (DvP) ── */}
          <Text style={ds.sectionTitle}>Matchup (DvP)</Text>
          <View style={ds.chipRow}>
            {MATCHUP_OPTIONS.map((opt) => {
              const active = matchupFilter.includes(opt.value);
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => toggleMatchup(opt.value)}
                  style={[
                    ds.matchupChip,
                    active && { backgroundColor: `${opt.color}18`, borderColor: opt.color },
                  ]}
                >
                  <View style={[ds.matchupDot, { backgroundColor: opt.color }]} />
                  <View>
                    <Text style={[ds.matchupLabel, active && { color: opt.color }]}>
                      {opt.label}
                    </Text>
                    <Text style={[ds.matchupRank, active && { color: opt.color, opacity: 0.7 }]}>
                      {opt.rank}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom actions — fixed at bottom of drawer */}
        <View style={ds.applyWrap}>
          <View style={ds.applyRow}>
            {isNonDefault ? (
              <Pressable onPress={onReset} style={ds.resetBtn}>
                <Ionicons name="refresh-outline" size={16} color={brandColors.textSecondary} />
                <Text style={ds.resetBtnText}>Reset</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={animateClose} style={[ds.applyBtn, !isNonDefault && { flex: 1 }]}>
              <Text style={ds.applyBtnText}>Show Results ({resultCount})</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

/* ─── Player Card ─── */

const PlayerCard = ({
  row,
  bestBook,
  bestPrice,
  sortField,
  onPress
}: {
  row: HitRateProfileV2;
  bestBook: string;
  bestPrice: number | null;
  sortField: HitRateSortField;
  onPress: () => void;
}) => {
  const teamLogo = getNbaTeamLogoUrl(row.team_abbr);
  const bookLogo = getSportsbookLogoUrl(bestBook);
  const headshot = row.player_id ? `https://cdn.nba.com/headshots/nba/latest/260x190/${row.player_id}.png` : null;
  const imgFailed = useRef(false);
  const [, forceUpdate] = useState(0);

  const showHeadshot = headshot && !imgFailed.current;

  const primaryPct =
    sortField === "l5Pct"
      ? row.last_5_pct
      : sortField === "seasonPct"
        ? row.season_pct
        : row.last_10_pct;

  const barPct = typeof primaryPct === "number" && Number.isFinite(primaryPct) ? Math.min(100, Math.max(0, primaryPct)) : 0;
  const barClr = barPct >= 70 ? brandColors.success : barPct >= 55 ? brandColors.primary : barPct >= 40 ? brandColors.warning : brandColors.error;

  const l10Avg = (row as any).last_10_avg as number | null | undefined;
  const edge = typeof l10Avg === "number" && Number.isFinite(l10Avg) && row.line != null
    ? l10Avg - row.line
    : null;

  const position = row.nba_players_hr?.depth_chart_pos ?? null;
  const streak = row.hit_streak ?? 0;
  const isStreaking = streak >= 3;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {/* Row 1: Player info */}
      <View style={styles.cardTop}>
        <View style={styles.cardPlayerInfo}>
          <View style={isStreaking ? [styles.streakRing, { borderColor: streakColor(streak), shadowColor: streakColor(streak) }] : undefined}>
            {showHeadshot ? (
              <Image
                source={{ uri: headshot }}
                style={[styles.cardHeadshot, isStreaking && styles.cardHeadshotStreak]}
                onError={() => { imgFailed.current = true; forceUpdate(n => n + 1); }}
              />
            ) : teamLogo ? (
              <Image source={{ uri: teamLogo }} style={[styles.cardTeamLogo, isStreaking && styles.cardHeadshotStreak]} />
            ) : (
              <View style={[styles.cardTeamLogo, styles.cardTeamLogoPlaceholder]} />
            )}
            {isStreaking ? (
              <View style={[styles.streakBadge, { backgroundColor: streakColor(streak) }]}>
                <Ionicons name="flame" size={10} color="#FFF" />
                <Text style={styles.streakBadgeText}>{streak}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.cardNameBlock}>
            <View style={styles.cardNameRow}>
              <Text style={styles.cardPlayerName} numberOfLines={1}>{getPlayerName(row)}</Text>
              {teamLogo ? (
                <Image source={{ uri: teamLogo }} style={styles.cardInlineTeamLogo} />
              ) : null}
              {position ? <Text style={styles.cardPosition}>{position}</Text> : null}
            </View>
            <View style={styles.cardPropRow}>
              <Text style={styles.cardPropLine}>
                O {formatLine(row.line)} {mktShort(row.market)}
              </Text>
              {bestPrice != null ? (
                <Text style={styles.cardPropOdds}>{formatOdds(bestPrice)}</Text>
              ) : null}
              {bookLogo ? (
                <Image source={{ uri: bookLogo }} style={styles.oddsBookLogo} />
              ) : null}
            </View>
          </View>
        </View>
        {edge != null ? (
          <View style={styles.edgeBadge}>
            <Text style={styles.edgeLabel}>EDGE</Text>
            <Text style={[styles.edgeValue, { color: edge > 0 ? brandColors.success : brandColors.error }]}>
              {edge > 0 ? "+" : ""}{edge.toFixed(1)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Hit rate progress bar */}
      <View style={styles.hitBarContainer}>
        <View style={[styles.hitBarFill, { width: `${barPct}%`, backgroundColor: barClr }]} />
      </View>

      {/* Row 2: Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>DVP</Text>
          <Text style={[styles.statValue, { color: dvpColor(row.matchup?.matchup_quality) }]}>
            {row.matchup?.matchup_rank != null ? `#${row.matchup.matchup_rank}` : "—"}
          </Text>
        </View>
        {(row as any).h2h_pct != null ? (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>H2H</Text>
              <Text style={[styles.statValue, { color: hitColor((row as any).h2h_pct) }]}>
                {formatPct((row as any).h2h_pct)}
              </Text>
            </View>
          </>
        ) : null}
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={[styles.statLabel, sortField === "l5Pct" && styles.statLabelActive]}>L5</Text>
          <Text style={[styles.statValue, { color: hitColor(row.last_5_pct) }, sortField === "l5Pct" && styles.statValueHighlighted]}>
            {formatPct(row.last_5_pct)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={[styles.statLabel, sortField === "l10Pct" && styles.statLabelActive]}>L10</Text>
          <Text
            style={[
              styles.statValue,
              { color: hitColor(row.last_10_pct) },
              sortField === "l10Pct" && styles.statValueHighlighted
            ]}
          >
            {formatPct(row.last_10_pct)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>L20</Text>
          <Text style={[styles.statValue, { color: hitColor(row.last_20_pct) }]}>
            {formatPct(row.last_20_pct)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={[styles.statLabel, sortField === "seasonPct" && styles.statLabelActive]}>SZN</Text>
          <Text style={[styles.statValue, { color: hitColor(row.season_pct) }, sortField === "seasonPct" && styles.statValueHighlighted]}>
            {formatPct(row.season_pct)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

/* ─── Main Screen ─── */

export default function PropsScreen() {
  const router = useRouter();
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  // Sport state
  const [sport, setSport] = useState<SportId>("nba");
  const activeSport = SPORT_OPTIONS.find((s) => s.id === sport)!;

  // Filter state
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([DEFAULT_MARKET]);
  const [hasOddsOnly, setHasOddsOnly] = useState(DEFAULT_HAS_ODDS);
  const [sort, setSort] = useState<HitRateSortField>(DEFAULT_SORT);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(DEFAULT_SORT_DIR);
  const [minHitRate, setMinHitRate] = useState(DEFAULT_MIN_HIT);
  const [searchText, setSearchText] = useState("");
  const [selectedGameKeys, setSelectedGameKeys] = useState<string[]>([]);
  const [matchupFilter, setMatchupFilter] = useState<string[]>([]);

  // Drawer visibility
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Bottom bar scroll hide
  const bottomBarTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const bottomBarVisible = useRef(true);
  const scrollIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBottomBar = useCallback(() => {
    if (!bottomBarVisible.current) {
      bottomBarVisible.current = true;
      Animated.timing(bottomBarTranslateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [bottomBarTranslateY]);

  const onListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const goingDown = y > lastScrollY.current && y > 20;
      lastScrollY.current = y;

      // Clear any pending idle timer
      if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current);

      if (goingDown && bottomBarVisible.current) {
        bottomBarVisible.current = false;
        Animated.timing(bottomBarTranslateY, {
          toValue: 80,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else if (!goingDown && !bottomBarVisible.current) {
        showBottomBar();
      }

      // Show bar after scroll stops (no new events for 300ms)
      scrollIdleTimer.current = setTimeout(showBottomBar, 300);
    },
    [bottomBarTranslateY, showBottomBar]
  );

  const sportEnabled = activeSport.enabled;
  const { session, user } = useAuth();
  const searchTrimmed = searchText.trim();

  // Fire one query per selected market, merge results
  const marketQueries = useQueries({
    queries: selectedMarkets.map((mkt) => ({
      queryKey: [
        "hit-rates-v2",
        user?.id,
        mkt,
        minHitRate ?? "",
        150,
        0,
        searchTrimmed,
        sort,
        sortDir,
        hasOddsOnly,
      ],
      queryFn: async (): Promise<HitRatesV2Response> => {
        return api.getNbaHitRatesV2({
          accessToken: session?.access_token,
          market: mkt,
          minHitRate,
          limit: 150,
          search: searchTrimmed || undefined,
          sort,
          sortDir,
          hasOdds: hasOddsOnly,
        });
      },
      enabled: sportEnabled && !!session,
      staleTime: 15_000,
      gcTime: 10 * 60_000,
      refetchInterval: autoRefreshEnabled ? 30_000 : false as const,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  });

  const isLoading = marketQueries.some((q) => q.isLoading);
  const isError = marketQueries.some((q) => q.isError);
  const error = marketQueries.find((q) => q.error)?.error;
  const isRefetching = marketQueries.some((q) => q.isRefetching);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allData = useMemo(() => {
    const merged: HitRateProfileV2[] = [];
    for (const q of marketQueries) {
      if (q.data?.data) merged.push(...q.data.data);
    }
    return merged;
  }, [marketQueries.map((q) => q.dataUpdatedAt).join(",")]);

  const refetch = useCallback(() => {
    for (const q of marketQueries) void q.refetch();
  }, [marketQueries]);

  const gameOptions = useMemo(() => {
    const byKey = new Map<string, GameFilterOption>();
    for (const row of allData) {
      const key = getGameKey(row);
      if (byKey.has(key)) continue;
      const isHome = row.home_away === "H";
      const status = String(row.game_status ?? "").trim();
      const isTime = /^\d{1,2}:\d{2}\s*(am|pm)\s*et$/i.test(status);
      byKey.set(key, {
        key,
        label: getGameLabel(row),
        started: hasGameStarted(row),
        completed: isCompletedGame(row),
        awayAbbr: isHome ? (row.opponent_team_abbr ?? "OPP") : (row.team_abbr ?? "TM"),
        homeAbbr: isHome ? (row.team_abbr ?? "TM") : (row.opponent_team_abbr ?? "OPP"),
        gameTime: isTime ? status : null,
      });
    }
    return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allData]);

  const rows = useMemo(() => {
    let filtered: HitRateProfileV2[];
    if (selectedGameKeys.length > 0) {
      const set = new Set(selectedGameKeys);
      filtered = allData.filter((r) => set.has(getGameKey(r)));
    } else {
      filtered = allData.filter((r) => !isCompletedGame(r) && !hasGameStarted(r));
    }
    // Client-side matchup filter
    if (matchupFilter.length > 0) {
      filtered = filtered.filter(
        (r) => r.matchup?.matchup_quality && matchupFilter.includes(r.matchup.matchup_quality)
      );
    }
    return filtered;
  }, [allData, selectedGameKeys, matchupFilter]);

  // best_odds comes directly from the hit rates v2 API (Redis lookup, same as desktop)

  function toggleSort(field: HitRateSortField) {
    if (field === sort) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(field);
      setSortDir("desc");
    }
  }

  // Count non-default filters (for badge)
  const marketsNonDefault = !(selectedMarkets.length === 1 && selectedMarkets[0] === DEFAULT_MARKET);
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (marketsNonDefault) count++;
    if (minHitRate !== DEFAULT_MIN_HIT) count++;
    if (selectedGameKeys.length > 0) count++;
    if (hasOddsOnly !== DEFAULT_HAS_ODDS) count++;
    if (matchupFilter.length > 0) count++;
    return count;
  }, [marketsNonDefault, minHitRate, selectedGameKeys, hasOddsOnly, matchupFilter]);

  const isNonDefault = activeFilterCount > 0 || sort !== DEFAULT_SORT || sortDir !== DEFAULT_SORT_DIR;

  function resetFilters() {
    setSelectedMarkets([DEFAULT_MARKET]);
    setHasOddsOnly(DEFAULT_HAS_ODDS);
    setSort(DEFAULT_SORT);
    setSortDir(DEFAULT_SORT_DIR);
    setMinHitRate(DEFAULT_MIN_HIT);
    setSearchText("");
    setSelectedGameKeys([]);
    setMatchupFilter([]);
  }

  function toggleMarket(marketId: string) {
    setSelectedMarkets((curr) => {
      if (curr.includes(marketId)) {
        // Don't allow deselecting the last one
        if (curr.length === 1) return curr;
        return curr.filter((m) => m !== marketId);
      }
      return [...curr, marketId];
    });
  }

  function toggleGameFilter(gameKey: string) {
    setSelectedGameKeys((curr) =>
      curr.includes(gameKey) ? curr.filter((k) => k !== gameKey) : [...curr, gameKey]
    );
  }

  function toggleMatchup(value: string) {
    setMatchupFilter((curr) =>
      curr.includes(value) ? curr.filter((v) => v !== value) : [...curr, value]
    );
  }

  const renderItem = useCallback(
    ({ item }: { item: HitRateProfileV2 }) => {
      const bestBook = item.best_odds?.book ?? "";
      const bestPrice = item.best_odds?.price ?? null;

      return (
        <PlayerCard
          row={item}
          bestBook={bestBook}
          bestPrice={bestPrice}
          sortField={sort}
          onPress={() =>
            router.push({
              pathname: "/props/player/[id]",
              params: { id: String(item.player_id), market: item.market }
            })
          }
        />
      );
    },
    [router, sort]
  );

  const keyExtractor = useCallback((item: HitRateProfileV2) => item.id, []);

  /* ─── Fixed page header ─── */
  const pageHeader = (
    <View style={styles.pageHeader}>
      <Text style={styles.pageTitle}>Props</Text>
      <View style={styles.titleActions}>
        <Pressable
          onPress={() => router.push("/cheat-sheets")}
          style={styles.cheatSheetsBtn}
        >
          <Ionicons name="newspaper-outline" size={14} color={brandColors.primary} />
          <Text style={styles.cheatSheetsBtnText}>Cheat Sheets</Text>
        </Pressable>
        <Pressable
          onPress={() => setAutoRefreshEnabled((c) => !c)}
          style={[styles.autoBtn, autoRefreshEnabled && styles.autoBtnActive]}
        >
          <Ionicons
            name="refresh"
            size={14}
            color={autoRefreshEnabled ? brandColors.primary : brandColors.textMuted}
          />
          <Text style={[styles.autoBtnText, autoRefreshEnabled && styles.autoBtnTextActive]}>
            Auto
          </Text>
        </Pressable>
      </View>
    </View>
  );

  /* ─── Sticky header: sport pills only ─── */
  const stickyFilters = (
    <View style={styles.stickyHeader}>
      {/* Sport selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportScroll}>
        {SPORT_OPTIONS.map((opt) => {
          const active = opt.id === sport;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setSport(opt.id)}
              style={[styles.sportPill, active && styles.sportPillActive]}
            >
              <Ionicons
                name={opt.icon as any}
                size={14}
                color={active ? "#FFFFFF" : opt.enabled ? brandColors.textSecondary : brandColors.textMuted}
              />
              <Text style={[styles.sportPillText, active && styles.sportPillTextActive, !opt.enabled && !active && styles.sportPillTextDisabled]}>
                {opt.label}
              </Text>
              {!opt.enabled ? (
                <View style={styles.soonBadge}>
                  <Text style={styles.soonBadgeText}>SOON</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  /* ─── Search bar (FlatList header) ─── */
  const listHeader = sportEnabled ? (
    <View style={styles.searchBarWrap}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={brandColors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search players"
          placeholderTextColor={brandColors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchText.length > 0 ? (
          <Pressable onPress={() => setSearchText("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={brandColors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  ) : null;

  const listEmpty = !sportEnabled ? (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={activeSport.icon as any} size={44} color={brandColors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{activeSport.emptyTitle}</Text>
      <Text style={styles.emptySubtitle}>{activeSport.emptySubtitle}</Text>
    </View>
  ) : isLoading ? (
    <View style={styles.stateCard}>
      <ActivityIndicator size="small" color={brandColors.primary} />
      <Text style={styles.stateText}>Loading hit rates...</Text>
    </View>
  ) : isError ? (
    <View style={[styles.stateCard, styles.errorCard]}>
      <Text style={styles.errorTitle}>Unable to load</Text>
      <Text style={styles.errorText}>
        {error instanceof Error ? error.message : "Unexpected error"}
      </Text>
    </View>
  ) : (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="filter-outline" size={36} color={brandColors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No players found</Text>
      <Text style={styles.emptySubtitle}>Try adjusting your filters or search to see more results.</Text>
    </View>
  );

  return (
    <PlanGate feature={PLAN_GATE_FEATURES.props} bannerBottomOffset={52}>
    <SafeAreaView style={styles.container}>
      {/* ─── Fixed page header ─── */}
      {pageHeader}

      {/* ─── Sticky header: sport pills + search ─── */}
      {stickyFilters}

      {sportEnabled ? (
        <FlatList
          data={rows}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={styles.listContent}
          onRefresh={() => void refetch()}
          refreshing={isRefetching}
          tintColor={brandColors.primary}
          showsVerticalScrollIndicator={false}
          onScroll={onListScroll}
          scrollEventThrottle={16}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
        />
      ) : (
        <View style={styles.disabledContent}>
          {listEmpty}
        </View>
      )}

      {/* ─── Bottom Bar (hides on scroll down) ─── */}
      {sportEnabled ? (
        <Animated.View style={[styles.bottomBar, { transform: [{ translateY: bottomBarTranslateY }] }]}>
          {/* Filter button */}
          <Pressable onPress={() => setDrawerVisible(true)} style={styles.bottomFilterBtn}>
            <Ionicons name="options-outline" size={18} color={brandColors.textPrimary} />
            <Text style={styles.bottomFilterBtnText}>Filter</Text>
            {activeFilterCount > 0 ? (
              <View style={styles.bottomFilterBadge}>
                <Text style={styles.bottomFilterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>

          {/* Quick sort pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bottomSortScroll}
          >
            {QUICK_SORT_OPTIONS.map((opt) => {
              const active = opt.field === sort;
              return (
                <Pressable
                  key={opt.field}
                  onPress={() => toggleSort(opt.field)}
                  style={[styles.bottomSortPill, active && styles.bottomSortPillActive]}
                >
                  <Text style={[styles.bottomSortPillText, active && styles.bottomSortPillTextActive]}>
                    {opt.label}
                    {active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* ─── Filter Drawer ─── */}
      <FilterDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        selectedMarkets={selectedMarkets}
        toggleMarket={toggleMarket}
        gameOptions={gameOptions}
        selectedGameKeys={selectedGameKeys}
        toggleGameFilter={toggleGameFilter}
        clearGameFilter={() => setSelectedGameKeys([])}
        minHitRate={minHitRate}
        setMinHitRate={setMinHitRate}
        hasOddsOnly={hasOddsOnly}
        setHasOddsOnly={setHasOddsOnly}
        matchupFilter={matchupFilter}
        toggleMatchup={toggleMatchup}
        resultCount={rows.length}
        isNonDefault={isNonDefault}
        onReset={resetFilters}
      />
    </SafeAreaView>
    </PlanGate>
  );
}

/* ─── Filter Drawer Styles ─── */

const ds = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: DRAWER_MAX,
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.border,
  },
  headerTitle: {
    color: brandColors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: brandColors.panelBackgroundAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },

  // Section titles
  sectionTitle: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 10,
  },

  // Market 3x3 grid
  marketGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  marketCell: {
    width: "30.5%",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  marketCellActive: {
    backgroundColor: brandColors.primarySoft,
    borderColor: brandColors.primary,
  },
  marketCellText: {
    color: brandColors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  marketCellTextActive: {
    color: brandColors.primary,
  },

  // Games section
  gamesSectionOuter: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: brandColors.panelBackgroundAlt,
    overflow: "hidden",
  },
  gamesScroll: {
    maxHeight: 240,
  },
  gameChip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  gameChipActive: {
    backgroundColor: brandColors.primarySoft,
  },
  gameChipText: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
  },
  gameChipTextActive: {
    color: brandColors.primary,
    fontWeight: "700",
  },
  gameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  gameRowActive: {
    backgroundColor: brandColors.primarySoft,
  },
  gameLogos: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  gameLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  gameLabel: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
  },
  gameLabelActive: {
    color: brandColors.primary,
    fontWeight: "700",
  },
  gameLabelMuted: {
    color: brandColors.textMuted,
  },
  gameRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gameBadgeFinal: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  gameBadgeLive: {
    color: brandColors.warning,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  gameTime: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },

  // Chips (hit rate, matchup)
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  chipActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft,
  },
  chipText: {
    color: brandColors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextActive: {
    color: brandColors.primary,
    fontWeight: "700",
  },

  // Matchup chips
  matchupChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  matchupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  matchupLabel: {
    color: brandColors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  matchupRank: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "500",
    opacity: 0.6,
  },

  // Toggle
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  toggleLabel: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
  },

  // Apply button
  applyWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: brandColors.border,
  },
  applyRow: {
    flexDirection: "row",
    gap: 10,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brandColors.border,
    height: 50,
    paddingHorizontal: 20,
  },
  resetBtnText: {
    color: brandColors.textSecondary,
    fontSize: 15,
    fontWeight: "700",
  },
  applyBtn: {
    flex: 2,
    borderRadius: 12,
    backgroundColor: brandColors.primary,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: {
    color: "#020617",
    fontSize: 16,
    fontWeight: "800",
  },
});

/* ─── Main Styles ─── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 72
  },

  /* ── sticky header ── */
  stickyHeader: {
    backgroundColor: brandColors.appBackground,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },

  /* ── sport pills ── */
  sportScroll: {
    gap: 6,
    paddingRight: 8,
  },
  sportPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "transparent",
  },
  sportPillActive: {
    backgroundColor: brandColors.primary,
    borderColor: brandColors.primary,
  },
  sportPillText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  sportPillTextActive: {
    color: "#FFFFFF",
  },
  sportPillTextDisabled: {
    color: brandColors.textMuted,
    opacity: 0.7,
  },
  soonBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  soonBadgeText: {
    color: brandColors.textMuted,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  /* ── disabled sport content ── */
  disabledContent: {
    flex: 1,
    paddingHorizontal: 12,
  },

  /* ── empty state ── */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: brandColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    color: brandColors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    color: brandColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  /* ── fixed page header ── */
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: brandColors.appBackground,
  },
  pageTitle: {
    color: brandColors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cheatSheetsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  cheatSheetsBtnText: {
    color: brandColors.primary,
    fontSize: 12,
    fontWeight: "600"
  },
  autoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brandColors.border,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  autoBtnActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  autoBtnText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  autoBtnTextActive: {
    color: brandColors.primary
  },

  /* ── search ── */
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: brandColors.panelBackground,
    borderColor: brandColors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: brandColors.textPrimary,
    fontSize: 15
  },

  /* ── search bar (list header) ── */
  searchBarWrap: {
    paddingBottom: 8,
  },

  /* ── bottom bar ── */
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    height: 56,
  },
  bottomFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
  },
  bottomFilterBtnText: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  bottomFilterBadge: {
    backgroundColor: brandColors.primary,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  bottomFilterBadgeText: {
    color: "#020617",
    fontSize: 10,
    fontWeight: "800",
  },
  bottomSortScroll: {
    gap: 6,
    paddingRight: 8,
  },
  bottomSortPill: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brandColors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: brandColors.panelBackground,
  },
  bottomSortPillActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primary,
  },
  bottomSortPillText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  bottomSortPillTextActive: {
    color: "#020617",
    fontWeight: "700",
  },
  /* ── player card ── */
  card: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
    backgroundColor: brandColors.panelBackground,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    marginBottom: 8,
  },
  cardPressed: {
    opacity: 0.7,
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  cardPlayerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  streakRing: {
    position: "relative",
    borderRadius: 21,
    borderWidth: 2,
    padding: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8
  },
  streakBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    zIndex: 2
  },
  streakBadgeText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "800"
  },
  cardHeadshot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  cardHeadshotStreak: {
    borderWidth: 0
  },
  cardTeamLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0A0F1B"
  },
  cardTeamLogoPlaceholder: {
    borderWidth: 1,
    borderColor: brandColors.border
  },
  cardNameBlock: {
    flex: 1,
    gap: 2
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  cardPlayerName: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1
  },
  cardInlineTeamLogo: {
    width: 14,
    height: 14,
    borderRadius: 7
  },
  cardPosition: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "600"
  },
  cardPropRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  cardPropLine: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "500"
  },
  cardPropOdds: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  edgeBadge: {
    alignItems: "center",
    gap: 1
  },
  edgeLabel: {
    color: brandColors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  edgeValue: {
    fontSize: 16,
    fontWeight: "800"
  },
  oddsBookLogo: {
    width: 14,
    height: 14,
    borderRadius: 3
  },

  /* ── hit rate bar ── */
  hitBarContainer: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden"
  },
  hitBarFill: {
    height: "100%",
    borderRadius: 2
  },

  /* ── stats row ── */
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 10,
    paddingVertical: 6,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    gap: 1
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  statLabel: {
    color: brandColors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  statLabelActive: {
    color: brandColors.primary
  },
  statValue: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "700"
  },
  statValueHighlighted: {
    textDecorationLine: "underline",
    textDecorationColor: brandColors.primary
  },

  /* ── state cards ── */
  stateCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 14,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8
  },
  stateText: {
    color: brandColors.textSecondary,
    fontSize: 14,
    textAlign: "center"
  },
  errorCard: {
    borderColor: "rgba(248, 113, 113, 0.5)",
    backgroundColor: "rgba(127, 29, 29, 0.25)"
  },
  errorTitle: {
    color: "#FCA5A5",
    fontSize: 16,
    fontWeight: "700"
  },
  errorText: {
    color: "#FECACA",
    fontSize: 13,
    textAlign: "center"
  },
});
