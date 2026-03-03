import { useMemo, useState } from "react";
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
import { useDvpRankings } from "@/src/hooks/use-dvp-rankings";
import { getNbaTeamLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";
import type { DvpTeamRanking } from "@unjuiced/api";

const POSITIONS = [
  { value: "PG", label: "PG" },
  { value: "SG", label: "SG" },
  { value: "SF", label: "SF" },
  { value: "PF", label: "PF" },
  { value: "C", label: "C" }
];

const STATS = [
  { value: "pts", label: "PTS", field: "ptsAvg", rankField: "ptsRank" },
  { value: "reb", label: "REB", field: "rebAvg", rankField: "rebRank" },
  { value: "ast", label: "AST", field: "astAvg", rankField: "astRank" },
  { value: "fg3m", label: "3PM", field: "fg3mAvg", rankField: "fg3mRank" },
  { value: "stl", label: "STL", field: "stlAvg", rankField: "stlRank" },
  { value: "blk", label: "BLK", field: "blkAvg", rankField: "blkRank" },
  { value: "tov", label: "TO", field: "tovAvg", rankField: "tovRank" },
  { value: "pra", label: "PRA", field: "praAvg", rankField: "praRank" }
];

function rankColor(rank: number | null): { bg: string; text: string } {
  if (rank === null) return { bg: "rgba(107,114,128,0.1)", text: brandColors.textMuted };
  if (rank >= 21) return { bg: "rgba(34, 197, 94, 0.15)", text: "#22C55E" };
  if (rank <= 10) return { bg: "rgba(239, 68, 68, 0.15)", text: "#EF4444" };
  return { bg: "rgba(234, 179, 8, 0.1)", text: "#EAB308" };
}

function rankLabel(rank: number | null): string {
  if (rank === null) return "—";
  if (rank >= 26) return "Easy";
  if (rank >= 21) return "Soft";
  if (rank <= 5) return "Lock";
  if (rank <= 10) return "Tough";
  return "Avg";
}

export default function DvpSheet() {
  const [position, setPosition] = useState("PG");
  const [selectedStat, setSelectedStat] = useState(STATS[0]);

  const { data, isLoading, isRefetching, refetch } = useDvpRankings({ position });

  const teams = useMemo(() => {
    const src = data?.teams ?? [];
    const sorted = [...src];
    const rField = selectedStat.rankField as keyof DvpTeamRanking;
    sorted.sort((a, b) => {
      const aR = (a[rField] as number | null) ?? 99;
      const bR = (b[rField] as number | null) ?? 99;
      return aR - bR;
    });
    return sorted;
  }, [data?.teams, selectedStat.rankField]);

  const renderItem = ({ item, index }: { item: DvpTeamRanking; index: number }) => {
    const rank = (item[selectedStat.rankField as keyof DvpTeamRanking] as number | null) ?? null;
    const avg = (item[selectedStat.field as keyof DvpTeamRanking] as number | null) ?? null;
    const rc = rankColor(rank);
    const teamLogo = getNbaTeamLogoUrl(item.teamAbbr);

    return (
      <View style={[styles.row, index % 2 === 0 && styles.rowAlt]}>
        <View style={[styles.rankBadge, { backgroundColor: rc.bg }]}>
          <Text style={[styles.rankText, { color: rc.text }]}>
            {rank ?? "—"}
          </Text>
        </View>
        {teamLogo ? (
          <Image source={{ uri: teamLogo }} style={styles.teamLogo} />
        ) : (
          <View style={[styles.teamLogo, { borderWidth: 1, borderColor: brandColors.border }]} />
        )}
        <Text style={styles.teamAbbr}>{item.teamAbbr}</Text>
        <View style={styles.rowRight}>
          <Text style={styles.avgValue}>{avg != null ? avg.toFixed(1) : "—"}</Text>
          <View style={[styles.qualityBadge, { backgroundColor: rc.bg }]}>
            <Text style={[styles.qualityText, { color: rc.text }]}>{rankLabel(rank)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const listHeader = (
    <View style={styles.listHeader}>
      {/* Position pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
        {POSITIONS.map((p) => {
          const active = position === p.value;
          return (
            <Pressable key={p.value} onPress={() => setPosition(p.value)} style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* Stat pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
        {STATS.map((s) => {
          const active = selectedStat.value === s.value;
          return (
            <Pressable key={s.value} onPress={() => setSelectedStat(s)} style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* Column header */}
      <View style={styles.colHeader}>
        <Text style={styles.colText}>RANK</Text>
        <Text style={[styles.colText, { flex: 1, textAlign: "left", marginLeft: 48 }]}>TEAM</Text>
        <Text style={[styles.colText, { width: 50, textAlign: "right" }]}>AVG</Text>
        <Text style={[styles.colText, { width: 50, textAlign: "right" }]}>MATCHUP</Text>
      </View>
    </View>
  );

  const listEmpty = isLoading ? (
    <View style={styles.stateCard}>
      <ActivityIndicator size="small" color={brandColors.primary} />
      <Text style={styles.stateText}>Loading DVP rankings...</Text>
    </View>
  ) : (
    <View style={styles.stateCard}>
      <Text style={styles.stateText}>No DVP data available.</Text>
    </View>
  );

  return (
    <FlatList
      data={teams}
      renderItem={renderItem}
      keyExtractor={(item) => `${item.teamId}-${item.position}`}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      contentContainerStyle={styles.listContent}
      onRefresh={() => void refetch()}
      refreshing={isRefetching}
      progressViewOffset={0}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 12, paddingBottom: 24 },
  listHeader: { gap: 8, paddingTop: 4, paddingBottom: 4 },
  pillScroll: { gap: 6, paddingRight: 8 },
  pill: {
    borderRadius: 20, borderWidth: 1, borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground, paddingHorizontal: 14, paddingVertical: 7
  },
  pillActive: { borderColor: brandColors.primary, backgroundColor: brandColors.primarySoft },
  pillText: { color: brandColors.textSecondary, fontSize: 12, fontWeight: "600" },
  pillTextActive: { color: brandColors.primary },
  colHeader: {
    flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: brandColors.border
  },
  colText: { color: brandColors.textMuted, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  row: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 4, gap: 10,
    borderBottomWidth: 0.5, borderBottomColor: brandColors.border
  },
  rowAlt: { backgroundColor: "rgba(255,255,255,0.02)" },
  rankBadge: { width: 32, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 14, fontWeight: "800" },
  teamLogo: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#0A0F1B" },
  teamAbbr: { color: brandColors.textPrimary, fontSize: 14, fontWeight: "700", width: 40 },
  rowRight: { flex: 1, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10 },
  avgValue: { color: brandColors.textPrimary, fontSize: 14, fontWeight: "600" },
  qualityBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, minWidth: 44, alignItems: "center" },
  qualityText: { fontSize: 10, fontWeight: "700" },
  stateCard: {
    borderRadius: 14, borderWidth: 1, borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt, paddingHorizontal: 14, paddingVertical: 24,
    alignItems: "center", gap: 8, marginTop: 8
  },
  stateText: { color: brandColors.textSecondary, fontSize: 14, textAlign: "center" }
});
