import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TeammateCorrelation, StatCorrelation } from "@unjuiced/api";
import { brandColors } from "@/src/theme/brand";
import { usePlayerCorrelations } from "@/src/hooks/use-player-correlations";
import { fmtPct, hitColor, mktTab } from "./constants";

type CorrelationMarketKey =
  | "ALL" | "points" | "rebounds" | "assists" | "threes"
  | "steals" | "blocks" | "turnovers" | "pra";

const MARKET_PILLS: { key: CorrelationMarketKey; label: string }[] = [
  { key: "ALL", label: "ALL" },
  { key: "points", label: "PTS" },
  { key: "rebounds", label: "REB" },
  { key: "assists", label: "AST" },
  { key: "threes", label: "3PM" },
  { key: "steals", label: "STL" },
  { key: "blocks", label: "BLK" },
  { key: "turnovers", label: "TO" },
  { key: "pra", label: "PRA" }
];

interface CorrelationTabProps {
  playerId: number;
  chartMarket: string;
  chartLine: number | null;
}

export function CorrelationTab({ playerId, chartMarket, chartLine }: CorrelationTabProps) {
  const [selectedMarket, setSelectedMarket] = useState<CorrelationMarketKey>("ALL");

  const { teammateCorrelations, anchorPerformance, headline, isLoading, error } = usePlayerCorrelations({
    playerId,
    market: chartMarket,
    line: chartLine,
    enabled: chartLine != null && chartLine > 0
  });

  const sortedTeammates = useMemo(() => {
    if (!teammateCorrelations.length) return [];
    return [...teammateCorrelations].sort((a, b) => {
      const aStr = getStrength(a, selectedMarket);
      const bStr = getStrength(b, selectedMarket);
      return Math.abs(bStr) - Math.abs(aStr);
    });
  }, [teammateCorrelations, selectedMarket]);

  if (chartLine == null || chartLine <= 0) {
    return (
      <View style={s.emptyState}>
        <Ionicons name="people-outline" size={36} color={brandColors.textMuted} />
        <Text style={s.emptyTitle}>No Line Selected</Text>
        <Text style={s.emptyText}>Select a line from the Chart tab to see teammate correlations.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={s.emptyState}>
        <ActivityIndicator size="small" color={brandColors.primary} />
        <Text style={s.emptyText}>Loading correlations...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.emptyState}>
        <Ionicons name="alert-circle-outline" size={36} color={brandColors.error} />
        <Text style={s.emptyText}>{error.message}</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Anchor summary */}
      {anchorPerformance ? (
        <View style={s.anchorCard}>
          <Text style={s.anchorTitle}>{mktTab(chartMarket)} {chartLine}+</Text>
          <Text style={[s.anchorHitRate, { color: hitColor(anchorPerformance.hitRate) }]}>
            {fmtPct(anchorPerformance.hitRate)}
          </Text>
          <Text style={s.anchorSub}>
            {anchorPerformance.timesHit}/{anchorPerformance.gamesAnalyzed} games
          </Text>
        </View>
      ) : null}

      {/* Market filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillBar}
      >
        {MARKET_PILLS.map((m) => {
          const active = m.key === selectedMarket;
          return (
            <Pressable
              key={m.key}
              onPress={() => setSelectedMarket(m.key)}
              style={[s.pill, active && s.pillActive]}
            >
              <Text style={[s.pillText, active && s.pillTextActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Teammate rows */}
      {sortedTeammates.length > 0 ? (
        <View style={s.list}>
          {sortedTeammates.map((tm) => (
            <TeammateRow key={tm.playerId} teammate={tm} market={selectedMarket} />
          ))}
        </View>
      ) : (
        <Text style={s.emptyText}>No teammate correlation data available.</Text>
      )}
    </View>
  );
}

function TeammateRow({ teammate, market }: { teammate: TeammateCorrelation; market: CorrelationMarketKey }) {
  const stats = getStatForMarket(teammate, market);

  const hitPct = stats?.hitRateWhenAnchorHits?.pct ?? null;
  const diff = stats?.diff ?? null;
  const isPositive = diff != null && diff > 0;

  return (
    <View style={s.tmRow}>
      <Image
        source={{ uri: `https://cdn.nba.com/headshots/nba/latest/260x190/${teammate.playerId}.png` }}
        style={s.tmAvatar}
      />
      <View style={s.tmInfo}>
        <View style={s.tmNameRow}>
          <Text style={s.tmName} numberOfLines={1}>{teammate.playerName}</Text>
          <View style={s.posBadge}>
            <Text style={s.posBadgeText}>{teammate.position}</Text>
          </View>
        </View>
        {stats ? (
          <View style={s.tmStatsRow}>
            {hitPct != null ? (
              <Text style={[s.tmHitRate, { color: hitColor(hitPct) }]}>
                {fmtPct(hitPct)} hit rate
              </Text>
            ) : null}
            {diff != null ? (
              <View style={[s.boostBadge, isPositive ? s.boostPositive : s.boostNegative]}>
                <Ionicons
                  name={isPositive ? "arrow-up" : "arrow-down"}
                  size={10}
                  color={isPositive ? "#22C55E" : "#EF4444"}
                />
                <Text style={[s.boostText, { color: isPositive ? "#22C55E" : "#EF4444" }]}>
                  {Math.abs(diff).toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function getStatForMarket(tm: TeammateCorrelation, market: CorrelationMarketKey): StatCorrelation | null {
  if (market === "ALL") {
    // Return the stat with strongest diff
    const candidates: StatCorrelation[] = [tm.points, tm.rebounds, tm.assists, tm.threes, tm.pra];
    return candidates.reduce((best, cur) => {
      const bestDiff = Math.abs(best?.diff ?? 0);
      const curDiff = Math.abs(cur?.diff ?? 0);
      return curDiff > bestDiff ? cur : best;
    }, candidates[0]);
  }
  return (tm as any)[market] ?? null;
}

function getStrength(tm: TeammateCorrelation, market: CorrelationMarketKey): number {
  const stat = getStatForMarket(tm, market);
  return stat?.diff ?? 0;
}

const s = StyleSheet.create({
  container: { paddingTop: 4 },

  anchorCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: 16, padding: 12,
    backgroundColor: brandColors.panelBackground, borderRadius: 12,
    borderWidth: 1, borderColor: brandColors.border
  },
  anchorTitle: { color: brandColors.textSecondary, fontSize: 14, fontWeight: "700" },
  anchorHitRate: { fontSize: 18, fontWeight: "900" },
  anchorSub: { color: brandColors.textMuted, fontSize: 12, fontWeight: "500", flex: 1, textAlign: "right" },

  pillBar: { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)"
  },
  pillActive: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  pillText: { color: "rgba(255,255,255,0.50)", fontSize: 12, fontWeight: "600" },
  pillTextActive: { color: "#FFFFFF" },

  list: { paddingHorizontal: 16, gap: 2 },

  tmRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.04)"
  },
  tmAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: brandColors.panelBackgroundAlt },
  tmInfo: { flex: 1, gap: 3 },
  tmNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tmName: { color: brandColors.textPrimary, fontSize: 14, fontWeight: "600", flex: 1 },
  posBadge: {
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1
  },
  posBadgeText: { color: brandColors.textMuted, fontSize: 10, fontWeight: "700" },
  tmStatsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tmHitRate: { fontSize: 13, fontWeight: "700" },
  boostBadge: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  boostPositive: { backgroundColor: "rgba(34, 197, 94, 0.12)" },
  boostNegative: { backgroundColor: "rgba(239, 68, 68, 0.12)" },
  boostText: { fontSize: 11, fontWeight: "800" },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  emptyTitle: { color: brandColors.textPrimary, fontSize: 18, fontWeight: "700" },
  emptyText: { color: brandColors.textMuted, fontSize: 13, textAlign: "center" }
});
