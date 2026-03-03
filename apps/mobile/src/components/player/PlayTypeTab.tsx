import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { brandColors } from "@/src/theme/brand";
import { usePlayTypeMatchup } from "@/src/hooks/use-play-type-matchup";
import { rankColor, rankBgColor } from "./constants";

interface PlayTypeTabProps {
  playerId: number;
  opponentTeamId: number | null;
  oppAbbr: string | null;
}

export function PlayTypeTab({ playerId, opponentTeamId, oppAbbr }: PlayTypeTabProps) {
  const { data, isLoading, error } = usePlayTypeMatchup({
    playerId, opponentTeamId, enabled: !!opponentTeamId
  });

  if (!opponentTeamId) {
    return (
      <View style={s.emptyState}>
        <Ionicons name="analytics-outline" size={36} color={brandColors.textMuted} />
        <Text style={s.emptyTitle}>No Matchup Data</Text>
        <Text style={s.emptyText}>No upcoming game scheduled to analyze play types.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={s.emptyState}>
        <ActivityIndicator size="small" color={brandColors.primary} />
        <Text style={s.emptyText}>Loading play type data...</Text>
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

  const playTypes = data?.play_types ?? [];

  if (!playTypes.length) {
    return (
      <View style={s.emptyState}>
        <Text style={s.emptyText}>No play type data available.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.title}>Play Type Analysis{oppAbbr ? ` vs ${oppAbbr}` : ""}</Text>
      <Text style={s.subtitle}>25/26 Season</Text>

      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.headerText, { flex: 1 }]}>PLAY TYPE</Text>
          <Text style={[s.headerText, { width: 80, textAlign: "center" }]}>PLAYER POINTS</Text>
          <Text style={[s.headerText, { width: 70, textAlign: "center" }]}>OPP DEF RANK</Text>
        </View>
        {playTypes.map((pt) => {
          const ppgDisplay = pt.player_pct_of_total != null
            ? `${pt.player_ppg.toFixed(1)} (${Math.round(pt.player_pct_of_total)}%)`
            : pt.player_ppg.toFixed(1);

          return (
            <View key={pt.play_type} style={s.tableRow}>
              <Text style={[s.cellText, { flex: 1 }]} numberOfLines={1}>{pt.display_name}</Text>
              <Text style={[s.cellTextBold, { width: 80, textAlign: "center" }]}>
                {ppgDisplay}
              </Text>
              <View style={{ width: 70, alignItems: "center" }}>
                {pt.opponent_def_rank != null ? (
                  <View style={[s.rankBadge, { backgroundColor: rankBgColor(pt.opponent_def_rank) }]}>
                    <Text style={[s.rankBadgeText, { color: rankColor(pt.opponent_def_rank) }]}>
                      {pt.opponent_def_rank}
                    </Text>
                  </View>
                ) : (
                  <View style={[s.rankBadge, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                    <Text style={[s.rankBadgeText, { color: brandColors.textMuted }]}>N/A</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Summary */}
      {data?.summary ? (
        <View style={s.summaryRow}>
          <View style={[s.summaryPill, { backgroundColor: "rgba(34, 197, 94, 0.12)" }]}>
            <Text style={[s.summaryPillText, { color: "#34D399" }]}>
              {data.summary.favorable_matchups} Favorable
            </Text>
          </View>
          <View style={[s.summaryPill, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
            <Text style={[s.summaryPillText, { color: "#F87171" }]}>
              {data.summary.tough_matchups} Tough
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { paddingTop: 4, paddingHorizontal: 16, gap: 8 },

  title: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "700" },
  subtitle: { color: brandColors.textMuted, fontSize: 12, fontWeight: "500", marginBottom: 4 },

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
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 11,
    borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.04)"
  },
  cellText: { color: brandColors.textPrimary, fontSize: 14, fontWeight: "600" },
  cellTextBold: { color: brandColors.textSecondary, fontSize: 13, fontWeight: "600" },
  rankBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, minWidth: 36, alignItems: "center" },
  rankBadgeText: { fontSize: 13, fontWeight: "800" },

  summaryRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  summaryPill: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  summaryPillText: { fontSize: 12, fontWeight: "700" },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  emptyTitle: { color: brandColors.textPrimary, fontSize: 18, fontWeight: "700" },
  emptyText: { color: brandColors.textMuted, fontSize: 13, textAlign: "center" }
});
