import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  LayoutAnimation,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Opportunity } from "@unjuiced/types";
import { useEdgeOpportunities } from "@/src/hooks/use-edge-opportunities";
import { useUserPreferences } from "@/src/hooks/use-user-preferences";
import { getSportsbookLogoUrl, normalizeSportsbookId } from "@/src/lib/logos";
import { getKellyStakeDisplay } from "@/src/lib/kelly";
import { triggerLightImpactHaptic, triggerSelectionHaptic } from "@/src/lib/haptics";
import { remapEdgeOpportunityToSelectedBooks } from "@/src/lib/opportunity-books";
import { brandColors } from "@/src/theme/brand";
import { shortenMarketDisplay, humanizeMarketKey } from "@/src/lib/market-display";
import StateView from "@/src/components/StateView";
import BottomActionBar, { useScrollHideBar, type BottomPill } from "@/src/components/BottomActionBar";
import { SPORT_COLORS, SPORT_OPTIONS } from "@/src/components/positive-ev/constants";
import SharpOpportunityCardShell from "@/src/components/sharp/SharpOpportunityCardShell";

const MIN_EDGE_OPTIONS = [0, 1, 2, 3, 5];
const MIN_ODDS_OPTIONS = [-500, -200, 100, 200];
const MAX_ODDS_OPTIONS = [200, 500, 1000, 2000];
const MARKET_TYPE_OPTIONS: Array<{ value: "all" | "player" | "game"; label: string }> = [
  { value: "all", label: "All" },
  { value: "player", label: "Player" },
  { value: "game", label: "Game" },
];
const SORT_OPTIONS: Array<{ key: EdgeSortField; label: string }> = [
  { key: "edge", label: "Edge%" },
  { key: "kelly", label: "Kelly%" },
  { key: "time", label: "Time" },
  { key: "odds", label: "Odds" },
];

type EdgeSortField = "edge" | "kelly" | "time" | "odds";

function parseAmericanOdds(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^\d+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatOddsString(value: string | null | undefined): string {
  if (!value) return "—";
  return String(value).trim();
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(1);
  return `${rounded}%`;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "$0";
  if (value >= 1000) return `$${Math.round(value).toLocaleString()}`;
  if (value >= 100) return `$${Math.round(value)}`;
  return `$${value.toFixed(2)}`;
}

function decimalFromAmericanString(value: string | null | undefined): number | null {
  const american = parseAmericanOdds(value);
  if (american == null) return null;
  if (american > 0) return 1 + american / 100;
  return 1 + 100 / Math.abs(american);
}

function getDisplayImprovement(opp: Opportunity): number {
  if (typeof opp.bestDecimal === "number" && Number.isFinite(opp.bestDecimal) && typeof opp.sharpDecimal === "number" && Number.isFinite(opp.sharpDecimal) && opp.sharpDecimal > 0) {
    return ((opp.bestDecimal - opp.sharpDecimal) / opp.sharpDecimal) * 100;
  }

  const bestDecimal = decimalFromAmericanString(opp.bestPrice);
  const refDecimal = decimalFromAmericanString(opp.sharpPrice);
  if (bestDecimal && refDecimal && refDecimal > 0) {
    return ((bestDecimal - refDecimal) / refDecimal) * 100;
  }

  return opp.edgePct ?? 0;
}

function formatTimeLabel(isoString: string): string {
  const date = new Date(isoString);
  if (!Number.isFinite(date.getTime())) return "TBD";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isToday) return timeStr;
  if (isTomorrow) return `Tmrw ${timeStr}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${timeStr}`;
}

function getTitle(opp: Opportunity): string {
  if (opp.player && !opp.player.includes("_")) return opp.player;
  if (opp.player?.includes("_")) return humanizeMarketKey(opp.player);
  return `${opp.awayTeam} @ ${opp.homeTeam}`;
}

function getGameInfo(opp: Opportunity): string {
  const matchup = opp.awayTeam && opp.homeTeam ? `${opp.awayTeam} @ ${opp.homeTeam}` : "Matchup";
  const time = opp.gameStart ? formatTimeLabel(opp.gameStart) : "TBD";
  return `${matchup}  ${time}`;
}

function getMarketLabel(opp: Opportunity): string {
  const sideLabel =
    opp.side === "over" ? "O" : opp.side === "under" ? "U" : opp.side === "yes" ? "Yes" : "No";
  const lineValue = Number.isFinite(opp.line) ? ` ${opp.line}` : "";
  const display = shortenMarketDisplay(opp.marketDisplay || opp.market);
  return `${display} ${sideLabel}${lineValue}`.trim();
}

function sportLabel(sport: string): string {
  return SPORT_OPTIONS.find((item) => item.id === sport)?.label ?? sport.toUpperCase();
}

function sortOpportunities(list: Opportunity[], field: EdgeSortField, dir: "asc" | "desc"): Opportunity[] {
  const sorted = [...list];
  const factor = dir === "desc" ? -1 : 1;
  sorted.sort((a, b) => {
    switch (field) {
      case "edge":
        return (getDisplayImprovement(a) - getDisplayImprovement(b)) * factor;
      case "kelly":
        return ((a.kellyFraction ?? 0) - (b.kellyFraction ?? 0)) * factor;
      case "odds": {
        const aOdds = parseAmericanOdds(a.bestPrice) ?? 0;
        const bOdds = parseAmericanOdds(b.bestPrice) ?? 0;
        return (aOdds - bOdds) * factor;
      }
      case "time": {
        const aTime = a.gameStart ? new Date(a.gameStart).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.gameStart ? new Date(b.gameStart).getTime() : Number.MAX_SAFE_INTEGER;
        return (aTime - bTime) * factor;
      }
      default:
        return 0;
    }
  });
  return sorted;
}

function filterBySearch(list: Opportunity[], searchText: string): Opportunity[] {
  const query = searchText.trim().toLowerCase();
  if (!query) return list;

  return list.filter((opp) => {
    const haystack = [
      opp.player,
      opp.homeTeam,
      opp.awayTeam,
      opp.market,
      opp.marketDisplay,
      opp.team,
      opp.position,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function FilterDrawer({
  visible,
  onClose,
  selectedSports,
  onToggleSport,
  marketType,
  onSetMarketType,
  minEdge,
  onSetMinEdge,
  minOdds,
  onSetMinOdds,
  maxOdds,
  onSetMaxOdds,
  resultCount,
  onReset,
}: {
  visible: boolean;
  onClose: () => void;
  selectedSports: string[];
  onToggleSport: (sportId: string) => void;
  marketType: "all" | "player" | "game";
  onSetMarketType: (value: "all" | "player" | "game") => void;
  minEdge: number;
  onSetMinEdge: (value: number) => void;
  minOdds: number;
  onSetMinOdds: (value: number) => void;
  maxOdds: number;
  onSetMaxOdds: (value: number) => void;
  resultCount: number;
  onReset: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.drawerOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.drawerSheet}>
          <View style={styles.drawerHandle} />
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Edge Finder Filters</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={brandColors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.filterSectionLabel}>Sports</Text>
            <View style={styles.quickRow}>
              {SPORT_OPTIONS.map((sport) => {
                const active = selectedSports.includes(sport.id);
                const color = SPORT_COLORS[sport.id] ?? brandColors.primary;
                return (
                  <Pressable
                    key={sport.id}
                    onPress={() => onToggleSport(sport.id)}
                    style={[styles.filterChip, active && { borderColor: color, backgroundColor: `${color}22` }]}
                  >
                    <Text style={[styles.filterChipText, active && { color }]}>{sport.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.filterSectionLabel}>Market Type</Text>
            <View style={styles.quickRow}>
              {MARKET_TYPE_OPTIONS.map((option) => {
                const active = marketType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      triggerSelectionHaptic();
                      onSetMarketType(option.value);
                    }}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.filterSectionLabel}>Min Edge</Text>
            <View style={styles.quickRow}>
              {MIN_EDGE_OPTIONS.map((option) => {
                const active = minEdge === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      triggerSelectionHaptic();
                      onSetMinEdge(option);
                    }}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {option}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.filterSectionLabel}>Min Odds</Text>
            <View style={styles.quickRow}>
              {MIN_ODDS_OPTIONS.map((option) => {
                const active = minOdds === option;
                const label = option > 0 ? `+${option}` : String(option);
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      triggerSelectionHaptic();
                      onSetMinOdds(option);
                    }}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.filterSectionLabel}>Max Odds</Text>
            <View style={styles.quickRow}>
              {MAX_ODDS_OPTIONS.map((option) => {
                const active = maxOdds === option;
                const label = option > 0 ? `+${option}` : String(option);
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      triggerSelectionHaptic();
                      onSetMaxOdds(option);
                    }}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.drawerFooter}>
            <View style={styles.drawerFooterMeta}>
              <Text style={styles.drawerFooterLabel}>Showing</Text>
              <Text style={styles.drawerFooterValue}>{resultCount} edges</Text>
            </View>
            <View style={styles.drawerFooterActions}>
              <Pressable onPress={onReset} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.applyButton}>
                <Text style={styles.applyButtonText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EdgeOpportunityCard({
  opp,
  isExpanded,
  onToggleExpand,
  bankroll,
  kellyPercent,
}: {
  opp: Opportunity;
  isExpanded: boolean;
  onToggleExpand: () => void;
  bankroll: number;
  kellyPercent: number;
}) {
  const accentColor = brandColors.warning;
  const bookLogo = getSportsbookLogoUrl(opp.bestBook);
  const bestOddsNumber = parseAmericanOdds(opp.bestPrice);
  const edgePct = getDisplayImprovement(opp);
  const kellyInfo =
    bestOddsNumber != null && edgePct > 0
      ? getKellyStakeDisplay({
          bankroll,
          bestOdds: bestOddsNumber,
          evPercent: edgePct,
          kellyPercent,
        })
      : null;

  const statItems = [
    { key: "edge", label: "Edge", value: formatPercent(getDisplayImprovement(opp)), accent: true },
    { key: "kelly", label: "Kelly", value: `${((opp.kellyFraction ?? 0) * 100).toFixed(1)}%` },
    { key: "stake", label: "Stake", value: kellyInfo?.display ?? "—" },
    { key: "books", label: "Books", value: String(opp.nBooks || opp.allBooks.length || 1) },
  ];

  const books = [...opp.allBooks].sort((a, b) => b.price - a.price).slice(0, 6);
  const fairValueLabel = formatOddsString(opp.fairAmerican ?? opp.sharpPrice);

  async function openBestBook() {
    const url = opp.bestMobileLink || opp.bestLink;
    if (!url) return;
    triggerLightImpactHaptic();
    await Linking.openURL(url);
  }

  return (
    <View style={styles.edgeCardShell}>
      <SharpOpportunityCardShell
        accentColor={accentColor}
        metaContent={
          <Text style={styles.metaText} numberOfLines={1}>
            <Text style={{ color: accentColor, fontWeight: "800" }}>{sportLabel(opp.sport)}</Text>
            {`  ${getGameInfo(opp)}`}
          </Text>
        }
        badgeText={`+${formatPercent(getDisplayImprovement(opp))}`}
        title={getTitle(opp)}
        selectionRow={
          <View style={styles.selectionRow}>
            <View style={styles.selectionCopy}>
              <View style={styles.selectionMetaRow}>
                <Text style={styles.propText}>{getMarketLabel(opp)}</Text>
                <Text style={styles.oddsText}>{formatOddsString(opp.bestPrice)}</Text>
                <Text style={styles.fvText}>FV {fairValueLabel}</Text>
              </View>
            </View>

            <Pressable onPress={() => void openBestBook()} style={styles.betPill}>
              {bookLogo ? <Image source={{ uri: bookLogo }} style={styles.bookLogo} /> : <View style={styles.bookLogoFallback} />}
              <Text style={[styles.betPillText, { color: accentColor }]}>Bet</Text>
              <Ionicons name="arrow-forward" size={11} color={accentColor} />
            </Pressable>
          </View>
        }
        statItems={statItems}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        expandedContent={
          <>
            {books.map((book) => {
              const logoUrl = getSportsbookLogoUrl(book.book);
              const active = normalizeSportsbookId(book.book) === normalizeSportsbookId(opp.bestBook);
              const bookUrl = book.mobileLink || book.link;
              return (
                <Pressable
                  key={`${opp.id}-${book.book}-${book.price}`}
                  style={styles.boardRow}
                  onPress={() => {
                    if (bookUrl) {
                      triggerLightImpactHaptic();
                      void Linking.openURL(bookUrl);
                    }
                  }}
                >
                  <View style={styles.boardBook}>
                    {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.boardLogo} /> : <View style={styles.boardBookFallback} />}
                    <Text style={styles.boardBookText} numberOfLines={1}>{book.book}</Text>
                  </View>
                  <View style={styles.boardPriceWrap}>
                    <Text style={[styles.boardPrice, active && { color: accentColor }]}>{book.priceFormatted}</Text>
                    {typeof book.limits?.max === "number" ? (
                      <Text style={styles.boardSubtext}>max {formatCurrency(book.limits.max)}</Text>
                    ) : null}
                  </View>
                  {bookUrl ? (
                    <Ionicons name="open-outline" size={12} color={brandColors.textMuted} style={{ marginLeft: 4 }} />
                  ) : null}
                </Pressable>
              );
            })}

            {opp.sharpBooks.length > 0 ? (
              <View style={styles.sharpInfoRow}>
                <Text style={styles.sharpInfoLabel}>Sharp ref</Text>
                <Text style={styles.sharpInfoValue} numberOfLines={1}>{opp.sharpBooks.join(" • ")}</Text>
              </View>
            ) : null}
          </>
        }
      />
    </View>
  );
}

export default function EdgeFinderContent() {
  const { preferences, isLoading: prefsLoading, savePreferences } = useUserPreferences();
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>(["nba", "nfl"]);
  const [marketType, setMarketType] = useState<"all" | "player" | "game">("all");
  const [minEdge, setMinEdge] = useState(0);
  const [minOdds, setMinOdds] = useState(-500);
  const [maxOdds, setMaxOdds] = useState(500);
  const [sortField, setSortField] = useState<EdgeSortField>("edge");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const PAGE_SIZE = 20;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bestOddsComparisonPreset = useMemo(() => {
    if (preferences.bestOddsComparisonMode === "book" && preferences.bestOddsComparisonBook) {
      return preferences.bestOddsComparisonBook;
    }
    if (preferences.bestOddsComparisonMode === "next_best") {
      return "next_best";
    }
    return "average";
  }, [preferences.bestOddsComparisonBook, preferences.bestOddsComparisonMode]);

  useEffect(() => {
    if (prefsLoading || filtersHydrated) return;
    setSelectedSports(preferences.bestOddsSelectedSports ?? ["nba", "nfl"]);
    setMinEdge(preferences.bestOddsMinImprovement);
    setMinOdds(preferences.bestOddsMinOdds ?? -500);
    setMaxOdds(preferences.bestOddsMaxOdds ?? 500);
    setFiltersHydrated(true);
  }, [
    filtersHydrated,
    preferences.bestOddsMaxOdds,
    preferences.bestOddsMinImprovement,
    preferences.bestOddsMinOdds,
    preferences.bestOddsSelectedSports,
    prefsLoading,
  ]);

  useEffect(() => {
    if (!filtersHydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void savePreferences({
        best_odds_selected_sports: selectedSports,
        best_odds_min_improvement: minEdge,
        best_odds_min_odds: minOdds,
        best_odds_max_odds: maxOdds,
      });
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [filtersHydrated, maxOdds, minEdge, minOdds, savePreferences, selectedSports]);

  const { data, isLoading, isError, error, refetch, isRefetching } = useEdgeOpportunities({
    sports: selectedSports,
    preset: bestOddsComparisonPreset,
    markets: preferences.bestOddsSelectedMarkets,
    marketLines: preferences.bestOddsMarketLines,
    marketType,
    minEdge: 0,
    minOdds,
    maxOdds,
    limit: 150,
    autoRefreshEnabled,
    autoRefreshMs: 15_000,
  });

  function toggleSport(sportId: string) {
    triggerSelectionHaptic();
    setSelectedSports((current) => {
      if (current.includes(sportId)) {
        if (current.length === 1) return current;
        return current.filter((sport) => sport !== sportId);
      }
      return [...current, sportId];
    });
  }

  function resetFilters() {
    triggerSelectionHaptic();
    setSelectedSports(["nba", "nfl"]);
    setMarketType("all");
    setMinEdge(0);
    setMinOdds(-500);
    setMaxOdds(500);
  }

  function toggleSort(field: EdgeSortField) {
    triggerSelectionHaptic();
    if (field === sortField) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }
    setSortField(field);
    setSortDir("desc");
  }

  const { translateY: bottomBarTranslateY, onScroll: onListScroll } = useScrollHideBar();
  const allOpportunities = data?.opportunities ?? [];
  const preferredBooks = preferences.preferredSportsbooks;
  const prevOrderRef = useRef<string[]>([]);

  const visibleOpportunities = useMemo(() => {
    let list = [...allOpportunities];

    if (preferredBooks.length > 0) {
      list = list
        .map((opp) => remapEdgeOpportunityToSelectedBooks(opp, preferredBooks))
        .filter((opp): opp is Opportunity => opp !== null);
    }

    if (preferences.bestOddsSelectedMarkets.length > 0) {
      const marketSet = new Set(preferences.bestOddsSelectedMarkets);
      list = list.filter((opp) => marketSet.has(opp.market));
    }

    if (Object.keys(preferences.bestOddsMarketLines).length > 0) {
      list = list.filter((opp) => {
        const allowedLines = preferences.bestOddsMarketLines[opp.market];
        if (!allowedLines || allowedLines.length === 0) return true;
        return allowedLines.includes(opp.line);
      });
    }

    list = list.filter((opp) => getDisplayImprovement(opp) >= minEdge);
    list = sortOpportunities(list, sortField, sortDir);

    // When a card is expanded, preserve the current order so the user's
    // view doesn't jump around during auto-refresh.
    if (expandedId) {
      const prevOrder = prevOrderRef.current;
      if (prevOrder.length > 0) {
        const orderMap = new Map(prevOrder.map((id, i) => [id, i]));
        list = list.slice().sort((a, b) => {
          const ai = orderMap.get(a.id) ?? Infinity;
          const bi = orderMap.get(b.id) ?? Infinity;
          return ai - bi;
        });
      }
    } else {
      prevOrderRef.current = list.map((o) => o.id);
    }

    return list;
  }, [
    allOpportunities,
    expandedId,
    minEdge,
    preferences.bestOddsMarketLines,
    preferences.bestOddsSelectedMarkets,
    preferredBooks,
    sortDir,
    sortField,
  ]);

  // Reset pagination when filters change
  useEffect(() => {
    setDisplayLimit(PAGE_SIZE);
  }, [allOpportunities, minEdge, preferredBooks, sortField, sortDir]);

  const paginatedOpportunities = useMemo(
    () => visibleOpportunities.slice(0, displayLimit),
    [visibleOpportunities, displayLimit]
  );

  const hasMore = displayLimit < visibleOpportunities.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayLimit((prev) => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  const activeFilterCount =
    ((preferences.bestOddsSelectedSports ?? ["nba", "nfl"]).join(",") !== ["nba", "nfl"].join(",") ? 1 : 0) +
    (marketType !== "all" ? 1 : 0) +
    (minEdge !== 0 ? 1 : 0) +
    (minOdds !== -500 ? 1 : 0) +
    (maxOdds !== 500 ? 1 : 0);

  const bottomPills: BottomPill[] = [
    ...SORT_OPTIONS.map((option) => ({
      key: option.key,
      label: option.label,
      active: sortField === option.key,
      onPress: () => toggleSort(option.key),
    })),
    {
      key: "auto",
      label: "Auto \u27F3",
      active: autoRefreshEnabled,
      onPress: () => {
        triggerSelectionHaptic();
        setAutoRefreshEnabled((c) => !c);
      },
    },
  ];

  const listEmpty = isLoading ? (
    <StateView state="loading" message="Loading edge opportunities..." />
  ) : isError ? (
    <StateView
      state="error"
      title="Edge Finder failed to load"
      message={error instanceof Error ? error.message : "Unexpected error"}
      onRetry={() => void refetch()}
    />
  ) : (
    <StateView
      state="empty"
      icon="pulse-outline"
      message="No edges found. Adjust filters or try a different sport."
    />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={paginatedOpportunities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <EdgeOpportunityCard
            opp={item}
            bankroll={preferences.evBankroll}
            kellyPercent={preferences.evKellyPercent}
            isExpanded={expandedId === item.id}
            onToggleExpand={() => {
              LayoutAnimation.configureNext({
                duration: 150,
                update: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.scaleY },
                create: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity, duration: 100 },
                delete: { type: LayoutAnimation.Types.easeOut, property: LayoutAnimation.Properties.opacity, duration: 100 },
              });
              triggerSelectionHaptic();
              setExpandedId((current) => (current === item.id ? null : item.id));
            }}
          />
        )}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={hasMore ? (
          <View style={styles.loadMoreFooter}>
            <ActivityIndicator size="small" color={brandColors.primary} />
          </View>
        ) : null}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={manualRefreshing}
            onRefresh={() => {
              triggerSelectionHaptic();
              setManualRefreshing(true);
              refetch().finally(() => setManualRefreshing(false));
            }}
            tintColor={brandColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={onListScroll}
        scrollEventThrottle={16}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
      />

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

      <FilterDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        selectedSports={selectedSports}
        onToggleSport={toggleSport}
        marketType={marketType}
        onSetMarketType={setMarketType}
        minEdge={minEdge}
        onSetMinEdge={setMinEdge}
        minOdds={minOdds}
        onSetMinOdds={setMinOdds}
        maxOdds={maxOdds}
        onSetMaxOdds={setMaxOdds}
        resultCount={visibleOpportunities.length}

        onReset={resetFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 92,
  },
  loadMoreFooter: {
    paddingVertical: 16,
    alignItems: "center",
  },
  edgeCardShell: {
    marginBottom: 10,
  },
  metaText: {
    flex: 1,
    color: brandColors.textMuted,
    fontSize: 9,
    fontWeight: "700",
  },
  selectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  selectionCopy: {
    flex: 1,
    justifyContent: "center",
  },
  selectionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  propText: {
    color: brandColors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
  },
  oddsText: {
    color: brandColors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  fvText: {
    color: brandColors.textMuted,
    fontSize: 9,
    fontWeight: "600",
  },
  bookLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  bookLogoFallback: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: brandColors.panelBackgroundAlt,
    borderWidth: 1,
    borderColor: brandColors.border,
  },
  betPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: 30,
    minWidth: 66,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.26)",
    backgroundColor: "rgba(251,191,36,0.08)",
  },
  betPillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  edgeCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.18)",
    padding: 12,
    gap: 10,
    overflow: "hidden",
  },
  edgeHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  edgeHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  edgeMetaRow: {
    gap: 1,
  },
  edgeLeague: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  edgeMetaText: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  edgeTitle: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  edgeLine: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  edgeHeaderActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  edgeBadge: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(34, 197, 94, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.22)",
  },
  edgeBadgeText: {
    color: brandColors.success,
    fontSize: 14,
    fontWeight: "900",
  },
  edgeBetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  edgeBookLogo: {
    width: 30,
    height: 30,
    borderRadius: 9,
  },
  edgeBookFallback: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: brandColors.panelBackgroundAlt,
    borderWidth: 1,
    borderColor: brandColors.border,
  },
  edgeBetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.22)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(10, 20, 34, 0.60)",
  },
  edgeBetButtonText: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  edgeStatsRow: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
    overflow: "hidden",
  },
  edgeStatCell: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 9,
  },
  edgeStatCellDivider: {
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.06)",
  },
  edgeStatValue: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  edgeStatValueAccent: {
    color: brandColors.success,
  },
  edgeStatLabel: {
    marginTop: 2,
    color: brandColors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  expandButton: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  expandButtonText: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  boardWrap: {
    marginTop: -2,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 10,
    gap: 8,
  },
  boardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  boardBook: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  boardLogo: {
    width: 26,
    height: 26,
    borderRadius: 8,
  },
  boardBookFallback: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  boardBookText: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "capitalize",
    flex: 1,
  },
  boardPriceWrap: {
    alignItems: "flex-end",
  },
  boardPrice: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  boardSubtext: {
    marginTop: 2,
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  sharpInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  sharpInfoLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  sharpInfoValue: {
    flex: 1,
    textAlign: "right",
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  drawerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  drawerSheet: {
    maxHeight: "84%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.appBackground,
  },
  drawerHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: brandColors.borderStrong,
    marginTop: 10,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  drawerTitle: {
    color: brandColors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  drawerContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  filterSectionLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 6,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brandColors.borderStrong,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft,
  },
  filterChipText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#D7F3FF",
  },
  drawerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: brandColors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  drawerFooterMeta: {
    gap: 4,
  },
  drawerFooterLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  drawerFooterValue: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  drawerFooterActions: {
    flexDirection: "row",
    gap: 8,
  },
  resetButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brandColors.borderStrong,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  resetButtonText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  applyButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brandColors.primaryStrong,
    backgroundColor: brandColors.primaryStrong,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  applyButtonText: {
    color: "#E0F2FE",
    fontSize: 13,
    fontWeight: "800",
  },
  bottomBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
});
