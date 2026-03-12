import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { brandColors } from "@/src/theme/brand";
import { useTeamDefenseRanks } from "@/src/hooks/use-team-defense-ranks";
import { usePositionVsTeam } from "@/src/hooks/use-position-vs-team";
import TeamLogo from "@/src/components/TeamLogo";
import { rankColor, rankBgColor, fmtDate, hitColor } from "./constants";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
const MARKETS = [
  { key: "player_points", label: "PTS" },
  { key: "player_rebounds", label: "REB" },
  { key: "player_assists", label: "AST" },
  { key: "player_threes_made", label: "3PM" },
  { key: "player_steals", label: "STL" },
  { key: "player_blocks", label: "BLK" },
  { key: "player_points_rebounds_assists", label: "PRA" }
] as const;

interface MatchupTabProps {
  opponentTeamId: number | null;
  playerPosition: string | null;
  oppAbbr: string | null;
  chartMarket: string;
}

export function MatchupTab({ opponentTeamId, playerPosition, oppAbbr, chartMarket }: MatchupTabProps) {
  const { positions, isLoading, error } = useTeamDefenseRanks({
    opponentTeamId,
    enabled: !!opponentTeamId
  });

  const normalizedPos = normalizePosition(playerPosition);

  const { data: posVsTeam, isLoading: pvtLoading } = usePositionVsTeam({
    position: normalizedPos,
    opponentTeamId,
    market: chartMarket,
    limit: 20,
    minMinutes: 15,
    enabled: !!opponentTeamId && !!normalizedPos
  });

  if (!opponentTeamId) {
    return (
      <View style={s.emptyState}>
        <Ionicons name="shield-outline" size={36} color={brandColors.textMuted} />
        <Text style={s.emptyTitle}>No Matchup Data</Text>
        <Text style={s.emptyText}>No upcoming game scheduled.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={s.emptyState}>
        <ActivityIndicator size="small" color={brandColors.primary} />
        <Text style={s.emptyText}>Loading defense data...</Text>
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
      <Text style={s.title}>Defense vs Position{oppAbbr ? ` — ${oppAbbr}` : ""}</Text>
      <Text style={s.subtitle}>Rank 1-10 = tough (red) · 11-20 = neutral (amber) · 21-30 = favorable (green)</Text>

      {/* Centered defense matrix */}
      <View style={s.tableCenter}>
        <View style={s.table}>
          {/* Header row */}
          <View style={s.headerRow}>
            <View style={s.labelCol} />
            {POSITIONS.map((pos) => {
              const isPlayer = pos === normalizedPos;
              return (
                <View key={pos} style={[s.posCol, isPlayer && s.posColHighlight]}>
                  <Text style={[s.posHeader, isPlayer && s.posHeaderActive]}>{pos}</Text>
                </View>
              );
            })}
          </View>

          {/* Market rows */}
          {MARKETS.map((mkt) => (
            <View key={mkt.key} style={s.row}>
              <View style={s.labelCol}>
                <Text style={s.rowLabel}>{mkt.label}</Text>
              </View>
              {POSITIONS.map((pos) => {
                const isPlayer = pos === normalizedPos;
                const data = positions[pos]?.[mkt.key];
                const rank = data?.rank ?? null;
                return (
                  <View key={pos} style={[s.posCol, isPlayer && s.posColHighlight]}>
                    {rank != null ? (
                      <View style={[s.rankCell, { backgroundColor: rankBgColor(rank) }]}>
                        <Text style={[s.rankText, { color: rankColor(rank) }]}>{rank}</Text>
                      </View>
                    ) : (
                      <Text style={s.emptyCell}>—</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Recent players at this position vs opponent */}
      {normalizedPos ? (
        <View style={s.recentSection}>
          <Text style={s.recentTitle}>
            Recent {normalizedPos}s vs {oppAbbr ?? "Opponent"}
          </Text>

          {pvtLoading ? (
            <ActivityIndicator size="small" color={brandColors.primary} style={{ marginVertical: 12 }} />
          ) : posVsTeam && posVsTeam.players.length > 0 ? (
            <>
              {/* Summary row */}
              <View style={s.recentSummary}>
                <View style={s.summaryItem}>
                  <Text style={s.summaryLabel}>AVG</Text>
                  <Text style={s.summaryValue}>{posVsTeam.avgStat.toFixed(1)}</Text>
                </View>
                {posVsTeam.overHitRate != null ? (
                  <View style={s.summaryItem}>
                    <Text style={s.summaryLabel}>HIT RATE</Text>
                    <Text style={[s.summaryValue, { color: hitColor(posVsTeam.overHitRate) }]}>
                      {Math.round(posVsTeam.overHitRate)}%
                    </Text>
                  </View>
                ) : null}
                <View style={s.summaryItem}>
                  <Text style={s.summaryLabel}>GAMES</Text>
                  <Text style={s.summaryValue}>{posVsTeam.totalGames}</Text>
                </View>
              </View>

              {/* Player rows */}
              <View style={s.recentTable}>
                {posVsTeam.players.slice(0, 15).map((p, i) => {
                  const hit = p.hitOver === true;
                  const miss = p.hitOver === false;
                  return (
                    <View key={`${p.playerId}-${p.gameDate}-${i}`} style={s.recentRow}>
                      <Image
                        source={{ uri: `https://cdn.nba.com/headshots/nba/latest/260x190/${p.playerId}.png` }}
                        style={s.recentAvatar}
                      />
                      <View style={s.recentInfo}>
                        <Text style={s.recentName} numberOfLines={1}>{p.playerName}</Text>
                        <View style={s.recentMeta}>
                          {p.teamAbbr ? (
                            <TeamLogo teamAbbr={p.teamAbbr} sport="nba" size={12} style={{ borderRadius: 6 }} />
                          ) : null}
                          <Text style={s.recentDate}>{fmtDate(p.gameDate)}</Text>
                          {p.closingLine != null ? (
                            <Text style={s.recentLine}>Line: {p.closingLine}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={s.recentStatCol}>
                        <Text style={[
                          s.recentStat,
                          hit && { color: "#34D399" },
                          miss && { color: "#F87171" }
                        ]}>
                          {p.stat}
                        </Text>
                        <Text style={s.recentMin}>{Math.round(p.minutes)} min</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={s.emptyTextSmall}>No recent games found.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function normalizePosition(pos: string | null): string | null {
  if (!pos) return null;
  const upper = pos.toUpperCase().trim();
  if (upper === "G") return "PG";
  if (upper === "F") return "SF";
  if (upper === "C") return "C";
  if (upper.startsWith("PG") || upper.startsWith("SG") || upper.startsWith("SF") || upper.startsWith("PF")) {
    return upper.substring(0, 2);
  }
  return upper;
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  title: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "700" },
  subtitle: { color: brandColors.textMuted, fontSize: 11, fontWeight: "500" },

  /* Centered table */
  tableCenter: { alignItems: "center" },
  table: {
    backgroundColor: brandColors.panelBackground,
    borderRadius: 12, borderWidth: 1, borderColor: brandColors.border, overflow: "hidden"
  },
  headerRow: {
    flexDirection: "row", backgroundColor: brandColors.panelBackgroundAlt,
    borderBottomWidth: 1, borderBottomColor: brandColors.border
  },
  row: {
    flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.04)"
  },
  labelCol: { width: 48, justifyContent: "center", paddingLeft: 12, paddingVertical: 10 },
  posCol: { width: 56, alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  posColHighlight: { backgroundColor: "rgba(34, 197, 94, 0.06)" },
  posHeader: { color: brandColors.textMuted, fontSize: 11, fontWeight: "700" },
  posHeaderActive: { color: "#22C55E" },
  rowLabel: { color: brandColors.textSecondary, fontSize: 12, fontWeight: "700" },
  rankCell: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  rankText: { fontSize: 13, fontWeight: "800", textAlign: "center" },
  emptyCell: { color: brandColors.textMuted, fontSize: 13, fontWeight: "500" },

  /* Recent players section */
  recentSection: { gap: 8 },
  recentTitle: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "700" },

  recentSummary: {
    flexDirection: "row", gap: 4,
    backgroundColor: brandColors.panelBackground, borderRadius: 10,
    borderWidth: 1, borderColor: brandColors.border, overflow: "hidden"
  },
  summaryItem: {
    flex: 1, alignItems: "center", paddingVertical: 8,
    borderRightWidth: 0.5, borderRightColor: brandColors.border
  },
  summaryLabel: { color: brandColors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  summaryValue: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "800", marginTop: 2 },

  recentTable: {
    backgroundColor: brandColors.panelBackground, borderRadius: 12,
    borderWidth: 1, borderColor: brandColors.border, overflow: "hidden"
  },
  recentRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.04)"
  },
  recentAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: brandColors.panelBackgroundAlt },
  recentInfo: { flex: 1, gap: 2 },
  recentName: { color: brandColors.textPrimary, fontSize: 13, fontWeight: "600" },
  recentMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  recentTeamLogo: { width: 12, height: 12, borderRadius: 6 },
  recentDate: { color: brandColors.textMuted, fontSize: 11, fontWeight: "500" },
  recentLine: { color: brandColors.textMuted, fontSize: 11, fontWeight: "500" },
  recentStatCol: { alignItems: "flex-end", gap: 1 },
  recentStat: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "800" },
  recentMin: { color: brandColors.textMuted, fontSize: 10, fontWeight: "500" },

  emptyTextSmall: { color: brandColors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 12 },

  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  emptyTitle: { color: brandColors.textPrimary, fontSize: 18, fontWeight: "700" },
  emptyText: { color: brandColors.textMuted, fontSize: 13, textAlign: "center" }
});
