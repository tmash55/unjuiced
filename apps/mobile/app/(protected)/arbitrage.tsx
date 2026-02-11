import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { ArbMode, ArbRow } from "@unjuiced/types";
import { normalizePlanName } from "@unjuiced/types";
import { useArbitrage } from "@/src/hooks/use-arbitrage";
import { useUserPreferences } from "@/src/hooks/use-user-preferences";
import { brandColors } from "@/src/theme/brand";

const MODES: Array<{ key: ArbMode; label: string }> = [
  { key: "pregame", label: "Pregame" },
  { key: "live", label: "Live" }
];

const MIN_ARB_OPTIONS = [0, 0.5, 1, 2, 3];
const MAX_ARB_OPTIONS = [2, 5, 10, 20];
const LIQUIDITY_OPTIONS = [0, 50, 100, 250];

function getStartTimestamp(row: ArbRow): number | null {
  if (!row.ev?.dt) return null;
  const timestamp = Date.parse(row.ev.dt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isCompletedGame(row: ArbRow): boolean {
  const startTimestamp = getStartTimestamp(row);
  if (startTimestamp == null) return false;
  const completedWindowMs = 6 * 60 * 60 * 1000;
  return row.ev.live !== true && Date.now() >= startTimestamp + completedWindowMs;
}

function normalizeBookId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

function formatBookLabel(bookId: string): string {
  return bookId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseNumberInput(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPercent(value: number): string {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(1);
}

export default function ArbitrageScreen() {
  const [mode, setMode] = useState<ArbMode>("pregame");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [minArbInput, setMinArbInput] = useState("0");
  const [maxArbInput, setMaxArbInput] = useState("20");
  const [minLiquidityInput, setMinLiquidityInput] = useState("50");
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const { data, isLoading, isError, error, refetch, isRefetching } = useArbitrage({
    mode,
    limit: 100,
    autoRefreshEnabled
  });
  const { preferences, isLoading: prefsLoading, savePreferences, isSaving } = useUserPreferences();
  const plan = normalizePlanName(String(data?.plan || "free"));

  useEffect(() => {
    if (prefsLoading || filtersHydrated) return;
    setSelectedBooks(preferences.arbitrageSelectedBooks);
    setMinArbInput(String(preferences.arbitrageMinArb));
    setMaxArbInput(String(preferences.arbitrageMaxArb));
    setMinLiquidityInput(String(preferences.arbitrageMinLiquidity));
    setFiltersHydrated(true);
  }, [filtersHydrated, preferences, prefsLoading]);

  const numericFilters = useMemo(() => {
    const rawMinArb = parseNumberInput(minArbInput, preferences.arbitrageMinArb);
    const rawMaxArb = parseNumberInput(maxArbInput, preferences.arbitrageMaxArb);
    const minArb = Math.max(0, rawMinArb);
    const maxArb = Math.max(minArb, rawMaxArb);
    const minLiquidity = Math.max(0, parseNumberInput(minLiquidityInput, preferences.arbitrageMinLiquidity));
    return { minArb, maxArb, minLiquidity };
  }, [maxArbInput, minArbInput, minLiquidityInput, preferences]);

  const nonCompletedRows = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter((row) => !isCompletedGame(row));
  }, [data?.rows]);

  const availableBooks = useMemo(() => {
    const map = new Map<string, string>();
    nonCompletedRows.forEach((row) => {
      if (row.o?.bk) map.set(row.o.bk, row.o.name || formatBookLabel(row.o.bk));
      if (row.u?.bk) map.set(row.u.bk, row.u.name || formatBookLabel(row.u.bk));
    });
    selectedBooks.forEach((bookId) => {
      if (!map.has(bookId)) map.set(bookId, formatBookLabel(bookId));
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [nonCompletedRows, selectedBooks]);

  const availableBookIds = useMemo(() => availableBooks.map((book) => book.id), [availableBooks]);

  const visibleRows = useMemo(() => {
    const selectedBookSet =
      selectedBooks.length > 0 ? new Set(selectedBooks.map((book) => normalizeBookId(book))) : null;
    return nonCompletedRows.filter((row) => {
      const roiPercent = (row.roi_bps ?? 0) / 100;
      if (roiPercent < numericFilters.minArb || roiPercent > numericFilters.maxArb) return false;

      if (selectedBookSet) {
        const overBook = normalizeBookId(String(row.o?.bk || ""));
        const underBook = normalizeBookId(String(row.u?.bk || ""));
        if (!selectedBookSet.has(overBook) || !selectedBookSet.has(underBook)) return false;
      }

      if (numericFilters.minLiquidity > 0) {
        if (typeof row.o?.max === "number" && row.o.max < numericFilters.minLiquidity) return false;
        if (typeof row.u?.max === "number" && row.u.max < numericFilters.minLiquidity) return false;
      }

      return true;
    });
  }, [nonCompletedRows, numericFilters, selectedBooks]);

  function isBookSelected(bookId: string): boolean {
    return selectedBooks.length === 0 || selectedBooks.includes(bookId);
  }

  function toggleBook(bookId: string) {
    const universe = availableBookIds;
    if (universe.length === 0) return;

    const current = selectedBooks.length === 0 ? universe : selectedBooks;
    const currentlySelected = current.includes(bookId);

    if (currentlySelected) {
      const next = current.filter((book) => book !== bookId);
      if (next.length === 0) return;
      if (next.length === universe.length) {
        setSelectedBooks([]);
      } else {
        setSelectedBooks(next);
      }
      return;
    }

    const next = Array.from(new Set([...current, bookId]));
    if (next.length === universe.length) {
      setSelectedBooks([]);
    } else {
      setSelectedBooks(next);
    }
  }

  async function applyFilters() {
    await savePreferences({
      arbitrage_selected_books: selectedBooks,
      arbitrage_min_arb: numericFilters.minArb,
      arbitrage_max_arb: numericFilters.maxArb,
      arbitrage_min_liquidity: numericFilters.minLiquidity
    });
  }

  async function resetFilters() {
    setSelectedBooks([]);
    setMinArbInput("0");
    setMaxArbInput("20");
    setMinLiquidityInput("50");
    await savePreferences({
      arbitrage_selected_books: [],
      arbitrage_min_arb: 0,
      arbitrage_max_arb: 20,
      arbitrage_min_liquidity: 50
    });
  }

  const planLabel = plan === "anonymous" ? "Free" : plan.toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={brandColors.primary} />}
      >
        <View style={styles.headerCard}>
          <Text style={styles.pageTitle}>Arbitrage</Text>
          <Text style={styles.pageSubtitle}>Plan {planLabel}</Text>
          <View style={styles.modeRow}>
            {MODES.map((item) => {
              const active = mode === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setMode(item.key)}
                  style={[styles.topPill, active && styles.topPillActive]}
                >
                  <Text style={[styles.topPillText, active && styles.topPillTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
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

          <Text style={styles.sectionLabel}>Sportsbooks</Text>
          <View style={styles.chipWrap}>
            {availableBooks.map((book) => {
              const active = isBookSelected(book.id);
              return (
                <Pressable key={book.id} onPress={() => toggleBook(book.id)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                    {book.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Min Arb %</Text>
          <View style={styles.quickRow}>
            {MIN_ARB_OPTIONS.map((value) => {
              const active = numericFilters.minArb === value;
              return (
                <Pressable key={`min-${value}`} onPress={() => setMinArbInput(String(value))} style={[styles.quickChip, active && styles.quickChipActive]}>
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{formatPercent(value)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Max Arb %</Text>
          <View style={styles.quickRow}>
            {MAX_ARB_OPTIONS.map((value) => {
              const active = numericFilters.maxArb === value;
              return (
                <Pressable key={`max-${value}`} onPress={() => setMaxArbInput(String(value))} style={[styles.quickChip, active && styles.quickChipActive]}>
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{formatPercent(value)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Min Liquidity</Text>
          <View style={styles.quickRow}>
            {LIQUIDITY_OPTIONS.map((value) => {
              const active = numericFilters.minLiquidity === value;
              return (
                <Pressable
                  key={`liq-${value}`}
                  onPress={() => setMinLiquidityInput(String(value))}
                  style={[styles.quickChip, active && styles.quickChipActive]}
                >
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{value}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Min</Text>
              <TextInput
                style={styles.input}
                value={minArbInput}
                onChangeText={(value) => setMinArbInput(value.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={brandColors.textMuted}
              />
            </View>
            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Max</Text>
              <TextInput
                style={styles.input}
                value={maxArbInput}
                onChangeText={(value) => setMaxArbInput(value.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
                placeholder="20"
                placeholderTextColor={brandColors.textMuted}
              />
            </View>
            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Liquidity</Text>
              <TextInput
                style={styles.input}
                value={minLiquidityInput}
                onChangeText={(value) => setMinLiquidityInput(value.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="50"
                placeholderTextColor={brandColors.textMuted}
              />
            </View>
          </View>

          <View style={styles.filterActions}>
            <Pressable onPress={() => void resetFilters()} style={styles.outlineAction} disabled={isSaving}>
              <Text style={styles.outlineActionText}>Reset</Text>
            </Pressable>
            <Pressable onPress={() => void applyFilters()} style={styles.primaryAction} disabled={isSaving}>
              <Text style={styles.primaryActionText}>{isSaving ? "Saving..." : "Apply"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Rows {visibleRows.length}</Text>
          {data?.filteredReason ? <Text style={styles.warningText}>{data.filteredReason}</Text> : null}
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={brandColors.primary} />
            <Text style={styles.loadingText}>Loading arbitrage rows...</Text>
          </View>
        ) : null}

        {isError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Arbitrage failed to load</Text>
            <Text style={styles.errorBody}>{error instanceof Error ? error.message : "Unknown error"}</Text>
            <Pressable onPress={() => void refetch()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !isError && visibleRows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No rows found</Text>
            <Text style={styles.emptyBody}>Adjust filters or switch between Pregame and Live.</Text>
          </View>
        ) : null}

        {!isLoading && !isError
          ? visibleRows.map((row, index) => {
              const away = row.ev.away.abbr || row.ev.away.name || "Away";
              const home = row.ev.home.abbr || row.ev.home.name || "Home";
              const roi = (row.roi_bps / 100).toFixed(2);
              const line = Number.isFinite(row.ln) ? row.ln : 0;
              return (
                <View key={`${row.eid}-${row.mkt}-${index}`} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardMatchup}>
                      {away} @ {home}
                    </Text>
                    <Text style={styles.cardRoi}>ROI {roi}%</Text>
                  </View>
                  <Text style={styles.cardSub}>
                    {row.mkt} {line > 0 ? `+${line}` : line}
                  </Text>
                  <View style={styles.legsRow}>
                    <View style={styles.leg}>
                      <Text style={styles.legBook}>{row.o.name || row.o.bk.toUpperCase()}</Text>
                      <Text style={styles.legOdds}>{row.o.od > 0 ? `+${row.o.od}` : row.o.od}</Text>
                    </View>
                    <View style={styles.leg}>
                      <Text style={styles.legBook}>{row.u.name || row.u.bk.toUpperCase()}</Text>
                      <Text style={styles.legOdds}>{row.u.od > 0 ? `+${row.u.od}` : row.u.od}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardMeta}>{row.ev.live ? "Live" : "Pregame"}</Text>
                </View>
              );
            })
          : null}
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
    padding: 12,
    gap: 10
  },
  headerCard: {
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    borderRadius: 14,
    padding: 12,
    gap: 8
  },
  pageTitle: {
    color: brandColors.textPrimary,
    fontSize: 24,
    fontWeight: "700"
  },
  pageSubtitle: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "600"
  },
  modeRow: {
    flexDirection: "row",
    gap: 8
  },
  topPill: {
    borderColor: brandColors.borderStrong,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: brandColors.panelBackground
  },
  topPillActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoftStrong
  },
  topPillText: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  topPillTextActive: {
    color: "#D7F3FF"
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8
  },
  filterCard: {
    borderColor: brandColors.border,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: brandColors.panelBackground,
    padding: 12,
    gap: 8
  },
  filterTitle: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "700"
  },
  sectionLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  chip: {
    borderColor: brandColors.borderStrong,
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  chipActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  chipText: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "600"
  },
  chipTextActive: {
    color: "#CDEFFF"
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  quickChip: {
    borderColor: brandColors.borderStrong,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingVertical: 5,
    paddingHorizontal: 8
  },
  quickChipActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  quickChipText: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "700"
  },
  quickChipTextActive: {
    color: "#D7F3FF"
  },
  inputRow: {
    flexDirection: "row",
    gap: 8
  },
  inputItem: {
    flex: 1,
    gap: 4
  },
  inputLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "600"
  },
  input: {
    borderColor: brandColors.borderStrong,
    borderWidth: 1,
    borderRadius: 10,
    color: brandColors.textPrimary,
    backgroundColor: brandColors.panelBackgroundAlt,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  filterActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8
  },
  outlineAction: {
    borderColor: brandColors.borderStrong,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: brandColors.panelBackgroundAlt
  },
  outlineActionActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  outlineActionText: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  outlineActionTextActive: {
    color: "#D7F3FF"
  },
  primaryAction: {
    borderColor: brandColors.primaryStrong,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: brandColors.primaryStrong,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  primaryActionText: {
    color: "#E0F2FE",
    fontSize: 12,
    fontWeight: "800"
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  metaText: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "600"
  },
  warningText: {
    color: brandColors.warning,
    fontSize: 11
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 8
  },
  loadingText: {
    color: brandColors.textSecondary,
    fontSize: 12
  },
  errorCard: {
    borderColor: "rgba(248, 113, 113, 0.4)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(127, 29, 29, 0.2)",
    gap: 6
  },
  errorTitle: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "700"
  },
  errorBody: {
    color: "#FECACA",
    fontSize: 11
  },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DC2626",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  retryText: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "700"
  },
  emptyCard: {
    borderColor: brandColors.border,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: brandColors.panelBackground,
    padding: 12,
    gap: 4
  },
  emptyTitle: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "700"
  },
  emptyBody: {
    color: brandColors.textSecondary,
    fontSize: 13
  },
  card: {
    borderColor: brandColors.border,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: brandColors.panelBackground,
    padding: 12,
    gap: 6
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  cardMatchup: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "700"
  },
  cardRoi: {
    color: brandColors.success,
    fontSize: 13,
    fontWeight: "700"
  },
  cardSub: {
    color: "#93C5FD",
    fontSize: 12
  },
  legsRow: {
    flexDirection: "row",
    gap: 8
  },
  leg: {
    flex: 1,
    borderColor: brandColors.borderStrong,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    gap: 4,
    backgroundColor: brandColors.panelBackgroundAlt
  },
  legBook: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "600"
  },
  legOdds: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "700"
  },
  cardMeta: {
    color: brandColors.textMuted,
    fontSize: 11
  }
});
