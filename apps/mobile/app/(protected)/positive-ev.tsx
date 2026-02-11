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
import { type PositiveEVOpportunity, type SharpPreset } from "@unjuiced/types";
import { usePositiveEV } from "@/src/hooks/use-positive-ev";
import { useSharpPresets } from "@/src/hooks/use-sharp-presets";
import { useUserPreferences } from "@/src/hooks/use-user-preferences";
import { brandColors } from "@/src/theme/brand";

const SPORT_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
  { id: "ncaab", label: "NCAAB" },
  { id: "ncaaf", label: "NCAAF" },
  { id: "nhl", label: "NHL" },
  { id: "mlb", label: "MLB" },
  { id: "wnba", label: "WNBA" }
];

const MIN_EV_OPTIONS = [0, 0.5, 1, 2, 3, 5];
const MAX_EV_OPTIONS = [10, 15, 20, 30];

function formatOdds(price: number): string {
  return price > 0 ? `+${price}` : String(price);
}

function getOpportunityTitle(opp: PositiveEVOpportunity): string {
  if (opp.playerName) return opp.playerName;
  const away = opp.awayTeam || "Away";
  const home = opp.homeTeam || "Home";
  return `${away} @ ${home}`;
}

function getOpportunitySubtitle(opp: PositiveEVOpportunity): string {
  const side = opp.side.toUpperCase();
  const line = Number.isFinite(opp.line) ? opp.line : 0;
  const team = opp.playerTeam ? ` • ${opp.playerTeam}` : "";
  return `${opp.marketDisplay} • ${side} ${line}${team}`;
}

function parseNumberInput(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBookLabel(id: string): string {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPercent(value: number): string {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(1);
}

export default function PositiveEvScreen() {
  const { data: presetsData, isLoading: presetsLoading } = useSharpPresets();
  const { preferences, isLoading: prefsLoading, savePreferences, isSaving } = useUserPreferences();

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<SharpPreset>("pinnacle");
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>(["nba", "nfl"]);
  const [minEvInput, setMinEvInput] = useState("2");
  const [maxEvInput, setMaxEvInput] = useState("");
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const presets = useMemo(() => presetsData?.presets ?? [], [presetsData?.presets]);

  useEffect(() => {
    if (prefsLoading || filtersHydrated) return;
    setSelectedPreset(preferences.positiveEvSharpPreset);
    setSelectedBooks(preferences.positiveEvSelectedBooks);
    setSelectedSports(preferences.positiveEvSelectedSports);
    setMinEvInput(String(preferences.positiveEvMinEv));
    setMaxEvInput(
      typeof preferences.positiveEvMaxEv === "number" && Number.isFinite(preferences.positiveEvMaxEv)
        ? String(preferences.positiveEvMaxEv)
        : ""
    );
    setFiltersHydrated(true);
  }, [filtersHydrated, preferences, prefsLoading]);

  useEffect(() => {
    if (!presets.length) return;
    const hasSelected = presets.some((preset) => preset.id === selectedPreset);
    if (hasSelected) return;
    const hasPinnacle = presets.some((preset) => preset.id === "pinnacle");
    setSelectedPreset(hasPinnacle ? "pinnacle" : (presets[0].id as SharpPreset));
  }, [presets, selectedPreset]);

  const numericMinEv = useMemo(
    () => Math.max(0, parseNumberInput(minEvInput, preferences.positiveEvMinEv)),
    [minEvInput, preferences.positiveEvMinEv]
  );

  const numericMaxEv = useMemo(() => {
    if (!maxEvInput.trim()) return undefined;
    const raw = parseNumberInput(maxEvInput, preferences.positiveEvMaxEv ?? 0);
    return Math.max(numericMinEv, raw);
  }, [maxEvInput, numericMinEv, preferences.positiveEvMaxEv]);

  const { data, isLoading, isError, error, refetch, isRefetching } = usePositiveEV({
    sports: selectedSports,
    books: selectedBooks,
    sharpPreset: selectedPreset,
    mode: "pregame",
    minEV: numericMinEv,
    maxEV: numericMaxEv,
    minBooksPerSide: preferences.positiveEvMinBooksPerSide,
    limit: 100,
    autoRefreshEnabled
  });

  const availableBooks = useMemo(() => {
    const map = new Map<string, string>();
    data?.opportunities.forEach((opp) => {
      if (!opp.book?.bookId) return;
      map.set(opp.book.bookId, opp.book.bookName || normalizeBookLabel(opp.book.bookId));
    });
    selectedBooks.forEach((bookId) => {
      if (!map.has(bookId)) map.set(bookId, normalizeBookLabel(bookId));
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data?.opportunities, selectedBooks]);

  const availableBookIds = useMemo(() => availableBooks.map((book) => book.id), [availableBooks]);

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

  function toggleSport(sportId: string) {
    setSelectedSports((current) => {
      if (current.includes(sportId)) {
        if (current.length === 1) return current;
        return current.filter((sport) => sport !== sportId);
      }
      return [...current, sportId];
    });
  }

  async function applyFilters() {
    await savePreferences({
      positive_ev_selected_books: selectedBooks,
      positive_ev_selected_sports: selectedSports,
      positive_ev_sharp_preset: selectedPreset,
      positive_ev_min_ev: numericMinEv,
      positive_ev_max_ev: numericMaxEv ?? null
    });
  }

  async function resetFilters() {
    setSelectedBooks([]);
    setSelectedSports(["nba", "nfl"]);
    setSelectedPreset("pinnacle");
    setMinEvInput("2");
    setMaxEvInput("");
    await savePreferences({
      positive_ev_selected_books: [],
      positive_ev_selected_sports: ["nba", "nfl"],
      positive_ev_sharp_preset: "pinnacle",
      positive_ev_min_ev: 2,
      positive_ev_max_ev: null
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={brandColors.primary} />}
      >
        <View style={styles.headerCard}>
          <Text style={styles.pageTitle}>Positive EV</Text>
          <Text style={styles.pageSubtitle}>Preset-driven +EV feed</Text>
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

          <Text style={styles.sectionLabel}>Presets</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalRow}>
            {presetsLoading ? (
              <View style={styles.presetLoading}>
                <ActivityIndicator size="small" color={brandColors.primary} />
              </View>
            ) : null}
            {presets.map((preset) => {
              const active = preset.id === selectedPreset;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => setSelectedPreset(preset.id as SharpPreset)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{preset.label || preset.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionLabel}>Sports</Text>
          <View style={styles.chipWrap}>
            {SPORT_OPTIONS.map((sport) => {
              const active = selectedSports.includes(sport.id);
              return (
                <Pressable key={sport.id} onPress={() => toggleSport(sport.id)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{sport.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {availableBooks.length > 0 ? (
            <>
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
            </>
          ) : null}

          <Text style={styles.sectionLabel}>Min EV %</Text>
          <View style={styles.quickRow}>
            {MIN_EV_OPTIONS.map((value) => {
              const active = numericMinEv === value;
              return (
                <Pressable key={`min-${value}`} onPress={() => setMinEvInput(String(value))} style={[styles.quickChip, active && styles.quickChipActive]}>
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{formatPercent(value)}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Max EV %</Text>
          <View style={styles.quickRow}>
            <Pressable onPress={() => setMaxEvInput("")} style={[styles.quickChip, maxEvInput.trim() === "" && styles.quickChipActive]}>
              <Text style={[styles.quickChipText, maxEvInput.trim() === "" && styles.quickChipTextActive]}>None</Text>
            </Pressable>
            {MAX_EV_OPTIONS.map((value) => {
              const active = numericMaxEv === value;
              return (
                <Pressable key={`max-${value}`} onPress={() => setMaxEvInput(String(value))} style={[styles.quickChip, active && styles.quickChipActive]}>
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
                value={minEvInput}
                onChangeText={(value) => setMinEvInput(value.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
                placeholder="2"
                placeholderTextColor={brandColors.textMuted}
              />
            </View>
            <View style={styles.inputItem}>
              <Text style={styles.inputLabel}>Max</Text>
              <TextInput
                style={styles.input}
                value={maxEvInput}
                onChangeText={(value) => setMaxEvInput(value.replace(/[^0-9.]/g, ""))}
                keyboardType="decimal-pad"
                placeholder="Optional"
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
          <Text style={styles.metaText}>Preset {selectedPreset}</Text>
          <Text style={styles.metaText}>Rows {data?.opportunities.length ?? 0}</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={brandColors.primary} />
            <Text style={styles.loadingText}>Loading +EV opportunities...</Text>
          </View>
        ) : null}

        {isError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Positive EV failed to load</Text>
            <Text style={styles.errorBody}>{error instanceof Error ? error.message : "Unknown error"}</Text>
            <Pressable onPress={() => void refetch()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !isError && (data?.opportunities.length ?? 0) === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No opportunities found</Text>
            <Text style={styles.emptyBody}>Adjust sportsbook, sport, preset, or EV filters.</Text>
          </View>
        ) : null}

        {!isLoading && !isError
          ? data?.opportunities.map((opp) => {
              const ev = opp.evCalculations?.evWorst ?? 0;
              return (
                <View key={opp.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardTitle}>{getOpportunityTitle(opp)}</Text>
                    <Text style={styles.cardEv}>EV {ev.toFixed(2)}%</Text>
                  </View>
                  <Text style={styles.cardSub}>{getOpportunitySubtitle(opp)}</Text>
                  <View style={styles.cardRow}>
                    <Text style={styles.bookText}>{opp.book.bookName || opp.book.bookId}</Text>
                    <Text style={styles.oddsText}>{formatOdds(opp.book.price)}</Text>
                  </View>
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
  horizontalRow: {
    gap: 6,
    paddingRight: 8
  },
  presetLoading: {
    width: 28,
    alignItems: "center",
    justifyContent: "center"
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
    color: "#D7F3FF"
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
  cardTitle: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    flex: 1
  },
  cardEv: {
    color: brandColors.success,
    fontSize: 13,
    fontWeight: "700"
  },
  cardSub: {
    color: "#93C5FD",
    fontSize: 12
  },
  bookText: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "600"
  },
  oddsText: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "700"
  }
});
