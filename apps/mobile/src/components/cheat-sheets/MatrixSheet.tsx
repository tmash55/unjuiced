import { useRef } from "react";
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useRouter } from "expo-router";
import { useHitRateMatrix } from "@/src/hooks/use-hit-rate-matrix";
import { brandColors } from "@/src/theme/brand";
import type { HitRateMatrixRow } from "@unjuiced/api";

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

type Props = {
  market: string;
  timeWindow: string;
  dateFilter: "today" | "tomorrow";
};

const CELL_WIDTH = 62;
const STICKY_WIDTH = 110;
const ROW_HEIGHT = 52;

export default function MatrixSheet({ market, timeWindow, dateFilter }: Props) {
  const router = useRouter();
  const leftBodyRef = useRef<ScrollView>(null);
  const rightBodyRef = useRef<ScrollView>(null);
  const headerHorizontalRef = useRef<ScrollView>(null);
  const syncingVerticalRef = useRef<"left" | "right" | null>(null);

  const gameDate = dateFilter === "today" ? getTodayDate() : getTomorrowDate();

  const { data, isLoading } = useHitRateMatrix({
    market,
    timeWindow,
    gameDate
  });

  const thresholdLines = data?.thresholdLines ?? [];
  const rows = data?.rows ?? [];
  const tableHeight = Math.min(rows.length * ROW_HEIGHT, 500);

  function openPlayer(row: HitRateMatrixRow) {
    router.push({ pathname: "/player/[id]", params: { id: String(row.playerId), market } });
  }

  function syncVerticalScroll(source: "left" | "right", event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (syncingVerticalRef.current && syncingVerticalRef.current !== source) return;
    syncingVerticalRef.current = source;

    const y = event.nativeEvent.contentOffset.y;
    if (source === "left") {
      rightBodyRef.current?.scrollTo({ y, animated: false });
    } else {
      leftBodyRef.current?.scrollTo({ y, animated: false });
    }

    requestAnimationFrame(() => {
      syncingVerticalRef.current = null;
    });
  }

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
      {rows.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No matrix data for these filters.</Text>
        </View>
      ) : (
        <View style={styles.matrixShell}>
          <View style={styles.leftRail}>
            <View style={styles.stickyHeaderCell}>
              <Text style={styles.headerText}>PLAYER</Text>
            </View>

            <ScrollView
              ref={leftBodyRef}
              style={{ height: tableHeight }}
              showsVerticalScrollIndicator={false}
              bounces={false}
              onScroll={(event) => syncVerticalScroll("left", event)}
              scrollEventThrottle={16}
            >
              {rows.map((row, idx) => (
                <Pressable
                  key={`${row.playerId}-${idx}-left`}
                  style={[styles.playerRow, idx % 2 === 0 && styles.dataRowAlt]}
                  onPress={() => openPlayer(row)}
                >
                  <Text style={styles.playerName} numberOfLines={1}>{row.playerName}</Text>
                  <Text style={styles.playerSub}>
                    {row.teamAbbr} {row.homeAway === "H" ? "vs" : "@"} {row.opponentAbbr}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.rightRail}>
            <ScrollView
              ref={headerHorizontalRef}
              horizontal
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.headerRow}>
                {thresholdLines.map((line) => (
                  <View key={line} style={styles.headerCell}>
                    <Text style={styles.headerText}>{line}+</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              bounces={false}
              onScroll={(event) => {
                headerHorizontalRef.current?.scrollTo({
                  x: event.nativeEvent.contentOffset.x,
                  animated: false
                });
              }}
              scrollEventThrottle={16}
            >
              <ScrollView
                ref={rightBodyRef}
                style={{ height: tableHeight }}
                showsVerticalScrollIndicator={false}
                bounces={false}
                onScroll={(event) => syncVerticalScroll("right", event)}
                scrollEventThrottle={16}
              >
                {rows.map((row, idx) => (
                  <Pressable
                    key={`${row.playerId}-${idx}-right`}
                    style={[styles.dataRow, idx % 2 === 0 && styles.dataRowAlt]}
                    onPress={() => openPlayer(row)}
                  >
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
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { color: brandColors.textSecondary, fontSize: 14 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyText: { color: brandColors.textSecondary, fontSize: 14 },
  matrixShell: { flexDirection: "row" },
  leftRail: {
    width: STICKY_WIDTH,
    borderRightWidth: 1,
    borderRightColor: brandColors.border,
    backgroundColor: brandColors.appBackground
  },
  rightRail: { flex: 1 },
  stickyHeaderCell: {
    width: STICKY_WIDTH,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: brandColors.appBackground,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: brandColors.border
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: brandColors.border
  },
  headerCell: {
    width: CELL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8
  },
  headerText: {
    color: brandColors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  dataRow: {
    flexDirection: "row",
    minHeight: ROW_HEIGHT,
    borderBottomWidth: 0.5,
    borderBottomColor: brandColors.border
  },
  dataRowAlt: { backgroundColor: "rgba(255,255,255,0.02)" },
  playerRow: {
    minHeight: ROW_HEIGHT,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: brandColors.border
  },
  playerName: { color: brandColors.textPrimary, fontSize: 11, fontWeight: "700" },
  playerSub: { color: brandColors.textMuted, fontSize: 9 },
  cell: {
    width: CELL_WIDTH,
    minHeight: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 1
  },
  cellRate: { fontSize: 12, fontWeight: "800" },
  cellSample: { color: brandColors.textMuted, fontSize: 8 },
  cellOdds: { color: brandColors.textSecondary, fontSize: 8, fontWeight: "600" }
});
