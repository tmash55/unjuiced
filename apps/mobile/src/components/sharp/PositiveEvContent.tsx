import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type PositiveEVOpportunity, type SharpPreset } from "@unjuiced/types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { usePositiveEV } from "@/src/hooks/use-positive-ev";
import { useSharpPresets } from "@/src/hooks/use-sharp-presets";
import { useUserPreferences } from "@/src/hooks/use-user-preferences";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";

/* ─── constants ─── */

const SPORT_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
  { id: "ncaab", label: "NCAAB" },
  { id: "ncaaf", label: "NCAAF" },
  { id: "nhl", label: "NHL" },
  { id: "mlb", label: "MLB" },
  { id: "wnba", label: "WNBA" }
];

const SPORT_COLORS: Record<string, string> = {
  nba: "#2563EB",
  nfl: "#16A34A",
  ncaab: "#7C3AED",
  ncaaf: "#CA8A04",
  nhl: "#0891B2",
  mlb: "#DC2626",
  wnba: "#DB2777",
  ufc: "#D4163C"
};

const SPORT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  nba: "basketball-outline",
  nfl: "american-football-outline",
  ncaab: "basketball-outline",
  ncaaf: "american-football-outline",
  nhl: "disc-outline",
  mlb: "baseball-outline",
  wnba: "basketball-outline",
  ufc: "body-outline"
};

const MIN_EV_OPTIONS = [0, 0.5, 1, 2, 3, 5];
const MAX_EV_OPTIONS: Array<{ value: number | undefined; label: string }> = [
  { value: undefined, label: "None" },
  { value: 10, label: "10%" },
  { value: 15, label: "15%" },
  { value: 20, label: "20%" },
  { value: 30, label: "30%" }
];

/* ─── helpers ─── */

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

function evColor(ev: number): string {
  if (ev >= 3) return brandColors.success;
  if (ev >= 1) return brandColors.warning;
  return brandColors.textSecondary;
}

function sportLabel(sportId: string): string {
  return SPORT_OPTIONS.find((s) => s.id === sportId)?.label ?? sportId.toUpperCase();
}

function probToAmerican(prob: number): number {
  if (prob <= 0 || prob >= 1) return 0;
  if (prob >= 0.5) return Math.round((-100 * prob) / (1 - prob));
  return Math.round((100 * (1 - prob)) / prob);
}

function getFairValueOdds(opp: PositiveEVOpportunity): number | null {
  if (!opp.sharpReference) return null;
  if (opp.side === "over" || opp.side === "yes") return opp.sharpReference.overOdds;
  if (opp.side === "under" || opp.side === "no") return opp.sharpReference.underOdds;
  return null;
}

function formatGameInfo(opp: PositiveEVOpportunity): string {
  const parts: string[] = [];
  if (opp.awayTeam && opp.homeTeam) {
    parts.push(`${opp.awayTeam} @ ${opp.homeTeam}`);
  }
  if (opp.startTime) {
    const date = new Date(opp.startTime);
    if (Number.isFinite(date.getTime())) {
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = date.toDateString() === tomorrow.toDateString();
      const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      if (isToday) parts.push(`Today ${timeStr}`);
      else if (isTomorrow) parts.push(`Tomorrow ${timeStr}`);
      else parts.push(`${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${timeStr}`);
    }
  }
  return parts.join(" • ");
}

/* ─── Bottom Sheet ─── */

function BottomSheet({
  visible,
  onClose,
  title,
  children
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheetContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.sheetClose}>
              <Ionicons name="close" size={20} color={brandColors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView bounces={false}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── Opportunity Card ─── */

const OpportunityCard = ({
  opp,
  isExpanded,
  isHidden,
  onToggleExpand,
  onToggleHide
}: {
  opp: PositiveEVOpportunity;
  isExpanded: boolean;
  isHidden: boolean;
  onToggleExpand: () => void;
  onToggleHide: () => void;
}) => {
  const ev = opp.evCalculations?.evWorst ?? 0;
  const kelly = (opp.evCalculations?.kellyWorst ?? 0) * 100;
  const sport = opp.sport ?? "";
  const badgeColor = SPORT_COLORS[sport.toLowerCase()] ?? brandColors.textMuted;
  const bookLogo = getSportsbookLogoUrl(opp.book.bookId);
  const fairValue = getFairValueOdds(opp);
  const gameInfo = formatGameInfo(opp);
  const evClr = evColor(ev);

  const hasTwoSides =
    (opp.side === "over" || opp.side === "under") &&
    opp.oppositeBooks &&
    opp.oppositeBooks.length > 0;

  const sideLabel = opp.side === "over" ? "o" : opp.side === "under" ? "u" : opp.side === "yes" ? "Yes" : "No";
  const lineDisplay = opp.line != null && Number.isFinite(opp.line) ? ` ${opp.line}` : "";
  const marketShort = opp.marketDisplay
    ? opp.marketDisplay.replace(/^Player\s+/i, "")
    : opp.market.replace("player_", "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View style={[styles.card, isHidden && styles.cardHidden]}>
      <Pressable onPress={onToggleExpand} style={({ pressed }) => [pressed && styles.cardPressed]}>
        {/* ── Header section ── */}
        <View style={styles.cardHeader}>
          {/* Row 1: Sport + Game + Time | EV badge + icons */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              {SPORT_ICONS[sport.toLowerCase()] ? (
                <Ionicons
                  name={SPORT_ICONS[sport.toLowerCase()]}
                  size={12}
                  color={badgeColor}
                />
              ) : null}
              <Text style={[styles.cardLeague, { color: badgeColor }]}>{sportLabel(sport)}</Text>
              <Text style={styles.cardHeaderDot}>·</Text>
              {opp.awayTeam && opp.homeTeam ? (
                <>
                  <Text style={styles.cardGameText} numberOfLines={1}>
                    {opp.awayTeam} @ {opp.homeTeam}
                  </Text>
                  {gameInfo.includes("•") ? (
                    <>
                      <Text style={styles.cardHeaderDot}>•</Text>
                      <Text style={styles.cardTimeText}>{gameInfo.split("• ").pop()}</Text>
                    </>
                  ) : null}
                </>
              ) : null}
            </View>
            <View style={styles.cardHeaderRight}>
              <View style={[styles.evBadge, { backgroundColor: `${evClr}18` }]}>
                <Text style={[styles.evBadgeText, { color: evClr }]}>+{ev.toFixed(1)}%</Text>
              </View>
              <Pressable onPress={() => onToggleHide()} hitSlop={10}>
                <Ionicons
                  name={isHidden ? "eye-outline" : "eye-off-outline"}
                  size={15}
                  color={brandColors.textMuted}
                />
              </Pressable>
            </View>
          </View>
          {/* Row 2: Market label */}
          <Text style={styles.cardMarketLabel}>{marketShort}</Text>
        </View>

        {/* ── Divider ── */}
        <View style={styles.cardDivider} />

        {/* ── Body section ── */}
        <View style={styles.cardBody}>
          {/* Row 1: Player name + side/line */}
          <Text style={styles.cardPlayerName} numberOfLines={1}>
            {getOpportunityTitle(opp)}
            <Text style={styles.cardSideLine}>{"  "}{sideLabel}{lineDisplay}</Text>
          </Text>

          {/* Row 2: Book logo + odds + chevron | FV + Kelly */}
          <View style={styles.cardOddsRow}>
            <View style={styles.cardOddsLeft}>
              {bookLogo ? (
                <Image source={{ uri: bookLogo }} style={styles.bookLogo} />
              ) : null}
              <Text style={styles.oddsText}>{formatOdds(opp.book.price)}</Text>
              <View style={[styles.chevronWrap, isExpanded && styles.chevronWrapActive]}>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={12}
                  color={isExpanded ? brandColors.primary : brandColors.textMuted}
                />
              </View>
            </View>
            <View style={styles.cardOddsRight}>
              {fairValue != null ? (
                <Text style={styles.fairValueText}>FV {formatOdds(fairValue)}</Text>
              ) : null}
              <Text style={styles.kellyText}>{kelly.toFixed(1)}% K</Text>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Expanded section */}
      {isExpanded ? (
        <View style={styles.expandedSection}>
          {/* Info row: Sharp + Fair + EV methods */}
          <View style={styles.expandedInfoRow}>
            <View style={styles.expandedInfoItem}>
              <Text style={styles.expandedInfoLabel}>SHARP</Text>
              <Text style={styles.expandedInfoSharp}>
                {formatOdds(opp.sharpReference?.overOdds ?? 0)}/{formatOdds(opp.sharpReference?.underOdds ?? 0)}
              </Text>
            </View>
            {opp.devigResults?.power?.success ? (
              <View style={styles.expandedInfoItem}>
                <Text style={styles.expandedInfoLabel}>FAIR</Text>
                <Text style={styles.expandedInfoFair}>
                  {formatOdds(probToAmerican(
                    opp.side === "over" || opp.side === "yes"
                      ? opp.devigResults.power.fairProbOver
                      : opp.devigResults.power.fairProbUnder
                  ))}
                </Text>
              </View>
            ) : null}
            {opp.evCalculations?.power ? (
              <View style={styles.evMethodBadge}>
                <Text style={styles.evMethodText}>P: +{opp.evCalculations.power.evPercent.toFixed(1)}%</Text>
              </View>
            ) : null}
            {opp.evCalculations?.multiplicative ? (
              <View style={styles.evMethodBadge}>
                <Text style={styles.evMethodText}>M: +{opp.evCalculations.multiplicative.evPercent.toFixed(1)}%</Text>
              </View>
            ) : null}
          </View>

          {/* Odds comparison */}
          {hasTwoSides ? (
            <OverUnderComparison opp={opp} />
          ) : (
            <SingleSideGrid opp={opp} />
          )}
        </View>
      ) : null}
    </View>
  );
};

/* ─── Over/Under Comparison ─── */

const OverUnderComparison = ({ opp }: { opp: PositiveEVOpportunity }) => {
  const overBooks = opp.side === "over" ? opp.allBooks : (opp.oppositeBooks ?? []);
  const underBooks = opp.side === "under" ? opp.allBooks : (opp.oppositeBooks ?? []);

  const allBookIds = useMemo(() => {
    const ids = new Set([...overBooks.map((b) => b.bookId), ...underBooks.map((b) => b.bookId)]);
    return Array.from(ids);
  }, [overBooks, underBooks]);

  const bestOverPrice = useMemo(() => Math.max(...overBooks.map((b) => b.price)), [overBooks]);
  const bestUnderPrice = useMemo(() => Math.max(...underBooks.map((b) => b.price)), [underBooks]);

  const pairedBooks = useMemo(() =>
    allBookIds
      .map((id) => ({
        bookId: id,
        over: overBooks.find((b) => b.bookId === id),
        under: underBooks.find((b) => b.bookId === id)
      }))
      .sort((a, b) => (b.over?.price ?? -9999) - (a.over?.price ?? -9999)),
    [allBookIds, overBooks, underBooks]
  );

  const openLink = (book: { mobileLink?: string | null; link?: string | null } | undefined) => {
    const url = book?.mobileLink || book?.link;
    if (url) void Linking.openURL(url);
  };

  return (
    <View style={styles.oddsCompare}>
      {/* Header */}
      <View style={styles.oddsCompareHeader}>
        <Text style={styles.oddsCompareOverLabel}>Over {opp.line}</Text>
        <Text style={styles.oddsCompareBookLabel}>Book</Text>
        <Text style={styles.oddsCompareUnderLabel}>Under {opp.line}</Text>
      </View>
      {/* Rows */}
      {pairedBooks.map((pair) => {
        const logo = getSportsbookLogoUrl(pair.bookId);
        const isBestOver = pair.over && pair.over.price === bestOverPrice;
        const isBestUnder = pair.under && pair.under.price === bestUnderPrice;
        return (
          <View key={pair.bookId} style={styles.oddsCompareRow}>
            <Pressable
              onPress={() => openLink(pair.over)}
              disabled={!pair.over}
              style={[styles.oddsCell, isBestOver && styles.oddsCellBest, !pair.over && styles.oddsCellDisabled]}
            >
              <Text style={[styles.oddsCellText, isBestOver && styles.oddsCellTextBest]}>
                {pair.over ? formatOdds(pair.over.price) : "—"}
              </Text>
            </Pressable>
            <View style={styles.oddsBookCenter}>
              {logo ? (
                <Image source={{ uri: logo }} style={styles.oddsBookLogo} />
              ) : (
                <View style={styles.oddsBookPlaceholder}>
                  <Text style={styles.oddsBookPlaceholderText}>{pair.bookId.slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Pressable
              onPress={() => openLink(pair.under)}
              disabled={!pair.under}
              style={[styles.oddsCell, isBestUnder && styles.oddsCellBestBlue, !pair.under && styles.oddsCellDisabled]}
            >
              <Text style={[styles.oddsCellText, isBestUnder && styles.oddsCellTextBestBlue]}>
                {pair.under ? formatOdds(pair.under.price) : "—"}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
};

/* ─── Single Side Grid ─── */

const SingleSideGrid = ({ opp }: { opp: PositiveEVOpportunity }) => {
  const books = opp.allBooks ?? [];
  const bestBookId = opp.book?.bookId;

  return (
    <View style={styles.singleSideGrid}>
      {books.map((book) => {
        const logo = getSportsbookLogoUrl(book.bookId);
        const isBest = book.bookId === bestBookId;
        const url = book.mobileLink || book.link;
        return (
          <Pressable
            key={book.bookId}
            onPress={() => url && Linking.openURL(url)}
            style={[styles.singleSideCell, isBest && styles.singleSideCellBest]}
          >
            {logo ? (
              <Image source={{ uri: logo }} style={styles.singleSideLogo} />
            ) : null}
            <Text style={[styles.singleSideName, isBest && styles.singleSideNameBest]} numberOfLines={1}>
              {book.bookName || normalizeBookLabel(book.bookId)}
            </Text>
            <Text style={[styles.singleSidePrice, isBest && styles.singleSidePriceBest]}>
              {formatOdds(book.price)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

/* ─── Main Screen ─── */

export default function PositiveEvContent() {
  const { data: presetsData, isLoading: presetsLoading } = useSharpPresets();
  const { preferences, isLoading: prefsLoading, savePreferences } = useUserPreferences();

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<SharpPreset>("pinnacle");
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>(["nba", "nfl"]);
  const [minEv, setMinEv] = useState(2);
  const [maxEv, setMaxEv] = useState<number | undefined>(undefined);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  // Expand / hide state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  const toggleExpand = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const toggleHide = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Sheet visibility
  const [activeSheet, setActiveSheet] = useState<"preset" | "sports" | "books" | "minEv" | "maxEv" | null>(null);

  const presets = useMemo(() => presetsData?.presets ?? [], [presetsData?.presets]);

  // Hydrate from preferences
  useEffect(() => {
    if (prefsLoading || filtersHydrated) return;
    setSelectedPreset(preferences.positiveEvSharpPreset);
    setSelectedBooks(preferences.positiveEvSelectedBooks);
    setSelectedSports(preferences.positiveEvSelectedSports);
    setMinEv(preferences.positiveEvMinEv);
    setMaxEv(preferences.positiveEvMaxEv);
    setFiltersHydrated(true);
  }, [filtersHydrated, preferences, prefsLoading]);

  // Ensure selected preset is valid
  useEffect(() => {
    if (!presets.length) return;
    const hasSelected = presets.some((preset) => preset.id === selectedPreset);
    if (hasSelected) return;
    const hasPinnacle = presets.some((preset) => preset.id === "pinnacle");
    setSelectedPreset(hasPinnacle ? "pinnacle" : (presets[0].id as SharpPreset));
  }, [presets, selectedPreset]);

  // Auto-save preferences when filters change
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!filtersHydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void savePreferences({
        positive_ev_selected_books: selectedBooks,
        positive_ev_selected_sports: selectedSports,
        positive_ev_sharp_preset: selectedPreset,
        positive_ev_min_ev: minEv,
        positive_ev_max_ev: maxEv ?? null
      });
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [selectedBooks, selectedSports, selectedPreset, minEv, maxEv, filtersHydrated, savePreferences]);

  const { data, isLoading, isError, error, refetch, isRefetching } = usePositiveEV({
    sports: selectedSports,
    books: selectedBooks,
    sharpPreset: selectedPreset,
    mode: "pregame",
    minEV: minEv,
    maxEV: maxEv,
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
      setSelectedBooks(next.length === universe.length ? [] : next);
      return;
    }

    const next = Array.from(new Set([...current, bookId]));
    setSelectedBooks(next.length === universe.length ? [] : next);
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

  function resetAllFilters() {
    setSelectedBooks([]);
    setSelectedSports(["nba", "nfl"]);
    setSelectedPreset("pinnacle");
    setMinEv(2);
    setMaxEv(undefined);
  }

  // Determine if any filter is non-default
  const hasActiveFilters =
    selectedPreset !== "pinnacle" ||
    !(selectedSports.length === 2 && selectedSports.includes("nba") && selectedSports.includes("nfl")) ||
    selectedBooks.length > 0 ||
    minEv !== 2 ||
    maxEv !== undefined;

  // Pill labels
  const presetLabel = useMemo(() => {
    const found = presets.find((p) => p.id === selectedPreset);
    return found ? (found.label || found.name) : selectedPreset;
  }, [presets, selectedPreset]);

  const sportsLabel = useMemo(() => {
    if (selectedSports.length === SPORT_OPTIONS.length || selectedSports.length === 0) return "All Sports";
    return selectedSports.map((s) => sportLabel(s)).join(", ");
  }, [selectedSports]);

  const booksLabel = useMemo(() => {
    if (selectedBooks.length === 0) return "All Books";
    return `${selectedBooks.length} Books`;
  }, [selectedBooks]);

  const minEvLabel = minEv > 0 ? `EV ${formatPercent(minEv)}%+` : "Min EV";
  const maxEvLabel = maxEv !== undefined ? `Max ${maxEv}%` : "No Max";

  const minEvActive = minEv !== 2;
  const maxEvActive = maxEv !== undefined;
  const sportsActive = !(selectedSports.length === 2 && selectedSports.includes("nba") && selectedSports.includes("nfl"));
  const booksActive = selectedBooks.length > 0;

  /* ─── FlatList setup ─── */

  const allOpportunities = data?.opportunities ?? [];
  const hiddenCount = allOpportunities.filter((o) => hiddenIds.has(o.id)).length;
  const opportunities = showHidden
    ? allOpportunities
    : allOpportunities.filter((o) => !hiddenIds.has(o.id));

  const renderItem = useCallback(
    ({ item }: { item: PositiveEVOpportunity }) => (
      <OpportunityCard
        opp={item}
        isExpanded={expandedId === item.id}
        isHidden={hiddenIds.has(item.id)}
        onToggleExpand={() => toggleExpand(item.id)}
        onToggleHide={() => toggleHide(item.id)}
      />
    ),
    [expandedId, hiddenIds, toggleExpand, toggleHide]
  );

  const keyExtractor = useCallback((item: PositiveEVOpportunity) => item.id, []);

  const listHeader = (
    <View style={styles.listHeader}>
      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>Positive EV</Text>
        <View style={styles.titleActions}>
          <Pressable
            onPress={() => setAutoRefreshEnabled((c) => !c)}
            style={[styles.autoBtn, autoRefreshEnabled && styles.autoBtnActive]}
          >
            <Ionicons
              name="refresh"
              size={14}
              color={autoRefreshEnabled ? brandColors.primary : brandColors.textMuted}
            />
            <Text style={[styles.autoBtnText, autoRefreshEnabled && styles.autoBtnTextActive]}>
              Auto
            </Text>
          </Pressable>
          <Pressable onPress={() => void refetch()} disabled={isRefetching} style={styles.refreshBtn}>
            <Ionicons
              name="refresh-outline"
              size={18}
              color={isRefetching ? brandColors.textMuted : brandColors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        {/* Preset pill */}
        <Pressable
          onPress={() => setActiveSheet("preset")}
          style={[styles.filterPill, selectedPreset !== "pinnacle" && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, selectedPreset !== "pinnacle" && styles.filterPillTextActive]}>
            {presetLabel}
          </Text>
          <Ionicons name="chevron-down" size={12} color={selectedPreset !== "pinnacle" ? brandColors.primary : brandColors.textMuted} />
        </Pressable>

        {/* Sports pill */}
        <Pressable
          onPress={() => setActiveSheet("sports")}
          style={[styles.filterPill, sportsActive && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, sportsActive && styles.filterPillTextActive]} numberOfLines={1}>
            {sportsLabel}
          </Text>
          <Ionicons name="chevron-down" size={12} color={sportsActive ? brandColors.primary : brandColors.textMuted} />
        </Pressable>

        {/* Books pill */}
        <Pressable
          onPress={() => setActiveSheet("books")}
          style={[styles.filterPill, booksActive && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, booksActive && styles.filterPillTextActive]}>
            {booksLabel}
          </Text>
          <Ionicons name="chevron-down" size={12} color={booksActive ? brandColors.primary : brandColors.textMuted} />
        </Pressable>

        {/* Min EV pill */}
        <Pressable
          onPress={() => setActiveSheet("minEv")}
          style={[styles.filterPill, minEvActive && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, minEvActive && styles.filterPillTextActive]}>
            {minEvLabel}
          </Text>
          <Ionicons name="chevron-down" size={12} color={minEvActive ? brandColors.primary : brandColors.textMuted} />
        </Pressable>

        {/* Max EV pill */}
        <Pressable
          onPress={() => setActiveSheet("maxEv")}
          style={[styles.filterPill, maxEvActive && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, maxEvActive && styles.filterPillTextActive]}>
            {maxEvLabel}
          </Text>
          <Ionicons name="chevron-down" size={12} color={maxEvActive ? brandColors.primary : brandColors.textMuted} />
        </Pressable>

        {/* Reset pill */}
        {hasActiveFilters ? (
          <Pressable onPress={resetAllFilters} style={styles.resetPill}>
            <Ionicons name="close" size={12} color={brandColors.error} />
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Count + Hidden toggle */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{opportunities.length} opportunities</Text>
        <View style={styles.countRight}>
          {hiddenCount > 0 ? (
            <Pressable onPress={() => setShowHidden((c) => !c)} hitSlop={6}>
              <Text style={styles.hiddenToggle}>
                {showHidden ? "Hide hidden" : `${hiddenCount} hidden`}
              </Text>
            </Pressable>
          ) : null}
          {isRefetching ? <ActivityIndicator size="small" color={brandColors.primary} /> : null}
        </View>
      </View>
    </View>
  );

  const listEmpty = isLoading ? (
    <View style={styles.stateCard}>
      <ActivityIndicator size="small" color={brandColors.primary} />
      <Text style={styles.stateText}>Loading +EV opportunities...</Text>
    </View>
  ) : isError ? (
    <View style={[styles.stateCard, styles.errorCard]}>
      <Text style={styles.errorTitle}>Unable to load</Text>
      <Text style={styles.errorBody}>
        {error instanceof Error ? error.message : "Unexpected error"}
      </Text>
      <Pressable onPress={() => void refetch()} style={styles.retryButton}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.stateCard}>
      <Text style={styles.stateText}>No opportunities found. Adjust your filters.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={opportunities}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.listContent}
        onRefresh={() => void refetch()}
        refreshing={isRefetching}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={5}
      />

      {/* ─── Preset Sheet ─── */}
      <BottomSheet visible={activeSheet === "preset"} onClose={() => setActiveSheet(null)} title="Sharp Preset">
        <View style={styles.sheetOptions}>
          {presetsLoading ? (
            <View style={styles.sheetLoading}>
              <ActivityIndicator size="small" color={brandColors.primary} />
            </View>
          ) : null}
          {presets.map((preset) => {
            const active = preset.id === selectedPreset;
            return (
              <Pressable
                key={preset.id}
                onPress={() => { setSelectedPreset(preset.id as SharpPreset); setActiveSheet(null); }}
                style={[styles.sheetOption, active && styles.sheetOptionActive]}
              >
                <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>
                  {preset.label || preset.name}
                </Text>
                {active ? <Ionicons name="checkmark" size={20} color={brandColors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* ─── Sports Sheet (multi-select) ─── */}
      <BottomSheet visible={activeSheet === "sports"} onClose={() => setActiveSheet(null)} title="Sports">
        <View style={styles.sheetOptions}>
          {SPORT_OPTIONS.map((sport) => {
            const active = selectedSports.includes(sport.id);
            return (
              <Pressable
                key={sport.id}
                onPress={() => toggleSport(sport.id)}
                style={[styles.sheetOption, active && styles.sheetOptionActive]}
              >
                <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>
                  {sport.label}
                </Text>
                {active ? <Ionicons name="checkmark" size={20} color={brandColors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* ─── Books Sheet (multi-select) ─── */}
      <BottomSheet visible={activeSheet === "books"} onClose={() => setActiveSheet(null)} title="Sportsbooks">
        <View style={styles.sheetOptions}>
          <Pressable
            onPress={() => { setSelectedBooks([]); }}
            style={[styles.sheetOption, selectedBooks.length === 0 && styles.sheetOptionActive]}
          >
            <Text style={[styles.sheetOptionText, selectedBooks.length === 0 && styles.sheetOptionTextActive]}>
              All Books
            </Text>
            {selectedBooks.length === 0 ? <Ionicons name="checkmark" size={20} color={brandColors.primary} /> : null}
          </Pressable>
          {availableBooks.map((book) => {
            const active = selectedBooks.length > 0 && selectedBooks.includes(book.id);
            return (
              <Pressable
                key={book.id}
                onPress={() => toggleBook(book.id)}
                style={[styles.sheetOption, active && styles.sheetOptionActive]}
              >
                <View style={styles.sheetBookRow}>
                  {getSportsbookLogoUrl(book.id) ? (
                    <Image source={{ uri: getSportsbookLogoUrl(book.id)! }} style={styles.sheetBookLogo} />
                  ) : null}
                  <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>
                    {book.label}
                  </Text>
                </View>
                {active ? <Ionicons name="checkmark" size={20} color={brandColors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* ─── Min EV Sheet ─── */}
      <BottomSheet visible={activeSheet === "minEv"} onClose={() => setActiveSheet(null)} title="Minimum EV %">
        <View style={styles.sheetOptions}>
          {MIN_EV_OPTIONS.map((val) => {
            const active = minEv === val;
            return (
              <Pressable
                key={`min-${val}`}
                onPress={() => { setMinEv(val); setActiveSheet(null); }}
                style={[styles.sheetOption, active && styles.sheetOptionActive]}
              >
                <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>
                  {val === 0 ? "No minimum" : `${formatPercent(val)}%+`}
                </Text>
                {active ? <Ionicons name="checkmark" size={20} color={brandColors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* ─── Max EV Sheet ─── */}
      <BottomSheet visible={activeSheet === "maxEv"} onClose={() => setActiveSheet(null)} title="Maximum EV %">
        <View style={styles.sheetOptions}>
          {MAX_EV_OPTIONS.map((opt) => {
            const active = maxEv === opt.value;
            return (
              <Pressable
                key={`max-${opt.label}`}
                onPress={() => { setMaxEv(opt.value); setActiveSheet(null); }}
                style={[styles.sheetOption, active && styles.sheetOptionActive]}
              >
                <Text style={[styles.sheetOptionText, active && styles.sheetOptionTextActive]}>
                  {opt.value === undefined ? "No maximum" : `${opt.label}`}
                </Text>
                {active ? <Ionicons name="checkmark" size={20} color={brandColors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 20
  },

  /* ── header ── */
  listHeader: {
    gap: 10,
    paddingTop: 6,
    paddingBottom: 4
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  pageTitle: {
    color: brandColors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  autoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brandColors.border,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  autoBtnActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  autoBtnText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  autoBtnTextActive: {
    color: brandColors.primary
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brandColors.border,
    alignItems: "center",
    justifyContent: "center"
  },

  /* ── filter pills ── */
  filterScroll: {
    gap: 6,
    paddingRight: 8
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  filterPillActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  filterPillText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 120
  },
  filterPillTextActive: {
    color: brandColors.primary
  },
  resetPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
    alignItems: "center",
    justifyContent: "center"
  },

  /* ── count ── */
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2
  },
  countText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  countRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  hiddenToggle: {
    color: brandColors.primary,
    fontSize: 11,
    fontWeight: "600"
  },

  /* ── opportunity card ── */
  card: {
    backgroundColor: brandColors.panelBackground,
    borderColor: brandColors.border,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    // Android elevation
    elevation: 3
  },
  cardHidden: {
    opacity: 0.4
  },
  cardPressed: {
    opacity: 0.85
  },

  /* ── card header ── */
  cardHeader: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
    gap: 3
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  cardLeague: {
    fontSize: 11,
    fontWeight: "700"
  },
  cardHeaderDot: {
    color: brandColors.textMuted,
    fontSize: 10
  },
  cardGameText: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "500",
    flexShrink: 1
  },
  cardTimeText: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "500"
  },
  evBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  evBadgeText: {
    fontSize: 11,
    fontWeight: "800"
  },
  cardMarketLabel: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2
  },

  /* ── card divider ── */
  cardDivider: {
    height: 0.5,
    backgroundColor: brandColors.border
  },

  /* ── card body ── */
  cardBody: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8
  },
  cardPlayerName: {
    color: brandColors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2
  },
  cardSideLine: {
    color: brandColors.textMuted,
    fontSize: 13,
    fontWeight: "500"
  },
  cardOddsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  cardOddsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  cardOddsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  bookLogo: {
    width: 24,
    height: 24,
    borderRadius: 5
  },
  oddsText: {
    color: brandColors.textPrimary,
    fontSize: 20,
    fontWeight: "800"
  },
  fairValueText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  kellyText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  chevronWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center"
  },
  chevronWrapActive: {
    backgroundColor: brandColors.primarySoft
  },

  /* ── expanded section ── */
  expandedSection: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 0.5,
    borderTopColor: brandColors.border,
    backgroundColor: "rgba(0,0,0,0.15)",
    gap: 8
  },
  expandedInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  expandedInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  expandedInfoLabel: {
    color: brandColors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  expandedInfoSharp: {
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "700"
  },
  expandedInfoFair: {
    color: brandColors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  evMethodBadge: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  evMethodText: {
    color: brandColors.success,
    fontSize: 10,
    fontWeight: "700"
  },

  /* ── odds comparison (over/under) ── */
  oddsCompare: {
    gap: 4
  },
  oddsCompareHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 2
  },
  oddsCompareOverLabel: {
    flex: 1,
    color: brandColors.success,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase"
  },
  oddsCompareBookLabel: {
    width: 32,
    color: brandColors.textMuted,
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase"
  },
  oddsCompareUnderLabel: {
    flex: 1,
    color: brandColors.primary,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase"
  },
  oddsCompareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  oddsCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground
  },
  oddsCellBest: {
    backgroundColor: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.35)"
  },
  oddsCellBestBlue: {
    backgroundColor: "rgba(56,189,248,0.10)",
    borderColor: "rgba(56,189,248,0.35)"
  },
  oddsCellDisabled: {
    opacity: 0.35
  },
  oddsCellText: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "700"
  },
  oddsCellTextBest: {
    color: brandColors.success
  },
  oddsCellTextBestBlue: {
    color: brandColors.primary
  },
  oddsBookCenter: {
    width: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  oddsBookLogo: {
    width: 22,
    height: 22,
    borderRadius: 5
  },
  oddsBookPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: brandColors.panelBackgroundAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  oddsBookPlaceholderText: {
    color: brandColors.textMuted,
    fontSize: 8,
    fontWeight: "700"
  },

  /* ── single side grid ── */
  singleSideGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4
  },
  singleSideCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "48%",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground
  },
  singleSideCellBest: {
    backgroundColor: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.35)"
  },
  singleSideLogo: {
    width: 16,
    height: 16,
    borderRadius: 4
  },
  singleSideName: {
    flex: 1,
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "600"
  },
  singleSideNameBest: {
    color: brandColors.success
  },
  singleSidePrice: {
    color: brandColors.textPrimary,
    fontSize: 12,
    fontWeight: "700"
  },
  singleSidePriceBest: {
    color: brandColors.success
  },

  /* ── state cards ── */
  stateCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 14,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8
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
    fontSize: 14,
    fontWeight: "700"
  },
  errorBody: {
    color: "#FECACA",
    fontSize: 12,
    textAlign: "center"
  },
  retryButton: {
    alignSelf: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DC2626",
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 4
  },
  retryText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "700"
  },

  /* ── bottom sheet ── */
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end"
  },
  sheetContent: {
    backgroundColor: brandColors.panelBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: "70%"
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: brandColors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.border
  },
  sheetTitle: {
    color: brandColors.textPrimary,
    fontSize: 17,
    fontWeight: "700"
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: brandColors.panelBackgroundAlt,
    alignItems: "center",
    justifyContent: "center"
  },
  sheetOptions: {
    paddingHorizontal: 16,
    paddingTop: 8
  },
  sheetOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2
  },
  sheetOptionActive: {
    backgroundColor: brandColors.primarySoft
  },
  sheetOptionText: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "500"
  },
  sheetOptionTextActive: {
    color: brandColors.primary,
    fontWeight: "700"
  },
  sheetLoading: {
    paddingVertical: 16,
    alignItems: "center"
  },
  sheetBookRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  sheetBookLogo: {
    width: 24,
    height: 24,
    borderRadius: 6
  }
});
