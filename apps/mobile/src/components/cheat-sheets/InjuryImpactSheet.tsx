import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useInjuryImpact } from "@/src/hooks/use-injury-impact-sheet";
import { useEntitlements } from "@/src/hooks/use-entitlements";
import { getNbaTeamLogoUrl, getSportsbookLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";
import type { InjuryImpactRow } from "@unjuiced/api";

const MARKETS = [
  { value: "player_points", label: "PTS" },
  { value: "player_rebounds", label: "REB" },
  { value: "player_assists", label: "AST" },
  { value: "player_threes_made", label: "3PM" },
  { value: "player_points_rebounds_assists", label: "PRA" },
  { value: "player_points_rebounds", label: "P+R" },
  { value: "player_points_assists", label: "P+A" },
  { value: "player_rebounds_assists", label: "R+A" },
  { value: "player_steals", label: "STL" },
  { value: "player_blocks", label: "BLK" },
  { value: "player_blocks_steals", label: "B+S" }
];

const DATE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "all", label: "All" }
];

const SORT_OPTIONS = [
  { value: "hitRate", label: "Hit %" },
  { value: "boost", label: "Boost" },
  { value: "grade", label: "Grade" },
  { value: "odds", label: "Odds" }
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

const MARKET_SHORT: Record<string, string> = {
  player_points: "PTS",
  player_rebounds: "REB",
  player_assists: "AST",
  player_points_rebounds_assists: "PRA",
  player_points_rebounds: "P+R",
  player_points_assists: "P+A",
  player_rebounds_assists: "R+A",
  player_threes_made: "3PM",
  player_steals: "STL",
  player_blocks: "BLK",
  player_blocks_steals: "B+S"
};

function hitColor(rate: number | null): string {
  if (rate === null) return brandColors.textMuted;
  if (rate >= 0.85) return "#10B981";
  if (rate >= 0.75) return "#22C55E";
  if (rate >= 0.65) return brandColors.warning;
  return brandColors.error;
}

function gradeColor(grade: string): { bg: string; text: string } {
  switch (grade) {
    case "A": return { bg: "rgba(34, 197, 94, 0.15)", text: "#22C55E" };
    case "B": return { bg: "rgba(59, 130, 246, 0.15)", text: "#3B82F6" };
    case "C": return { bg: "rgba(234, 179, 8, 0.15)", text: "#EAB308" };
    default: return { bg: "rgba(107, 114, 128, 0.15)", text: "#6B7280" };
  }
}

function injuryStatusStyle(status: string): { bg: string; text: string } {
  const s = status?.toLowerCase() ?? "";
  if (s === "out") return { bg: "rgba(239, 68, 68, 0.15)", text: "#EF4444" };
  if (s === "questionable") return { bg: "rgba(234, 179, 8, 0.15)", text: "#EAB308" };
  if (s === "doubtful") return { bg: "rgba(249, 115, 22, 0.15)", text: "#F97316" };
  return { bg: "rgba(107, 114, 128, 0.15)", text: "#6B7280" };
}

function formatOdds(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return value > 0 ? `+${value}` : String(value);
}

const Card = ({ row, onPress }: { row: InjuryImpactRow; onPress: () => void }) => {
  const teamLogo = getNbaTeamLogoUrl(row.teamAbbr);
  const bookLogo = row.bestOdds?.book ? getSportsbookLogoUrl(row.bestOdds.book) : null;
  const gc = gradeColor(row.opportunityGrade);
  const is = injuryStatusStyle(row.defaultTeammateInjuryStatus);
  const hitPct = row.hitRate !== null ? Math.round(row.hitRate * 100) : null;
  const homeAway = row.homeAway?.toLowerCase() === "home" ? "vs" : "@";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {/* Player info */}
      <View style={styles.cardTop}>
        <View style={styles.cardPlayerInfo}>
          {teamLogo ? (
            <Image source={{ uri: teamLogo }} style={styles.teamLogo} />
          ) : (
            <View style={[styles.teamLogo, { borderWidth: 1, borderColor: brandColors.border }]} />
          )}
          <View style={styles.cardNameBlock}>
            <Text style={styles.playerName} numberOfLines={1}>{row.playerName}</Text>
            <Text style={styles.subInfo}>{row.teamAbbr} {homeAway} {row.opponentAbbr}</Text>
          </View>
        </View>
        <View style={[styles.gradeBadge, { backgroundColor: gc.bg }]}>
          <Text style={[styles.gradeText, { color: gc.text }]}>{row.opportunityGrade}</Text>
        </View>
      </View>

      {/* Market + injured teammate */}
      <View style={styles.marketRow}>
        <View style={styles.marketBadge}>
          <Text style={styles.marketLabel}>{MARKET_SHORT[row.market] ?? row.market}</Text>
          <Text style={styles.marketLine}>{row.line}+</Text>
        </View>
        <View style={styles.injuredInfo}>
          <Ionicons name="medical" size={10} color={is.text} />
          <Text style={styles.injuredName} numberOfLines={1}>{row.defaultTeammateName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: is.bg }]}>
            <Text style={[styles.statusText, { color: is.text }]}>
              {row.defaultTeammateInjuryStatus?.toUpperCase() ?? "OUT"}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>HIT %</Text>
          <Text style={[styles.statValue, { color: hitColor(row.hitRate) }]}>
            {hitPct !== null ? `${hitPct}%` : "—"}
          </Text>
          <Text style={styles.statSub}>{row.hits}/{row.gamesWithTeammateOut}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>BOOST</Text>
          <Text style={[styles.statValue, { color: row.statBoost > 0 ? "#22C55E" : row.statBoost < 0 ? brandColors.error : brandColors.textMuted }]}>
            {row.statBoost > 0 ? "+" : ""}{row.statBoost.toFixed(1)}
          </Text>
          <Text style={styles.statSub}>{row.avgStatWhenOut.toFixed(1)} avg</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>MIN +</Text>
          <Text style={[styles.statValue, { color: row.minutesBoost > 0 ? "#22C55E" : brandColors.textMuted }]}>
            {row.minutesBoost > 0 ? "+" : ""}{row.minutesBoost.toFixed(1)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>ODDS</Text>
          {row.bestOdds ? (
            <View style={styles.inlineOdds}>
              <Text style={styles.oddsValue}>{formatOdds(row.bestOdds.price)}</Text>
              {bookLogo && <Image source={{ uri: bookLogo }} style={styles.bookLogo} />}
            </View>
          ) : (
            <Text style={styles.statValue}>—</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};

export default function InjuryImpactSheet() {
  const router = useRouter();
  const { data: entitlements } = useEntitlements();
  const isFree = !entitlements || entitlements.plan === "free";

  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(["player_points"]);
  const [dateFilter, setDateFilter] = useState("today");
  const [sortBy, setSortBy] = useState<SortKey>("hitRate");

  const dates = dateFilter === "all" ? undefined : [dateFilter];

  const { data, isLoading, isRefetching, refetch } = useInjuryImpact({
    markets: isFree ? ["player_points"] : selectedMarkets,
    dates
  });

  const rows = useMemo(() => {
    const src = data?.rows ?? [];
    const sorted = [...src];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "hitRate": return (b.hitRate ?? 0) - (a.hitRate ?? 0);
        case "boost": return (b.statBoost ?? 0) - (a.statBoost ?? 0);
        case "grade": {
          const order: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
          return (order[a.opportunityGrade] ?? 4) - (order[b.opportunityGrade] ?? 4);
        }
        case "odds": return (b.bestOdds?.price ?? -9999) - (a.bestOdds?.price ?? -9999);
        default: return 0;
      }
    });
    if (isFree) return sorted.slice(0, 7);
    return sorted;
  }, [data?.rows, sortBy, isFree]);

  const toggleMarket = (value: string) => {
    if (isFree) return;
    setSelectedMarkets([value]);
  };

  const renderItem = useCallback(
    ({ item }: { item: InjuryImpactRow }) => (
      <Card
        row={item}
        onPress={() =>
          router.push({ pathname: "/player/[id]", params: { id: String(item.playerId), market: item.market } })
        }
      />
    ),
    [router]
  );

  const keyExtractor = useCallback(
    (item: InjuryImpactRow, idx: number) => `${item.playerId}-${item.market}-${item.line}-${idx}`,
    []
  );

  const listHeader = (
    <View style={styles.listHeader}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
        {MARKETS.map((m) => {
          const active = selectedMarkets.includes(m.value);
          return (
            <Pressable
              key={m.value}
              onPress={() => toggleMarket(m.value)}
              style={[styles.pill, active && styles.pillActive, isFree && m.value !== "player_points" && styles.pillDisabled]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.controlRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
          {DATE_OPTIONS.map((d) => {
            const active = dateFilter === d.value;
            return (
              <Pressable key={d.value} onPress={() => !isFree && setDateFilter(d.value)} style={[styles.pill, active && styles.pillActive]}>
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
          {SORT_OPTIONS.map((s) => {
            const active = sortBy === s.value;
            return (
              <Pressable key={s.value} onPress={() => setSortBy(s.value)} style={[styles.pill, active && styles.pillActive]}>
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={styles.countRow}>
        <Text style={styles.countText}>{rows.length} opportunities</Text>
        {isRefetching && <ActivityIndicator size="small" color={brandColors.primary} />}
      </View>
    </View>
  );

  const listFooter = isFree ? (
    <View style={styles.upgradeCta}>
      <Ionicons name="lock-closed" size={20} color={brandColors.primary} />
      <Text style={styles.upgradeTitle}>Unlock Full Injury Impact</Text>
      <Text style={styles.upgradeBody}>Access all markets and unlimited injury opportunities</Text>
    </View>
  ) : null;

  const listEmpty = isLoading ? (
    <View style={styles.stateCard}>
      <ActivityIndicator size="small" color={brandColors.primary} />
      <Text style={styles.stateText}>Loading injury impact...</Text>
    </View>
  ) : (
    <View style={styles.stateCard}>
      <Text style={styles.stateText}>No injury impact opportunities found.</Text>
    </View>
  );

  return (
    <FlatList
      data={rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      ListEmptyComponent={listEmpty}
      contentContainerStyle={styles.listContent}
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
      progressViewOffset={0}
      showsVerticalScrollIndicator={false}
      initialNumToRender={10}
      maxToRenderPerBatch={8}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 12, paddingBottom: 24 },
  listHeader: { gap: 8, paddingTop: 4, paddingBottom: 4 },
  pillScroll: { gap: 6, paddingRight: 8 },
  controlRow: { flexDirection: "row", gap: 12 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, borderWidth: 1,
    borderColor: brandColors.border, backgroundColor: brandColors.panelBackground, paddingHorizontal: 12, paddingVertical: 7
  },
  pillActive: { borderColor: brandColors.primary, backgroundColor: brandColors.primarySoft },
  pillDisabled: { opacity: 0.4 },
  pillText: { color: brandColors.textSecondary, fontSize: 12, fontWeight: "600" },
  pillTextActive: { color: brandColors.primary },
  countRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 2 },
  countText: { color: brandColors.textMuted, fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: brandColors.panelBackground, borderColor: brandColors.border, borderWidth: 1,
    borderRadius: 14, padding: 12, marginBottom: 8, gap: 8
  },
  cardPressed: { opacity: 0.85 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardPlayerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  teamLogo: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#0A0F1B" },
  cardNameBlock: { flex: 1, gap: 1 },
  playerName: { color: brandColors.textPrimary, fontSize: 14, fontWeight: "700" },
  subInfo: { color: brandColors.textMuted, fontSize: 11 },
  gradeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  gradeText: { fontSize: 13, fontWeight: "800" },
  marketRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  marketBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6,
    backgroundColor: brandColors.primarySoft, paddingHorizontal: 8, paddingVertical: 3
  },
  marketLabel: { color: brandColors.primary, fontSize: 11, fontWeight: "700" },
  marketLine: { color: brandColors.textPrimary, fontSize: 12, fontWeight: "700" },
  injuredInfo: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  injuredName: { color: brandColors.textSecondary, fontSize: 11, fontWeight: "600", flexShrink: 1 },
  statusBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  statusText: { fontSize: 9, fontWeight: "700" },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statCol: { flex: 1, alignItems: "center", gap: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: brandColors.border },
  statLabel: { color: brandColors.textMuted, fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  statValue: { color: brandColors.textPrimary, fontSize: 13, fontWeight: "700" },
  statSub: { color: brandColors.textMuted, fontSize: 9 },
  inlineOdds: { flexDirection: "row", alignItems: "center", gap: 3 },
  oddsValue: { color: brandColors.textPrimary, fontSize: 12, fontWeight: "800" },
  bookLogo: { width: 12, height: 12, borderRadius: 2 },
  upgradeCta: {
    alignItems: "center", gap: 6, paddingVertical: 24, paddingHorizontal: 16,
    borderRadius: 14, borderWidth: 1, borderColor: brandColors.primarySoft,
    backgroundColor: brandColors.panelBackground, marginTop: 8
  },
  upgradeTitle: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "700" },
  upgradeBody: { color: brandColors.textSecondary, fontSize: 13, textAlign: "center" },
  stateCard: {
    borderRadius: 14, borderWidth: 1, borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt, paddingHorizontal: 14, paddingVertical: 24,
    alignItems: "center", gap: 8, marginTop: 8
  },
  stateText: { color: brandColors.textSecondary, fontSize: 14, textAlign: "center" }
});
