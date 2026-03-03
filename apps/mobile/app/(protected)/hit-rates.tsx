import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { HitRateSortField, HitRateProfileV2 } from "@unjuiced/types";
import { useHitRates } from "@/src/hooks/use-hit-rates";
import { useHitRateOdds } from "@/src/hooks/use-hit-rate-odds";
import { getNbaTeamLogoUrl, getSportsbookLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";
import { streakColor } from "@/src/components/player/constants";
import type { HitRateOddsSelection } from "@unjuiced/api";

/* ─── constants ─── */

const MARKET_OPTIONS: Array<{ id: string; label: string; short: string }> = [
  // Core stats
  { id: "player_points", label: "Points", short: "PTS" },
  { id: "player_rebounds", label: "Rebounds", short: "REB" },
  { id: "player_assists", label: "Assists", short: "AST" },
  { id: "player_threes_made", label: "3-Pointers", short: "3PM" },
  { id: "player_steals", label: "Steals", short: "STL" },
  { id: "player_blocks", label: "Blocks", short: "BLK" },
  { id: "player_turnovers", label: "Turnovers", short: "TOV" },
  // Combos
  { id: "player_points_rebounds_assists", label: "PRA", short: "PRA" },
  { id: "player_points_rebounds", label: "P+R", short: "P+R" },
  { id: "player_points_assists", label: "P+A", short: "P+A" },
  { id: "player_rebounds_assists", label: "R+A", short: "R+A" },
  { id: "player_blocks_steals", label: "Blk+Stl", short: "B+S" },
  // Other
  { id: "player_fgm", label: "Field Goals", short: "FGM" },
  { id: "player_double_double", label: "Double Double", short: "DD" },
  { id: "player_triple_double", label: "Triple Double", short: "TD" },
];

const MIN_HIT_OPTIONS = [0, 50, 55, 60, 65, 70];

const SORT_OPTIONS: Array<{ field: HitRateSortField; label: string; short: string }> = [
  { field: "l10Pct", label: "Last 10 Hit %", short: "Last 10" },
  { field: "l5Pct", label: "Last 5 Hit %", short: "Last 5" },
  { field: "seasonPct", label: "Season Hit %", short: "Season" },
  { field: "line", label: "Line", short: "Line" },
  { field: "matchupRank", label: "Matchup Rank (DvP)", short: "DvP" }
];

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

function getStableKey(row: HitRateProfileV2): string | null {
  return row.odds_selection_id || row.sel_key || null;
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
  return Date.now() > scheduled.getTime() + 10 * 60 * 1000;
}

function marketLabel(id: string): string {
  return MARKET_OPTIONS.find((m) => m.id === id)?.label ?? id;
}

/** Returns a color for a hit-rate percentage */
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

function mktShort(market: string): string {
  return market.replace("player_", "").replace(/_/g, " ");
}

type GameFilterOption = { key: string; label: string; started: boolean };

/* ─── Bottom Sheet ─── */

function BottomSheet({
  visible,
  onClose,
  title,
  children
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheetContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.sheetClose}>
              <Ionicons name="close" size={20} color={brandColors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView bounces={false}>{children}</ScrollView>
        </Pressable>
      </Pressable>
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

  // Determine the "primary" hit rate to feature (the sort field value)
  const primaryPct =
    sortField === "l5Pct"
      ? row.last_5_pct
      : sortField === "seasonPct"
        ? row.season_pct
        : row.last_10_pct;

  // Hit rate bar width (clamped 0-100)
  const barPct = typeof primaryPct === "number" && Number.isFinite(primaryPct) ? Math.min(100, Math.max(0, primaryPct)) : 0;
  const barClr = barPct >= 70 ? brandColors.success : barPct >= 55 ? brandColors.primary : barPct >= 40 ? brandColors.warning : brandColors.error;

  // Edge: L10 average stat minus the line (how far above/below the line the player is performing)
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

export default function HitRatesScreen() {
  const router = useRouter();
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);

  // Filter state
  const [market, setMarket] = useState("player_points");
  const [hasOddsOnly, setHasOddsOnly] = useState(true);
  const [sort, setSort] = useState<HitRateSortField>("l10Pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [minHitRate, setMinHitRate] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [selectedGameKeys, setSelectedGameKeys] = useState<string[]>([]);

  // Sheet visibility
  const [activeSheet, setActiveSheet] = useState<"market" | "minHit" | "games" | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useHitRates({
    market,
    minHitRate,
    search: searchText.trim(),
    sort,
    sortDir,
    hasOdds: hasOddsOnly,
    limit: 150,
    autoRefreshEnabled,
    autoRefreshMs: 30_000
  });

  const gameOptions = useMemo(() => {
    const byKey = new Map<string, GameFilterOption>();
    for (const row of data?.data ?? []) {
      if (isCompletedGame(row)) continue;
      const key = getGameKey(row);
      if (byKey.has(key)) continue;
      byKey.set(key, { key, label: getGameLabel(row), started: hasGameStarted(row) });
    }
    return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [data?.data]);

  const rows = useMemo(() => {
    const base = (data?.data ?? []).filter((r) => !isCompletedGame(r));
    if (selectedGameKeys.length > 0) {
      const set = new Set(selectedGameKeys);
      return base.filter((r) => set.has(getGameKey(r)));
    }
    return base.filter((r) => !hasGameStarted(r));
  }, [data?.data, selectedGameKeys]);

  const oddsSelections = useMemo(
    () =>
      rows.reduce<HitRateOddsSelection[]>((acc, row) => {
        const sk = getStableKey(row);
        if (sk) acc.push({ stableKey: sk, line: row.line ?? undefined });
        return acc;
      }, []),
    [rows]
  );

  const { getOdds } = useHitRateOdds({
    selections: oddsSelections,
    enabled: rows.length > 0
  });

  function toggleSort(field: HitRateSortField) {
    if (field === sort) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(field);
      setSortDir("desc");
    }
  }

  function resetFilters() {
    setMarket("player_points");
    setHasOddsOnly(true);
    setSort("l10Pct");
    setSortDir("desc");
    setMinHitRate(0);
    setSearchText("");
    setSelectedGameKeys([]);
  }

  function toggleGameFilter(gameKey: string) {
    setSelectedGameKeys((curr) =>
      curr.includes(gameKey) ? curr.filter((k) => k !== gameKey) : [...curr, gameKey]
    );
  }

  const gamesFilterActive = selectedGameKeys.length > 0;
  const minHitActive = minHitRate > 0;
  const filterCount =
    (minHitActive ? 1 : 0) +
    (gamesFilterActive ? 1 : 0) +
    (!hasOddsOnly ? 1 : 0);

  const renderItem = useCallback(
    ({ item }: { item: HitRateProfileV2 }) => {
      const sk = getStableKey(item);
      const lineOdds = sk ? getOdds(sk) : null;
      const bestBook = lineOdds?.bestOver?.book ?? item.best_odds?.book ?? "";
      const bestPrice = lineOdds?.bestOver?.price ?? item.best_odds?.price ?? null;

      return (
        <PlayerCard
          row={item}
          bestBook={bestBook}
          bestPrice={bestPrice}
          sortField={sort}
          onPress={() =>
            router.push({
              pathname: "/player/[id]",
              params: { id: String(item.player_id), market: item.market }
            })
          }
        />
      );
    },
    [getOdds, router, sort]
  );

  const keyExtractor = useCallback((item: HitRateProfileV2) => item.id, []);

  /* ─── List Header: title, search, filter pills ─── */
  const listHeader = (
    <View style={styles.listHeader}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>Hit Rates</Text>
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

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={brandColors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search"
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

      {/* Market quick-tap pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.marketScroll}>
        {MARKET_OPTIONS.map((opt) => {
          const active = opt.id === market;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setMarket(opt.id)}
              style={[styles.marketPill, active && styles.marketPillActive]}
            >
              <Text style={[styles.marketPillText, active && styles.marketPillTextActive]}>{opt.short}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Filter pills row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        <Pressable
          onPress={() => setActiveSheet("games")}
          style={[styles.filterPill, gamesFilterActive && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, gamesFilterActive && styles.filterPillTextActive]}>
            {gamesFilterActive ? `${selectedGameKeys.length} Games` : "All Games"}
          </Text>
          <Ionicons name="chevron-down" size={12} color={gamesFilterActive ? brandColors.primary : brandColors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => setActiveSheet("minHit")}
          style={[styles.filterPill, minHitActive && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, minHitActive && styles.filterPillTextActive]}>
            {minHitActive ? `Min ${minHitRate}%` : "Min %"}
          </Text>
          <Ionicons name="chevron-down" size={12} color={minHitActive ? brandColors.primary : brandColors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => setHasOddsOnly((c) => !c)}
          style={[styles.filterPill, hasOddsOnly && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, hasOddsOnly && styles.filterPillTextActive]}>
            Odds Only
          </Text>
        </Pressable>

        {filterCount > 0 ? (
          <Pressable onPress={resetFilters} style={styles.resetPill}>
            <Ionicons name="close" size={12} color={brandColors.error} />
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{rows.length} players</Text>
        {isRefetching ? <ActivityIndicator size="small" color={brandColors.primary} /> : null}
      </View>
    </View>
  );

  const listEmpty = isLoading ? (
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
    <View style={styles.stateCard}>
      <Text style={styles.stateText}>No players match your filters.</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
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
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
      />

      {/* ─── Sticky Sort Bar (bottom, above tab bar) ─── */}
      <View style={styles.sortBar}>
        <Pressable
          onPress={() => setActiveSheet("market")}
          style={styles.sortBarFilter}
        >
          <Ionicons name="options-outline" size={16} color={brandColors.textPrimary} />
          {filterCount > 0 ? (
            <View style={styles.sortBarBadge}>
              <Text style={styles.sortBarBadgeText}>{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortBarScroll}>
          {SORT_OPTIONS.map((opt) => {
            const active = opt.field === sort;
            return (
              <Pressable
                key={opt.field}
                onPress={() => toggleSort(opt.field)}
                style={[styles.sortPill, active && styles.sortPillActive]}
              >
                <Text style={[styles.sortPillText, active && styles.sortPillTextActive]}>
                  {opt.short}
                  {active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── Market Sheet ─── */}
      <BottomSheet visible={activeSheet === "market"} onClose={() => setActiveSheet(null)} title="Market">
        <View style={styles.sheetOptions}>
          {MARKET_OPTIONS.map((opt) => {
            const active = opt.id === market;
            return (
              <Pressable
                key={opt.id}
                onPress={() => { setMarket(opt.id); setActiveSheet(null); }}
                style={[styles.sheetOption, active && styles.sheetOptionActive]}
              >
                <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>
                  {opt.label}
                </Text>
                {active ? <Ionicons name="checkmark" size={20} color={brandColors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* ─── Min Hit Rate Sheet ─── */}
      <BottomSheet visible={activeSheet === "minHit"} onClose={() => setActiveSheet(null)} title="Minimum L10 Hit %">
        <View style={styles.sheetOptions}>
          {MIN_HIT_OPTIONS.map((val) => {
            const active = minHitRate === val;
            return (
              <Pressable
                key={`min-${val}`}
                onPress={() => { setMinHitRate(val); setActiveSheet(null); }}
                style={[styles.sheetOption, active && styles.sheetOptionActive]}
              >
                <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>
                  {val === 0 ? "No minimum" : `${val}%+`}
                </Text>
                {active ? <Ionicons name="checkmark" size={20} color={brandColors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* ─── Games Sheet ─── */}
      <BottomSheet visible={activeSheet === "games"} onClose={() => setActiveSheet(null)} title="Filter by Game">
        <View style={styles.sheetOptions}>
          <Pressable
            onPress={() => { setSelectedGameKeys([]); setActiveSheet(null); }}
            style={[styles.sheetOption, selectedGameKeys.length === 0 && styles.sheetOptionActive]}
          >
            <Text style={[styles.sheetOptionText, selectedGameKeys.length === 0 && styles.sheetOptionTextActive]}>
              All upcoming games
            </Text>
            {selectedGameKeys.length === 0 ? <Ionicons name="checkmark" size={20} color={brandColors.primary} /> : null}
          </Pressable>
          {gameOptions.map((game) => {
            const active = selectedGameKeys.includes(game.key);
            return (
              <Pressable
                key={game.key}
                onPress={() => toggleGameFilter(game.key)}
                style={[styles.sheetOption, active && styles.sheetOptionActive]}
              >
                <View style={styles.sheetGameRow}>
                  <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive, game.started && !active && styles.sheetOptionMuted]}>
                    {game.label}
                  </Text>
                  {game.started ? <Text style={styles.sheetStartedBadge}>LIVE</Text> : null}
                </View>
                {active ? <Ionicons name="checkmark" size={20} color={brandColors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 60 // space for sticky sort bar
  },

  /* ── header ── */
  listHeader: {
    gap: 10,
    paddingTop: 6,
    paddingBottom: 4
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  pageTitle: {
    color: brandColors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5
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
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: brandColors.textPrimary,
    fontSize: 15
  },

  /* ── market pills ── */
  marketScroll: {
    gap: 6,
    paddingRight: 8
  },
  marketPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  marketPillActive: {
    backgroundColor: brandColors.success,
    borderColor: brandColors.success
  },
  marketPillText: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 13,
    fontWeight: "600"
  },
  marketPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },

  /* ── filter pills ── */
  filterScroll: {
    gap: 6,
    paddingRight: 8
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  filterPillActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  filterPillText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "600"
  },
  filterPillTextActive: {
    color: brandColors.primary
  },
  resetPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
    alignItems: "center",
    justifyContent: "center"
  },

  /* ── count ── */
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2
  },
  countText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },

  /* ── player card ── */
  card: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    gap: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.06)"
  },
  cardPressed: {
    opacity: 0.7
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
  cardTeamAbbr: {
    color: brandColors.textMuted,
    fontWeight: "500"
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
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden"
  },
  hitBarFill: {
    height: "100%",
    borderRadius: 1.5
  },

  /* ── stats row ── */
  statsRow: {
    flexDirection: "row",
    alignItems: "center"
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

  /* ── sticky sort bar ── */
  sortBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: brandColors.navBackground,
    borderTopWidth: 0.5,
    borderTopColor: brandColors.navBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10
  },
  sortBarFilter: {
    flexDirection: "row",
    alignItems: "center",
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: brandColors.border,
    justifyContent: "center"
  },
  sortBarBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: brandColors.primary,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  sortBarBadgeText: {
    color: "#000",
    fontSize: 10,
    fontWeight: "800"
  },
  sortBarScroll: {
    gap: 6,
    paddingRight: 8
  },
  sortPill: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brandColors.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "transparent"
  },
  sortPillActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  sortPillText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "600"
  },
  sortPillTextActive: {
    color: brandColors.primary,
    fontWeight: "700"
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

  /* ── bottom sheet ── */
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end"
  },
  sheetContent: {
    backgroundColor: brandColors.panelBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: "70%"
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: brandColors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.border
  },
  sheetTitle: {
    color: brandColors.textPrimary,
    fontSize: 17,
    fontWeight: "700"
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: brandColors.panelBackgroundAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  sheetOptions: {
    paddingHorizontal: 16,
    paddingTop: 8
  },
  sheetOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2
  },
  sheetOptionActive: {
    backgroundColor: brandColors.primarySoft
  },
  sheetOptionText: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "500"
  },
  sheetOptionTextActive: {
    color: brandColors.primary,
    fontWeight: "700"
  },
  sheetOptionMuted: {
    color: brandColors.textMuted
  },
  sheetGameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sheetStartedBadge: {
    color: brandColors.warning,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5
  }
});
