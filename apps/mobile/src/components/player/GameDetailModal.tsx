import { useMemo } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PlayerBoxScoreGame } from "@unjuiced/types";
import type { TeammateOut } from "@unjuiced/api";
import type { PlayerOutInfo } from "@/src/hooks/use-players-out-for-filter";
import { getNbaTeamLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";
import { fmtDateShort, getGameStat, mktTab, injuryBorderColor, BAR_HIT, BAR_MISS } from "./constants";

interface GameDetailModalProps {
  game: PlayerBoxScoreGame;
  chartMarket: string;
  chartLine: number | null;
  teammatesOut: TeammateOut[];
  allGames: PlayerBoxScoreGame[];
  teammatesOutByGame: Map<string, TeammateOut[]>;
  teammateSeasonStats?: Map<number, PlayerOutInfo>;
  visible: boolean;
  onClose: () => void;
}

export function GameDetailModal({ game, chartMarket, chartLine, teammatesOut, allGames, teammatesOutByGame, teammateSeasonStats, visible, onClose }: GameDetailModalProps) {
  const sg = game;
  const sv = getGameStat(sg, chartMarket);
  const isDNP = sg.minutes === 0;
  const sHit = chartLine != null && !isDNP ? sv >= chartLine : null;
  const sColor = isDNP ? brandColors.textMuted : sHit == null ? brandColors.textPrimary : sHit ? BAR_HIT : BAR_MISS;
  const sgOppLogo = getNbaTeamLogoUrl(sg.opponentAbbr);

  // Compute teammate impact stats: player's avg when this teammate is out
  // Filter out bench/low-impact players aggressively
  const teammateStats = useMemo(() => {
    if (!teammatesOut.length || !allGames.length) return new Map<number, { gamesOut: number; avgStat: number; avgMin: number; hitPct: number | null } | null>();
    const totalGames = allGames.length;
    const overallAvgMin = allGames.reduce((s, g) => s + g.minutes, 0) / totalGames;
    const result = new Map<number, { gamesOut: number; avgStat: number; avgMin: number; hitPct: number | null } | null>();

    for (const tm of teammatesOut) {
      const tmGames: PlayerBoxScoreGame[] = [];
      for (const [gameId, mates] of teammatesOutByGame) {
        if (mates.some(m => m.player_id === tm.player_id)) {
          const match = allGames.find(g => String(g.gameId).replace(/^0+/, "") === gameId);
          if (match) tmGames.push(match);
        }
      }

      // Filter out low-impact teammates:
      // - Not enough data (< 3 games out)
      // - Out for nearly all games (their absence IS the baseline)
      // - No meaningful minute impact on the player (bench warmers)
      if (!tmGames.length || tmGames.length < 3) {
        result.set(tm.player_id, null);
        continue;
      }
      if (totalGames > 5 && tmGames.length / totalGames >= 0.80) {
        result.set(tm.player_id, null);
        continue;
      }

      const avgStat = tmGames.reduce((s, g) => s + getGameStat(g, chartMarket), 0) / tmGames.length;
      const avgMin = tmGames.reduce((s, g) => s + g.minutes, 0) / tmGames.length;

      // If the player's minutes barely change when this teammate is out,
      // the teammate is likely a bench warmer with no real impact
      const minDiff = Math.abs(avgMin - overallAvgMin);
      if (minDiff < 1 && tmGames.length < 8) {
        result.set(tm.player_id, null);
        continue;
      }

      const hitPct = chartLine != null
        ? Math.round((tmGames.filter(g => getGameStat(g, chartMarket) >= chartLine).length / tmGames.length) * 100)
        : null;
      result.set(tm.player_id, { gamesOut: tmGames.length, avgStat, avgMin, hitPct });
    }
    return result;
  }, [teammatesOut, allGames, teammatesOutByGame, chartMarket, chartLine]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modalSheet} onPress={(e) => e.stopPropagation()}>
          <Pressable onPress={onClose} style={s.modalHandle}><View style={s.modalHandleBar} /></Pressable>

          <View style={s.modalHeader}>
            <View style={s.modalHeaderLeft}>
              {sgOppLogo ? <Image source={{ uri: sgOppLogo }} style={s.modalOppLogo} /> : null}
              <Text style={s.modalHeaderTitle}>
                {fmtDateShort(sg.date)} {sg.homeAway === "H" ? "vs" : "@"} {sg.opponentAbbr}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={s.modalClose}>
              <Ionicons name="close" size={20} color={brandColors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={s.modalBodyContent}>
            {isDNP ? (
              <View style={s.dnpBanner}>
                <Ionicons name="information-circle" size={16} color={brandColors.warning} />
                <Text style={s.dnpText}>Did Not Play</Text>
              </View>
            ) : null}

            <View style={s.modalMainRow}>
              <View style={s.modalMainStat}>
                <Text style={[s.modalStatValue, { color: sColor }]}>{sv}</Text>
                <Text style={s.modalStatLabel}>{mktTab(chartMarket)}</Text>
              </View>
              <View style={[s.modalResultBadge, sg.result === "W" ? s.modalResultW : s.modalResultL]}>
                <Text style={[s.modalResultText, sg.result === "W" ? s.modalResultTextW : s.modalResultTextL]}>
                  {sg.result}{sg.margin > 0 ? `+${sg.margin}` : sg.margin}
                </Text>
              </View>
            </View>

            {!isDNP ? (
              <>
                <View style={s.modalDivider} />
                <StatRow label="Minutes" value={String(Math.round(sg.minutes))} />
                <StatRow label="Fouls" value={String(sg.fouls)} />
                <View style={s.modalDivider} />

                {chartMarket === "player_points" ? (
                  <>
                    <StatRow label="FG" value={`${sg.fgm}/${sg.fga} (${Math.round(sg.fgPct * 100)}%)`} />
                    <StatRow label="3PT" value={`${sg.fg3m}/${sg.fg3a} (${Math.round(sg.fg3Pct * 100)}%)`} />
                    <StatRow label="FT" value={`${sg.ftm}/${sg.fta} (${Math.round(sg.ftPct * 100)}%)`} />
                  </>
                ) : null}
                {chartMarket === "player_rebounds" ? (
                  <>
                    <StatRow label="OREB" value={String(sg.oreb)} />
                    <StatRow label="DREB" value={String(sg.dreb)} />
                    <StatRow label="Total REB" value={String(sg.reb)} />
                    <StatRow label="Chances" value={String(sg.potentialReb)} />
                  </>
                ) : null}
                {chartMarket === "player_assists" ? (
                  <>
                    <StatRow label="Assists" value={String(sg.ast)} />
                    <StatRow label="Passes" value={String(sg.passes)} />
                    <StatRow label="Turnovers" value={String(sg.tov)} />
                    <StatRow label="AST/TO" value={sg.tov > 0 ? (sg.ast / sg.tov).toFixed(1) : "\u221E"} />
                    <StatRow label="Pace" value={String(Math.round(sg.pace))} />
                  </>
                ) : null}
                {chartMarket === "player_threes_made" ? (
                  <>
                    <StatRow label="3PT" value={`${sg.fg3m}/${sg.fg3a} (${Math.round(sg.fg3Pct * 100)}%)`} />
                    <StatRow label="FG" value={`${sg.fgm}/${sg.fga} (${Math.round(sg.fgPct * 100)}%)`} />
                  </>
                ) : null}
                {chartMarket === "player_fgm" ? (
                  <>
                    <StatRow label="FG" value={`${sg.fgm}/${sg.fga} (${Math.round(sg.fgPct * 100)}%)`} />
                    <StatRow label="3PT" value={`${sg.fg3m}/${sg.fg3a} (${Math.round(sg.fg3Pct * 100)}%)`} />
                    <StatRow label="FT" value={`${sg.ftm}/${sg.fta} (${Math.round(sg.ftPct * 100)}%)`} />
                  </>
                ) : null}
                {(chartMarket === "player_steals" || chartMarket === "player_blocks" || chartMarket === "player_blocks_steals") ? (
                  <>
                    <StatRow label="Steals" value={String(sg.stl)} />
                    <StatRow label="Blocks" value={String(sg.blk)} />
                    {chartMarket === "player_blocks_steals" ? <StatRow label="Blk+Stl" value={String(sg.bs)} /> : null}
                    <StatRow label="DEF Rating" value={String(Math.round(sg.defRating))} />
                  </>
                ) : null}
                {chartMarket === "player_points_assists" ? (
                  <>
                    <StatRow label="Points" value={String(sg.pts)} />
                    <StatRow label="Assists" value={String(sg.ast)} />
                    <StatRow label="P+A Total" value={String(sg.pa)} />
                  </>
                ) : null}
                {chartMarket === "player_points_rebounds" ? (
                  <>
                    <StatRow label="Points" value={String(sg.pts)} />
                    <StatRow label="Rebounds" value={String(sg.reb)} />
                    <StatRow label="P+R Total" value={String(sg.pr)} />
                  </>
                ) : null}
                {chartMarket === "player_rebounds_assists" ? (
                  <>
                    <StatRow label="Rebounds" value={String(sg.reb)} />
                    <StatRow label="Assists" value={String(sg.ast)} />
                    <StatRow label="R+A Total" value={String(sg.ra)} />
                  </>
                ) : null}
                {chartMarket === "player_points_rebounds_assists" ? (
                  <>
                    <StatRow label="Points" value={String(sg.pts)} />
                    <StatRow label="Rebounds" value={String(sg.reb)} />
                    <StatRow label="Assists" value={String(sg.ast)} />
                    <View style={s.modalDivider} />
                    <StatRow label="PRA Total" value={String(sg.pra)} />
                    <StatRow label="Usage" value={`${Math.round(sg.usagePct * 100)}%`} />
                  </>
                ) : null}
                {chartMarket === "player_turnovers" ? (
                  <>
                    <StatRow label="Turnovers" value={String(sg.tov)} />
                    <StatRow label="Assists" value={String(sg.ast)} />
                    <StatRow label="AST/TO" value={sg.tov > 0 ? (sg.ast / sg.tov).toFixed(1) : "\u221E"} />
                    <StatRow label="Passes" value={String(sg.passes)} />
                    <StatRow label="Usage" value={`${Math.round(sg.usagePct * 100)}%`} />
                  </>
                ) : null}
              </>
            ) : null}

            {teammatesOut.length > 0 ? (() => {
              // Sort: teammates with season stats or impact data first, by games out desc
              const sorted = [...teammatesOut].sort((a, b) => {
                const sa = teammateSeasonStats?.get(a.player_id);
                const sb = teammateSeasonStats?.get(b.player_id);
                const ia = teammateStats.get(a.player_id);
                const ib = teammateStats.get(b.player_id);
                // Prioritize those with season stats
                const aHas = sa || ia;
                const bHas = sb || ib;
                if (aHas && !bHas) return -1;
                if (!aHas && bHas) return 1;
                // Sort by games out (from season stats or impact data)
                const aGames = sa?.games_out ?? ia?.gamesOut ?? 0;
                const bGames = sb?.games_out ?? ib?.gamesOut ?? 0;
                return bGames - aGames;
              });
              // Only show teammates with meaningful data (not bench warmers)
              const relevant = sorted.filter(tm =>
                teammateStats.get(tm.player_id) != null || teammateSeasonStats?.get(tm.player_id) != null
              );
              const display = relevant.length > 0 ? relevant : sorted;
              if (!display.length) return null;
              return (
                <>
                  <View style={s.modalDivider} />
                  <View style={s.tmOutHeader}>
                    <Text style={s.tmOutTitle}>Teammates Out</Text>
                    {display.length < teammatesOut.length ? (
                      <Text style={s.tmOutMore}>+{teammatesOut.length - display.length} bench</Text>
                    ) : null}
                  </View>
                  {display.slice(0, 5).map((tm) => {
                    const sznStats = teammateSeasonStats?.get(tm.player_id);
                    const impactStats = teammateStats.get(tm.player_id);
                    const borderC = injuryBorderColor(tm.reason);
                    const gamesOut = sznStats?.games_out ?? impactStats?.gamesOut ?? null;
                    return (
                      <View key={tm.player_id} style={s.tmOutRow}>
                        <View>
                          <Image
                            source={{ uri: `https://cdn.nba.com/headshots/nba/latest/260x190/${tm.player_id}.png` }}
                            style={[s.tmOutAvatar, { borderColor: borderC }]}
                          />
                          <View style={[s.tmOutDot, { backgroundColor: borderC }]} />
                        </View>
                        <View style={s.tmOutInfo}>
                          <View style={s.tmOutNameRow}>
                            <Text style={s.tmOutName} numberOfLines={1}>{tm.name}</Text>
                            {tm.position ? <Text style={s.tmOutPos}>{tm.position}</Text> : null}
                          </View>
                          {sznStats ? (
                            <View style={s.tmOutStats}>
                              {sznStats.avg_pts != null ? (
                                <Text style={s.tmOutStatItem}>
                                  <Text style={s.tmOutStatVal}>{sznStats.avg_pts.toFixed(1)}</Text>
                                  <Text style={s.tmOutStatLabel}> PTS</Text>
                                </Text>
                              ) : null}
                              {sznStats.avg_reb != null ? (
                                <>
                                  <Text style={s.tmOutStatSep}>·</Text>
                                  <Text style={s.tmOutStatItem}>
                                    <Text style={s.tmOutStatVal}>{sznStats.avg_reb.toFixed(1)}</Text>
                                    <Text style={s.tmOutStatLabel}> REB</Text>
                                  </Text>
                                </>
                              ) : null}
                              {sznStats.avg_ast != null ? (
                                <>
                                  <Text style={s.tmOutStatSep}>·</Text>
                                  <Text style={s.tmOutStatItem}>
                                    <Text style={s.tmOutStatVal}>{sznStats.avg_ast.toFixed(1)}</Text>
                                    <Text style={s.tmOutStatLabel}> AST</Text>
                                  </Text>
                                </>
                              ) : null}
                              {gamesOut != null ? (
                                <Text style={s.tmOutGames}>(missed {gamesOut}g)</Text>
                              ) : null}
                            </View>
                          ) : impactStats ? (
                            <View style={s.tmOutStats}>
                              <Text style={s.tmOutStatItem}>
                                <Text style={s.tmOutStatVal}>{impactStats.avgMin.toFixed(0)}</Text>
                                <Text style={s.tmOutStatLabel}> MIN</Text>
                              </Text>
                              <Text style={s.tmOutStatSep}>·</Text>
                              <Text style={s.tmOutStatItem}>
                                <Text style={s.tmOutStatVal}>{impactStats.avgStat.toFixed(1)}</Text>
                                <Text style={s.tmOutStatLabel}> {mktTab(chartMarket)}</Text>
                              </Text>
                              {gamesOut != null ? (
                                <Text style={s.tmOutGames}>(missed {gamesOut}g)</Text>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </>
              );
            })() : null}

            <View style={s.modalDivider} />
            <StatRow label="Score" value={`${sg.teamScore} - ${sg.opponentScore}`} />
            <View style={s.modalStatRow}>
              <Text style={s.modalLabel}>+/-</Text>
              <Text style={[s.modalVal, { color: sg.plusMinus >= 0 ? brandColors.success : brandColors.error }]}>
                {sg.plusMinus > 0 ? "+" : ""}{sg.plusMinus}
              </Text>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.modalStatRow}>
      <Text style={s.modalLabel}>{label}</Text>
      <Text style={s.modalVal}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: brandColors.panelBackground,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: brandColors.border, maxHeight: "85%"
  },
  modalHandle: { alignItems: "center", paddingTop: 12, paddingBottom: 8 },
  modalHandleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: brandColors.border
  },
  modalHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  modalOppLogo: { width: 24, height: 24, borderRadius: 12 },
  modalHeaderTitle: { color: brandColors.textPrimary, fontSize: 16, fontWeight: "700" },
  modalClose: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  modalBody: { paddingHorizontal: 20 },
  modalBodyContent: { paddingTop: 16, paddingBottom: 60 },
  dnpBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12
  },
  dnpText: { color: brandColors.warning, fontSize: 14, fontWeight: "700" },
  modalMainRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 12
  },
  modalMainStat: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  modalStatValue: { fontSize: 36, fontWeight: "900", letterSpacing: -0.5 },
  modalStatLabel: {
    color: brandColors.textMuted, fontSize: 15, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5
  },
  modalResultBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  modalResultW: { backgroundColor: "rgba(34, 197, 94, 0.15)" },
  modalResultL: { backgroundColor: "rgba(248, 113, 113, 0.15)" },
  modalResultText: { fontSize: 14, fontWeight: "800" },
  modalResultTextW: { color: brandColors.success },
  modalResultTextL: { color: brandColors.error },
  modalDivider: { height: 1, backgroundColor: brandColors.border, marginVertical: 10 },
  modalStatRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8
  },
  modalLabel: { color: brandColors.textMuted, fontSize: 14, fontWeight: "600" },
  modalVal: { color: brandColors.textPrimary, fontSize: 15, fontWeight: "700" },
  tmOutHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  tmOutTitle: {
    color: brandColors.textMuted, fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.8
  },
  tmOutMore: { color: brandColors.warning, fontSize: 10, fontWeight: "600" },
  tmOutRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  tmOutAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: brandColors.panelBackgroundAlt,
    borderWidth: 1.5
  },
  tmOutDot: {
    position: "absolute", bottom: -1, right: -1,
    width: 8, height: 8, borderRadius: 4,
    borderWidth: 1.5, borderColor: brandColors.panelBackground
  },
  tmOutInfo: { flex: 1, gap: 2 },
  tmOutNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tmOutName: { color: brandColors.textSecondary, fontSize: 13, fontWeight: "700", flexShrink: 1 },
  tmOutPos: {
    color: brandColors.textMuted, fontSize: 9, fontWeight: "700",
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 3,
    paddingHorizontal: 4, paddingVertical: 1, overflow: "hidden"
  },
  tmOutStats: { flexDirection: "row", alignItems: "center", gap: 4 },
  tmOutStatItem: { fontSize: 12 },
  tmOutStatVal: { color: brandColors.textPrimary, fontSize: 12, fontWeight: "700" },
  tmOutStatLabel: { color: brandColors.textMuted, fontSize: 10, fontWeight: "600" },
  tmOutStatSep: { color: "rgba(255,255,255,0.15)", fontSize: 10 },
  tmOutGames: { color: brandColors.textMuted, fontSize: 10, fontWeight: "500" }
});
