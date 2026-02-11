import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useRouter } from "expo-router";
import type { HitRateSortField, HitRateProfileV2 } from "@unjuiced/types";
import { useHitRates } from "@/src/hooks/use-hit-rates";
import { useHitRateOdds } from "@/src/hooks/use-hit-rate-odds";
import { getNbaTeamLogoUrl, getSportsbookLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";
import type { HitRateOddsSelection } from "@unjuiced/api";

const MARKET_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "player_points", label: "Points" },
  { id: "player_rebounds", label: "Rebounds" },
  { id: "player_assists", label: "Assists" },
  { id: "player_points_rebounds_assists", label: "PRA" },
  { id: "player_points_rebounds", label: "P+R" },
  { id: "player_points_assists", label: "P+A" }
];

const MIN_HIT_OPTIONS = [0, 50, 55, 60, 65, 70];

const SORT_OPTIONS: Array<{ field: HitRateSortField; label: string }> = [
  { field: "l10Pct", label: "L10%" },
  { field: "l5Pct", label: "L5%" },
  { field: "seasonPct", label: "Season%" },
  { field: "line", label: "Line" },
  { field: "matchupRank", label: "DvP" }
];

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${Math.round(value)}%`;
}

function formatOdds(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return value > 0 ? `+${value}` : String(value);
}

function formatLine(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function parseNumberInput(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isCompletedGame(row: HitRateProfileV2): boolean {
  const status = String(row.game_status ?? "").toLowerCase();
  return status.includes("final");
}

function getSubtitle(row: HitRateProfileV2): string {
  const team = row.team_abbr ? row.team_abbr : "--";
  const opp = row.opponent_team_abbr ? row.opponent_team_abbr : "--";
  const homeAway = row.home_away === "H" ? "vs" : row.home_away === "A" ? "@" : "vs";
  return `${team} ${homeAway} ${opp}`;
}

function getPlayerName(row: HitRateProfileV2): string {
  return row.player_name || row.nba_players_hr?.name || "Unknown Player";
}

function getStableKey(row: HitRateProfileV2): string | null {
  return row.odds_selection_id || row.sel_key || null;
}

type GameFilterOption = {
  key: string;
  label: string;
  started: boolean;
};

function getGameKey(row: HitRateProfileV2): string {
  if (row.game_id) return row.game_id;
  const team = row.team_abbr ?? "TEAM";
  const opponent = row.opponent_team_abbr ?? "OPP";
  const date = row.game_date ?? "DATE";
  return `${date}:${team}:${opponent}`;
}

function getGameLabel(row: HitRateProfileV2): string {
  const team = row.team_abbr ?? "TEAM";
  const opponent = row.opponent_team_abbr ?? "OPP";
  if (row.home_away === "H") return `${opponent} @ ${team}`;
  if (row.home_away === "A") return `${team} @ ${opponent}`;
  return `${team} vs ${opponent}`;
}

function hasGameStarted(row: HitRateProfileV2): boolean {
  const status = String(row.game_status ?? "").toLowerCase().trim();
  if (!status) return false;
  if (status.includes("final")) return true;

  const timeMatch = status.match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*et$/i);
  if (!timeMatch) {
    // Non-time statuses (Q1, halftime, live, delayed) are considered started.
    return true;
  }

  if (!row.game_date) return false;

  const [, hours, minutes, period] = timeMatch;
  let hour = Number(hours);
  if (period.toLowerCase() === "pm" && hour !== 12) hour += 12;
  if (period.toLowerCase() === "am" && hour === 12) hour = 0;

  const scheduledTime = new Date(
    `${row.game_date}T${String(hour).padStart(2, "0")}:${minutes}:00-05:00`
  );

  if (!Number.isFinite(scheduledTime.getTime())) return false;

  const startedWithBufferMs = scheduledTime.getTime() + 10 * 60 * 1000;
  return Date.now() > startedWithBufferMs;
}

export default function HitRatesScreen() {
  const router = useRouter();
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [market, setMarket] = useState("player_points");
  const [hasOddsOnly, setHasOddsOnly] = useState(true);
  const [sort, setSort] = useState<HitRateSortField>("l10Pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [minHitRateInput, setMinHitRateInput] = useState("0");
  const [searchInput, setSearchInput] = useState("");
  const [appliedMinHitRate, setAppliedMinHitRate] = useState(0);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedGameKeys, setSelectedGameKeys] = useState<string[]>([]);

  const minHitRate = useMemo(
    () => Math.max(0, Math.min(100, parseNumberInput(minHitRateInput, appliedMinHitRate))),
    [appliedMinHitRate, minHitRateInput]
  );

  const { data, isLoading, isError, error, refetch, isRefetching } = useHitRates({
    market,
    minHitRate: appliedMinHitRate,
    search: appliedSearch,
    sort,
    sortDir,
    hasOdds: hasOddsOnly,
    limit: 150,
    autoRefreshEnabled,
    autoRefreshMs: 30_000
  });

  const gameOptions = useMemo(() => {
    const byKey = new Map<string, GameFilterOption>();
    for (const row of data?.data ?? []) {
      if (isCompletedGame(row)) continue;
      const key = getGameKey(row);
      if (byKey.has(key)) continue;
      byKey.set(key, {
        key,
        label: getGameLabel(row),
        started: hasGameStarted(row)
      });
    }

    return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [data?.data]);

  const rows = useMemo(() => {
    const baseRows = (data?.data ?? []).filter((row) => !isCompletedGame(row));
    if (selectedGameKeys.length > 0) {
      const selectedSet = new Set(selectedGameKeys);
      return baseRows.filter((row) => selectedSet.has(getGameKey(row)));
    }
    return baseRows.filter((row) => !hasGameStarted(row));
  }, [data?.data, selectedGameKeys]);

  const oddsSelections = useMemo(
    () =>
      rows.reduce<HitRateOddsSelection[]>((acc, row) => {
        const stableKey = getStableKey(row);
        if (!stableKey) return acc;
        acc.push({
          stableKey,
          line: row.line ?? undefined
        });
        return acc;
      }, []),
    [rows]
  );

  const { getOdds } = useHitRateOdds({
    selections: oddsSelections,
    enabled: rows.length > 0
  });

  function toggleSort(field: HitRateSortField) {
    if (field === sort) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSort(field);
    setSortDir("desc");
  }

  function applyFilters() {
    setAppliedMinHitRate(minHitRate);
    setAppliedSearch(searchInput.trim());
  }

  function toggleGameFilter(gameKey: string) {
    setSelectedGameKeys((current) =>
      current.includes(gameKey) ? current.filter((item) => item !== gameKey) : [...current, gameKey]
    );
  }

  function resetFilters() {
    setMarket("player_points");
    setHasOddsOnly(true);
    setSort("l10Pct");
    setSortDir("desc");
    setMinHitRateInput("0");
    setSearchInput("");
    setSelectedGameKeys([]);
    setAppliedMinHitRate(0);
    setAppliedSearch("");
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={brandColors.primary} />}
      >
        <View style={styles.headerCard}>
          <Text style={styles.pageTitle}>Hit Rates</Text>
          <Text style={styles.pageSubtitle}>NBA player hit-rate feed with odds-aware filtering.</Text>
          <View style={styles.controlRow}>
            <Pressable onPress={() => void refetch()} style={styles.outlineAction} disabled={isRefetching}>
              <Text style={styles.outlineActionText}>{isRefetching ? "Refreshing..." : "Refresh"}</Text>
            </Pressable>
            <Pressable
              onPress={() => setAutoRefreshEnabled((current) => !current)}
              style={[styles.outlineAction, autoRefreshEnabled && styles.outlineActionActive]}
            >
              <Text style={[styles.outlineActionText, autoRefreshEnabled && styles.outlineActionTextActive]}>
                Auto {autoRefreshEnabled ? "On" : "Off"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Filters</Text>

          <Text style={styles.sectionLabel}>Markets</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
            {MARKET_OPTIONS.map((option) => {
              const active = option.id === market;
              return (
                <Pressable key={option.id} onPress={() => setMarket(option.id)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionLabel}>Games</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
            <Pressable
              onPress={() => setSelectedGameKeys([])}
              style={[styles.chip, selectedGameKeys.length === 0 && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedGameKeys.length === 0 && styles.chipTextActive]}>Default</Text>
            </Pressable>
            {gameOptions.map((game) => {
              const active = selectedGameKeys.includes(game.key);
              return (
                <Pressable
                  key={game.key}
                  onPress={() => toggleGameFilter(game.key)}
                  style={[
                    styles.chip,
                    active && styles.chipActive,
                    game.started && !active && styles.chipMuted
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                      game.started && !active && styles.chipTextMuted
                    ]}
                  >
                    {game.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionLabel}>Sort</Text>
          <View style={styles.chipWrap}>
            {SORT_OPTIONS.map((option) => {
              const active = option.field === sort;
              return (
                <Pressable
                  key={option.field}
                  onPress={() => toggleSort(option.field)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {option.label}
                    {active ? ` ${sortDir === "desc" ? "▼" : "▲"}` : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Min L10 Hit %</Text>
          <View style={styles.quickRow}>
            {MIN_HIT_OPTIONS.map((value) => {
              const active = minHitRate === value;
              return (
                <Pressable key={`min-${value}`} onPress={() => setMinHitRateInput(String(value))} style={[styles.quickChip, active && styles.quickChipActive]}>
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{value}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Search Player</Text>
              <TextInput
                style={styles.input}
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Search name"
                placeholderTextColor={brandColors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Min %</Text>
              <TextInput
                style={styles.input}
                value={minHitRateInput}
                onChangeText={(value) => setMinHitRateInput(value.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={brandColors.textMuted}
              />
            </View>
          </View>

          <View style={styles.quickRow}>
            <Pressable
              onPress={() => setHasOddsOnly((current) => !current)}
              style={[styles.quickChip, hasOddsOnly && styles.quickChipActive]}
            >
              <Text style={[styles.quickChipText, hasOddsOnly && styles.quickChipTextActive]}>
                Odds Only: {hasOddsOnly ? "On" : "Off"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.actionsRow}>
            <Pressable onPress={resetFilters} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Reset</Text>
            </Pressable>
            <Pressable onPress={applyFilters} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Apply</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Rows: {rows.length}</Text>
          <Text style={styles.summaryText}>
            {selectedGameKeys.length > 0 ? `Games: ${selectedGameKeys.length}` : "Started: Hidden"}
          </Text>
        </View>

        {isLoading && rows.length === 0 ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color={brandColors.primary} />
            <Text style={styles.stateText}>Loading hit rates...</Text>
          </View>
        ) : null}

        {isError ? (
          <View style={[styles.stateCard, styles.errorCard]}>
            <Text style={styles.errorTitle}>Unable to load hit rates</Text>
            <Text style={styles.errorText}>{error instanceof Error ? error.message : "Unexpected error"}</Text>
          </View>
        ) : null}

        {!isLoading && !isError && rows.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>No hit-rate profiles match your filters.</Text>
          </View>
        ) : null}

        {rows.map((row) => {
          const stableKey = getStableKey(row);
          const lineOdds = stableKey ? getOdds(stableKey) : null;
          const displayBook = lineOdds?.bestOver?.book ?? row.best_odds?.book ?? "--";
          const displayPrice = lineOdds?.bestOver?.price ?? row.best_odds?.price ?? null;
          const bookLogo = getSportsbookLogoUrl(displayBook);
          const playerId = row.player_id;

          return (
            <Pressable
              key={row.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() =>
                router.push({
                  pathname: "/player/[id]",
                  params: { id: String(playerId), market: row.market }
                })
              }
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.playerName}>{getPlayerName(row)}</Text>
                  <Text style={styles.playerMeta}>{getSubtitle(row)}</Text>
                  <View style={styles.matchupLogoRow}>
                    {getNbaTeamLogoUrl(row.team_abbr) ? (
                      <Image source={{ uri: getNbaTeamLogoUrl(row.team_abbr)! }} style={styles.teamLogo} />
                    ) : null}
                    <Text style={styles.matchupVs}>vs</Text>
                    {getNbaTeamLogoUrl(row.opponent_team_abbr) ? (
                      <Image source={{ uri: getNbaTeamLogoUrl(row.opponent_team_abbr)! }} style={styles.teamLogo} />
                    ) : null}
                  </View>
                </View>
                <View style={styles.lineBadge}>
                  <Text style={styles.lineBadgeText}>
                    {formatLine(row.line)} {row.market.replace("player_", "").replace(/_/g, " ")}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statLabel}>L5</Text>
                  <Text style={styles.statValue}>{formatPercent(row.last_5_pct)}</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statLabel}>L10</Text>
                  <Text style={styles.statValue}>{formatPercent(row.last_10_pct)}</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statLabel}>L20</Text>
                  <Text style={styles.statValue}>{formatPercent(row.last_20_pct)}</Text>
                </View>
                <View style={styles.statChip}>
                  <Text style={styles.statLabel}>SZN</Text>
                  <Text style={styles.statValue}>{formatPercent(row.season_pct)}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.footerOdds}>
                  {bookLogo ? (
                    <Image source={{ uri: bookLogo }} style={styles.bookLogo} />
                  ) : null}
                  <Text style={styles.footerText}>
                    Odds: {displayBook} {formatOdds(displayPrice)}
                  </Text>
                </View>
                <Text style={styles.footerText}>
                  DvP: {row.matchup?.rank_label ?? "--"}
                </Text>
              </View>
            </Pressable>
          );
        })}
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
    paddingBottom: 32,
    gap: 12
  },
  headerCard: {
    backgroundColor: brandColors.appBackground,
    gap: 10
  },
  pageTitle: {
    color: brandColors.textPrimary,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -0.7
  },
  pageSubtitle: {
    color: brandColors.textSecondary,
    fontSize: 16
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10
  },
  outlineAction: {
    borderWidth: 1,
    borderColor: brandColors.borderStrong,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  outlineActionActive: {
    backgroundColor: brandColors.primarySoft,
    borderColor: brandColors.primary
  },
  outlineActionText: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "700"
  },
  outlineActionTextActive: {
    color: brandColors.primary
  },
  filterCard: {
    backgroundColor: brandColors.panelBackground,
    borderColor: brandColors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 12
  },
  filterTitle: {
    color: brandColors.textPrimary,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.4
  },
  sectionLabel: {
    color: brandColors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  horizontalRow: {
    gap: 8,
    paddingRight: 6
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    borderRadius: 999,
    borderColor: brandColors.borderStrong,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: brandColors.panelBackgroundAlt
  },
  chipActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  chipMuted: {
    opacity: 0.65
  },
  chipText: {
    color: brandColors.textSecondary,
    fontSize: 14,
    fontWeight: "700"
  },
  chipTextActive: {
    color: brandColors.primary
  },
  chipTextMuted: {
    color: brandColors.textMuted
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  quickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: brandColors.borderStrong,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  quickChipActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  quickChipText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "700"
  },
  quickChipTextActive: {
    color: brandColors.primary
  },
  inputRow: {
    flexDirection: "row",
    gap: 10
  },
  inputItem: {
    flex: 1,
    gap: 6
  },
  inputLabel: {
    color: brandColors.textSecondary,
    fontSize: 14,
    fontWeight: "600"
  },
  input: {
    backgroundColor: brandColors.panelBackgroundAlt,
    borderColor: brandColors.borderStrong,
    borderWidth: 1,
    borderRadius: 12,
    color: brandColors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: brandColors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  secondaryButtonText: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "700"
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: brandColors.primaryStrong,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  primaryButtonText: {
    color: "#EAF8FF",
    fontSize: 16,
    fontWeight: "700"
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  summaryText: {
    color: brandColors.textSecondary,
    fontSize: 14,
    fontWeight: "600"
  },
  stateCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 14,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  stateText: {
    color: brandColors.textSecondary,
    fontSize: 14,
    textAlign: "center"
  },
  errorCard: {
    borderColor: "rgba(248, 113, 113, 0.5)",
    backgroundColor: "rgba(127, 29, 29, 0.25)"
  },
  errorTitle: {
    color: "#FCA5A5",
    fontSize: 16,
    fontWeight: "700"
  },
  errorText: {
    color: "#FECACA",
    fontSize: 13,
    textAlign: "center"
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    padding: 12,
    gap: 10
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 2
  },
  playerName: {
    color: brandColors.textPrimary,
    fontSize: 17,
    fontWeight: "700"
  },
  playerMeta: {
    color: brandColors.textSecondary,
    fontSize: 14
  },
  matchupLogoRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  matchupVs: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  teamLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#0A0F1B"
  },
  lineBadge: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: brandColors.borderStrong,
    backgroundColor: brandColors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  lineBadgeText: {
    color: brandColors.primary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statChip: {
    minWidth: 66,
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
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  footerOdds: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1
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
    fontWeight: "600",
    flexShrink: 1
  },
  cardPressed: {
    opacity: 0.92
  }
});
