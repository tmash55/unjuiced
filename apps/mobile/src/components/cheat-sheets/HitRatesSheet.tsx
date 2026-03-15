import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCheatSheet } from "@/src/hooks/use-cheat-sheet";
import { useEntitlements } from "@/src/hooks/use-entitlements";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import TeamLogo from "@/src/components/TeamLogo";
import { brandColors } from "@/src/theme/brand";
import type { CheatSheetRow } from "@unjuiced/api";

const MARKETS = [
  { value: "player_points", label: "PTS" },
  { value: "player_rebounds", label: "REB" },
  { value: "player_assists", label: "AST" },
  { value: "player_points_rebounds_assists", label: "PRA" },
  { value: "player_threes_made", label: "3PM" },
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
  { value: "grade", label: "Grade" },
  { value: "hitRate", label: "Hit %" },
  { value: "edge", label: "Edge" },
  { value: "dvp", label: "DvP" },
  { value: "odds", label: "Odds" }
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["value"];

function formatPct(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatPctRaw(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

function formatOdds(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return value > 0 ? `+${value}` : String(value);
}

function hitColor(pct: number | null | undefined): string {
  if (typeof pct !== "number") return brandColors.textMuted;
  if (pct >= 0.8) return "#22C55E";
  if (pct >= 0.7) return "#4ADE80";
  if (pct >= 0.6) return brandColors.warning;
  return brandColors.error;
}

function gradeColor(grade: string): { bg: string; text: string } {
  switch (grade) {
    case "A+": return { bg: "rgba(16, 185, 129, 0.15)", text: "#10B981" };
    case "A": return { bg: "rgba(34, 197, 94, 0.15)", text: "#22C55E" };
    case "B+": return { bg: "rgba(234, 179, 8, 0.15)", text: "#EAB308" };
    case "B": return { bg: "rgba(249, 115, 22, 0.15)", text: "#F97316" };
    default: return { bg: "rgba(107, 114, 128, 0.15)", text: "#6B7280" };
  }
}

function matchupBadge(quality: string): { bg: string; text: string; label: string } {
  switch (quality) {
    case "favorable": return { bg: "rgba(34, 197, 94, 0.15)", text: "#22C55E", label: "Easy" };
    case "unfavorable": return { bg: "rgba(239, 68, 68, 0.15)", text: "#EF4444", label: "Tough" };
    default: return { bg: "rgba(107, 114, 128, 0.1)", text: "#6B7280", label: "Avg" };
  }
}

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
  player_blocks_steals: "B+S",
  player_turnovers: "TO"
};

const Card = ({ row, onPress }: { row: CheatSheetRow; onPress: () => void }) => {
  const bookLogo = row.bestOdds?.book ? getSportsbookLogoUrl(row.bestOdds.book) : null;
  const gc = gradeColor(row.confidenceGrade);
  const mb = matchupBadge(row.matchupQuality);
  const homeAway = row.homeAway === "H" ? "vs" : "@";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {/* Top row: player + grade */}
      <View style={styles.cardTop}>
        <View style={styles.cardPlayerInfo}>
          <TeamLogo teamAbbr={row.teamAbbr} sport="nba" size={32} style={{ borderRadius: 16 }} />
          <View style={styles.cardNameBlock}>
            <Text style={styles.playerName} numberOfLines={1}>
              {row.playerName}
            </Text>
            <Text style={styles.subInfo}>
              {row.teamAbbr} {homeAway} {row.opponentAbbr}
            </Text>
          </View>
        </View>
        <View style={[styles.gradeBadge, { backgroundColor: gc.bg }]}>
          <Text style={[styles.gradeText, { color: gc.text }]}>{row.confidenceGrade}</Text>
        </View>
      </View>

      {/* Market + line */}
      <View style={styles.marketRow}>
        <View style={styles.marketBadge}>
          <Text style={styles.marketLabel}>{MARKET_SHORT[row.market] ?? row.market}</Text>
          <Text style={styles.marketLine}>{row.line}+</Text>
        </View>
        {row.dvpRank != null && (
          <View style={[styles.matchupBadge, { backgroundColor: mb.bg }]}>
            <Text style={[styles.matchupText, { color: mb.text }]}>
              DvP #{row.dvpRank} {mb.label}
            </Text>
          </View>
        )}
        {row.edge != null && row.edge !== 0 && (
          <Text style={[styles.edgeText, { color: row.edge > 0 ? "#22C55E" : brandColors.error }]}>
            {row.edge > 0 ? "+" : ""}{row.edge.toFixed(1)} edge
          </Text>
        )}
      </View>

      {/* Hit rates row */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>L5</Text>
          <Text style={[styles.statValue, { color: hitColor(row.last5Pct) }]}>
            {formatPctRaw(row.last5Pct)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>L10</Text>
          <Text style={[styles.statValue, { color: hitColor(row.last10Pct) }]}>
            {formatPctRaw(row.last10Pct)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>L20</Text>
          <Text style={[styles.statValue, { color: hitColor(row.last20Pct) }]}>
            {formatPctRaw(row.last20Pct)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>SZN</Text>
          <Text style={[styles.statValue, { color: hitColor(row.seasonPct) }]}>
            {formatPctRaw(row.seasonPct)}
          </Text>
        </View>
      </View>

      {/* Bottom: odds + indicators */}
      <View style={styles.cardBottom}>
        {row.bestOdds ? (
          <View style={styles.oddsBadge}>
            <Text style={styles.oddsText}>{formatOdds(row.bestOdds.price)}</Text>
            {bookLogo && <Image source={{ uri: bookLogo }} style={styles.bookLogo} />}
          </View>
        ) : (
          <View />
        )}
        <View style={styles.indicators}>
          {row.isBackToBack && (
            <View style={styles.b2bBadge}>
              <Text style={styles.b2bText}>B2B</Text>
            </View>
          )}
          {row.injuryStatus && (
            <View style={styles.injuryBadge}>
              <Text style={styles.injuryText}>{row.injuryStatus}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

export default function HitRatesSheet() {
  const router = useRouter();
  const { data: entitlements } = useEntitlements();
  const isFree = !entitlements || entitlements.plan === "free";

  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(["player_points"]);
  const [dateFilter, setDateFilter] = useState("today");
  const [sortBy, setSortBy] = useState<SortKey>("grade");

  const dates = dateFilter === "all" ? undefined : [dateFilter];

  const { data, isLoading, isRefetching, refetch } = useCheatSheet({
    markets: isFree ? ["player_points"] : selectedMarkets,
    dates
  });

  const rows = useMemo(() => {
    const src = data?.rows ?? [];
    const sorted = [...src];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "grade": {
          const order: Record<string, number> = { "A+": 0, A: 1, "B+": 2, B: 3, C: 4 };
          return (order[a.confidenceGrade] ?? 5) - (order[b.confidenceGrade] ?? 5);
        }
        case "hitRate":
          return (b.hitRate ?? 0) - (a.hitRate ?? 0);
        case "edge":
          return (b.edge ?? 0) - (a.edge ?? 0);
        case "dvp":
          return (a.dvpRank ?? 99) - (b.dvpRank ?? 99);
        case "odds":
          return (b.bestOdds?.price ?? -9999) - (a.bestOdds?.price ?? -9999);
        default:
          return 0;
      }
    });
    if (isFree) return sorted.slice(0, 7);
    return sorted;
  }, [data?.rows, sortBy, isFree]);

  const toggleMarket = (value: string) => {
    if (isFree) return;
    setSelectedMarkets((prev) =>
      prev.includes(value) ? (prev.length > 1 ? prev.filter((m) => m !== value) : prev) : [value]
    );
  };

  const renderItem = useCallback(
    ({ item }: { item: CheatSheetRow }) => (
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
    (item: CheatSheetRow, idx: number) => `${item.playerId}-${item.market}-${item.line}-${idx}`,
    []
  );

  const listHeader = (
    <View style={styles.listHeader}>
      {/* Market pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
        {MARKETS.map((m) => {
          const active = selectedMarkets.includes(m.value);
          return (
            <Pressable
              key={m.value}
              onPress={() => toggleMarket(m.value)}
              style={[styles.pill, active && styles.pillActive, isFree && m.value !== "player_points" && styles.pillDisabled]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {m.label}
              </Text>
              {isFree && m.value !== "player_points" && (
                <Ionicons name="lock-closed" size={10} color={brandColors.textMuted} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Date + Sort row */}
      <View style={styles.controlRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
          {DATE_OPTIONS.map((d) => {
            const active = dateFilter === d.value;
            return (
              <Pressable
                key={d.value}
                onPress={() => !isFree && setDateFilter(d.value)}
                style={[styles.pill, active && styles.pillActive, isFree && d.value !== "today" && styles.pillDisabled]}
              >
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
        <Text style={styles.countText}>{rows.length} props</Text>
        {isRefetching && <ActivityIndicator size="small" color={brandColors.primary} />}
      </View>
    </View>
  );

  const listFooter = isFree ? (
    <View style={styles.upgradeCta}>
      <Ionicons name="lock-closed" size={20} color={brandColors.primary} />
      <Text style={styles.upgradeTitle}>Unlock Full Cheat Sheet</Text>
      <Text style={styles.upgradeBody}>Access all markets, filters, and unlimited props</Text>
    </View>
  ) : null;

  const listEmpty = isLoading ? (
    <View style={styles.stateCard}>
      <ActivityIndicator size="small" color={brandColors.primary} />
      <Text style={styles.stateText}>Loading cheat sheet...</Text>
    </View>
  ) : (
    <View style={styles.stateCard}>
      <Text style={styles.stateText}>No data available for these filters.</Text>
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
  pillActive: { borderColor: brandColors.primary, backgroundColor: brandColors.primarySoft },
  pillDisabled: { opacity: 0.4 },
  pillText: { color: brandColors.textSecondary, fontSize: 12, fontWeight: "600" },
  pillTextActive: { color: brandColors.primary },
  countRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 2 },
  countText: { color: brandColors.textMuted, fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: brandColors.panelBackground,
    borderColor: brandColors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 8
  },
  cardPressed: { opacity: 0.85 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardPlayerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  teamLogo: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#0A0F1B" },
  cardNameBlock: { flex: 1, gap: 1 },
  playerName: { color: brandColors.textPrimary, fontSize: 14, fontWeight: "700" },
  subInfo: { color: brandColors.textMuted, fontSize: 11 },
  gradeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignItems: "center" },
  gradeText: { fontSize: 13, fontWeight: "800" },
  marketRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  marketBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    backgroundColor: brandColors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  marketLabel: { color: brandColors.primary, fontSize: 11, fontWeight: "700" },
  marketLine: { color: brandColors.textPrimary, fontSize: 12, fontWeight: "700" },
  matchupBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  matchupText: { fontSize: 10, fontWeight: "600" },
  edgeText: { fontSize: 11, fontWeight: "700" },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statCol: { flex: 1, alignItems: "center", gap: 1 },
  statDivider: { width: 1, height: 22, backgroundColor: brandColors.border },
  statLabel: { color: brandColors.textMuted, fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  statValue: { fontSize: 13, fontWeight: "700" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  oddsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: brandColors.panelBackgroundAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brandColors.border,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  oddsText: { color: brandColors.textPrimary, fontSize: 13, fontWeight: "800" },
  bookLogo: { width: 14, height: 14, borderRadius: 3 },
  indicators: { flexDirection: "row", gap: 4 },
  b2bBadge: {
    borderRadius: 4,
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  b2bText: { color: brandColors.warning, fontSize: 9, fontWeight: "700" },
  injuryBadge: {
    borderRadius: 4,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  injuryText: { color: brandColors.error, fontSize: 9, fontWeight: "700" },
  upgradeCta: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brandColors.primarySoft,
    backgroundColor: brandColors.panelBackground,
    marginTop: 8
  },
  upgradeTitle: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "700" },
  upgradeBody: { color: brandColors.textSecondary, fontSize: 13, textAlign: "center" },
  stateCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 14,
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
    marginTop: 8
  },
  stateText: { color: brandColors.textSecondary, fontSize: 14, textAlign: "center" }
});
