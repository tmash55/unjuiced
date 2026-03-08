import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { brandColors } from "@/src/theme/brand";
import { useShotZoneMatchup } from "@/src/hooks/use-shot-zone-matchup";
import { rankColor, rankBgColor } from "./constants";
import { ShotZoneCourt } from "./ShotZoneCourt";

interface ShootingTabProps {
  playerId: number;
  opponentTeamId: number | null;
  oppAbbr: string | null;
}

export function ShootingTab({ playerId, opponentTeamId, oppAbbr }: ShootingTabProps) {
  const { data, isLoading, error } = useShotZoneMatchup({
    playerId, opponentTeamId, enabled: !!opponentTeamId
  });

  if (!opponentTeamId) {
    return (
      <View style={s.emptyState}>
        <Ionicons name="basketball-outline" size={36} color={brandColors.textMuted} />
        <Text style={s.emptyTitle}>No Matchup Data</Text>
        <Text style={s.emptyText}>No upcoming game scheduled to compare shooting zones.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={s.emptyState}>
        <ActivityIndicator size="small" color={brandColors.primary} />
        <Text style={s.emptyText}>Loading shooting zones...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.emptyState}>
        <Ionicons name="alert-circle-outline" size={36} color={brandColors.error} />
        <Text style={s.emptyText}>{(error as Error).message}</Text>
      </View>
    );
  }

  if (!data?.zones?.length) {
    return (
      <View style={s.emptyState}>
        <Text style={s.emptyText}>No shot zone data available.</Text>
      </View>
    );
  }

  // Summary pills
  const favorable = data.summary?.favorable_zones ?? 0;
  const neutral = data.summary?.neutral_zones ?? 0;
  const tough = data.summary?.tough_zones ?? 0;

  return (
    <View style={s.container}>
      <Text style={s.title}>Shooting Zones{oppAbbr ? ` vs ${oppAbbr}` : ""}</Text>

      {/* Court visualization */}
      <ShotZoneCourt zones={data.zones} oppAbbr={oppAbbr} />

      {/* Summary pills */}
      <View style={s.summaryRow}>
        {favorable > 0 ? (
          <View style={[s.summaryPill, { backgroundColor: "rgba(34, 197, 94, 0.12)" }]}>
            <Text style={[s.summaryText, { color: "#34D399" }]}>{favorable} Favorable</Text>
          </View>
        ) : null}
        {neutral > 0 ? (
          <View style={[s.summaryPill, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
            <Text style={[s.summaryText, { color: "#FBBF24" }]}>{neutral} Neutral</Text>
          </View>
        ) : null}
        {tough > 0 ? (
          <View style={[s.summaryPill, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
            <Text style={[s.summaryText, { color: "#F87171" }]}>{tough} Tough</Text>
          </View>
        ) : null}
      </View>

      {/* Zone detail table */}
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.headerText, { flex: 1 }]}>ZONE</Text>
          <Text style={[s.headerText, { width: 50, textAlign: "center" }]}>FG%</Text>
          <Text style={[s.headerText, { width: 50, textAlign: "center" }]}>SHARE</Text>
          <Text style={[s.headerText, { width: 65, textAlign: "center" }]}>DEF RANK</Text>
        </View>
        {data.zones.map((z) => (
          <View key={z.zone} style={s.tableRow}>
            <Text style={[s.cellText, { flex: 1 }]} numberOfLines={1}>{z.display_name}</Text>
            <Text style={[s.cellTextBold, { width: 50, textAlign: "center" }]}>
              {Math.round(z.player_fg_pct * 100)}%
            </Text>
            <Text style={[s.cellTextDim, { width: 50, textAlign: "center" }]}>
              {Math.round(z.player_pct_of_total)}%
            </Text>
            <View style={{ width: 65, alignItems: "center" }}>
              {z.opponent_def_rank != null ? (
                <View style={[s.rankBadge, { backgroundColor: rankBgColor(z.opponent_def_rank) }]}>
                  <Text style={[s.rankBadgeText, { color: rankColor(z.opponent_def_rank) }]}>
                    {z.opponent_def_rank}
                  </Text>
                </View>
              ) : (
                <Text style={s.cellTextDim}>—</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingTop: 4, paddingHorizontal: 16, gap: 12 },

  title: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "700" },

  summaryRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  summaryPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  summaryText: { fontSize: 12, fontWeight: "700" },

  table: {
    backgroundColor: brandColors.panelBackground, borderRadius: 12,
    borderWidth: 1, borderColor: brandColors.border, overflow: "hidden"
  },
  tableHeader: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: brandColors.panelBackgroundAlt, borderBottomWidth: 1, borderBottomColor: brandColors.border
  },
  headerText: {
    color: brandColors.textMuted, fontSize: 10, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.5
  },
  tableRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.04)"
  },
  cellText: { color: brandColors.textSecondary, fontSize: 13, fontWeight: "600" },
  cellTextBold: { color: brandColors.textPrimary, fontSize: 13, fontWeight: "700" },
  cellTextDim: { color: brandColors.textMuted, fontSize: 13, fontWeight: "500" },
  rankBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, minWidth: 32, alignItems: "center" },
  rankBadgeText: { fontSize: 12, fontWeight: "800" },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  emptyTitle: { color: brandColors.textPrimary, fontSize: 18, fontWeight: "700" },
  emptyText: { color: brandColors.textMuted, fontSize: 13, textAlign: "center" }
});
