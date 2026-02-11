import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { HitRateProfileV2, PlayerBoxScoreGame } from "@unjuiced/types";
import { usePlayerHitRates } from "@/src/hooks/use-player-hit-rates";
import { usePlayerBoxScores } from "@/src/hooks/use-player-box-scores";
import { useHitRateOdds } from "@/src/hooks/use-hit-rate-odds";
import { getNbaTeamLogoUrl, getSportsbookLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";

const MARKET_LABELS: Record<string, string> = {
  player_points: "Points",
  player_rebounds: "Rebounds",
  player_assists: "Assists",
  player_points_rebounds_assists: "PRA",
  player_points_rebounds: "P+R",
  player_points_assists: "P+A",
  player_rebounds_assists: "R+A",
  player_threes_made: "3PM",
  player_steals: "Steals",
  player_blocks: "Blocks",
  player_turnovers: "Turnovers",
  player_blocks_steals: "B+S"
};

const CHART_HEIGHT = 150;
const CHART_LIMIT = 10;
const RECENT_GAMES_LIMIT = 12;

function parseParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${Math.round(value)}%`;
}

function formatLine(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatOdds(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return value > 0 ? `+${value}` : String(value);
}

function marketLabel(market: string): string {
  return MARKET_LABELS[market] ?? market.replace("player_", "").replace(/_/g, " ");
}

function subtitleForRow(row: HitRateProfileV2): string {
  const team = row.team_abbr || "--";
  const opp = row.opponent_team_abbr || "--";
  const homeAway = row.home_away === "H" ? "vs" : row.home_away === "A" ? "@" : "vs";
  return `${team} ${homeAway} ${opp}`;
}

function playerNameForRow(row: HitRateProfileV2): string {
  return row.player_name || row.nba_players_hr?.name || "Unknown Player";
}

function formatGameDate(value: string): string {
  const dt = new Date(value);
  if (!Number.isFinite(dt.getTime())) return value;
  return dt.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric"
  });
}

function getGameStat(game: PlayerBoxScoreGame, market: string): number {
  switch (market) {
    case "player_points":
      return game.pts;
    case "player_rebounds":
      return game.reb;
    case "player_assists":
      return game.ast;
    case "player_threes_made":
      return game.fg3m;
    case "player_steals":
      return game.stl;
    case "player_blocks":
      return game.blk;
    case "player_turnovers":
      return game.tov;
    case "player_points_rebounds_assists":
      return game.pra;
    case "player_points_rebounds":
      return game.pr;
    case "player_points_assists":
      return game.pa;
    case "player_rebounds_assists":
      return game.ra;
    case "player_blocks_steals":
      return game.bs;
    default:
      return game.pts;
  }
}

function getHitRate(games: PlayerBoxScoreGame[], market: string, line: number | null): number | null {
  if (!games.length || line == null || !Number.isFinite(line)) return null;
  const hits = games.filter((game) => getGameStat(game, market) >= line).length;
  return Math.round((hits / games.length) * 100);
}

export default function PlayerHitRateDrilldownScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; market?: string | string[] }>();
  const playerIdParam = parseParam(params.id);
  const marketParam = parseParam(params.market);
  const playerId = Number(playerIdParam);

  const {
    data: hitRatesData,
    isLoading: hitRatesLoading,
    isError: hitRatesError,
    error: hitRatesErrorValue,
    isRefetching: hitRatesRefetching,
    refetch: refetchHitRates
  } = usePlayerHitRates({
    playerId,
    enabled: Number.isFinite(playerId) && playerId > 0,
    limit: 120
  });

  const {
    data: boxScoresData,
    isLoading: boxScoresLoading,
    isError: boxScoresError,
    error: boxScoresErrorValue,
    isRefetching: boxScoresRefetching,
    refetch: refetchBoxScores
  } = usePlayerBoxScores({
    playerId,
    enabled: Number.isFinite(playerId) && playerId > 0,
    limit: 25
  });

  const rows = hitRatesData?.data ?? [];
  const allGames = boxScoresData?.games ?? [];
  const isRefreshing = hitRatesRefetching || boxScoresRefetching;

  const marketOptions = useMemo(() => {
    const unique = Array.from(new Set(rows.map((row) => row.market)));
    return unique.sort((a, b) => marketLabel(a).localeCompare(marketLabel(b)));
  }, [rows]);

  const [selectedMarket, setSelectedMarket] = useState<string | null>(marketParam);

  useEffect(() => {
    if (!marketParam) return;
    setSelectedMarket(marketParam);
  }, [marketParam]);

  useEffect(() => {
    if (!marketOptions.length) return;
    if (selectedMarket && marketOptions.includes(selectedMarket)) return;
    setSelectedMarket(marketOptions[0]);
  }, [marketOptions, selectedMarket]);

  const profile = useMemo(() => {
    if (!rows.length) return null;
    if (!selectedMarket) return rows[0];
    return rows.find((row) => row.market === selectedMarket) ?? rows[0];
  }, [rows, selectedMarket]);

  const [selectedLine, setSelectedLine] = useState<number | null>(null);

  useEffect(() => {
    setSelectedLine(profile?.line ?? null);
  }, [profile?.market, profile?.line]);

  const stableKey = profile ? profile.odds_selection_id || profile.sel_key || null : null;

  const {
    getOdds,
    isLoading: oddsLoading,
    isFetching: oddsFetching
  } = useHitRateOdds({
    selections:
      stableKey != null
        ? [
            {
              stableKey,
              line: selectedLine ?? profile?.line ?? undefined
            }
          ]
        : [],
    enabled: stableKey != null
  });

  const oddsEntry = getOdds(stableKey);
  const ladderLines = useMemo(() => {
    const lines = oddsEntry?.allLines ?? [];
    return [...lines].sort((a, b) => a.line - b.line);
  }, [oddsEntry?.allLines]);

  const chartGames = useMemo(() => allGames.slice(0, CHART_LIMIT).reverse(), [allGames]);
  const recentGames = useMemo(() => allGames.slice(0, RECENT_GAMES_LIMIT), [allGames]);

  const chartLine = selectedLine ?? profile?.line ?? null;
  const chartMarket = profile?.market ?? "player_points";
  const chartValues = useMemo(
    () => chartGames.map((game) => getGameStat(game, chartMarket)),
    [chartGames, chartMarket]
  );

  const chartMax = useMemo(() => {
    const maxValue = Math.max(1, ...chartValues, chartLine ?? 0);
    return maxValue;
  }, [chartLine, chartValues]);

  const lineY = useMemo(() => {
    if (chartLine == null || !Number.isFinite(chartLine)) return null;
    return (chartLine / chartMax) * CHART_HEIGHT;
  }, [chartLine, chartMax]);

  const hitRateL10 = useMemo(
    () => getHitRate(chartGames, chartMarket, chartLine),
    [chartGames, chartLine, chartMarket]
  );

  const lineHitRates = useMemo(() => {
    const lines = ladderLines.map((item) => item.line);
    const result = new Map<number, { l5: number | null; l10: number | null; l20: number | null; szn: number | null }>();

    for (const line of lines) {
      result.set(line, {
        l5: getHitRate(allGames.slice(0, 5), chartMarket, line),
        l10: getHitRate(allGames.slice(0, 10), chartMarket, line),
        l20: getHitRate(allGames.slice(0, 20), chartMarket, line),
        szn: getHitRate(allGames, chartMarket, line)
      });
    }

    return result;
  }, [allGames, chartMarket, ladderLines]);

  async function handleRefresh() {
    await Promise.all([refetchHitRates(), refetchBoxScores()]);
  }

  if (!Number.isFinite(playerId) || playerId <= 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Invalid player</Text>
          <Text style={styles.stateText}>The selected player id is not valid.</Text>
          <Pressable onPress={() => router.replace("/hit-rates")} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Back to Hit Rates</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor={brandColors.primary} />
        }
      >
        <View style={styles.topRow}>
          <Pressable onPress={() => router.replace("/hit-rates")} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color={brandColors.textPrimary} />
            <Text style={styles.backButtonText}>Hit Rates</Text>
          </Pressable>
          <Pressable onPress={() => void handleRefresh()} style={styles.refreshButton} disabled={isRefreshing}>
            <Text style={styles.refreshButtonText}>{isRefreshing ? "Refreshing..." : "Refresh"}</Text>
          </Pressable>
        </View>

        {hitRatesLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={brandColors.primary} />
            <Text style={styles.stateText}>Loading player profile...</Text>
          </View>
        ) : null}

        {hitRatesError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load player profile</Text>
            <Text style={styles.errorText}>{hitRatesErrorValue instanceof Error ? hitRatesErrorValue.message : "Unexpected error"}</Text>
          </View>
        ) : null}

        {!hitRatesLoading && !hitRatesError && !profile ? (
          <View style={styles.centerState}>
            <Text style={styles.stateTitle}>No data found</Text>
            <Text style={styles.stateText}>No hit-rate data is available for this player right now.</Text>
          </View>
        ) : null}

        {profile ? (
          <View style={styles.card}>
            <Text style={styles.playerName}>{playerNameForRow(profile)}</Text>
            <Text style={styles.playerSubtitle}>{subtitleForRow(profile)}</Text>

            <View style={styles.logoRow}>
              {getNbaTeamLogoUrl(profile.team_abbr) ? (
                <Image source={{ uri: getNbaTeamLogoUrl(profile.team_abbr)! }} style={styles.teamLogo} />
              ) : null}
              <Text style={styles.vsText}>vs</Text>
              {getNbaTeamLogoUrl(profile.opponent_team_abbr) ? (
                <Image source={{ uri: getNbaTeamLogoUrl(profile.opponent_team_abbr)! }} style={styles.teamLogo} />
              ) : null}
            </View>

            <Text style={styles.sectionLabel}>Markets</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.marketRow}>
              {marketOptions.map((market) => {
                const active = market === profile.market;
                return (
                  <Pressable
                    key={market}
                    onPress={() => setSelectedMarket(market)}
                    style={[styles.marketChip, active && styles.marketChipActive]}
                  >
                    <Text style={[styles.marketChipText, active && styles.marketChipTextActive]}>
                      {marketLabel(market)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.lineBadge}>
              <Text style={styles.lineBadgeText}>
                {marketLabel(profile.market)} {formatLine(chartLine)}
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statLabel}>L5</Text>
                <Text style={styles.statValue}>{formatPercent(profile.last_5_pct)}</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statLabel}>L10</Text>
                <Text style={styles.statValue}>{formatPercent(profile.last_10_pct)}</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statLabel}>L20</Text>
                <Text style={styles.statValue}>{formatPercent(profile.last_20_pct)}</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statLabel}>SZN</Text>
                <Text style={styles.statValue}>{formatPercent(profile.season_pct)}</Text>
              </View>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.oddsRow}>
                {profile.best_odds?.book && getSportsbookLogoUrl(profile.best_odds.book) ? (
                  <Image source={{ uri: getSportsbookLogoUrl(profile.best_odds.book)! }} style={styles.bookLogo} />
                ) : null}
                <Text style={styles.footerText}>
                  Best Odds: {profile.best_odds?.book ?? "--"} {formatOdds(profile.best_odds?.price)}
                </Text>
              </View>
              <Text style={styles.footerText}>DvP: {profile.matchup?.rank_label ?? "--"}</Text>
            </View>
          </View>
        ) : null}

        {profile ? (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Odds Ladder</Text>
              <Text style={styles.sectionSubtitle}>
                {oddsLoading || oddsFetching ? "Loading..." : `${ladderLines.length} lines`}
              </Text>
            </View>

            {!stableKey ? (
              <Text style={styles.stateText}>No odds key available for this market.</Text>
            ) : null}

            {stableKey && !oddsLoading && !oddsFetching && ladderLines.length === 0 ? (
              <Text style={styles.stateText}>No ladder odds available right now.</Text>
            ) : null}

            {ladderLines.map((lineItem) => {
              const isActive = chartLine != null && lineItem.line === chartLine;
              const rates = lineHitRates.get(lineItem.line) ?? {
                l5: null,
                l10: null,
                l20: null,
                szn: null
              };
              const overLogo = lineItem.bestOver?.book ? getSportsbookLogoUrl(lineItem.bestOver.book) : null;
              const underLogo = lineItem.bestUnder?.book ? getSportsbookLogoUrl(lineItem.bestUnder.book) : null;

              return (
                <Pressable
                  key={`ladder-${lineItem.line}`}
                  onPress={() => setSelectedLine(lineItem.line)}
                  style={[styles.ladderRow, isActive && styles.ladderRowActive]}
                >
                  <View style={styles.ladderTopRow}>
                    <View style={styles.ladderLineBlock}>
                      <Text style={styles.ladderLineLabel}>Line</Text>
                      <Text style={[styles.ladderLineValue, isActive && styles.ladderLineValueActive]}>
                        {formatLine(lineItem.line)}
                      </Text>
                    </View>

                    <View style={styles.ladderOddsGroup}>
                      <View style={styles.ladderOddsChip}>
                        <Text style={styles.ladderOddsSide}>O</Text>
                        {overLogo ? <Image source={{ uri: overLogo }} style={styles.ladderBookLogo} /> : null}
                        <Text style={styles.ladderOddsText}>
                          {lineItem.bestOver?.book ? `${lineItem.bestOver.book} ${formatOdds(lineItem.bestOver.price)}` : "--"}
                        </Text>
                      </View>

                      <View style={styles.ladderOddsChip}>
                        <Text style={styles.ladderOddsSide}>U</Text>
                        {underLogo ? <Image source={{ uri: underLogo }} style={styles.ladderBookLogo} /> : null}
                        <Text style={styles.ladderOddsText}>
                          {lineItem.bestUnder?.book ? `${lineItem.bestUnder.book} ${formatOdds(lineItem.bestUnder.price)}` : "--"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.ladderRatesRow}>
                    <Text style={styles.ladderRateCell}>L5 {formatPercent(rates.l5)}</Text>
                    <Text style={styles.ladderRateCell}>L10 {formatPercent(rates.l10)}</Text>
                    <Text style={styles.ladderRateCell}>L20 {formatPercent(rates.l20)}</Text>
                    <Text style={styles.ladderRateCell}>SZN {formatPercent(rates.szn)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {profile ? (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Game Log Chart</Text>
              <Text style={styles.sectionSubtitle}>
                {hitRateL10 == null ? "L10 hit: --" : `L10 hit: ${hitRateL10}%`}
              </Text>
            </View>

            {boxScoresError ? (
              <View style={styles.errorInline}>
                <Text style={styles.errorText}>
                  {boxScoresErrorValue instanceof Error
                    ? boxScoresErrorValue.message
                    : "Unable to load box scores"}
                </Text>
              </View>
            ) : null}

            {boxScoresLoading && !allGames.length ? (
              <View style={styles.chartLoading}>
                <ActivityIndicator size="small" color={brandColors.primary} />
                <Text style={styles.stateText}>Loading game logs...</Text>
              </View>
            ) : null}

            {!boxScoresLoading && chartGames.length === 0 ? (
              <View style={styles.chartLoading}>
                <Text style={styles.stateText}>No recent games available.</Text>
              </View>
            ) : null}

            {chartGames.length > 0 ? (
              <View style={styles.chartCard}>
                <View style={[styles.chartViewport, { height: CHART_HEIGHT + 22 }]}>
                  {lineY != null ? (
                    <View style={[styles.chartLine, { bottom: lineY + 10 }]}>
                      <Text style={styles.chartLineLabel}>Line {formatLine(chartLine)}</Text>
                    </View>
                  ) : null}

                  <View style={[styles.chartBarsRow, { height: CHART_HEIGHT }]}>
                    {chartGames.map((game) => {
                      const value = getGameStat(game, chartMarket);
                      const barHeight = Math.max(6, (value / chartMax) * CHART_HEIGHT);
                      const isHit = chartLine == null ? null : value >= chartLine;

                      return (
                        <View key={game.gameId} style={styles.chartBarCol}>
                          <Text style={styles.chartValue}>{value}</Text>
                          <View
                            style={[
                              styles.chartBar,
                              {
                                height: barHeight,
                                backgroundColor:
                                  isHit == null
                                    ? brandColors.primaryStrong
                                    : isHit
                                      ? brandColors.success
                                      : brandColors.error
                              }
                            ]}
                          />
                          <Text style={styles.chartXAxis}>
                            {game.homeAway === "H" ? "vs" : "@"} {game.opponentAbbr}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.chartLegendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: brandColors.success }]} />
                    <Text style={styles.legendText}>Hit</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: brandColors.error }]} />
                    <Text style={styles.legendText}>Miss</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={styles.legendLine} />
                    <Text style={styles.legendText}>Projection Line</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {profile ? (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Games</Text>
              <Text style={styles.sectionSubtitle}>{recentGames.length} rows</Text>
            </View>

            {!recentGames.length ? (
              <Text style={styles.stateText}>No recent game rows available.</Text>
            ) : null}

            {recentGames.map((game) => {
              const value = getGameStat(game, chartMarket);
              const isHit = chartLine == null ? null : value >= chartLine;

              return (
                <View key={`${game.gameId}-row`} style={styles.gameRow}>
                  <View style={styles.gameRowLeft}>
                    <Text style={styles.gameDate}>{formatGameDate(game.date)}</Text>
                    <Text style={styles.gameMeta}>
                      {game.homeAway === "H" ? "vs" : "@"} {game.opponentAbbr} • {game.result}
                      {game.margin > 0 ? ` +${game.margin}` : ` ${game.margin}`}
                    </Text>
                  </View>
                  <View style={styles.gameRowRight}>
                    <Text style={styles.gameMinutes}>{Math.round(game.minutes)}m</Text>
                    <Text style={[styles.gameValue, isHit == null ? undefined : isHit ? styles.hitValue : styles.missValue]}>
                      {value}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {profile ? <Text style={styles.metaText}>Profiles loaded: {rows.length}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: brandColors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  backButtonText: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "700"
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: brandColors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  refreshButtonText: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "700"
  },
  centerState: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  stateTitle: {
    color: brandColors.textPrimary,
    fontSize: 18,
    fontWeight: "700"
  },
  stateText: {
    color: brandColors.textSecondary,
    fontSize: 14,
    textAlign: "center"
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    padding: 14,
    gap: 12
  },
  playerName: {
    color: brandColors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  playerSubtitle: {
    color: brandColors.textSecondary,
    fontSize: 15
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  teamLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#0A0F1B"
  },
  vsText: {
    color: brandColors.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: "700"
  },
  sectionLabel: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  marketRow: {
    gap: 8
  },
  marketChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: brandColors.borderStrong,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  marketChipActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  marketChipText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "700"
  },
  marketChipTextActive: {
    color: brandColors.primary
  },
  lineBadge: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brandColors.borderStrong,
    backgroundColor: brandColors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignSelf: "flex-start"
  },
  lineBadgeText: {
    color: brandColors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statChip: {
    minWidth: 70,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  statLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  statValue: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "700"
  },
  footerRow: {
    gap: 8
  },
  oddsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  bookLogo: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#0A0F1B"
  },
  footerText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "600"
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    color: brandColors.textPrimary,
    fontSize: 18,
    fontWeight: "800"
  },
  sectionSubtitle: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "600"
  },
  chartLoading: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 12,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  chartCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    padding: 10,
    gap: 8
  },
  chartViewport: {
    position: "relative"
  },
  chartLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: brandColors.warning,
    borderStyle: "dashed",
    zIndex: 2
  },
  chartLineLabel: {
    position: "absolute",
    right: 0,
    top: -18,
    color: brandColors.warning,
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 6
  },
  chartBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    paddingTop: 10
  },
  chartBarCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4
  },
  chartValue: {
    color: brandColors.textSecondary,
    fontSize: 10,
    fontWeight: "700"
  },
  chartBar: {
    width: "100%",
    borderRadius: 6,
    minHeight: 6
  },
  chartXAxis: {
    color: brandColors.textMuted,
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center"
  },
  chartLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap"
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendLine: {
    width: 12,
    borderTopWidth: 1,
    borderTopColor: brandColors.warning,
    borderStyle: "dashed"
  },
  legendText: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "600"
  },
  ladderRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6
  },
  ladderRowActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  ladderTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  ladderLineBlock: {
    minWidth: 48
  },
  ladderLineLabel: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7
  },
  ladderLineValue: {
    color: brandColors.textPrimary,
    fontSize: 18,
    fontWeight: "800"
  },
  ladderLineValueActive: {
    color: brandColors.primary
  },
  ladderOddsGroup: {
    flex: 1,
    gap: 4
  },
  ladderOddsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  ladderOddsSide: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    width: 12
  },
  ladderBookLogo: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#0A0F1B"
  },
  ladderOddsText: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "600"
  },
  ladderRatesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  ladderRateCell: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    flex: 1
  },
  gameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  gameRowLeft: {
    flex: 1
  },
  gameDate: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "700"
  },
  gameMeta: {
    color: brandColors.textSecondary,
    fontSize: 12
  },
  gameRowRight: {
    alignItems: "flex-end",
    gap: 2
  },
  gameMinutes: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "600"
  },
  gameValue: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "800"
  },
  hitValue: {
    color: brandColors.success
  },
  missValue: {
    color: brandColors.error
  },
  metaText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.5)",
    backgroundColor: "rgba(127, 29, 29, 0.25)",
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 6
  },
  errorTitle: {
    color: "#FCA5A5",
    fontSize: 16,
    fontWeight: "700"
  },
  errorText: {
    color: "#FECACA",
    fontSize: 13
  },
  errorInline: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.4)",
    backgroundColor: "rgba(127, 29, 29, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: brandColors.primaryStrong,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  primaryButtonText: {
    color: "#EAF8FF",
    fontSize: 15,
    fontWeight: "700"
  }
});
