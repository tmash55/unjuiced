import { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
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

type QuickAction = {
  key: string;
  label: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: "/props" | "/sharp" | "/my-slips" | "/account";
  colors: readonly [string, string];
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "research",
    label: "Research",
    caption: "Hit rates and player cards",
    icon: "stats-chart",
    route: "/props",
    colors: ["rgba(14, 165, 233, 0.22)", "rgba(56, 189, 248, 0.04)"],
  },
  {
    key: "sharp",
    label: "Sharp",
    caption: "Best +EV and arb spots",
    icon: "flash",
    route: "/sharp",
    colors: ["rgba(251, 191, 36, 0.26)", "rgba(245, 158, 11, 0.06)"],
  },
  {
    key: "slips",
    label: "My Picks",
    caption: "Track your card",
    icon: "bookmark",
    route: "/my-slips",
    colors: ["rgba(16, 185, 129, 0.24)", "rgba(5, 150, 105, 0.05)"],
  },
  {
    key: "account",
    label: "Account",
    caption: "Books and bankroll",
    icon: "person",
    route: "/account",
    colors: ["rgba(168, 85, 247, 0.24)", "rgba(99, 102, 241, 0.05)"],
  },
];

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
  if (!value) return "Updated live";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Updated live";
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPositiveEvTitle(opp: PositiveEVOpportunity): string {
  if (opp.playerName) return opp.playerName;
  if (opp.marketDisplay) return opp.marketDisplay;
  return "Positive EV";
}

function getPositiveEvSubtitle(opp: PositiveEVOpportunity): string {
  if (opp.playerName) {
    return `${opp.marketDisplay} ${opp.side === "over" ? "Over" : opp.side === "under" ? "Under" : opp.side} ${opp.line}`;
  }
  return opp.marketDisplay;
}

function getEventLabel(away: string | undefined, home: string | undefined): string {
  if (away && home) return `${away} @ ${home}`;
  return away || home || "Market board";
}

function getArbEventLabel(row: ArbRow): string {
  return getEventLabel(row.ev.away.abbr || row.ev.away.name, row.ev.home.abbr || row.ev.home.name);
}

function getArbMarketLabel(row: ArbRow): string {
  const market = row.mkt.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: brandColors.panelBackgroundAlt,
      }}
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
  const arbitrageQuery = useArbitrage({
    mode: "pregame",
    limit: 10,
  });
  const cheatSheetQuery = useCheatSheet({
    minHitRate: 60,
    markets: ["player_points", "player_rebounds", "player_assists"],
  });
  const tripleDoubleQuery = useTripleDoubleSheet();

  const topPositiveEv = positiveEvQuery.data?.opportunities?.[0];
  const topArb = arbitrageQuery.data?.rows?.[0];
  const cheatRows = useMemo(() => (cheatSheetQuery.data?.rows ?? []).slice(0, 3), [cheatSheetQuery.data?.rows]);
  const tripleRows = useMemo(
    () => (tripleDoubleQuery.data?.data?.rows ?? []).slice(0, 2),
    [tripleDoubleQuery.data?.data?.rows]
  );

  const stats = useMemo(
    () => [
      {
        key: "ev",
        label: "EV spots",
        value: formatCompactCount(positiveEvQuery.data?.meta.returned ?? 0),
        tone: "#FBBF24",
      },
      {
        key: "arb",
        label: "Arbs",
        value: formatCompactCount(arbitrageQuery.data?.rows.length ?? 0),
        tone: brandColors.primary,
      },
      {
        key: "research",
        label: "Research",
        value: formatCompactCount(cheatSheetQuery.data?.count ?? 0),
        tone: "#A78BFA",
      },
      {
        key: "books",
        label: "Books",
        value: preferences.preferredSportsbooks.length > 0 ? `${preferences.preferredSportsbooks.length}` : "All",
        tone: "#34D399",
      },
    ],
    [
      arbitrageQuery.data?.rows.length,
      cheatSheetQuery.data?.count,
      positiveEvQuery.data?.meta.returned,
      preferences.preferredSportsbooks.length,
    ]
  );

  const topBooks = useMemo(
    () => (preferences.preferredSportsbooks.length > 0 ? preferences.preferredSportsbooks : ["draftkings", "fanduel", "betmgm"]).slice(0, 4),
    [preferences.preferredSportsbooks]
  );

  const isRefreshing =
    positiveEvQuery.isRefetching ||
    arbitrageQuery.isRefetching ||
    cheatSheetQuery.isRefetching ||
    tripleDoubleQuery.isRefetching;

  async function handleRefresh() {
    await Promise.all([
      positiveEvQuery.refetch(),
      arbitrageQuery.refetch(),
      cheatSheetQuery.refetch(),
      tripleDoubleQuery.refetch(),
    ]);
  }

  function pushWithImpact(route: Parameters<typeof router.push>[0]) {
    triggerLightImpactHaptic();
    router.push(route);
  }

  function runSelection(action: () => void) {
    triggerSelectionHaptic();
    action();
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PageHeader
        title="Today"
        accentColor="#22C55E"
        onSportsbooksPress={() => setPickerVisible(true)}
        selectedSportsbooks={preferences.preferredSportsbooks}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={brandColors.primary}
          />
        }
      >
        <LinearGradient
          colors={["#112236", "#0C151F", "#091017"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroEyebrowRow}>
            <View style={styles.heroEyebrow}>
              <Ionicons name="pulse" size={12} color="#7DD3FC" />
              <Text style={styles.heroEyebrowText}>Market pulse</Text>
            </View>
            <Text style={styles.heroDate}>{formatTodayLabel()}</Text>
          </View>

          <Text style={styles.heroTitle}>A cleaner board for finding your next bet.</Text>
          <Text style={styles.heroSubtitle}>
            Live sharp signals, research-ready props, and your selected books in one mobile flow.
          </Text>

          <View style={styles.heroStatsGrid}>
            {stats.map((item) => (
              <View key={item.key} style={styles.heroStatCard}>
                <View style={[styles.heroStatDot, { backgroundColor: item.tone }]} />
                <Text style={styles.heroStatValue}>{item.value}</Text>
                <Text style={styles.heroStatLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.heroBottomRow}>
            <View style={styles.bookStackRow}>
              <View style={styles.bookStack}>
                {topBooks.map((bookId, index) => (
                  <View key={bookId} style={index > 0 ? styles.bookStackOffset : undefined}>
                    <BookLogo bookId={bookId} size={28} />
                  </View>
                ))}
              </View>
              <View style={styles.bookStackTextWrap}>
                <Text style={styles.bookStackTitle}>
                  {preferences.preferredSportsbooks.length > 0 ? "Custom book mix" : "All books enabled"}
                </Text>
                <Text style={styles.bookStackSubtitle}>
                  {preferences.preferredSportsbooks.length > 0
                    ? "Today is tuned to your preferred outs."
                    : "Pick specific books any time from the header."}
                </Text>
              </View>
            </View>

            <Pressable onPress={() => pushWithImpact("/sharp")} style={styles.heroPrimaryCta}>
              <Text style={styles.heroPrimaryCtaText}>Open Sharp</Text>
              <Ionicons name="arrow-forward" size={14} color="#03131E" />
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.actionsRow}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable key={action.key} onPress={() => pushWithImpact(action.route)} style={styles.actionCard}>
              <LinearGradient colors={[action.colors[0], action.colors[1]]} style={styles.actionGlow}>
                <View style={styles.actionIconWrap}>
                  <Ionicons name={action.icon} size={18} color={brandColors.textPrimary} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <Text style={styles.actionCaption}>{action.caption}</Text>
              </LinearGradient>
            </Pressable>
          ))}
        </View>

        <SectionHeader
          title="Best Right Now"
          subtitle="Fastest route to the strongest spots on your board."
          cta={{ label: "Sharp", onPress: () => runSelection(() => router.push("/sharp")) }}
        />

        <View style={styles.cardStack}>
          {topPositiveEv ? (
            <Pressable onPress={() => pushWithImpact("/sharp")} style={styles.primaryInsightCard}>
              <View style={styles.cardBadgeRow}>
                <View style={[styles.cardBadge, styles.evBadge]}>
                  <Text style={styles.cardBadgeText}>+EV</Text>
                </View>
                <Text style={styles.cardMetaText}>{formatTimeLabel(topPositiveEv.startTime)}</Text>
              </View>

              <Text style={styles.primaryInsightTitle}>{getPositiveEvTitle(topPositiveEv)}</Text>
              <Text style={styles.primaryInsightSubtitle}>{getPositiveEvSubtitle(topPositiveEv)}</Text>

              <View style={styles.primaryInsightMeta}>
                <Text style={styles.primaryInsightMetaText}>
                  {getEventLabel(topPositiveEv.awayTeam, topPositiveEv.homeTeam)}
                </Text>
                <View style={styles.primaryInsightDivider} />
                <Text style={styles.primaryInsightMetaText}>{topPositiveEv.book.bookName}</Text>
              </View>

              <View style={styles.insightStatsRow}>
                <View style={styles.insightStatCell}>
                  <Text style={styles.insightStatValue}>
                    {formatPercent(topPositiveEv.evCalculations.evWorst ?? 0)}
                  </Text>
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
          ) : positiveEvQuery.isLoading ? (
            <StateView state="loading" message="Loading positive EV board..." skeletonCount={1} />
          ) : positiveEvQuery.isError ? (
            <StateView
              state="error"
              message="Positive EV spots are unavailable right now."
              onRetry={() => void positiveEvQuery.refetch()}
            />
          ) : (
            <StateView
              state="empty"
              icon="flash-outline"
              title="No EV spots yet"
              message="Try widening your sportsbook filter or check back closer to lock."
            />
          )}

          {topArb ? (
            <Pressable onPress={() => pushWithImpact("/sharp")} style={styles.secondaryInsightCard}>
              <View style={styles.cardBadgeRow}>
                <View style={[styles.cardBadge, styles.arbBadge]}>
                  <Text style={styles.cardBadgeText}>Arbitrage</Text>
                </View>
                <Text style={styles.cardMetaText}>{topArb.lg?.name ?? "Market"}</Text>
              </View>

              <Text style={styles.secondaryInsightTitle}>{getArbEventLabel(topArb)}</Text>
              <Text style={styles.secondaryInsightSubtitle}>{getArbMarketLabel(topArb)}</Text>

              <View style={styles.arbLegsRow}>
                <View style={styles.arbLegCard}>
                  <BookLogo bookId={topArb.o.bk} size={22} />
                  <Text style={styles.arbLegBook}>{topArb.o.bk}</Text>
                  <Text style={styles.arbLegOdds}>{formatOdds(topArb.o.od)}</Text>
                </View>
                <View style={styles.arbLegDivider}>
                  <Ionicons name="swap-horizontal" size={16} color={brandColors.textMuted} />
                </View>
                <View style={styles.arbLegCard}>
                  <BookLogo bookId={topArb.u.bk} size={22} />
                  <Text style={styles.arbLegBook}>{topArb.u.bk}</Text>
                  <Text style={styles.arbLegOdds}>{formatOdds(topArb.u.od)}</Text>
                </View>
              </View>

              <View style={styles.arbBottomRow}>
                <Text style={styles.arbBottomValue}>{formatPercent((topArb.roi_bps ?? 0) / 100, 2)}</Text>
                <Text style={styles.arbBottomLabel}>Projected arb</Text>
              </View>
            </Pressable>
          ) : arbitrageQuery.isLoading ? (
            <StateView state="loading" message="Loading arbitrage board..." skeletonCount={1} />
          ) : arbitrageQuery.isError ? (
            <StateView
              state="error"
              message="Arbitrage opportunities are unavailable right now."
              onRetry={() => void arbitrageQuery.refetch()}
            />
          ) : (
            <StateView
              state="empty"
              icon="swap-horizontal-outline"
              title="No arbs right now"
              message="Pregame arbitrage usually appears closer to market open."
            />
          )}
        </View>

        <SectionHeader
          title="Research Radar"
          subtitle="High-signal props and specialty sheets worth opening next."
          cta={{ label: "Props", onPress: () => runSelection(() => router.push("/props")) }}
        />

        <View style={styles.researchGrid}>
          <View style={styles.researchPanel}>
            <View style={styles.researchPanelHeader}>
              <View>
                <Text style={styles.researchPanelTitle}>Top hit rate spots</Text>
                <Text style={styles.researchPanelSubtitle}>Sorted for quick pregame review.</Text>
              </View>
              <Ionicons name="stats-chart" size={18} color={brandColors.primary} />
            </View>

            {cheatRows.length > 0 ? (
              <View style={styles.researchList}>
                {cheatRows.map((row) => (
                  <Pressable
                    key={`${row.playerId}-${row.market}-${row.line}`}
                    onPress={() => pushWithImpact("/props")}
                    style={styles.researchRow}
                  >
                    <View style={styles.researchRowHeader}>
                      <View style={[styles.matchupPill, { backgroundColor: `${matchupAccent(row.matchupQuality)}18` }]}>
                        <Text style={[styles.matchupPillText, { color: matchupAccent(row.matchupQuality) }]}>
                          {row.confidenceGrade}
                        </Text>
                      </View>
                      <Text style={styles.researchRowMeta}>{getCheatMatchupLabel(row)}</Text>
                    </View>

                    <Text style={styles.researchRowTitle}>{row.playerName}</Text>
                    <Text style={styles.researchRowSubtitle}>
                      {row.market.replace("player_", "").replace(/_/g, " ")} over {row.line}
                    </Text>

                    <View style={styles.researchRowStats}>
                      <Text style={styles.researchRowStat}>{row.hitRate}% hit</Text>
                      <Text style={styles.researchRowStat}>{formatOdds(row.bestOdds?.price)}</Text>
                      <Text style={styles.researchRowStat}>{row.bestOdds?.book ?? `${row.books} books`}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : cheatSheetQuery.isLoading ? (
              <StateView state="loading" message="Loading research board..." skeletonCount={2} />
            ) : cheatSheetQuery.isError ? (
              <StateView
                state="error"
                message="Research rows are unavailable right now."
                onRetry={() => void cheatSheetQuery.refetch()}
              />
            ) : (
              <StateView
                state="empty"
                icon="bar-chart-outline"
                title="No research rows"
                message="Try again once more props are posted."
              />
            )}
          </View>

          <View style={styles.researchPanel}>
            <View style={styles.researchPanelHeader}>
              <View>
                <Text style={styles.researchPanelTitle}>Specialty looks</Text>
                <Text style={styles.researchPanelSubtitle}>Sheet-style markets with faster context.</Text>
              </View>
              <Ionicons name="trophy" size={18} color="#FBBF24" />
            </View>

            {tripleRows.length > 0 ? (
              <View style={styles.specialtyList}>
                {tripleRows.map((row: TripleDoubleSheetRow) => (
                  <Pressable key={row.id} onPress={() => pushWithImpact("/props")} style={styles.specialtyCard}>
                    <View style={styles.specialtyCardHeader}>
                      <Text style={styles.specialtyPlayer}>{row.player}</Text>
                      <View style={styles.specialtyPricePill}>
                        <Text style={styles.specialtyPriceText}>{row.td?.priceFormatted ?? "Open"}</Text>
                      </View>
                    </View>
                    <Text style={styles.specialtyMatchup}>{row.matchup}</Text>
                    <View style={styles.specialtyMetaRow}>
                      <Text style={styles.specialtyMeta}>TD books {row.allTd.length}</Text>
                      <Text style={styles.specialtyMeta}>RA books {row.booksWithRa}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : tripleDoubleQuery.isLoading ? (
              <StateView state="loading" message="Loading specialty sheets..." skeletonCount={2} />
            ) : tripleDoubleQuery.isError ? (
              <StateView
                state="error"
                message="Specialty sheet data is unavailable right now."
                onRetry={() => void tripleDoubleQuery.refetch()}
              />
            ) : (
              <StateView
                state="empty"
                icon="sparkles-outline"
                title="No specialty rows"
                message="Triple-double sheet will appear when qualified legs are available."
              />
            )}
          </View>
        </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 18,
  },
  heroCard: {
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.14)",
    overflow: "hidden",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 10,
  },
  heroEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroEyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(125, 211, 252, 0.10)",
  },
  heroEyebrowText: {
    color: "#D7F4FF",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroDate: {
    color: "rgba(229, 231, 235, 0.82)",
    fontSize: 12,
    fontWeight: "600",
  },
  heroTitle: {
    color: "#F8FAFC",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    color: "rgba(229, 231, 235, 0.72)",
    fontSize: 14,
    lineHeight: 21,
  },
  heroStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroStatCard: {
    width: "47%",
    minWidth: 140,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 6,
  },
  heroStatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroStatValue: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "800",
  },
  heroStatLabel: {
    color: "rgba(229, 231, 235, 0.62)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroBottomRow: {
    gap: 14,
  },
  bookStackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bookStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  bookStackOffset: {
    marginLeft: -8,
  },
  bookStackTextWrap: {
    flex: 1,
    gap: 2,
  },
  bookStackTitle: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "700",
  },
  bookStackSubtitle: {
    color: "rgba(229, 231, 235, 0.62)",
    fontSize: 12,
    lineHeight: 17,
  },
  heroPrimaryCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "#D9F99D",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroPrimaryCtaText: {
    color: "#03131E",
    fontSize: 13,
    fontWeight: "800",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionCard: {
    width: "47%",
    minWidth: 145,
  },
  actionGlow: {
    minHeight: 122,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    gap: 10,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  actionLabel: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  actionCaption: {
    color: brandColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeaderText: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: brandColors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: brandColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
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
  cardStack: {
    gap: 12,
  },
  primaryInsightCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "#0F1824",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.15)",
    gap: 12,
  },
  secondaryInsightCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: brandColors.panelBackground,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.15)",
    gap: 12,
  },
  cardBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  evBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.14)",
  },
  arbBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.14)",
  },
  cardBadgeText: {
    color: brandColors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  cardMetaText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  primaryInsightTitle: {
    color: brandColors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
  },
  primaryInsightSubtitle: {
    color: "#FDE68A",
    fontSize: 14,
    fontWeight: "700",
  },
  primaryInsightMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryInsightMetaText: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  primaryInsightDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  insightStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  insightStatCell: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 4,
  },
  insightStatValue: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  insightStatLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  secondaryInsightTitle: {
    color: brandColors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  secondaryInsightSubtitle: {
    color: brandColors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  arbLegsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  arbLegCard: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 8,
    alignItems: "center",
  },
  arbLegDivider: {
    width: 28,
    alignItems: "center",
  },
  arbLegBook: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  arbLegOdds: {
    color: brandColors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  arbBottomRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  arbBottomValue: {
    color: "#7DD3FC",
    fontSize: 22,
    fontWeight: "800",
  },
  arbBottomLabel: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  researchGrid: {
    gap: 12,
  },
  researchPanel: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: brandColors.panelBackground,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 14,
  },
  researchPanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  researchPanelTitle: {
    color: brandColors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  researchPanelSubtitle: {
    color: brandColors.textMuted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  researchList: {
    gap: 10,
  },
  researchRow: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 8,
  },
  researchRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  matchupPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  matchupPillText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  researchRowMeta: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  researchRowTitle: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  researchRowSubtitle: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  researchRowStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  researchRowStat: {
    color: "#D4DDE8",
    fontSize: 12,
    fontWeight: "700",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  specialtyList: {
    gap: 10,
  },
  specialtyCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 8,
  },
  specialtyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  specialtyPlayer: {
    flex: 1,
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  specialtyPricePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(251, 191, 36, 0.14)",
  },
  specialtyPriceText: {
    color: "#FCD34D",
    fontSize: 11,
    fontWeight: "800",
  },
  specialtyMatchup: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  specialtyMetaRow: {
    flexDirection: "row",
    gap: 8,
  },
  specialtyMeta: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
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
