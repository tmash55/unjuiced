import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ArbLeg, ArbMode, ArbRow } from "@unjuiced/types";
import { normalizePlanName } from "@unjuiced/types";
import { useArbitrage } from "@/src/hooks/use-arbitrage";
import { useEntitlements } from "@/src/hooks/use-entitlements";
import { useUserPreferences } from "@/src/hooks/use-user-preferences";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { triggerLightImpactHaptic, triggerSelectionHaptic } from "@/src/lib/haptics";
import { brandColors } from "@/src/theme/brand";
import { humanizeMarketKey } from "@/src/lib/market-display";
import StateView from "@/src/components/StateView";

const MODES: Array<{ key: ArbMode; label: string }> = [
  { key: "pregame", label: "Pregame" },
  { key: "live", label: "Live" }
];

const MIN_ARB_OPTIONS = [0, 0.5, 1, 2, 3];
const MAX_ARB_OPTIONS = [2, 5, 10, 20];
const LIQUIDITY_OPTIONS = [0, 50, 100, 250];
const TOTAL_STAKE_OPTIONS = [100, 200, 500, 1000];

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

function parseNumberInput(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPercent(value: number): string {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(1);
}

function formatOdds(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  if (value >= 1000) return `$${Math.round(value).toLocaleString()}`;
  if (value >= 100) return `$${Math.round(value)}`;
  return `$${value.toFixed(2)}`;
}

function humanizeMarket(market: string): string {
  return humanizeMarketKey(market);
}

function isSpread(market?: string): boolean {
  return /spread|handicap|run[_ ]?line|puck[_ ]?line|goal[_ ]?line/i.test(String(market || ""));
}

function isMoneyline(market?: string): boolean {
  return /moneyline|\bml\b/i.test(String(market || ""));
}

function extractPlayer(name?: string): string {
  if (!name) return "";
  return name.replace(/\s+(Over|Under).*$/i, "").trim();
}

function formatTimeLabel(row: ArbRow): string {
  const date = row.ev?.dt ? new Date(row.ev.dt) : null;
  if (!date || !Number.isFinite(date.getTime())) return "TBD";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (row.ev.live) return "Live";
  if (isToday) return time;
  if (isTomorrow) return `Tomorrow ${time}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

function getMatchupLabel(row: ArbRow): string {
  const away = row.ev?.away?.abbr || row.ev?.away?.name || "Away";
  const home = row.ev?.home?.abbr || row.ev?.home?.name || "Home";
  return `${away} @ ${home}`;
}

function getSideLabel(row: ArbRow, side: "over" | "under"): string {
  if (isMoneyline(row.mkt)) {
    return side === "over" ? row.ev?.home?.abbr || "Home" : row.ev?.away?.abbr || "Away";
  }

  if (isSpread(row.mkt)) {
    const raw = side === "over" ? row.o?.name || "" : row.u?.name || "";
    const homeName = row.ev?.home?.name || "";
    const awayName = row.ev?.away?.name || "";
    const homeAbbr = row.ev?.home?.abbr || homeName;
    const awayAbbr = row.ev?.away?.abbr || awayName;

    let output = raw;
    if (homeName) {
      output = output.replace(new RegExp(homeName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"), homeAbbr);
    }
    if (awayName) {
      output = output.replace(new RegExp(awayName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i"), awayAbbr);
    }
    return output.replace(/\s+/g, " ").trim();
  }

  return side === "over" ? `Over ${row.ln}` : `Under ${row.ln}`;
}

function calculateBetSizes(overOdds: number, underOdds: number, total: number) {
  const overDec = overOdds > 0 ? 1 + overOdds / 100 : 1 + 100 / Math.abs(overOdds);
  const underDec = underOdds > 0 ? 1 + underOdds / 100 : 1 + 100 / Math.abs(underOdds);
  const overStake = (total * underDec) / (overDec + underDec);
  const underStake = total - overStake;
  return { over: overStake, under: underStake };
}

function calculatePayout(odds: number, stake: number): number {
  if (!stake || !odds) return 0;
  if (odds > 0) return stake * (1 + odds / 100);
  return stake * (1 + 100 / Math.abs(odds));
}

function rowSearchText(row: ArbRow): string {
  return [
    row.o?.name,
    row.u?.name,
    row.mkt,
    row.ev?.home?.name,
    row.ev?.home?.abbr,
    row.ev?.away?.name,
    row.ev?.away?.abbr,
    row.lg?.name,
    row.lg?.sport,
    row.lg?.id
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function FilterDrawer({
  visible,
  onClose,
  minArbInput,
  maxArbInput,
  minLiquidityInput,
  totalStakeInput,
  onSetMinArbInput,
  onSetMaxArbInput,
  onSetMinLiquidityInput,
  onSetTotalStakeInput,
  numericFilters,
  onApply,
  onReset,
  isSaving
}: {
  visible: boolean;
  onClose: () => void;
  minArbInput: string;
  maxArbInput: string;
  minLiquidityInput: string;
  totalStakeInput: string;
  onSetMinArbInput: (value: string) => void;
  onSetMaxArbInput: (value: string) => void;
  onSetMinLiquidityInput: (value: string) => void;
  onSetTotalStakeInput: (value: string) => void;
  numericFilters: { minArb: number; maxArb: number; minLiquidity: number; totalStake: number };
  onApply: () => void;
  onReset: () => void;
  isSaving: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.drawerOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.drawerSheet}>
          <View style={styles.drawerHandle} />
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Arbitrage Filters</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={brandColors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.drawerContent}>
            <Text style={styles.filterSectionLabel}>Min Arb %</Text>
            <View style={styles.quickRow}>
              {MIN_ARB_OPTIONS.map((value) => {
                const active = numericFilters.minArb === value;
                return (
                  <Pressable
                    key={`min-${value}`}
                    onPress={() => {
                      triggerSelectionHaptic();
                      onSetMinArbInput(String(value));
                    }}
                    style={[styles.quickChip, active && styles.quickChipActive]}
                  >
                    <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                      {formatPercent(value)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.filterSectionLabel}>Max Arb %</Text>
            <View style={styles.quickRow}>
              {MAX_ARB_OPTIONS.map((value) => {
                const active = numericFilters.maxArb === value;
                return (
                  <Pressable
                    key={`max-${value}`}
                    onPress={() => {
                      triggerSelectionHaptic();
                      onSetMaxArbInput(String(value));
                    }}
                    style={[styles.quickChip, active && styles.quickChipActive]}
                  >
                    <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                      {formatPercent(value)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.filterSectionLabel}>Min Liquidity</Text>
            <View style={styles.quickRow}>
              {LIQUIDITY_OPTIONS.map((value) => {
                const active = numericFilters.minLiquidity === value;
                return (
                  <Pressable
                    key={`liq-${value}`}
                    onPress={() => {
                      triggerSelectionHaptic();
                      onSetMinLiquidityInput(String(value));
                    }}
                    style={[styles.quickChip, active && styles.quickChipActive]}
                  >
                    <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                      {value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.filterSectionLabel}>Total Stake</Text>
            <View style={styles.quickRow}>
              {TOTAL_STAKE_OPTIONS.map((value) => {
                const active = numericFilters.totalStake === value;
                return (
                  <Pressable
                    key={`stake-${value}`}
                    onPress={() => {
                      triggerSelectionHaptic();
                      onSetTotalStakeInput(String(value));
                    }}
                    style={[styles.quickChip, active && styles.quickChipActive]}
                  >
                    <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                      ${value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.inputGrid}>
              <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>Min Arb</Text>
                <TextInput
                  style={styles.input}
                  value={minArbInput}
                  onChangeText={(value) => onSetMinArbInput(value.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={brandColors.textMuted}
                />
              </View>
              <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>Max Arb</Text>
                <TextInput
                  style={styles.input}
                  value={maxArbInput}
                  onChangeText={(value) => onSetMaxArbInput(value.replace(/[^0-9.]/g, ""))}
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
                  onChangeText={(value) => onSetMinLiquidityInput(value.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  placeholder="50"
                  placeholderTextColor={brandColors.textMuted}
                />
              </View>
              <View style={styles.inputItem}>
                <Text style={styles.inputLabel}>Stake</Text>
                <TextInput
                  style={styles.input}
                  value={totalStakeInput}
                  onChangeText={(value) => onSetTotalStakeInput(value.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  placeholder="200"
                  placeholderTextColor={brandColors.textMuted}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.drawerFooter}>
            <Pressable onPress={onReset} style={styles.resetButton} disabled={isSaving}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </Pressable>
            <Pressable onPress={onApply} style={styles.applyButton} disabled={isSaving}>
              <Text style={styles.applyButtonText}>{isSaving ? "Saving..." : "Apply"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LegCard({
  leg,
  sideLabel,
  stakeLabel,
  accentColor,
  onPress
}: {
  leg: ArbLeg;
  sideLabel: string;
  stakeLabel: string;
  accentColor: string;
  onPress: () => void;
}) {
  const logoUrl = getSportsbookLogoUrl(leg.bk);

  return (
    <View style={[styles.legCard, { borderLeftColor: accentColor }]}>
      <View style={styles.legTopRow}>
        {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.bookLogo} /> : <View style={styles.bookLogoFallback} />}
        <View style={styles.legCopy}>
          <Text style={styles.legSideLabel} numberOfLines={1}>{sideLabel}</Text>
          <Text style={styles.legBookName} numberOfLines={1}>{leg.name || leg.bk.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.legOddsRow}>
        <Text style={[styles.legOdds, { color: accentColor }]}>{formatOdds(leg.od)}</Text>
        {typeof leg.max === "number" ? <Text style={styles.legLimit}>max {formatCurrency(leg.max)}</Text> : null}
      </View>

      <View style={styles.legBottomRow}>
        <Text style={styles.legStakeLabel}>{stakeLabel}</Text>
        <Pressable onPress={onPress} style={styles.legBetButton}>
          <Text style={styles.legBetText}>Bet</Text>
          <Ionicons name="arrow-forward" size={11} color={brandColors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function ArbitrageCard({
  row,
  totalStake,
  onOpenLeg,
  onOpenWarning
}: {
  row: ArbRow;
  totalStake: number;
  onOpenLeg: (leg: ArbLeg) => void;
  onOpenWarning: () => void;
}) {
  const roiPercent = (row.roi_bps ?? 0) / 100;
  const stakes = useMemo(() => calculateBetSizes(Number(row.o?.od || 0), Number(row.u?.od || 0), totalStake), [row.o?.od, row.u?.od, totalStake]);
  const overPayout = calculatePayout(Number(row.o?.od || 0), stakes.over);
  const underPayout = calculatePayout(Number(row.u?.od || 0), stakes.under);
  const guaranteedProfit = Math.min(overPayout, underPayout) - (stakes.over + stakes.under);
  const player = extractPlayer(row.o?.name) || extractPlayer(row.u?.name);
  const isHighRoi = roiPercent >= 10;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <View style={styles.headerMetaRow}>
            <Text style={styles.cardLeague}>{row.lg?.name || row.lg?.sport || "Arbitrage"}</Text>
            <Text style={styles.cardDot}>•</Text>
            <Text style={styles.cardTime}>{formatTimeLabel(row)}</Text>
            {row.ev.live ? <View style={styles.livePill}><Text style={styles.livePillText}>LIVE</Text></View> : null}
          </View>
          <Text style={styles.cardMatchup}>{getMatchupLabel(row)}</Text>
          <Text style={styles.cardMarket}>
            {humanizeMarket(row.mkt)}{player ? ` • ${player}` : ""}{Number.isFinite(row.ln) ? ` • ${row.ln}` : ""}
          </Text>
        </View>

        <View style={styles.roiBlock}>
          {isHighRoi ? (
            <Pressable onPress={onOpenWarning} style={styles.warningButton}>
              <Ionicons name="warning-outline" size={14} color={brandColors.warning} />
            </Pressable>
          ) : null}
          <View style={styles.roiBadge}>
            <Text style={styles.roiBadgeText}>+{roiPercent.toFixed(1)}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.legsRow}>
        <LegCard
          leg={row.o}
          sideLabel={getSideLabel(row, "over")}
          stakeLabel={formatCurrency(stakes.over)}
          accentColor={brandColors.success}
          onPress={() => onOpenLeg(row.o)}
        />
        <LegCard
          leg={row.u}
          sideLabel={getSideLabel(row, "under")}
          stakeLabel={formatCurrency(stakes.under)}
          accentColor={brandColors.primary}
          onPress={() => onOpenLeg(row.u)}
        />
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerMetric}>
          <Text style={styles.footerLabel}>Stake</Text>
          <Text style={styles.footerValue}>{formatCurrency(stakes.over + stakes.under)}</Text>
        </View>
        <View style={styles.footerMetric}>
          <Text style={styles.footerLabel}>Profit</Text>
          <Text style={[styles.footerValue, styles.footerValueProfit]}>+{formatCurrency(guaranteedProfit).replace("$", "$")}</Text>
        </View>
        <View style={styles.footerMetric}>
          <Text style={styles.footerLabel}>Max Bet</Text>
          <Text style={styles.footerValue}>
            {typeof row.max_bet === "number" ? formatCurrency(row.max_bet) : "Open"}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ArbitrageContent() {
  const [mode, setMode] = useState<ArbMode>("pregame");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const [minArbInput, setMinArbInput] = useState("0");
  const [maxArbInput, setMaxArbInput] = useState("20");
  const [minLiquidityInput, setMinLiquidityInput] = useState("50");
  const [totalStakeInput, setTotalStakeInput] = useState("200");
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const { session } = useAuth();
  const { data, isLoading, isError, error, refetch, isRefetching } = useArbitrage({
    mode,
    limit: 100,
    autoRefreshEnabled
  });
  const { data: entitlements, isLoading: entitlementsLoading } = useEntitlements();
  const { preferences, isLoading: prefsLoading, savePreferences, isSaving } = useUserPreferences();
  // Prefer entitlements (from /api/me/plan) since it's the canonical source.
  // Fall back to arb API response plan while entitlements are loading.
  const plan = normalizePlanName(
    entitlements?.plan ?? data?.plan ?? "free"
  );

  useEffect(() => {
    if (prefsLoading || filtersHydrated) return;
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
    const totalStake = Math.max(25, parseNumberInput(totalStakeInput, 200));
    return { minArb, maxArb, minLiquidity, totalStake };
  }, [maxArbInput, minArbInput, minLiquidityInput, preferences, totalStakeInput]);

  const availableRows = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter((row) => !isCompletedGame(row));
  }, [data?.rows]);

  const selectedBooks = preferences.preferredSportsbooks;

  const visibleRows = useMemo(() => {
    const selectedBookSet =
      selectedBooks.length > 0 ? new Set(selectedBooks.map((book) => normalizeBookId(book))) : null;
    const query = searchQuery.trim().toLowerCase();

    return availableRows
      .filter((row) => {
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

        if (query && !rowSearchText(row).includes(query)) return false;
        return true;
      })
      .sort((a, b) => (b.roi_bps ?? 0) - (a.roi_bps ?? 0));
  }, [availableRows, numericFilters, searchQuery, selectedBooks]);

  async function applyFilters() {
    triggerSelectionHaptic();
    await savePreferences({
      arbitrage_min_arb: numericFilters.minArb,
      arbitrage_max_arb: numericFilters.maxArb,
      arbitrage_min_liquidity: numericFilters.minLiquidity
    });
    setDrawerVisible(false);
  }

  async function resetFilters() {
    triggerSelectionHaptic();
    setMinArbInput("0");
    setMaxArbInput("20");
    setMinLiquidityInput("50");
    setTotalStakeInput("200");
    await savePreferences({
      arbitrage_min_arb: 0,
      arbitrage_max_arb: 20,
      arbitrage_min_liquidity: 50
    });
  }

  async function openLeg(leg: ArbLeg) {
    const url = leg.m || leg.u;
    if (!url) return;
    triggerLightImpactHaptic();
    await Linking.openURL(url);
  }

  const planLabel = (plan === "anonymous" || plan === "free") ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1);
  const bookSummary =
    selectedBooks.length > 0 ? `${selectedBooks.length} books active` : "All books active";
  const filterCount =
    (numericFilters.minArb > 0 ? 1 : 0) +
    (numericFilters.maxArb < 20 ? 1 : 0) +
    (numericFilters.minLiquidity > 50 ? 1 : 0);
  const restrictionReason = plan === "elite" ? null : data?.filteredReason ?? null;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.modeRow}>
          {MODES.map((item) => {
            const active = mode === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  if (mode !== item.key) triggerSelectionHaptic();
                  setMode(item.key);
                }}
                style={[styles.modePill, active && styles.modePillActive]}
              >
                <Text style={[styles.modePillText, active && styles.modePillTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.topActions}>
          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              setAutoRefreshEnabled((current) => !current);
            }}
            style={[styles.iconButton, autoRefreshEnabled && styles.iconButtonActive]}
          >
            <Ionicons
              name={autoRefreshEnabled ? "pause-outline" : "play-outline"}
              size={16}
              color={autoRefreshEnabled ? "#02131E" : brandColors.textSecondary}
            />
          </Pressable>
          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              void refetch();
            }}
            style={styles.iconButton}
            disabled={isRefetching}
          >
            <Ionicons name="refresh-outline" size={16} color={brandColors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              setDrawerVisible(true);
            }}
            style={styles.iconButton}
          >
            <Ionicons name="options-outline" size={16} color={filterCount > 0 ? brandColors.primary : brandColors.textSecondary} />
            {filterCount > 0 ? <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{filterCount}</Text></View> : null}
          </Pressable>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={brandColors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search teams, players, markets..."
          placeholderTextColor={brandColors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 ? (
          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              setSearchQuery("");
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={16} color={brandColors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryLabel}>Plan</Text>
          <Text style={styles.summaryValue}>{planLabel}</Text>
        </View>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryLabel}>Rows</Text>
          <Text style={styles.summaryValue}>{visibleRows.length}</Text>
        </View>
        <View style={[styles.summaryMetric, styles.summaryMetricWide]}>
          <Text style={styles.summaryLabel}>Books</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>{bookSummary}</Text>
        </View>
      </View>

      {restrictionReason ? (
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={14} color={brandColors.warning} />
          <Text style={styles.bannerText}>{restrictionReason}</Text>
        </View>
      ) : null}

      <FlatList
        data={visibleRows}
        keyExtractor={(item, index) => `${item.eid}-${item.mkt}-${item.ln}-${index}`}
        renderItem={({ item }) => (
          <ArbitrageCard
            row={item}
            totalStake={numericFilters.totalStake}
            onOpenLeg={(leg) => void openLeg(leg)}
            onOpenWarning={() => {
              triggerSelectionHaptic();
              setWarningVisible(true);
            }}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={brandColors.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isLoading ? (
            <StateView state="loading" message="Loading arbitrage rows..." />
          ) : isError ? (
            <StateView
              state="error"
              title="Arbitrage failed to load"
              message={error instanceof Error ? error.message : "Unknown error"}
              onRetry={() => void refetch()}
            />
          ) : (
            <StateView
              state="empty"
              icon="git-compare-outline"
              title="No arbitrage spots"
              message={searchQuery ? "Try a different search or loosen filters." : "Adjust filters or check back later."}
            />
          )
        }
      />

      <FilterDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        minArbInput={minArbInput}
        maxArbInput={maxArbInput}
        minLiquidityInput={minLiquidityInput}
        totalStakeInput={totalStakeInput}
        onSetMinArbInput={setMinArbInput}
        onSetMaxArbInput={setMaxArbInput}
        onSetMinLiquidityInput={setMinLiquidityInput}
        onSetTotalStakeInput={setTotalStakeInput}
        numericFilters={numericFilters}
        onApply={() => void applyFilters()}
        onReset={() => void resetFilters()}
        isSaving={isSaving}
      />

      <Modal visible={warningVisible} transparent animationType="fade" onRequestClose={() => setWarningVisible(false)}>
        <View style={styles.warningOverlay}>
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <View style={styles.warningIconWrap}>
                <Ionicons name="warning-outline" size={18} color={brandColors.warning} />
              </View>
              <Text style={styles.warningTitle}>High ROI Warning</Text>
            </View>
            <Text style={styles.warningBody}>
              Verify both books, markets, and lines before placing high-return arbitrage. Obvious errors and stale lines can be voided.
            </Text>
            <Pressable
              onPress={() => {
                triggerSelectionHaptic();
                setWarningVisible(false);
              }}
              style={styles.warningClose}
            >
              <Text style={styles.warningCloseText}>I Understand</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12
  },
  modeRow: {
    flexDirection: "row",
    gap: 8
  },
  modePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  modePillActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft
  },
  modePillText: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  modePillTextActive: {
    color: "#D7F3FF"
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground
  },
  iconButtonActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primary
  },
  filterBadge: {
    position: "absolute",
    top: -3,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: brandColors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  filterBadgeText: {
    color: "#03131E",
    fontSize: 9,
    fontWeight: "800"
  },
  searchWrap: {
    marginHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: brandColors.border,
    borderRadius: 14,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 12,
    height: 46
  },
  searchInput: {
    flex: 1,
    color: brandColors.textPrimary,
    fontSize: 14
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10
  },
  summaryMetric: {
    minWidth: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4
  },
  summaryMetricWide: {
    flex: 1
  },
  summaryLabel: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  summaryValue: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "700"
  },
  banner: {
    marginTop: 10,
    marginHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.20)",
    backgroundColor: "rgba(251, 191, 36, 0.10)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  bannerText: {
    flex: 1,
    color: "#FDE68A",
    fontSize: 12,
    lineHeight: 17
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 90,
    gap: 10
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    padding: 14,
    gap: 12
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  cardHeaderCopy: {
    flex: 1,
    gap: 4
  },
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap"
  },
  cardLeague: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  cardDot: {
    color: brandColors.textMuted,
    fontSize: 11
  },
  cardTime: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "600"
  },
  livePill: {
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.14)",
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  livePillText: {
    color: brandColors.success,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6
  },
  cardMatchup: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "800"
  },
  cardMarket: {
    color: brandColors.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  roiBlock: {
    alignItems: "flex-end",
    gap: 6
  },
  warningButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251, 191, 36, 0.10)"
  },
  roiBadge: {
    borderRadius: 12,
    backgroundColor: "rgba(34, 197, 94, 0.14)",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  roiBadgeText: {
    color: brandColors.success,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.7
  },
  legsRow: {
    flexDirection: "row",
    gap: 10
  },
  legCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: brandColors.border,
    borderLeftWidth: 3,
    backgroundColor: brandColors.panelBackgroundAlt,
    padding: 12,
    gap: 10
  },
  legTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  bookLogo: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: brandColors.panelBackground
  },
  bookLogoFallback: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: brandColors.border
  },
  legCopy: {
    flex: 1,
    gap: 2
  },
  legSideLabel: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "700"
  },
  legBookName: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "600"
  },
  legOddsRow: {
    gap: 2
  },
  legOdds: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.8
  },
  legLimit: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "600"
  },
  legBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  legStakeLabel: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "800"
  },
  legBetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  legBetText: {
    color: brandColors.textPrimary,
    fontSize: 11,
    fontWeight: "800"
  },
  cardFooter: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
    overflow: "hidden"
  },
  footerMetric: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10
  },
  footerLabel: {
    color: brandColors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  footerValue: {
    marginTop: 3,
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "800"
  },
  footerValueProfit: {
    color: brandColors.success
  },
  drawerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.50)"
  },
  drawerSheet: {
    backgroundColor: brandColors.appBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: brandColors.border,
    maxHeight: "82%"
  },
  drawerHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: brandColors.borderStrong,
    marginTop: 10
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10
  },
  drawerTitle: {
    color: brandColors.textPrimary,
    fontSize: 18,
    fontWeight: "800"
  },
  drawerContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10
  },
  filterSectionLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 6
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  quickChip: {
    borderColor: brandColors.borderStrong,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: brandColors.panelBackground,
    paddingVertical: 6,
    paddingHorizontal: 10
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
  inputGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6
  },
  inputItem: {
    width: "47%",
    gap: 5
  },
  inputLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "600"
  },
  input: {
    borderColor: brandColors.borderStrong,
    borderWidth: 1,
    borderRadius: 12,
    color: brandColors.textPrimary,
    backgroundColor: brandColors.panelBackground,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  drawerFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: brandColors.border
  },
  resetButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brandColors.borderStrong,
    backgroundColor: brandColors.panelBackground,
    paddingVertical: 12,
    alignItems: "center"
  },
  resetButtonText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "700"
  },
  applyButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brandColors.primaryStrong,
    backgroundColor: brandColors.primaryStrong,
    paddingVertical: 12,
    alignItems: "center"
  },
  applyButtonText: {
    color: "#E0F2FE",
    fontSize: 13,
    fontWeight: "800"
  },
  warningOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 24
  },
  warningCard: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    padding: 16,
    gap: 12
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  warningIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251, 191, 36, 0.10)"
  },
  warningTitle: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "800"
  },
  warningBody: {
    color: brandColors.textSecondary,
    fontSize: 13,
    lineHeight: 19
  },
  warningClose: {
    borderRadius: 12,
    backgroundColor: brandColors.panelBackgroundAlt,
    alignItems: "center",
    paddingVertical: 11
  },
  warningCloseText: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "700"
  }
});
