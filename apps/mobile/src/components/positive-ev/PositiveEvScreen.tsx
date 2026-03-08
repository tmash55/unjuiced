import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PositiveEVOpportunity, SharpPreset } from "@unjuiced/types";
import { usePositiveEV } from "@/src/hooks/use-positive-ev";
import { useSharpPresets } from "@/src/hooks/use-sharp-presets";
import { useUserPreferences } from "@/src/hooks/use-user-preferences";
import { triggerSelectionHaptic } from "@/src/lib/haptics";
import { brandColors } from "@/src/theme/brand";
import StateView from "@/src/components/StateView";
import PlanGate from "@/src/components/plan-gate/PlanGate";
import { PLAN_GATE_FEATURES } from "@/src/components/plan-gate/plan-gate-config";
import PageHeader from "@/src/components/PageHeader";
import SportsbookPicker from "@/src/components/SportsbookPicker";
import BottomActionBar, { useScrollHideBar, type BottomPill } from "@/src/components/BottomActionBar";
import { SORT_OPTIONS, DEFAULT_DEVIG_METHODS, type SortField, type EVModeOption, type DevigMethodOption } from "./constants";
import { sortOpportunities } from "./helpers";
import OpportunityCard from "./OpportunityCard";
import FilterDrawer from "./FilterDrawer";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ScreenProps = {
  /** When true, skip SafeAreaView + PageHeader (parent provides them) */
  embedded?: boolean;
};

export default function PositiveEvScreen({ embedded }: ScreenProps = {}) {
  const { data: presetsData } = useSharpPresets();
  const { preferences, isLoading: prefsLoading, savePreferences } = useUserPreferences();

  /* ─── Filter state ─── */
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<SharpPreset>("pinnacle");
  const [selectedSports, setSelectedSports] = useState<string[]>(["nba", "nfl"]);
  const [minEv, setMinEv] = useState(2);
  const [maxEv, setMaxEv] = useState<number | undefined>(undefined);
  const [mode, setMode] = useState<EVModeOption>("pregame");
  const [bankroll, setBankroll] = useState(1000);
  const [kellyFraction, setKellyFraction] = useState(25);
  const [devigMethods, setDevigMethods] = useState<DevigMethodOption[]>(DEFAULT_DEVIG_METHODS);
  const [playerProps, setPlayerProps] = useState(true);
  const [gameProps, setGameProps] = useState(true);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  /* ─── New state ─── */
  const [sortField, setSortField] = useState<SortField>("ev");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  /* ─── Expand / hide ─── */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    triggerSelectionHaptic();
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const toggleHide = useCallback((id: string) => {
    triggerSelectionHaptic();
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const presets = useMemo(() => presetsData?.presets ?? [], [presetsData?.presets]);

  /* ─── Hydrate from preferences ─── */
  useEffect(() => {
    if (prefsLoading || filtersHydrated) return;
    setSelectedPreset(preferences.positiveEvSharpPreset);
    setSelectedSports(preferences.positiveEvSelectedSports);
    setMinEv(preferences.positiveEvMinEv);
    setMaxEv(preferences.positiveEvMaxEv);
    setBankroll(preferences.evBankroll);
    setKellyFraction(preferences.evKellyPercent);
    setFiltersHydrated(true);
  }, [filtersHydrated, preferences, prefsLoading]);

  /* ─── Ensure preset is valid ─── */
  useEffect(() => {
    if (!presets.length) return;
    const hasSelected = presets.some((p) => p.id === selectedPreset);
    if (hasSelected) return;
    const hasPinnacle = presets.some((p) => p.id === "pinnacle");
    setSelectedPreset(hasPinnacle ? "pinnacle" : (presets[0].id as SharpPreset));
  }, [presets, selectedPreset]);

  /* ─── Auto-save preferences ─── */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!filtersHydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void savePreferences({
        positive_ev_selected_sports: selectedSports,
        positive_ev_sharp_preset: selectedPreset,
        positive_ev_min_ev: minEv,
        positive_ev_max_ev: maxEv ?? null,
        ev_bankroll: bankroll,
        ev_kelly_percent: kellyFraction,
      });
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [selectedSports, selectedPreset, minEv, maxEv, bankroll, kellyFraction, filtersHydrated, savePreferences]);

  /* ─── Data fetch ─── */
  const marketType = playerProps && gameProps ? "all" : playerProps ? "player" : gameProps ? "game" : "all";

  const { data, isLoading, isError, error, refetch, isRefetching } = usePositiveEV({
    sports: selectedSports,
    books: preferences.preferredSportsbooks,
    sharpPreset: selectedPreset,
    devigMethods,
    marketType,
    mode: mode === "all" ? undefined : mode,
    minEV: minEv,
    maxEV: maxEv,
    minBooksPerSide: preferences.positiveEvMinBooksPerSide,
    limit: 100,
    autoRefreshEnabled,
  });

  function toggleSport(sportId: string) {
    triggerSelectionHaptic();
    setSelectedSports((current) => {
      if (current.includes(sportId)) {
        if (current.length === 1) return current;
        return current.filter((s) => s !== sportId);
      }
      return [...current, sportId];
    });
  }

  function toggleDevigMethod(method: DevigMethodOption) {
    triggerSelectionHaptic();
    setDevigMethods((current) => {
      if (current.includes(method)) {
        if (current.length === 1) return current;
        return current.filter((m) => m !== method);
      }
      return [...current, method];
    });
  }

  function toggleSort(field: SortField) {
    triggerSelectionHaptic();
    if (field === sortField) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function resetAllFilters() {
    triggerSelectionHaptic();
    setSelectedSports(["nba", "nfl"]);
    setSelectedPreset("pinnacle");
    setDevigMethods(DEFAULT_DEVIG_METHODS);
    setPlayerProps(true);
    setGameProps(true);
    setMinEv(2);
    setMaxEv(undefined);
    setMode("pregame");
    setBankroll(1000);
    setKellyFraction(25);
  }

  /* ─── Active filter detection ─── */
  const devigNonDefault = !(devigMethods.length === DEFAULT_DEVIG_METHODS.length && DEFAULT_DEVIG_METHODS.every((m) => devigMethods.includes(m)));

  const marketTypeNonDefault = !playerProps || !gameProps;

  const hasActiveFilters =
    selectedPreset !== "pinnacle" ||
    devigNonDefault ||
    marketTypeNonDefault ||
    !(selectedSports.length === 2 && selectedSports.includes("nba") && selectedSports.includes("nfl")) ||
    minEv !== 2 ||
    maxEv !== undefined ||
    mode !== "pregame" ||
    bankroll !== 1000 ||
    kellyFraction !== 25;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedPreset !== "pinnacle") count++;
    if (devigNonDefault) count++;
    if (marketTypeNonDefault) count++;
    if (!(selectedSports.length === 2 && selectedSports.includes("nba") && selectedSports.includes("nfl"))) count++;
    if (minEv !== 2) count++;
    if (maxEv !== undefined) count++;
    if (mode !== "pregame") count++;
    if (bankroll !== 1000) count++;
    if (kellyFraction !== 25) count++;
    return count;
  }, [selectedPreset, devigNonDefault, marketTypeNonDefault, selectedSports, minEv, maxEv, mode, bankroll, kellyFraction]);

  const presetLabel = useMemo(() => {
    const found = presets.find((p) => p.id === selectedPreset);
    return found ? (found.label || found.name) : selectedPreset;
  }, [presets, selectedPreset]);

  /* ─── Pipeline: raw → filter hidden → search → sort ─── */
  const allOpportunities = data?.opportunities ?? [];
  const hiddenCount = allOpportunities.filter((o) => hiddenIds.has(o.id)).length;

  const opportunities = useMemo(() => {
    let list = showHidden
      ? allOpportunities
      : allOpportunities.filter((o) => !hiddenIds.has(o.id));
    list = sortOpportunities(list, sortField, sortDir);
    return list;
  }, [allOpportunities, hiddenIds, showHidden, sortField, sortDir]);

  /* ─── Bottom bar scroll-hide ─── */
  const { translateY: bottomBarTranslateY, onScroll: onListScroll } = useScrollHideBar();

  /* ─── FlatList callbacks ─── */
  const renderItem = useCallback(
    ({ item, index }: { item: PositiveEVOpportunity; index: number }) => (
      <OpportunityCard
        opp={item}
        rank={index}
        isFeatured={index === 0}
        isExpanded={expandedId === item.id}
        isHidden={hiddenIds.has(item.id)}
        onToggleExpand={() => toggleExpand(item.id)}
        onToggleHide={() => toggleHide(item.id)}
        bankroll={bankroll}
        kellyPercent={kellyFraction}
      />
    ),
    [expandedId, hiddenIds, toggleExpand, toggleHide, bankroll, kellyFraction]
  );

  const keyExtractor = useCallback((item: PositiveEVOpportunity) => item.id, []);

  /* ─── List header: hidden toggle ─── */
  const listHeader = hiddenCount > 0 || isRefetching ? (
    <View style={styles.listHeader}>
      <View style={styles.countRow}>
        {hiddenCount > 0 ? (
          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              setShowHidden((c) => !c);
            }}
            hitSlop={6}
            style={styles.hiddenTogglePill}
          >
            <Ionicons
              name={showHidden ? "eye-off-outline" : "eye-outline"}
              size={12}
              color={brandColors.primary}
            />
            <Text style={styles.hiddenToggle}>
              {showHidden ? "Hide hidden" : `${hiddenCount} hidden`}
            </Text>
          </Pressable>
        ) : null}
        {isRefetching ? <ActivityIndicator size="small" color={brandColors.primary} /> : null}
      </View>
    </View>
  ) : null;

  /* ─── Bottom bar pills ─── */
  const bottomPills: BottomPill[] = useMemo(() => {
    const pills: BottomPill[] = SORT_OPTIONS.map((opt) => ({
      key: opt.field,
      label: `${opt.label}${opt.field === sortField ? (sortDir === "desc" ? " \u2193" : " \u2191") : ""}`,
      active: opt.field === sortField,
      onPress: () => toggleSort(opt.field),
    }));
    pills.push({
      key: "auto",
      label: "Auto \u27F3",
      active: autoRefreshEnabled,
      onPress: () => {
        triggerSelectionHaptic();
        setAutoRefreshEnabled((c) => !c);
      },
    });
    pills.push({
      key: "preset",
      label: presetLabel,
      color: "#FBBF24",
      colorBg: "rgba(251, 191, 36, 0.08)",
      colorBorder: "rgba(251, 191, 36, 0.3)",
    });
    return pills;
  }, [sortField, sortDir, autoRefreshEnabled, presetLabel]);

  const listEmpty = isLoading ? (
    <StateView state="loading" message="Loading +EV opportunities..." />
  ) : isError ? (
    <StateView
      state="error"
      message={error instanceof Error ? error.message : "Unexpected error"}
      onRetry={() => void refetch()}
    />
  ) : (
    <StateView
      state="empty"
      icon="filter-outline"
      message="No opportunities found. Adjust your filters."
    />
  );

  const content = (
    <View style={{ flex: 1 }}>
      {/* ─── Page Header (only when standalone) ─── */}
      {!embedded ? (
        <PageHeader
          title="Sharp +EV"
          autoRefresh={{
            enabled: autoRefreshEnabled,
            onToggle: () => {
              triggerSelectionHaptic();
              setAutoRefreshEnabled((c) => !c);
            }
          }}
          onRefresh={() => {
            triggerSelectionHaptic();
            void refetch();
          }}
          isRefetching={isRefetching}
          onSportsbooksPress={() => setPickerVisible(true)}
          selectedSportsbooks={preferences.preferredSportsbooks}
        />
      ) : null}

        {/* ─── FlatList ─── */}
        <FlatList
          data={opportunities}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={styles.listContent}
          onRefresh={() => {
            triggerSelectionHaptic();
            void refetch();
          }}
          refreshing={isRefetching}
          showsVerticalScrollIndicator={false}
          onScroll={onListScroll}
          scrollEventThrottle={16}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
        />

        {/* ─── Bottom Bar (scroll-hide, no bg) ─── */}
        <Animated.View style={[styles.bottomBar, { transform: [{ translateY: bottomBarTranslateY }] }]}>
          <BottomActionBar
            filterCount={activeFilterCount}
            onFilterPress={() => {
              triggerSelectionHaptic();
              setDrawerVisible(true);
            }}
            pills={bottomPills}
          />
        </Animated.View>

        {/* ─── Filter Drawer ─── */}
        <FilterDrawer
          visible={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          presets={presets}
          selectedPreset={selectedPreset}
          onSelectPreset={setSelectedPreset}
          selectedSports={selectedSports}
          onToggleSport={toggleSport}
          playerProps={playerProps}
          gameProps={gameProps}
          onTogglePlayerProps={() => setPlayerProps((c) => gameProps ? !c : c)}
          onToggleGameProps={() => setGameProps((c) => playerProps ? !c : c)}
          selectedDevigMethods={devigMethods}
          onToggleDevigMethod={toggleDevigMethod}
          minEv={minEv}
          onSetMinEv={setMinEv}
          maxEv={maxEv}
          onSetMaxEv={setMaxEv}
          mode={mode}
          onSetMode={setMode}
          bankroll={bankroll}
          onSetBankroll={setBankroll}
          kellyPercent={kellyFraction}
          onSetKellyPercent={setKellyFraction}
          resultCount={opportunities.length}
          isNonDefault={hasActiveFilters}
          onReset={resetAllFilters}
        />

        {!embedded ? (
          <SportsbookPicker
            visible={pickerVisible}
            onClose={() => setPickerVisible(false)}
            selected={preferences.preferredSportsbooks}
            onSave={(books) => void savePreferences({ preferred_sportsbooks: books })}
          />
        ) : null}
    </View>
  );

  if (embedded) {
    return (
      <PlanGate feature={PLAN_GATE_FEATURES.positiveEv} bannerBottomOffset={52}>
        {content}
      </PlanGate>
    );
  }

  return (
    <PlanGate feature={PLAN_GATE_FEATURES.positiveEv} bannerBottomOffset={52}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {content}
      </SafeAreaView>
    </PlanGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground,
  },

  /* ── List content ── */
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 92,
  },
  listHeader: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 10,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  hiddenTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: brandColors.panelBackground,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.14)",
  },
  hiddenToggle: {
    color: brandColors.primary,
    fontSize: 11,
    fontWeight: "700",
  },

  /* ── Bottom bar (no bg, pills have their own bg) ── */
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    height: 56,
  },
});
