import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ArbRow, PositiveEVOpportunity } from "@unjuiced/types";
import type { CheatSheetRow, TripleDoubleSheetRow } from "@unjuiced/api";
import { useArbitrage } from "@/src/hooks/use-arbitrage";
import { useCheatSheet } from "@/src/hooks/use-cheat-sheet";
import { usePositiveEV } from "@/src/hooks/use-positive-ev";
import { useTripleDoubleSheet } from "@/src/hooks/use-triple-double-sheet";
import { useUserPreferences } from "@/src/hooks/use-user-preferences";
import SportsbookPicker from "@/src/components/SportsbookPicker";
import PageHeader from "@/src/components/PageHeader";
import StateView from "@/src/components/StateView";
import { triggerLightImpactHaptic, triggerSelectionHaptic } from "@/src/lib/haptics";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";

/* ─── helpers ─── */

function formatOdds(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return value > 0 ? `+${value}` : `${value}`;
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(digits)}%`;
}

function formatCompactCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${value}`;
}

function formatTodayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTimeLabel(value: string | null | undefined): string {
  if (!value) return "Live";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Live";
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getPositiveEvTitle(opp: PositiveEVOpportunity): string {
  return opp.playerName || opp.marketDisplay || "Positive EV";
}

function getPositiveEvSubtitle(opp: PositiveEVOpportunity): string {
  if (opp.playerName) {
    return `${opp.marketDisplay} ${opp.side === "over" ? "Over" : opp.side === "under" ? "Under" : opp.side} ${opp.line}`;
  }
  return opp.marketDisplay;
}

function getEventLabel(away: string | undefined, home: string | undefined): string {
  if (away && home) return `${away} @ ${home}`;
  return away || home || "";
}

function getArbEventLabel(row: ArbRow): string {
  return getEventLabel(row.ev.away.abbr || row.ev.away.name, row.ev.home.abbr || row.ev.home.name);
}

function getArbMarketLabel(row: ArbRow): string {
  const market = row.mkt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${market} ${Number.isFinite(row.ln) ? row.ln : ""}`.trim();
}

function getCheatMatchupLabel(row: CheatSheetRow): string {
  if (row.homeAway === "A") return `${row.teamAbbr} @ ${row.opponentAbbr}`;
  if (row.homeAway === "H") return `${row.opponentAbbr} @ ${row.teamAbbr}`;
  return `${row.teamAbbr} vs ${row.opponentAbbr}`;
}

function matchupAccent(quality: CheatSheetRow["matchupQuality"]): string {
  if (quality === "favorable") return brandColors.success;
  if (quality === "neutral") return brandColors.warning;
  return brandColors.error;
}

/* ─── small components ─── */

function BookLogo({ bookId, size = 24 }: { bookId: string; size?: number }) {
  const uri = getSportsbookLogoUrl(bookId);
  if (!uri) {
    return (
      <View style={[styles.bookFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.bookFallbackText}>{bookId.slice(0, 1).toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: brandColors.panelBackgroundAlt }}
    />
  );
}

function SectionHeader({
  title,
  subtitle,
  cta,
}: {
  title: string;
  subtitle: string;
  cta?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {cta ? (
        <Pressable onPress={cta.onPress} style={styles.sectionCta}>
          <Text style={styles.sectionCtaText}>{cta.label}</Text>
          <Ionicons name="arrow-forward" size={14} color={brandColors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ─── main screen ─── */

export default function TodayScreen() {
  const router = useRouter();
  const [pickerVisible, setPickerVisible] = useState(false);
  const { preferences, savePreferences } = useUserPreferences();

  const positiveEvQuery = usePositiveEV({
    sports: ["nba"],
    books: preferences.preferredSportsbooks,
    sharpPreset: preferences.positiveEvSharpPreset,
    minEV: preferences.positiveEvMinEv,
    maxEV: preferences.positiveEvMaxEv,
    minBooksPerSide: preferences.positiveEvMinBooksPerSide,
    limit: 10,
  });
  const arbitrageQuery = useArbitrage({ mode: "pregame", limit: 10 });
  const cheatSheetQuery = useCheatSheet({
    minHitRate: 60,
    markets: ["player_points", "player_rebounds", "player_assists"],
  });
  const tripleDoubleQuery = useTripleDoubleSheet();

  // Data — use cached data when available to avoid flashing
  const evData = positiveEvQuery.data;
  const arbData = arbitrageQuery.data;
  const cheatData = cheatSheetQuery.data;
  const tripleData = tripleDoubleQuery.data;

  const topPositiveEv = evData?.opportunities?.[0];
  const topArb = arbData?.rows?.[0];
  const cheatRows = useMemo(() => (cheatData?.rows ?? []).slice(0, 3), [cheatData?.rows]);
  const tripleRows = useMemo(() => (tripleData?.data?.rows ?? []).slice(0, 2), [tripleData?.data?.rows]);

  // Only show loading skeleton on true first load (no cached data yet)
  const evFirstLoad = !evData && positiveEvQuery.isLoading;
  const arbFirstLoad = !arbData && arbitrageQuery.isLoading;
  const cheatFirstLoad = !cheatData && cheatSheetQuery.isLoading;
  const tripleFirstLoad = !tripleData && tripleDoubleQuery.isLoading;

  const stats = useMemo(
    () => [
      { key: "ev", label: "EV", value: formatCompactCount(evData?.meta.returned ?? 0), tone: brandColors.primary },
      { key: "arb", label: "Arbs", value: formatCompactCount(arbData?.rows.length ?? 0), tone: "#A78BFA" },
      { key: "research", label: "Research", value: formatCompactCount(cheatData?.count ?? 0), tone: brandColors.success },
      { key: "books", label: "Books", value: preferences.preferredSportsbooks.length > 0 ? `${preferences.preferredSportsbooks.length}` : "All", tone: brandColors.textSecondary },
    ],
    [evData?.meta.returned, arbData?.rows.length, cheatData?.count, preferences.preferredSportsbooks.length]
  );

  const topBooks = useMemo(
    () => (preferences.preferredSportsbooks.length > 0 ? preferences.preferredSportsbooks : ["draftkings", "fanduel", "betmgm"]).slice(0, 4),
    [preferences.preferredSportsbooks]
  );

  // Only show pull-to-refresh spinner when user manually pulls (not background refetch)
  const [manualRefresh, setManualRefresh] = useState(false);

  async function handleRefresh() {
    setManualRefresh(true);
    await Promise.all([
      positiveEvQuery.refetch(),
      arbitrageQuery.refetch(),
      cheatSheetQuery.refetch(),
      tripleDoubleQuery.refetch(),
    ]);
    setManualRefresh(false);
  }

  function pushWithImpact(route: Parameters<typeof router.push>[0]) {
    triggerLightImpactHaptic();
    router.push(route);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PageHeader
        title="Today"
        onSportsbooksPress={() => setPickerVisible(true)}
        selectedSportsbooks={preferences.preferredSportsbooks}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={manualRefresh}
            onRefresh={() => void handleRefresh()}
            tintColor={brandColors.primary}
          />
        }
      >
        {/* ─── Date & Stats Row ─── */}
        <View style={styles.dateRow}>
          <Text style={styles.dateText}>{formatTodayLabel()}</Text>
        </View>

        <View style={styles.statsRow}>
          {stats.map((item) => (
            <View key={item.key} style={styles.statChip}>
              <View style={[styles.statDot, { backgroundColor: item.tone }]} />
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ─── Best Right Now ─── */}
        <SectionHeader
          title="Best Right Now"
          subtitle="Top spots across your board."
          cta={{ label: "Sharp", onPress: () => { triggerSelectionHaptic(); router.push("/sharp"); } }}
        />

        <View style={styles.cardStack}>
          {topPositiveEv ? (
            <Pressable onPress={() => pushWithImpact("/sharp")} style={styles.insightCard}>
              <View style={styles.cardBadgeRow}>
                <View style={[styles.cardBadge, { backgroundColor: brandColors.primarySoft }]}>
                  <Text style={[styles.cardBadgeText, { color: brandColors.primary }]}>+EV</Text>
                </View>
                <Text style={styles.cardMeta}>{formatTimeLabel(topPositiveEv.startTime)}</Text>
              </View>

              <Text style={styles.insightTitle}>{getPositiveEvTitle(topPositiveEv)}</Text>
              <Text style={styles.insightSubtitle}>{getPositiveEvSubtitle(topPositiveEv)}</Text>

              <View style={styles.insightMeta}>
                <Text style={styles.insightMetaText}>
                  {getEventLabel(topPositiveEv.awayTeam, topPositiveEv.homeTeam)}
                </Text>
                <View style={styles.dot} />
                <Text style={styles.insightMetaText}>{topPositiveEv.book.bookName}</Text>
              </View>

              <View style={styles.insightStatsRow}>
                <View style={styles.insightStatCell}>
                  <Text style={styles.insightStatValue}>{formatPercent(topPositiveEv.evCalculations.evWorst ?? 0)}</Text>
                  <Text style={styles.insightStatLabel}>Edge</Text>
                </View>
                <View style={styles.insightStatCell}>
                  <Text style={styles.insightStatValue}>{formatOdds(topPositiveEv.book.price)}</Text>
                  <Text style={styles.insightStatLabel}>Price</Text>
                </View>
                <View style={styles.insightStatCell}>
                  <Text style={styles.insightStatValue}>{topPositiveEv.book.bookName}</Text>
                  <Text style={styles.insightStatLabel}>Book</Text>
                </View>
              </View>
            </Pressable>
          ) : evFirstLoad ? (
            <StateView state="loading" skeletonCount={1} inline />
          ) : positiveEvQuery.isError ? (
            <StateView state="error" message="EV spots unavailable." onRetry={() => void positiveEvQuery.refetch()} />
          ) : (
            <StateView state="empty" icon="flash-outline" title="No EV spots yet" message="Check back closer to lock." />
          )}

          {topArb ? (
            <Pressable onPress={() => pushWithImpact("/sharp")} style={styles.insightCard}>
              <View style={styles.cardBadgeRow}>
                <View style={[styles.cardBadge, { backgroundColor: "rgba(167,139,250,0.14)" }]}>
                  <Text style={[styles.cardBadgeText, { color: "#A78BFA" }]}>Arb</Text>
                </View>
                <Text style={styles.cardMeta}>{topArb.lg?.name ?? "Market"}</Text>
              </View>

              <Text style={styles.insightTitle}>{getArbEventLabel(topArb)}</Text>
              <Text style={styles.insightSubtitle}>{getArbMarketLabel(topArb)}</Text>

              <View style={styles.arbLegsRow}>
                <View style={styles.arbLeg}>
                  <BookLogo bookId={topArb.o.bk} size={22} />
                  <Text style={styles.arbLegBook}>{topArb.o.bk}</Text>
                  <Text style={styles.arbLegOdds}>{formatOdds(topArb.o.od)}</Text>
                </View>
                <Ionicons name="swap-horizontal" size={16} color={brandColors.textMuted} />
                <View style={styles.arbLeg}>
                  <BookLogo bookId={topArb.u.bk} size={22} />
                  <Text style={styles.arbLegBook}>{topArb.u.bk}</Text>
                  <Text style={styles.arbLegOdds}>{formatOdds(topArb.u.od)}</Text>
                </View>
              </View>

              <View style={styles.arbBottomRow}>
                <Text style={styles.arbBottomValue}>{formatPercent((topArb.roi_bps ?? 0) / 100, 2)}</Text>
                <Text style={styles.arbBottomLabel}>Projected return</Text>
              </View>
            </Pressable>
          ) : arbFirstLoad ? (
            <StateView state="loading" skeletonCount={1} inline />
          ) : arbitrageQuery.isError ? (
            <StateView state="error" message="Arbs unavailable." onRetry={() => void arbitrageQuery.refetch()} />
          ) : (
            <StateView state="empty" icon="swap-horizontal-outline" title="No arbs right now" message="Usually appears closer to market open." />
          )}
        </View>

        {/* ─── Research Radar ─── */}
        <SectionHeader
          title="Research Radar"
          subtitle="High-signal props worth opening."
          cta={{ label: "Props", onPress: () => { triggerSelectionHaptic(); router.push("/props"); } }}
        />

        {/* Cheat Sheet */}
        <View style={styles.researchPanel}>
          <View style={styles.researchPanelHeader}>
            <Text style={styles.researchPanelTitle}>Top hit rates</Text>
            <Ionicons name="stats-chart" size={16} color={brandColors.primary} />
          </View>

          {cheatRows.length > 0 ? (
            <View style={styles.researchList}>
              {cheatRows.map((row) => (
                <Pressable
                  key={`${row.playerId}-${row.market}-${row.line}`}
                  onPress={() => pushWithImpact("/props")}
                  style={styles.researchRow}
                >
                  <View style={styles.researchRowTop}>
                    <View>
                      <Text style={styles.researchPlayer}>{row.playerName}</Text>
                      <Text style={styles.researchMarket}>
                        {row.market.replace("player_", "").replace(/_/g, " ")} over {row.line}
                      </Text>
                    </View>
                    <View style={[styles.gradePill, { backgroundColor: `${matchupAccent(row.matchupQuality)}18` }]}>
                      <Text style={[styles.gradeText, { color: matchupAccent(row.matchupQuality) }]}>
                        {row.confidenceGrade}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.researchChips}>
                    <Text style={styles.chipText}>{row.hitRate}% hit</Text>
                    <Text style={styles.chipText}>{formatOdds(row.bestOdds?.price)}</Text>
                    <Text style={styles.chipText}>{getCheatMatchupLabel(row)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : cheatFirstLoad ? (
            <StateView state="loading" skeletonCount={2} inline />
          ) : cheatSheetQuery.isError ? (
            <StateView state="error" message="Research unavailable." onRetry={() => void cheatSheetQuery.refetch()} />
          ) : (
            <StateView state="empty" icon="bar-chart-outline" title="No research rows" message="Check back when more props are posted." />
          )}
        </View>

        {/* Specialty Sheets */}
        <View style={styles.researchPanel}>
          <View style={styles.researchPanelHeader}>
            <Text style={styles.researchPanelTitle}>Specialty looks</Text>
            <Ionicons name="trophy" size={16} color="#A78BFA" />
          </View>

          {tripleRows.length > 0 ? (
            <View style={styles.researchList}>
              {tripleRows.map((row: TripleDoubleSheetRow) => (
                <Pressable key={row.id} onPress={() => pushWithImpact("/props")} style={styles.researchRow}>
                  <View style={styles.researchRowTop}>
                    <View>
                      <Text style={styles.researchPlayer}>{row.player}</Text>
                      <Text style={styles.researchMarket}>{row.matchup}</Text>
                    </View>
                    <View style={styles.pricePill}>
                      <Text style={styles.priceText}>{row.td?.priceFormatted ?? "Open"}</Text>
                    </View>
                  </View>
                  <View style={styles.researchChips}>
                    <Text style={styles.chipText}>TD books {row.allTd.length}</Text>
                    <Text style={styles.chipText}>RA books {row.booksWithRa}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : tripleFirstLoad ? (
            <StateView state="loading" skeletonCount={2} inline />
          ) : tripleDoubleQuery.isError ? (
            <StateView state="error" message="Specialty data unavailable." onRetry={() => void tripleDoubleQuery.refetch()} />
          ) : (
            <StateView state="empty" icon="sparkles-outline" title="No specialty rows" message="Triple-double sheet appears when qualified." />
          )}
        </View>

        {/* ─── Books footer ─── */}
        <Pressable
          onPress={() => { triggerSelectionHaptic(); setPickerVisible(true); }}
          style={styles.booksFooter}
        >
          <View style={styles.bookStack}>
            {topBooks.map((bookId, i) => (
              <View key={bookId} style={i > 0 ? { marginLeft: -8 } : undefined}>
                <BookLogo bookId={bookId} size={28} />
              </View>
            ))}
          </View>
          <View style={styles.booksFooterText}>
            <Text style={styles.booksFooterTitle}>
              {preferences.preferredSportsbooks.length > 0 ? "Your book mix" : "All books enabled"}
            </Text>
            <Text style={styles.booksFooterSub}>Tap to customize</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={brandColors.textMuted} />
        </Pressable>
      </ScrollView>

      <SportsbookPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        selected={preferences.preferredSportsbooks}
        onSave={(books) => void savePreferences({ preferred_sportsbooks: books })}
      />
    </SafeAreaView>
  );
}

/* ─── styles ─── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 16,
  },

  /* Date */
  dateRow: {
    paddingVertical: 2,
  },
  dateText: {
    color: brandColors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },

  /* Stats */
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statChip: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    gap: 4,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statValue: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  /* Section Headers */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  sectionHeaderText: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: brandColors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: brandColors.textMuted,
    fontSize: 13,
  },
  sectionCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sectionCtaText: {
    color: brandColors.primary,
    fontSize: 13,
    fontWeight: "700",
  },

  /* Insight Cards */
  cardStack: {
    gap: 10,
  },
  insightCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: brandColors.panelBackground,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
  cardBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  cardMeta: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  insightTitle: {
    color: brandColors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  insightSubtitle: {
    color: brandColors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  insightMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  insightMetaText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  insightStatsRow: {
    flexDirection: "row",
    gap: 8,
  },
  insightStatCell: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 3,
  },
  insightStatValue: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  insightStatLabel: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* Arb legs */
  arbLegsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  arbLeg: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 6,
    alignItems: "center",
  },
  arbLegBook: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  arbLegOdds: {
    color: brandColors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  arbBottomRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  arbBottomValue: {
    color: brandColors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  arbBottomLabel: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },

  /* Research panels */
  researchPanel: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: brandColors.panelBackground,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  researchPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  researchPanelTitle: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  researchList: {
    gap: 8,
  },
  researchRow: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 8,
  },
  researchRowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  researchPlayer: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  researchMarket: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
    marginTop: 2,
  },
  gradePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gradeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  researchChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chipText: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  pricePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: brandColors.primarySoft,
  },
  priceText: {
    color: brandColors.primary,
    fontSize: 11,
    fontWeight: "800",
  },

  /* Books footer */
  booksFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  bookStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  booksFooterText: {
    flex: 1,
    gap: 2,
  },
  booksFooterTitle: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  booksFooterSub: {
    color: brandColors.textMuted,
    fontSize: 12,
  },

  /* Book fallback */
  bookFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  bookFallbackText: {
    color: brandColors.textPrimary,
    fontSize: 10,
    fontWeight: "800",
  },
});
