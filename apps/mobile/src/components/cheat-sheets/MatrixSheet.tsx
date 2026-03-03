import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useHitRateMatrix } from "@/src/hooks/use-hit-rate-matrix";
import { brandColors } from "@/src/theme/brand";
import type { HitRateMatrixRow, ThresholdData } from "@unjuiced/api";

const MARKETS = [
  { value: "player_points", label: "PTS" },
  { value: "player_rebounds", label: "REB" },
  { value: "player_assists", label: "AST" },
  { value: "player_points_rebounds_assists", label: "PRA" },
  { value: "player_threes_made", label: "3PM" },
  { value: "player_steals", label: "STL" },
  { value: "player_blocks", label: "BLK" }
];

const TIME_WINDOWS = [
  { value: "last_5", label: "L5" },
  { value: "last_10", label: "L10" },
  { value: "last_20", label: "L20" },
  { value: "season", label: "SZN" }
];

const DATE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" }
];

function hitRateBg(hitRate: number | null): string {
  if (hitRate === null) return "rgba(107,114,128,0.2)";
  if (hitRate >= 80) return "rgba(16, 185, 129, 0.6)";
  if (hitRate >= 70) return "rgba(16, 185, 129, 0.4)";
  if (hitRate >= 60) return "rgba(16, 185, 129, 0.2)";
  if (hitRate >= 50) return "rgba(107,114,128,0.2)";
  if (hitRate >= 40) return "rgba(239, 68, 68, 0.2)";
  return "rgba(239, 68, 68, 0.35)";
}

function hitRateColor(hitRate: number | null): string {
  if (hitRate === null) return brandColors.textMuted;
  if (hitRate >= 70) return "#10B981";
  if (hitRate >= 50) return brandColors.textPrimary;
  return "#EF4444";
}

function formatOdds(odds: number | null): string {
  if (odds === null) return "";
  return odds > 0 ? `+${odds}` : String(odds);
}

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MatrixSheet() {
  const router = useRouter();
  const [market, setMarket] = useState("player_points");
  const [timeWindow, setTimeWindow] = useState("last_10");
  const [dateFilter, setDateFilter] = useState("today");

  const gameDate = dateFilter === "today" ? getTodayDate() : getTomorrowDate();

  const { data, isLoading, isRefetching, refetch } = useHitRateMatrix({
    market,
    timeWindow,
    gameDate
  });

  const thresholdLines = data?.thresholdLines ?? [];
  const rows = data?.rows ?? [];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={brandColors.primary} />
        <Text style={styles.loadingText}>Loading matrix...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Controls */}
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
          {MARKETS.map((m) => {
            const active = market === m.value;
            return (
              <Pressable key={m.value} onPress={() => setMarket(m.value)} style={[styles.pill, active && styles.pillActive]}>
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.controlRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
            {TIME_WINDOWS.map((t) => {
              const active = timeWindow === t.value;
              return (
                <Pressable key={t.value} onPress={() => setTimeWindow(t.value)} style={[styles.pill, active && styles.pillActive]}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
            {DATE_OPTIONS.map((d) => {
              const active = dateFilter === d.value;
              return (
                <Pressable key={d.value} onPress={() => setDateFilter(d.value)} style={[styles.pill, active && styles.pillActive]}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {rows.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No matrix data for these filters.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            {/* Header row */}
            <View style={styles.headerRow}>
              <View style={styles.stickyCol}>
                <Text style={styles.headerText}>PLAYER</Text>
              </View>
              {thresholdLines.map((line) => (
                <View key={line} style={styles.headerCell}>
                  <Text style={styles.headerText}>{line}+</Text>
                </View>
              ))}
            </View>

            {/* Data rows */}
            <ScrollView showsVerticalScrollIndicator={false} style={styles.tableBody}>
              {rows.map((row, idx) => (
                <Pressable
                  key={`${row.playerId}-${idx}`}
                  style={[styles.dataRow, idx % 2 === 0 && styles.dataRowAlt]}
                  onPress={() =>
                    router.push({ pathname: "/player/[id]", params: { id: String(row.playerId), market } })
                  }
                >
                  <View style={[styles.stickyCol, idx % 2 === 0 && styles.dataRowAlt]}>
                    <Text style={styles.playerName} numberOfLines={1}>{row.playerName}</Text>
                    <Text style={styles.playerSub}>
                      {row.teamAbbr} {row.homeAway === "H" ? "vs" : "@"} {row.opponentAbbr}
                    </Text>
                  </View>
                  {row.thresholds.map((t, tIdx) => (
                    <View
                      key={tIdx}
                      style={[styles.cell, { backgroundColor: hitRateBg(t.hitRate) }]}
                    >
                      <Text style={[styles.cellRate, { color: hitRateColor(t.hitRate) }]}>
                        {t.hitRate !== null ? `${Math.round(t.hitRate)}%` : "—"}
                      </Text>
                      {t.hitRate !== null && (
                        <Text style={styles.cellSample}>{t.hits}/{t.games}</Text>
                      )}
                      {t.bestOdds !== null && (
                        <Text style={styles.cellOdds}>{formatOdds(t.bestOdds)}</Text>
                      )}
                    </View>
                  ))}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const CELL_WIDTH = 62;
const STICKY_WIDTH = 110;

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { gap: 8, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
  controlRow: { flexDirection: "row", gap: 12 },
  pillScroll: { gap: 6, paddingRight: 8 },
  pill: {
    borderRadius: 20, borderWidth: 1, borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground, paddingHorizontal: 12, paddingVertical: 7
  },
  pillActive: { borderColor: brandColors.primary, backgroundColor: brandColors.primarySoft },
  pillText: { color: brandColors.textSecondary, fontSize: 12, fontWeight: "600" },
  pillTextActive: { color: brandColors.primary },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { color: brandColors.textSecondary, fontSize: 14 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyText: { color: brandColors.textSecondary, fontSize: 14 },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: brandColors.border },
  stickyCol: {
    width: STICKY_WIDTH, paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: brandColors.appBackground, justifyContent: "center"
  },
  headerCell: { width: CELL_WIDTH, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  headerText: { color: brandColors.textMuted, fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  tableBody: { maxHeight: 500 },
  dataRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: brandColors.border },
  dataRowAlt: { backgroundColor: "rgba(255,255,255,0.02)" },
  playerName: { color: brandColors.textPrimary, fontSize: 11, fontWeight: "700" },
  playerSub: { color: brandColors.textMuted, fontSize: 9 },
  cell: { width: CELL_WIDTH, alignItems: "center", justifyContent: "center", paddingVertical: 6, gap: 1 },
  cellRate: { fontSize: 12, fontWeight: "800" },
  cellSample: { color: brandColors.textMuted, fontSize: 8 },
  cellOdds: { color: brandColors.textSecondary, fontSize: 8, fontWeight: "600" }
});
