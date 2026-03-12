import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useDvpRankings } from "@/src/hooks/use-dvp-rankings";
import TeamLogo from "@/src/components/TeamLogo";
import { brandColors } from "@/src/theme/brand";
import type { DvpTeamRanking } from "@unjuiced/api";

type DvpViewMode = "basic" | "advanced" | "trends";
type DvpDisplayMode = "values" | "ranks";
type DvpSampleSize = "season" | "l5" | "l10" | "l15" | "l20";
type TrendStat =
  | "pts"
  | "reb"
  | "ast"
  | "pra"
  | "fg3m"
  | "stl"
  | "blk"
  | "tov"
  | "pr"
  | "pa"
  | "ra"
  | "bs"
  | "fga"
  | "fg3a"
  | "fta"
  | "minutes";

type ColumnDefinition = {
  key: string;
  label: string;
  field: string;
  rankField?: string;
  tooltip?: string;
  isPercentage?: boolean;
  seasonOnly?: boolean;
};

type SortState = {
  field: string;
  direction: "asc" | "desc";
};

const VIEW_MODES: Array<{ value: DvpViewMode; label: string }> = [
  { value: "basic", label: "Basic" },
  { value: "advanced", label: "Advanced" },
  { value: "trends", label: "Trends" }
];

const SAMPLE_SIZES: Array<{ value: DvpSampleSize; label: string }> = [
  { value: "season", label: "Season" },
  { value: "l5", label: "L5" },
  { value: "l10", label: "L10" },
  { value: "l15", label: "L15" },
  { value: "l20", label: "L20" }
];

const TREND_STATS: Array<{ value: TrendStat; label: string }> = [
  { value: "pts", label: "PTS" },
  { value: "reb", label: "REB" },
  { value: "ast", label: "AST" },
  { value: "pra", label: "PRA" },
  { value: "fg3m", label: "3PM" },
  { value: "stl", label: "STL" },
  { value: "blk", label: "BLK" },
  { value: "tov", label: "TO" },
  { value: "pr", label: "P+R" },
  { value: "pa", label: "P+A" },
  { value: "ra", label: "R+A" },
  { value: "bs", label: "BLK+STL" },
  { value: "fga", label: "FGA" },
  { value: "fg3a", label: "3PA" },
  { value: "fta", label: "FTA" },
  { value: "minutes", label: "MIN" }
];

const BASIC_COLUMNS: ColumnDefinition[] = [
  { key: "games", label: "GP", field: "games", seasonOnly: true },
  { key: "pts", label: "PTS", field: "ptsAvg", rankField: "ptsRank" },
  { key: "reb", label: "REB", field: "rebAvg", rankField: "rebRank" },
  { key: "ast", label: "AST", field: "astAvg", rankField: "astRank" },
  { key: "fg3m", label: "3PM", field: "fg3mAvg", rankField: "fg3mRank" },
  { key: "fta", label: "FTA", field: "ftaAvg", rankField: "ftaRank", seasonOnly: true },
  { key: "stl", label: "STL", field: "stlAvg", rankField: "stlRank" },
  { key: "blk", label: "BLK", field: "blkAvg", rankField: "blkRank" },
  { key: "tov", label: "TO", field: "tovAvg", rankField: "tovRank" }
];

const ADVANCED_COLUMNS: ColumnDefinition[] = [
  { key: "fgPct", label: "FG%", field: "fgPct", rankField: "fgPctRank", isPercentage: true, seasonOnly: true },
  { key: "fga", label: "FGA", field: "fgaAvg", rankField: "fgaRank", seasonOnly: true },
  { key: "fg3Pct", label: "3P%", field: "fg3Pct", rankField: "fg3PctRank", isPercentage: true, seasonOnly: true },
  { key: "fg3a", label: "3PA", field: "fg3aAvg", rankField: "fg3aRank", seasonOnly: true },
  { key: "oreb", label: "OREB", field: "orebAvg", rankField: "orebRank", seasonOnly: true },
  { key: "dreb", label: "DREB", field: "drebAvg", rankField: "drebRank", seasonOnly: true },
  { key: "pra", label: "PRA", field: "praAvg", rankField: "praRank" },
  { key: "pr", label: "P+R", field: "prAvg", rankField: "prRank" },
  { key: "pa", label: "P+A", field: "paAvg", rankField: "paRank" },
  { key: "ra", label: "R+A", field: "raAvg", rankField: "raRank" },
  { key: "bs", label: "BLK+STL", field: "bsAvg", rankField: "bsRank" },
  { key: "dd2", label: "DD%", field: "dd2Pct", rankField: "dd2PctRank", isPercentage: true, seasonOnly: true }
];

const TEAM_COL_WIDTH = 110;
const CELL_WIDTH = 62;
const TREND_CELL_WIDTH = 62;
const DELTA_WIDTH = 72;
const ROW_HEIGHT = 42;

function formatCellValue(value: number | null | undefined, isPercentage?: boolean): string {
  if (value == null) return "—";
  if (isPercentage) {
    const pctValue = value > 1 ? value : value * 100;
    return `${pctValue.toFixed(1)}%`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatRank(rank: number | null | undefined): string {
  if (rank == null) return "—";
  return `#${rank}`;
}

function rankPalette(rank: number | null | undefined): { bg: string; text: string } {
  if (rank == null) return { bg: "transparent", text: brandColors.textSecondary };
  if (rank <= 5) return { bg: "rgba(248,113,113,0.26)", text: brandColors.error };
  if (rank <= 10) return { bg: "rgba(248,113,113,0.14)", text: brandColors.error };
  if (rank >= 26) return { bg: "rgba(34,197,94,0.26)", text: brandColors.success };
  if (rank >= 21) return { bg: "rgba(34,197,94,0.14)", text: brandColors.success };
  return { bg: "transparent", text: brandColors.textPrimary };
}

function resolveSampleField(baseField: string, sampleSize: DvpSampleSize): string {
  if (sampleSize === "season") return baseField;
  const trimmed = baseField.endsWith("Avg") ? baseField.slice(0, -3) : baseField;
  return `${sampleSize}${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}Avg`;
}

function resolveSampleRankField(baseField: string, sampleSize: DvpSampleSize): string {
  if (sampleSize === "season") return baseField;
  const trimmed = baseField.endsWith("Rank") ? baseField.slice(0, -4) : baseField;
  return `${sampleSize}${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}Rank`;
}

function getNumericValue(team: DvpTeamRanking, field: string): number | null {
  const value = team[field as keyof DvpTeamRanking];
  return typeof value === "number" ? value : null;
}

function getTrendFields(stat: TrendStat) {
  const fieldMap: Record<TrendStat, { base: string; cap: string }> = {
    pts: { base: "pts", cap: "Pts" },
    reb: { base: "reb", cap: "Reb" },
    ast: { base: "ast", cap: "Ast" },
    pra: { base: "pra", cap: "Pra" },
    fg3m: { base: "fg3m", cap: "Fg3m" },
    stl: { base: "stl", cap: "Stl" },
    blk: { base: "blk", cap: "Blk" },
    tov: { base: "tov", cap: "Tov" },
    pr: { base: "pr", cap: "Pr" },
    pa: { base: "pa", cap: "Pa" },
    ra: { base: "ra", cap: "Ra" },
    bs: { base: "bs", cap: "Bs" },
    fga: { base: "fga", cap: "Fga" },
    fg3a: { base: "fg3a", cap: "Fg3a" },
    fta: { base: "fta", cap: "Fta" },
    minutes: { base: "minutes", cap: "Minutes" }
  };

  const { base, cap } = fieldMap[stat];
  return {
    season: `${base}Avg`,
    seasonRank: `${base}Rank`,
    l20: `l20${cap}Avg`,
    l20Rank: `l20${cap}Rank`,
    l15: `l15${cap}Avg`,
    l15Rank: `l15${cap}Rank`,
    l10: `l10${cap}Avg`,
    l10Rank: `l10${cap}Rank`,
    l5: `l5${cap}Avg`,
    l5Rank: `l5${cap}Rank`
  };
}

type Props = {
  position: string;
  selectedStat: string;
};

export default function DvpSheet({ position, selectedStat }: Props) {
  const leftBodyRef = useRef<ScrollView>(null);
  const rightBodyRef = useRef<ScrollView>(null);
  const headerHorizontalRef = useRef<ScrollView>(null);
  const syncingVerticalRef = useRef<"left" | "right" | null>(null);
  const [viewMode, setViewMode] = useState<DvpViewMode>("basic");
  const [sampleSize, setSampleSize] = useState<DvpSampleSize>("season");
  const [displayMode, setDisplayMode] = useState<DvpDisplayMode>("values");
  const [trendStat, setTrendStat] = useState<TrendStat>(
    TREND_STATS.some((stat) => stat.value === selectedStat) ? (selectedStat as TrendStat) : "pts"
  );
  const [sortState, setSortState] = useState<Record<DvpViewMode, SortState>>({
    basic: { field: selectedStat === "reb" ? "rebAvg" : selectedStat === "ast" ? "astAvg" : selectedStat === "fg3m" ? "fg3mAvg" : selectedStat === "stl" ? "stlAvg" : selectedStat === "blk" ? "blkAvg" : selectedStat === "tov" ? "tovAvg" : selectedStat === "pra" ? "praAvg" : "ptsAvg", direction: "desc" },
    advanced: { field: "fgPct", direction: "desc" },
    trends: { field: "delta", direction: "desc" }
  });

  useEffect(() => {
    if (TREND_STATS.some((stat) => stat.value === selectedStat)) {
      setTrendStat(selectedStat as TrendStat);
    }
    setSortState((current) => ({
      ...current,
      basic: {
        field:
          selectedStat === "reb" ? "rebAvg" :
          selectedStat === "ast" ? "astAvg" :
          selectedStat === "fg3m" ? "fg3mAvg" :
          selectedStat === "stl" ? "stlAvg" :
          selectedStat === "blk" ? "blkAvg" :
          selectedStat === "tov" ? "tovAvg" :
          selectedStat === "pra" ? "praAvg" :
          "ptsAvg",
        direction: "desc"
      }
    }));
  }, [selectedStat]);

  const { data, isLoading, isRefetching, refetch } = useDvpRankings({ position });
  const teams = data?.teams ?? [];
  const trendFields = useMemo(() => getTrendFields(trendStat), [trendStat]);
  const currentSort = sortState[viewMode];

  const sortedTeams = useMemo(() => {
    const rows = [...teams];
    if (viewMode === "trends" && currentSort.field === "delta") {
      return rows.sort((a, b) => {
        const aSeason = getNumericValue(a, trendFields.season);
        const aL5 = getNumericValue(a, trendFields.l5);
        const bSeason = getNumericValue(b, trendFields.season);
        const bL5 = getNumericValue(b, trendFields.l5);
        const aDelta = aSeason != null && aL5 != null ? aL5 - aSeason : null;
        const bDelta = bSeason != null && bL5 != null ? bL5 - bSeason : null;
        if (aDelta == null && bDelta == null) return 0;
        if (aDelta == null) return 1;
        if (bDelta == null) return -1;
        return currentSort.direction === "asc" ? aDelta - bDelta : bDelta - aDelta;
      });
    }

    return rows.sort((a, b) => {
      const aRaw = a[currentSort.field as keyof DvpTeamRanking];
      const bRaw = b[currentSort.field as keyof DvpTeamRanking];

      if (typeof aRaw === "string" && typeof bRaw === "string") {
        return currentSort.direction === "asc"
          ? aRaw.localeCompare(bRaw)
          : bRaw.localeCompare(aRaw);
      }

      const aValue = typeof aRaw === "number" ? aRaw : null;
      const bValue = typeof bRaw === "number" ? bRaw : null;
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      return currentSort.direction === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [teams, viewMode, currentSort, trendFields]);

  const columns = viewMode === "basic" ? BASIC_COLUMNS : ADVANCED_COLUMNS;
  const matrixHeight = Math.min(sortedTeams.length * ROW_HEIGHT, 520);

  function toggleSort(field: string, defaultDirection: "asc" | "desc" = "desc") {
    setSortState((current) => {
      const active = current[viewMode];
      if (active.field === field) {
        return {
          ...current,
          [viewMode]: {
            field,
            direction: active.direction === "asc" ? "desc" : "asc"
          }
        };
      }
      return {
        ...current,
        [viewMode]: {
          field,
          direction: defaultDirection
        }
      };
    });
  }

  function renderSortIndicator(field: string) {
    if (currentSort.field !== field) return <Text style={styles.sortInactive}>↕</Text>;
    return (
      <Text style={styles.sortActive}>
        {currentSort.direction === "asc" ? "↑" : "↓"}
      </Text>
    );
  }

  function getColumnValue(team: DvpTeamRanking, column: ColumnDefinition): { value: number | null; rank: number | null } {
    const valueField = sampleSize !== "season" && !column.seasonOnly ? resolveSampleField(column.field, sampleSize) : column.field;
    const rankField =
      column.rankField == null
        ? null
        : sampleSize !== "season" && !column.seasonOnly
          ? resolveSampleRankField(column.rankField, sampleSize)
          : column.rankField;

    return {
      value: getNumericValue(team, valueField) ?? getNumericValue(team, column.field),
      rank: rankField ? (getNumericValue(team, rankField) ?? getNumericValue(team, column.rankField!)) : null
    };
  }

  function renderValueCell(team: DvpTeamRanking, column: ColumnDefinition) {
    const { value, rank } = getColumnValue(team, column);
    const palette = rankPalette(rank);

    return (
      <View key={column.key} style={[styles.dataCell, { width: CELL_WIDTH, backgroundColor: palette.bg }]}>
        <Text style={[styles.cellValue, { color: displayMode === "ranks" ? palette.text : palette.text }]}>
          {displayMode === "ranks" ? formatRank(rank) : formatCellValue(value, column.isPercentage)}
        </Text>
      </View>
    );
  }

  function renderTrendCell(team: DvpTeamRanking, field: string, rankField: string, label: string, strong?: boolean) {
    const value = getNumericValue(team, field);
    const rank = getNumericValue(team, rankField);
    const palette = rankPalette(rank);
    return (
      <View
        key={label}
        style={[
          styles.dataCell,
          styles.trendCell,
          strong && styles.trendCellStrong,
          { width: TREND_CELL_WIDTH, backgroundColor: palette.bg }
        ]}
      >
        <Text style={[styles.cellValue, strong && styles.cellValueStrong]}>
          {displayMode === "ranks" ? formatRank(rank) : formatCellValue(value)}
        </Text>
      </View>
    );
  }

  function renderDeltaCell(team: DvpTeamRanking) {
    const seasonValue = getNumericValue(team, trendFields.season);
    const l5Value = getNumericValue(team, trendFields.l5);
    const seasonRank = getNumericValue(team, trendFields.seasonRank);
    const l5Rank = getNumericValue(team, trendFields.l5Rank);
    const delta =
      displayMode === "ranks"
        ? seasonRank != null && l5Rank != null ? l5Rank - seasonRank : null
        : seasonValue != null && l5Value != null ? l5Value - seasonValue : null;

    const deltaBg =
      delta == null
        ? "transparent"
        : delta >= (displayMode === "ranks" ? 2 : 1)
          ? "rgba(34,197,94,0.14)"
          : delta <= (displayMode === "ranks" ? -2 : -1)
            ? "rgba(248,113,113,0.14)"
            : "transparent";

    const deltaText =
      delta == null
        ? brandColors.textSecondary
        : delta > 0
          ? brandColors.success
          : delta < 0
            ? brandColors.error
            : brandColors.textPrimary;

    const formattedDelta =
      delta == null
        ? "—"
        : `${delta > 0 ? "+" : ""}${displayMode === "ranks" ? String(delta) : delta.toFixed(1)}`;

    return (
      <View key="delta" style={[styles.dataCell, styles.deltaCell, { width: DELTA_WIDTH, backgroundColor: deltaBg }]}>
        <Text style={[styles.cellValue, { color: deltaText }]}>{formattedDelta}</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={brandColors.primary} />
        <Text style={styles.loadingText}>Loading DvP table...</Text>
      </View>
    );
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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={brandColors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Compact control bar */}
      <View style={styles.topControls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRail}>
          {VIEW_MODES.map((mode) => {
            const active = viewMode === mode.value;
            return (
              <Pressable
                key={mode.value}
                onPress={() => setViewMode(mode.value)}
                style={[styles.modeChip, active && styles.modeChipActive]}
              >
                <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{mode.label}</Text>
              </Pressable>
            );
          })}

          <View style={styles.controlDivider} />

          {viewMode !== "trends" ? (
            SAMPLE_SIZES.map((option) => {
              const active = sampleSize === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setSampleSize(option.value)}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                >
                  <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })
          ) : (
            TREND_STATS.map((option) => {
              const active = trendStat === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setTrendStat(option.value)}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                >
                  <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })
          )}

          <View style={styles.controlDivider} />

          <Pressable
            onPress={() => setDisplayMode(displayMode === "values" ? "ranks" : "values")}
            style={[styles.modeChip, styles.modeChipActive]}
          >
            <Text style={styles.modeChipTextActive}>{displayMode === "values" ? "AVG" : "RNK"}</Text>
          </Pressable>
        </ScrollView>
      </View>

      {sortedTeams.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No DvP data available.</Text>
        </View>
      ) : (
        <View style={styles.matrixShell}>
            <View style={styles.leftRail}>
              <Pressable style={styles.stickyColHeader} onPress={() => toggleSort("teamAbbr", "asc")}>
                <Text style={styles.headerText}>TEAM</Text>
                {renderSortIndicator("teamAbbr")}
              </Pressable>
              <ScrollView
                ref={leftBodyRef}
                style={{ height: matrixHeight }}
                showsVerticalScrollIndicator={false}
                bounces={false}
                onScroll={(event) => syncVerticalScroll("left", event)}
                scrollEventThrottle={16}
              >
                {sortedTeams.map((team, index) => (
                    <View key={`${team.teamId}-${team.position}-left`} style={[styles.stickyCol, index % 2 === 0 && styles.dataRowAlt]}>
                      <TeamLogo teamAbbr={team.teamAbbr} sport="nba" size={22} style={{ borderRadius: 11 }} />
                      <Text style={styles.teamName} numberOfLines={1}>{team.teamAbbr}</Text>
                    </View>
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
                  {viewMode !== "trends" ? (
                    columns.map((column) => (
                      <Pressable
                        key={column.key}
                        style={[styles.headerCell, { width: CELL_WIDTH }]}
                        onPress={() =>
                          toggleSort(
                            displayMode === "ranks" && column.rankField
                              ? (sampleSize !== "season" && !column.seasonOnly ? resolveSampleRankField(column.rankField, sampleSize) : column.rankField)
                              : (sampleSize !== "season" && !column.seasonOnly ? resolveSampleField(column.field, sampleSize) : column.field),
                            displayMode === "ranks" ? "asc" : "desc"
                          )
                        }
                      >
                        <Text style={styles.headerText}>{column.label}</Text>
                        {renderSortIndicator(
                          displayMode === "ranks" && column.rankField
                            ? (sampleSize !== "season" && !column.seasonOnly ? resolveSampleRankField(column.rankField, sampleSize) : column.rankField)
                            : (sampleSize !== "season" && !column.seasonOnly ? resolveSampleField(column.field, sampleSize) : column.field)
                        )}
                      </Pressable>
                    ))
                  ) : (
                    <>
                      {[
                        { label: "SZN", field: displayMode === "ranks" ? trendFields.seasonRank : trendFields.season, width: TREND_CELL_WIDTH },
                        { label: "L20", field: displayMode === "ranks" ? trendFields.l20Rank : trendFields.l20, width: TREND_CELL_WIDTH },
                        { label: "L15", field: displayMode === "ranks" ? trendFields.l15Rank : trendFields.l15, width: TREND_CELL_WIDTH },
                        { label: "L10", field: displayMode === "ranks" ? trendFields.l10Rank : trendFields.l10, width: TREND_CELL_WIDTH },
                        { label: "L5", field: displayMode === "ranks" ? trendFields.l5Rank : trendFields.l5, width: TREND_CELL_WIDTH }
                      ].map((column) => (
                        <Pressable
                          key={column.label}
                          style={[styles.headerCell, { width: column.width }]}
                          onPress={() => toggleSort(column.field, displayMode === "ranks" ? "asc" : "desc")}
                        >
                          <Text style={styles.headerText}>{column.label}</Text>
                          {renderSortIndicator(column.field)}
                        </Pressable>
                      ))}
                      <Pressable style={[styles.headerCell, { width: DELTA_WIDTH }]} onPress={() => toggleSort("delta", "desc")}>
                        <Text style={styles.headerText}>Δ L5</Text>
                        {renderSortIndicator("delta")}
                      </Pressable>
                    </>
                  )}
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
                  style={{ height: matrixHeight }}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  onScroll={(event) => syncVerticalScroll("right", event)}
                  scrollEventThrottle={16}
                >
                  {sortedTeams.map((team, index) => (
                    <View key={`${team.teamId}-${team.position}-right`} style={[styles.dataRow, index % 2 === 0 && styles.dataRowAlt]}>
                      {viewMode !== "trends"
                        ? columns.map((column) => renderValueCell(team, column))
                        : (
                          <>
                            {renderTrendCell(team, trendFields.season, trendFields.seasonRank, "season")}
                            {renderTrendCell(team, trendFields.l20, trendFields.l20Rank, "l20")}
                            {renderTrendCell(team, trendFields.l15, trendFields.l15Rank, "l15")}
                            {renderTrendCell(team, trendFields.l10, trendFields.l10Rank, "l10")}
                            {renderTrendCell(team, trendFields.l5, trendFields.l5Rank, "l5", true)}
                            {renderDeltaCell(team)}
                          </>
                        )}
                    </View>
                  ))}
                </ScrollView>
              </ScrollView>
            </View>
          </View>
      )}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { color: brandColors.textSecondary, fontSize: 14 },
  topControls: { paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8 },
  modeRail: { gap: 6, paddingRight: 8 },
  modeChip: {
    borderRadius: 20, borderWidth: 1, borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground, paddingHorizontal: 10, paddingVertical: 6
  },
  modeChipActive: { borderColor: brandColors.primary, backgroundColor: brandColors.primarySoft },
  modeChipText: { color: brandColors.textSecondary, fontSize: 11, fontWeight: "600" },
  modeChipTextActive: { color: brandColors.primary, fontSize: 11, fontWeight: "700" },
  controlDivider: { width: 1, backgroundColor: brandColors.border, marginVertical: 4 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyText: { color: brandColors.textSecondary, fontSize: 14 },
  matrixShell: { flexDirection: "row" },
  leftRail: {
    width: TEAM_COL_WIDTH, borderRightWidth: 1, borderRightColor: brandColors.border,
    backgroundColor: brandColors.appBackground
  },
  rightRail: { flex: 1 },
  stickyColHeader: {
    flexDirection: "row", width: TEAM_COL_WIDTH, paddingHorizontal: 8, paddingVertical: 8,
    backgroundColor: brandColors.appBackground, justifyContent: "center", alignItems: "center", gap: 4,
    borderBottomWidth: 1, borderBottomColor: brandColors.border
  },
  stickyCol: {
    flexDirection: "row", width: TEAM_COL_WIDTH, paddingHorizontal: 8,
    height: ROW_HEIGHT, alignItems: "center", gap: 6,
    backgroundColor: brandColors.appBackground,
    borderBottomWidth: 0.5, borderBottomColor: brandColors.border
  },
  teamLogo: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#0A0F1B" },
  teamName: { color: brandColors.textPrimary, fontSize: 11, fontWeight: "700" },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: brandColors.border },
  headerCell: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 2, paddingVertical: 8, width: CELL_WIDTH
  },
  headerText: { color: brandColors.textMuted, fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  sortActive: { color: brandColors.primary, fontSize: 9, fontWeight: "800" },
  sortInactive: { color: brandColors.textMuted, fontSize: 9 },
  dataRow: { flexDirection: "row", height: ROW_HEIGHT, borderBottomWidth: 0.5, borderBottomColor: brandColors.border },
  dataRowAlt: { backgroundColor: "rgba(255,255,255,0.02)" },
  dataCell: {
    alignItems: "center", justifyContent: "center",
    height: ROW_HEIGHT, width: CELL_WIDTH
  },
  trendCell: {},
  trendCellStrong: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.08)" },
  deltaCell: { paddingHorizontal: 4 },
  cellValue: { color: brandColors.textPrimary, fontSize: 12, fontWeight: "800" },
  cellValueStrong: { fontWeight: "800" },
  bottomSpacer: { height: 80 },
});
