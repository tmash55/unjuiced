import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Image, Pressable, RefreshControl,
  ScrollView, SafeAreaView, StyleSheet, Text, View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { TeammateOut } from "@unjuiced/api";
import { usePlayerHitRates } from "@/src/hooks/use-player-hit-rates";
import { usePlayerBoxScores } from "@/src/hooks/use-player-box-scores";
import { usePlayerGamesWithInjuries } from "@/src/hooks/use-player-games-with-injuries";
import { usePlayersOutForFilter, type PlayerOutInfo } from "@/src/hooks/use-players-out-for-filter";
import { useTeamRoster } from "@/src/hooks/use-team-roster";
import { useHitRateOdds } from "@/src/hooks/use-hit-rate-odds";
import { useDvpRankings } from "@/src/hooks/use-dvp-rankings";
import { usePlayTypeMatchup } from "@/src/hooks/use-play-type-matchup";
import { getNbaTeamLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";
import {
  type TabId, type ChartPeriod, parseParam, fmtPct, fmtLine, fmtGameTime,
  mktTab, hitColor, getHitRate, getGameStat, matchupColor, streakColor
} from "@/src/components/player/constants";
import { ProfileTabBar } from "@/src/components/player/ProfileTabBar";
import { ChartTab } from "@/src/components/player/ChartTab";
import { ShootingTab } from "@/src/components/player/ShootingTab";
import { PlayTypeTab } from "@/src/components/player/PlayTypeTab";
import { MatchupTab } from "@/src/components/player/MatchupTab";
import { CorrelationTab } from "@/src/components/player/CorrelationTab";
import { StatsTab } from "@/src/components/player/StatsTab";
import { OddsTab } from "@/src/components/player/OddsTab";

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

const MARKET_TO_DVP_RANK: Record<string, string> = {
  player_points: "ptsRank", player_rebounds: "rebRank", player_assists: "astRank",
  player_threes_made: "fg3mRank", player_steals: "stlRank", player_blocks: "blkRank",
  player_turnovers: "tovRank", player_points_rebounds_assists: "praRank",
  player_points_rebounds: "prRank", player_points_assists: "paRank",
  player_rebounds_assists: "raRank", player_blocks_steals: "bsRank",
};

function injuryIconColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "out") return "#EF4444";
  if (s === "doubtful") return "#F97316";
  if (s === "questionable") return "#EAB308";
  return "#6B7280"; // probable, available, etc.
}

export default function PlayerProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; market?: string | string[] }>();
  const playerId = Number(parseParam(params.id));
  const marketParam = parseParam(params.market);

  /* ─── Shared hooks ─── */

  const {
    data: hitRatesData, isLoading: hrLoading, isError: hrError,
    error: hrErrorVal, isRefetching: hrRefetching, refetch: refetchHR
  } = usePlayerHitRates({ playerId, enabled: Number.isFinite(playerId) && playerId > 0, limit: 120 });

  const {
    data: boxData, isLoading: bsLoading, isError: bsError,
    error: bsErrorVal, isRefetching: bsRefetching, refetch: refetchBS
  } = usePlayerBoxScores({ playerId, enabled: Number.isFinite(playerId) && playerId > 0, limit: 82 });

  const { data: injuryData } = usePlayerGamesWithInjuries({
    playerId, enabled: Number.isFinite(playerId) && playerId > 0
  });

  const { data: playersOutData } = usePlayersOutForFilter({
    playerId, enabled: Number.isFinite(playerId) && playerId > 0
  });

  const rows = hitRatesData?.data ?? [];
  const allGames = boxData?.games ?? [];
  const playerInfo = boxData?.player ?? null;
  const seasonSummary = boxData?.seasonSummary ?? null;
  const isRefreshing = hrRefetching || bsRefetching;

  /* ─── Team roster for current injury statuses ─── */
  const { players: rosterPlayers } = useTeamRoster({
    teamId: playerInfo?.teamId ?? null,
    enabled: playerInfo?.teamId != null,
  });

  const rosterInjuryMap = useMemo(() => {
    const map = new Map<number, { status: string | null; notes: string | null }>();
    for (const p of rosterPlayers) {
      map.set(p.playerId, { status: p.injuryStatus, notes: p.injuryNotes });
    }
    return map;
  }, [rosterPlayers]);

  /* ─── Derived state ─── */

  const teammatesOutByGame = useMemo(() => {
    const map = new Map<string, TeammateOut[]>();
    if (!injuryData?.games) return map;
    for (const g of injuryData.games) {
      if (g.game_id && g.teammates_out?.length > 0) {
        const normalized = String(g.game_id).replace(/^0+/, "");
        map.set(normalized, g.teammates_out);
      }
    }
    return map;
  }, [injuryData?.games]);

  const teammateSeasonStats = useMemo(() => {
    const map = new Map<number, PlayerOutInfo>();
    if (!playersOutData?.teammates_out) return map;
    for (const tm of playersOutData.teammates_out) {
      map.set(tm.player_id, tm);
    }
    return map;
  }, [playersOutData?.teammates_out]);

  const marketOptions = useMemo(() => {
    const unique = Array.from(new Set(rows.map((r) => r.market)));
    return unique.sort((a, b) => mktTab(a).localeCompare(mktTab(b)));
  }, [rows]);

  const marketLineMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const r of rows) {
      if (!map.has(r.market)) map.set(r.market, r.line);
    }
    return map;
  }, [rows]);

  const [selectedMarket, setSelectedMarket] = useState<string | null>(marketParam);
  const [activeTab, setActiveTab] = useState<TabId>("chart");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("L10");
  const [filterH2H, setFilterH2H] = useState(false);

  // Reset state when player or market param changes (e.g. navigating from hit-rates list)
  useEffect(() => {
    setActiveTab("chart");
    setChartPeriod("L10");
    setFilterH2H(false);
    if (marketParam) setSelectedMarket(marketParam);
  }, [playerId, marketParam]);

  useEffect(() => {
    if (!marketOptions.length) return;
    if (selectedMarket && marketOptions.includes(selectedMarket)) return;
    setSelectedMarket(marketOptions[0]);
  }, [marketOptions, selectedMarket]);

  const profile = useMemo(() => {
    if (!rows.length) return null;
    if (!selectedMarket) return rows[0];
    return rows.find((r) => r.market === selectedMarket) ?? rows[0];
  }, [rows, selectedMarket]);

  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  useEffect(() => { setSelectedLine(profile?.line ?? null); }, [profile?.market, profile?.line]);

  const stableKey = profile?.odds_selection_id || profile?.sel_key || null;
  const { getOdds, isLoading: oddsLoading, isFetching: oddsFetching } = useHitRateOdds({
    selections: stableKey ? [{ stableKey, line: selectedLine ?? profile?.line ?? undefined }] : [],
    enabled: stableKey != null
  });

  const oddsEntry = getOdds(stableKey);
  const ladderLines = useMemo(() => {
    const lines = oddsEntry?.allLines ?? [];
    return [...lines].sort((a, b) => a.line - b.line);
  }, [oddsEntry?.allLines]);

  const chartLine = selectedLine ?? profile?.line ?? null;
  const chartMarket = profile?.market ?? "player_points";

  const lineHitRatesForSelected = useMemo(() => {
    if (chartLine == null) return null;
    return {
      l5: getHitRate(allGames.slice(0, 5), chartMarket, chartLine),
      l10: getHitRate(allGames.slice(0, 10), chartMarket, chartLine),
      l20: getHitRate(allGames.slice(0, 20), chartMarket, chartLine),
      szn: getHitRate(allGames, chartMarket, chartLine)
    };
  }, [allGames, chartMarket, chartLine]);

  const lineHitRates = useMemo(() => {
    const result = new Map<number, { l5: number | null; l10: number | null; l20: number | null; szn: number | null }>();
    for (const item of ladderLines) {
      result.set(item.line, {
        l5: getHitRate(allGames.slice(0, 5), chartMarket, item.line),
        l10: getHitRate(allGames.slice(0, 10), chartMarket, item.line),
        l20: getHitRate(allGames.slice(0, 20), chartMarket, item.line),
        szn: getHitRate(allGames, chartMarket, item.line)
      });
    }
    return result;
  }, [allGames, chartMarket, ladderLines]);

  // Extract opponent team ID from profile
  const opponentTeamId: number | null = (profile as any)?.opponent_team_id ?? null;
  const normalizedPos = normalizePosition(profile?.nba_players_hr?.depth_chart_pos ?? playerInfo?.position ?? null);

  // DvP rankings for this player's position (all 30 teams)
  const { data: dvpData } = useDvpRankings({
    position: normalizedPos,
    enabled: !!normalizedPos
  });

  // Play type matchup for the upcoming opponent
  const { data: playTypeData } = usePlayTypeMatchup({
    playerId, opponentTeamId, enabled: !!opponentTeamId && Number.isFinite(playerId) && playerId > 0
  });

  // Build opponent abbr -> DvP rank map for the current market
  const dvpRankByTeam = useMemo(() => {
    const map = new Map<string, number>();
    if (!dvpData?.teams) return map;
    const rankField = MARKET_TO_DVP_RANK[chartMarket] ?? "ptsRank";
    for (const team of dvpData.teams) {
      const rank = (team as any)[rankField];
      if (typeof rank === "number" && team.teamAbbr) {
        map.set(team.teamAbbr, rank);
      }
    }
    return map;
  }, [dvpData?.teams, chartMarket]);

  // Top play type for this player (by PPG)
  const topPlayType = useMemo(() => {
    if (!playTypeData?.play_types?.length) return null;
    const sorted = [...playTypeData.play_types]
      .filter(pt => !pt.is_free_throws && pt.player_ppg > 0)
      .sort((a, b) => b.player_ppg - a.player_ppg);
    return sorted[0] ?? null;
  }, [playTypeData?.play_types]);

  async function handleRefresh() {
    await Promise.all([refetchHR(), refetchBS()]);
  }

  /* ─── Invalid player guard ─── */

  if (!Number.isFinite(playerId) || playerId <= 0) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.emptyState}>
          <Ionicons name="alert-circle-outline" size={40} color={brandColors.textMuted} />
          <Text style={s.emptyTitle}>Invalid Player</Text>
          <Pressable onPress={() => router.replace("/props")} style={s.primaryBtn}>
            <Text style={s.primaryBtnText}>Back to Props</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ─── Header data ─── */

  const playerName = profile
    ? profile.player_name || profile.nba_players_hr?.name || playerInfo?.name || "Unknown"
    : playerInfo?.name || "Loading...";
  const teamAbbr = profile?.team_abbr ?? playerInfo?.teamAbbr ?? null;
  const oppAbbr = profile?.opponent_team_abbr ?? null;
  const homeAway = profile?.home_away === "H" ? "vs" : profile?.home_away === "A" ? "@" : "vs";
  const position = profile?.nba_players_hr?.depth_chart_pos ?? playerInfo?.position ?? null;
  const gameTime = (profile as any)?.nba_games_hr?.start_time ?? (profile as any)?.nba_games_hr?.game_status ?? null;

  const teamColorsData = (profile as any)?.nba_teams ?? null;
  const rawPrimary = teamColorsData?.primary_color ?? null;
  const rawSecondary = teamColorsData?.secondary_color ?? null;
  const primaryColor = rawPrimary ? (rawPrimary.startsWith("#") ? rawPrimary : `#${rawPrimary}`) : null;
  const secondaryColor = rawSecondary ? (rawSecondary.startsWith("#") ? rawSecondary : `#${rawSecondary}`) : null;

  return (
    <SafeAreaView style={s.container}>
      {/* ─── Sticky Header ─── */}
      <View style={s.stickyHeader}>
        {/* Team color gradient */}
        {primaryColor ? (
          <LinearGradient
            colors={[
              `${primaryColor}30`,
              `${primaryColor}18`,
              `${brandColors.appBackground}F0`,
              brandColors.appBackground
            ]}
            locations={[0, 0.3, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={s.gradientOverlay}
            pointerEvents="none"
          />
        ) : null}
        <View style={s.gradientEdge} pointerEvents="none" />

        {/* Top Nav Row */}
        <View style={s.topNav}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.navBack}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => void handleRefresh()} hitSlop={12} style={s.navRefresh} disabled={isRefreshing}>
            <Ionicons name="refresh" size={17} color={isRefreshing ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)"} />
          </Pressable>
        </View>

        {/* Player Card */}
        <View style={s.playerCard}>
          {profile?.hit_streak != null && profile.hit_streak >= 3 ? (
            <View style={[s.streakRing, {
              borderColor: streakColor(profile.hit_streak),
              shadowColor: streakColor(profile.hit_streak),
            }]}>
              <Image
                source={{ uri: `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png` }}
                style={s.playerHeadshotStreak}
              />
              <View style={[s.streakBadge, { backgroundColor: streakColor(profile.hit_streak) }]}>
                <Ionicons name="flame" size={10} color="#FFFFFF" />
                <Text style={s.streakBadgeText}>{profile.hit_streak}</Text>
              </View>
            </View>
          ) : (
            <Image
              source={{ uri: `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png` }}
              style={s.playerHeadshot}
            />
          )}
          <View style={s.playerCardInfo}>
            <View style={s.playerNameRow}>
              <Text style={s.playerCardName} numberOfLines={1}>{playerName}</Text>
              {playerInfo?.injuryStatus ? (
                <Ionicons
                  name="heart"
                  size={14}
                  color={injuryIconColor(playerInfo.injuryStatus)}
                />
              ) : null}
            </View>
            <View style={s.playerCardMetaRow}>
              {teamAbbr ? <Image source={{ uri: getNbaTeamLogoUrl(teamAbbr) ?? "" }} style={s.playerCardTeamLogo} /> : null}
              <Text style={s.playerCardMeta} numberOfLines={1}>
                {position ?? ""}{position ? " · " : ""}{oppAbbr ? `${homeAway} ${oppAbbr}` : teamAbbr ?? ""}
              </Text>
              {profile?.matchup?.matchup_rank != null ? (
                <View style={[s.dvpBadge, { backgroundColor: `${matchupColor(profile.matchup.matchup_quality ?? "")}15` }]}>
                  <Text style={[s.dvpBadgeText, { color: matchupColor(profile.matchup.matchup_quality ?? "") }]}>
                    #{profile.matchup.matchup_rank} DVP
                  </Text>
                </View>
              ) : null}
            </View>
            {gameTime ? <Text style={s.playerCardTime}>{fmtGameTime(gameTime)}</Text> : null}
          </View>
        </View>

        {/* Hit Rate Percentages Row (tap to switch chart period) */}
        {profile ? (
          <View style={s.headerHitRates}>
            {[
              { label: "L5" as ChartPeriod, pct: lineHitRatesForSelected?.l5 ?? profile.last_5_pct },
              { label: "L10" as ChartPeriod, pct: lineHitRatesForSelected?.l10 ?? profile.last_10_pct },
              { label: "L20" as ChartPeriod, pct: lineHitRatesForSelected?.l20 ?? profile.last_20_pct },
              { label: "SZN" as ChartPeriod, pct: lineHitRatesForSelected?.szn ?? profile.season_pct },
            ].map((item, idx, arr) => {
              const isActive = item.label === chartPeriod;
              return (
                <Pressable
                  key={item.label}
                  onPress={() => setChartPeriod(item.label)}
                  style={[s.headerHitItem, isActive && s.headerHitItemActive]}
                >
                  <Text style={[s.headerHitLabel, isActive && s.headerHitLabelActive]}>{item.label}</Text>
                  <Text style={[s.headerHitValue, { color: hitColor(item.pct) }]}>{fmtPct(item.pct)}</Text>
                  {idx < arr.length - 1 ? <View style={s.headerHitDivider} /> : null}
                </Pressable>
              );
            })}
            {(profile as any).h2h_pct != null ? (
              <Pressable
                onPress={() => setFilterH2H(!filterH2H)}
                style={[s.headerHitItem, filterH2H && s.headerHitItemActive]}
              >
                <Text style={[s.headerHitLabel, filterH2H && s.headerHitLabelActive]}>H2H</Text>
                <Text style={[s.headerHitValue, { color: hitColor((profile as any).h2h_pct) }]}>{fmtPct((profile as any).h2h_pct)}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Market Pill Bar */}
        {marketOptions.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.pillBar}
          >
            {marketOptions.map((m) => {
              const active = m === selectedMarket;
              const line = marketLineMap.get(m);
              const label = line != null ? `${mktTab(m)} ${fmtLine(line)}` : mktTab(m);
              return (
                <Pressable key={m} onPress={() => setSelectedMarket(m)} style={[s.pill, active && s.pillActive]}>
                  <Text style={[s.pillText, active && s.pillTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Tab Bar */}
        <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </View>

      {/* ─── Scrollable Content ─── */}
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor={brandColors.primary} />
        }
      >
        {/* Loading / Error */}
        {hrLoading ? (
          <View style={s.emptyState}>
            <ActivityIndicator size="small" color={brandColors.primary} />
            <Text style={s.emptyText}>Loading profile...</Text>
          </View>
        ) : null}

        {hrError ? (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Unable to load</Text>
            <Text style={s.errorText}>{hrErrorVal instanceof Error ? hrErrorVal.message : "Unexpected error"}</Text>
          </View>
        ) : null}

        {profile ? (
          <>
            {activeTab === "chart" ? (
              <ChartTab
                profile={profile}
                chartMarket={chartMarket}
                chartLine={chartLine}
                selectedLine={selectedLine}
                allGames={allGames}
                seasonSummary={seasonSummary}
                playerInfo={playerInfo}
                teammatesOutByGame={teammatesOutByGame}
                teammateSeasonStats={teammateSeasonStats}
                rosterInjuryMap={rosterInjuryMap}
                dvpRankByTeam={dvpRankByTeam}
                topPlayType={topPlayType}
                lineHitRatesForSelected={lineHitRatesForSelected}
                bsLoading={bsLoading}
                chartPeriod={chartPeriod}
                onChartPeriodChange={setChartPeriod}
                bestOverPrice={oddsEntry?.bestOver?.price ?? null}
                oppAbbr={oppAbbr}
                homeAway={profile?.home_away === "H" ? "H" : profile?.home_away === "A" ? "A" : null}
                filterH2H={filterH2H}
                onFilterH2HChange={setFilterH2H}
                onLineChange={setSelectedLine}
              />
            ) : null}

            {activeTab === "shooting" ? (
              <ShootingTab
                playerId={playerId}
                opponentTeamId={opponentTeamId}
                oppAbbr={oppAbbr}
              />
            ) : null}

            {activeTab === "playtypes" ? (
              <PlayTypeTab
                playerId={playerId}
                opponentTeamId={opponentTeamId}
                oppAbbr={oppAbbr}
              />
            ) : null}

            {activeTab === "matchup" ? (
              <MatchupTab
                opponentTeamId={opponentTeamId}
                playerPosition={position}
                oppAbbr={oppAbbr}
                chartMarket={chartMarket}
              />
            ) : null}

            {activeTab === "correlation" ? (
              <CorrelationTab
                playerId={playerId}
                chartMarket={chartMarket}
                chartLine={chartLine}
              />
            ) : null}

            {activeTab === "stats" ? (
              <StatsTab
                allGames={allGames}
                chartMarket={chartMarket}
                chartLine={chartLine}
              />
            ) : null}

            {activeTab === "odds" ? (
              <OddsTab
                ladderLines={ladderLines}
                lineHitRates={lineHitRates}
                chartLine={chartLine}
                onSelectLine={setSelectedLine}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Styles ─── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.appBackground },
  scroll: { paddingBottom: 32 },

  /* sticky header */
  stickyHeader: { position: "relative", overflow: "hidden", zIndex: 10, paddingBottom: 4 },
  gradientOverlay: { ...StyleSheet.absoluteFillObject },
  gradientEdge: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 1,
    backgroundColor: "rgba(255,255,255,0.04)"
  },

  /* top nav */
  topNav: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingTop: 4, paddingBottom: 2, zIndex: 2
  },
  navBack: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center"
  },
  navRefresh: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center"
  },

  /* player card */
  playerCard: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 14, zIndex: 2
  },
  playerHeadshot: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.10)"
  },
  playerHeadshotStreak: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  streakRing: {
    position: "relative", borderRadius: 32, borderWidth: 2,
    borderColor: "#F59E0B", padding: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 8
  },
  streakBadge: {
    position: "absolute", bottom: -4, right: -4,
    flexDirection: "row", alignItems: "center", gap: 1,
    borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1, zIndex: 2
  },
  streakBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  playerCardInfo: { flex: 1, gap: 3 },
  playerNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  playerCardName: { color: "#E5E7EB", fontSize: 19, fontWeight: "700", letterSpacing: -0.3, flexShrink: 1 },
  playerCardMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  playerCardTeamLogo: { width: 16, height: 16, borderRadius: 8 },
  playerCardMeta: { color: "rgba(255,255,255,0.50)", fontSize: 13, fontWeight: "500" },
  dvpBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  dvpBadgeText: { fontSize: 11, fontWeight: "700" },
  playerCardTime: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "500" },

  /* header hit rates */
  headerHitRates: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 8, paddingBottom: 6, gap: 0, zIndex: 2
  },
  headerHitItem: {
    flexDirection: "row", alignItems: "center", gap: 2,
    paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6,
    borderWidth: 1, borderColor: "transparent"
  },
  headerHitItemActive: {
    borderColor: "rgba(34, 197, 94, 0.35)",
    backgroundColor: "rgba(34, 197, 94, 0.06)"
  },
  headerHitLabel: { color: "rgba(255,255,255,0.40)", fontSize: 11, fontWeight: "600" },
  headerHitLabelActive: { color: "rgba(34, 197, 94, 0.7)" },
  headerHitValue: { fontSize: 13, fontWeight: "800" },
  headerHitDivider: { width: 1, height: 12, backgroundColor: "rgba(255,255,255,0.08)", marginLeft: 2 },

  /* market pill bar */
  pillBar: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 10, gap: 8, zIndex: 2 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)"
  },
  pillActive: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  pillText: { color: "rgba(255,255,255,0.50)", fontSize: 13, fontWeight: "600" },
  pillTextActive: { color: "#FFFFFF" },

  /* empty / error */
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  emptyTitle: { color: brandColors.textPrimary, fontSize: 18, fontWeight: "700" },
  emptyText: { color: brandColors.textMuted, fontSize: 13, textAlign: "center" },
  errorCard: {
    marginHorizontal: 16, borderRadius: 12, borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.4)",
    backgroundColor: "rgba(127, 29, 29, 0.2)",
    padding: 12, gap: 4
  },
  errorTitle: { color: "#FCA5A5", fontSize: 15, fontWeight: "700" },
  errorText: { color: "#FECACA", fontSize: 12 },
  primaryBtn: { borderRadius: 10, backgroundColor: brandColors.primaryStrong, paddingHorizontal: 16, paddingVertical: 10 },
  primaryBtnText: { color: "#EAF8FF", fontSize: 14, fontWeight: "700" }
});
