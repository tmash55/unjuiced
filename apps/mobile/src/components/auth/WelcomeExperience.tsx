import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { brandColors } from "@/src/theme/brand";

const SCREEN_H = Dimensions.get("window").height;

const BACKGROUND_FEED = [
  { player: "Martin Necas", value: "+7.6%", detail: "Shots O2.5", accent: "#22C55E" },
  { player: "Jayson Tatum", value: "87", detail: "Unjuiced Score", accent: "#38BDF8" },
  { player: "Corbin Carroll", value: "91", detail: "Exit Velo", accent: "#FBBF24" },
  { player: "Connor McDavid", value: "+5.1%", detail: "Points O1.5", accent: "#A78BFA" },
  { player: "Kyle Schwarber", value: "HR", detail: "Targets Sheet", accent: "#34D399" },
  { player: "Nikola Jokic", value: "A+", detail: "Cheat Sheet", accent: "#F97316" },
];

function BookLogo({ bookId }: { bookId: string }) {
  const uri = getSportsbookLogoUrl(bookId);

  if (!uri) {
    return (
      <View style={styles.bookFallback}>
        <Text style={styles.bookFallbackText}>{bookId.slice(0, 1).toUpperCase()}</Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={styles.bookLogo} />;
}

function FlowBackground() {
  const translateA = useRef(new Animated.Value(0)).current;
  const translateB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.timing(translateA, {
          toValue: -260,
          duration: 18000,
          useNativeDriver: true,
        }),
        Animated.timing(translateA, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    const loopB = Animated.loop(
      Animated.sequence([
        Animated.timing(translateB, {
          toValue: 220,
          duration: 22000,
          useNativeDriver: true,
        }),
        Animated.timing(translateB, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    loopA.start();
    loopB.start();

    return () => {
      loopA.stop();
      loopB.stop();
    };
  }, [translateA, translateB]);

  const duplicated = [...BACKGROUND_FEED, ...BACKGROUND_FEED];

  return (
    <View pointerEvents="none" style={styles.backgroundWrap}>
      <Animated.View style={[styles.flowColumn, styles.flowColumnLeft, { transform: [{ translateY: translateA }] }]}>
        {duplicated.map((item, index) => (
          <View key={`${item.player}-${index}`} style={styles.flowCard}>
            <View style={[styles.flowAccent, { backgroundColor: item.accent }]} />
            <Text style={styles.flowPlayer}>{item.player}</Text>
            <Text style={[styles.flowValue, { color: item.accent }]}>{item.value}</Text>
            <Text style={styles.flowDetail}>{item.detail}</Text>
          </View>
        ))}
      </Animated.View>

      <Animated.View style={[styles.flowColumn, styles.flowColumnRight, { transform: [{ translateY: translateB }] }]}>
        {duplicated.map((item, index) => (
          <View key={`right-${item.player}-${index}`} style={styles.flowCardAlt}>
            <Text style={styles.flowMiniLabel}>Live</Text>
            <Text style={styles.flowPlayer}>{item.player}</Text>
            <Text style={styles.flowDetail}>{item.detail}</Text>
            <View style={styles.flowMiniTicker}>
              <Text style={[styles.flowMiniTickerText, { color: item.accent }]}>{item.value}</Text>
            </View>
          </View>
        ))}
      </Animated.View>

      <LinearGradient
        colors={["rgba(5,10,16,0.18)", "rgba(5,10,16,0.84)", "#081019"]}
        style={styles.backgroundOverlay}
      />
    </View>
  );
}

function FloatingPhone({ children, lift = 0 }: { children: React.ReactNode; lift?: number }) {
  const translateY = useRef(new Animated.Value(lift)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: lift - 8,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: lift,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => loop.stop();
  }, [lift, translateY]);

  return (
    <Animated.View style={[styles.phoneShell, { transform: [{ translateY }] }]}>
      <View style={styles.phoneNotch} />
      <View style={styles.phoneScreen}>{children}</View>
    </Animated.View>
  );
}

function SharpFeedPreview() {
  const cards = [
    { player: "Martin Necas", market: "Shots O2.5", edge: "+7.6%", book: "draftkings", odds: "+118" },
    { player: "Jalen Brunson", market: "Assists O6.5", edge: "+6.1%", book: "fanduel", odds: "+105" },
    { player: "Ronald Acuna Jr.", market: "Bases O1.5", edge: "+4.8%", book: "betmgm", odds: "+132" },
  ];

  return (
    <FloatingPhone>
      <Text style={styles.previewTopLabel}>Sharp Feed</Text>
      {cards.map((card) => (
        <View key={`${card.player}-${card.market}`} style={styles.feedCard}>
          <View style={styles.feedCardHeader}>
            <View>
              <Text style={styles.feedPlayer}>{card.player}</Text>
              <Text style={styles.feedMarket}>{card.market}</Text>
            </View>
            <View style={styles.feedEdgePill}>
              <Text style={styles.feedEdgeText}>{card.edge}</Text>
            </View>
          </View>
          <View style={styles.feedBottomRow}>
            <View style={styles.feedBookRow}>
              <BookLogo bookId={card.book} />
              <Text style={styles.feedBookName}>{card.book}</Text>
            </View>
            <Text style={styles.feedOdds}>{card.odds}</Text>
          </View>
        </View>
      ))}
    </FloatingPhone>
  );
}

function SheetPreview() {
  const rows = [
    { player: "Aaron Judge", score: 94, stat: "Exit Velo", color: "#22C55E" },
    { player: "Fernando Tatis Jr.", score: 88, stat: "HR Target", color: "#84CC16" },
    { player: "Mookie Betts", score: 82, stat: "Hard Hit", color: "#FBBF24" },
    { player: "Yordan Alvarez", score: 79, stat: "Power Surge", color: "#F97316" },
  ];

  return (
    <FloatingPhone lift={-2}>
      <Text style={styles.previewTopLabel}>Sheets</Text>
      {rows.map((row) => (
        <View key={row.player} style={styles.sheetRow}>
          <View style={styles.sheetAvatar}>
            <Text style={styles.sheetAvatarText}>{row.player.split(" ").map((part) => part[0]).join("")}</Text>
          </View>
          <View style={styles.sheetPlayerBlock}>
            <Text style={styles.sheetPlayer}>{row.player}</Text>
            <Text style={styles.sheetStat}>{row.stat}</Text>
          </View>
          <View style={[styles.sheetScorePill, { backgroundColor: `${row.color}22` }]}>
            <Text style={[styles.sheetScoreText, { color: row.color }]}>{row.score}</Text>
          </View>
        </View>
      ))}
    </FloatingPhone>
  );
}

function ScorePreview() {
  return (
    <FloatingPhone lift={-4}>
      <Text style={styles.previewTopLabel}>Unjuiced Score</Text>
      <View style={styles.scoreHero}>
        <View style={styles.scoreBubble}>
          <Text style={styles.scoreBubbleValue}>87</Text>
        </View>
        <View style={styles.scoreCopy}>
          <Text style={styles.scorePlayer}>Connor McDavid</Text>
          <Text style={styles.scoreMarket}>Points O1.5</Text>
        </View>
      </View>
      <View style={styles.aiInsightCard}>
        <Text style={styles.aiInsightLabel}>AI insight</Text>
        <Text style={styles.aiInsightText}>
          Elite matchup pace, sharp confirmation across 3 books, and recent role stability push this prop into premium range.
        </Text>
      </View>
      <View style={styles.scoreStatsRow}>
        <MiniStat label="Hit Rate" value="74%" />
        <MiniStat label="Best Price" value="+114" />
        <MiniStat label="Confidence" value="High" />
      </View>
    </FloatingPhone>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function Panel({
  eyebrow,
  title,
  subtitle,
  children,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <View style={[styles.panel, compact ? styles.panelCompact : null]}>
      <Text style={styles.panelEyebrow}>{eyebrow}</Text>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.panelSubtitle}>{subtitle}</Text>
      {children}
    </View>
  );
}

export function WelcomeExperience({
  onGetStarted,
  onLogin,
}: {
  onGetStarted: () => void;
  onLogin: () => void;
}) {
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <FlowBackground />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroPanel}>
          <View style={styles.heroInner}>
            <View style={styles.heroEyebrowRow}>
              <View style={styles.heroEyebrowPill}>
                <Ionicons name="flash-outline" size={14} color="#D9F99D" />
                <Text style={styles.heroEyebrowText}>Unjuiced Mobile</Text>
              </View>
            </View>

            <Text style={styles.heroTitle}>Sharper bets start here.</Text>
            <Text style={styles.heroSubtitle}>
              Real-time +EV plays, AI-powered scores, and cheat sheets across every sport.
            </Text>

            <View style={styles.heroActions}>
              <Pressable onPress={onGetStarted} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Get Started</Text>
              </Pressable>
              <Pressable onPress={onLogin} style={styles.loginLink}>
                <Text style={styles.loginLinkText}>I already have an account</Text>
                <Text style={styles.loginActionText}>Log In</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Panel
          eyebrow="Sharp tools"
          title="Find +EV plays in seconds."
          subtitle="A live feed built to surface the board fast, with the numbers that actually matter."
        >
          <SharpFeedPreview />
        </Panel>

        <Panel
          eyebrow="Sheets preview"
          title="Data that hits different."
          subtitle="Ranked sheets, color-coded confidence, and fast-scan player views that feel closer to a desk than a sportsbook."
        >
          <SheetPreview />
        </Panel>

        <Panel
          eyebrow="AI teaser"
          title="Every prop. Scored. Explained."
          subtitle="Unjuiced Score turns raw market data into one number and one clear reason to care."
        >
          <ScorePreview />
        </Panel>

        <Panel
          eyebrow="Choose your tier"
          title="Start simple. Go sharp when you’re ready."
          subtitle="Two plans. Clean access. No bloated pricing grid."
          compact
        >
          <View style={styles.pricingRow}>
            <View style={styles.planCard}>
              <Text style={styles.planName}>Standard</Text>
              <Text style={styles.planPrice}>$15/mo</Text>
              <Text style={styles.planBullet}>Live +EV feed</Text>
              <Text style={styles.planBullet}>Core cheat sheets</Text>
              <Text style={styles.planBullet}>Book selection</Text>
              <Text style={styles.planBullet}>Daily brief</Text>
            </View>

            <LinearGradient
              colors={["rgba(217,249,157,0.22)", "rgba(34,197,94,0.08)"]}
              style={[styles.planCard, styles.planCardFeatured]}
            >
              <Text style={styles.planName}>Sharp</Text>
              <Text style={styles.planPrice}>$30/mo</Text>
              <Text style={styles.planBullet}>AI score previews</Text>
              <Text style={styles.planBullet}>Premium sheets</Text>
              <Text style={styles.planBullet}>Arbitrage tools</Text>
              <Text style={styles.planBullet}>Best line workflow</Text>
            </LinearGradient>
          </View>

          <View style={styles.closeActions}>
            <Pressable onPress={onGetStarted} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </Pressable>
            <Pressable onPress={onLogin} style={styles.loginLink}>
              <Text style={styles.loginLinkText}>Already have an account</Text>
              <Text style={styles.loginActionText}>Log In</Text>
            </Pressable>
          </View>
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#081019",
  },
  backgroundWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  flowColumn: {
    position: "absolute",
    width: "44%",
    gap: 12,
  },
  flowColumnLeft: {
    left: 16,
    top: -80,
  },
  flowColumnRight: {
    right: 16,
    top: -180,
  },
  flowCard: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 4,
  },
  flowCardAlt: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    gap: 6,
  },
  flowAccent: {
    width: 26,
    height: 3,
    borderRadius: 2,
    marginBottom: 4,
  },
  flowMiniLabel: {
    color: "rgba(255,255,255,0.44)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  flowPlayer: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    fontWeight: "700",
  },
  flowValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  flowDetail: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 12,
    fontWeight: "600",
  },
  flowMiniTicker: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  flowMiniTickerText: {
    fontSize: 12,
    fontWeight: "800",
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 36,
    gap: 28,
  },
  heroPanel: {
    minHeight: SCREEN_H * 0.92,
    justifyContent: "center",
  },
  heroInner: {
    gap: 18,
  },
  heroEyebrowRow: {
    alignItems: "flex-start",
  },
  heroEyebrowPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroEyebrowText: {
    color: "#D9F99D",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: "#F8FAFC",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.9,
    maxWidth: 300,
  },
  heroSubtitle: {
    color: "rgba(229,231,235,0.76)",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  heroActions: {
    gap: 12,
    marginTop: 6,
  },
  primaryButton: {
    width: "100%",
    minHeight: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D9F99D",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryButtonText: {
    color: "#04111B",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  loginLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  loginLinkText: {
    color: "rgba(229,231,235,0.62)",
    fontSize: 14,
    fontWeight: "600",
  },
  loginActionText: {
    color: "#7DD3FC",
    fontSize: 14,
    fontWeight: "800",
  },
  panel: {
    minHeight: SCREEN_H * 0.78,
    gap: 14,
    justifyContent: "center",
  },
  panelCompact: {
    minHeight: SCREEN_H * 0.7,
  },
  panelEyebrow: {
    color: "#7DD3FC",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  panelTitle: {
    color: "#F8FAFC",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
    maxWidth: 310,
  },
  panelSubtitle: {
    color: "rgba(229,231,235,0.68)",
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 320,
  },
  phoneShell: {
    marginTop: 12,
    alignSelf: "center",
    width: "92%",
    maxWidth: 340,
    borderRadius: 34,
    padding: 10,
    backgroundColor: "#050A10",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  phoneNotch: {
    alignSelf: "center",
    width: 88,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#0E1721",
    marginBottom: 8,
  },
  phoneScreen: {
    borderRadius: 26,
    padding: 14,
    backgroundColor: "#F8FAFC",
    gap: 10,
    minHeight: 380,
  },
  previewTopLabel: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  feedCard: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  feedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  feedPlayer: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  feedMarket: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  feedEdgePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(34,197,94,0.12)",
    alignSelf: "flex-start",
  },
  feedEdgeText: {
    color: "#16A34A",
    fontSize: 12,
    fontWeight: "800",
  },
  feedBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  feedBookRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  feedBookName: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  feedOdds: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  bookLogo: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  bookFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
  },
  bookFallbackText: {
    color: "#334155",
    fontSize: 10,
    fontWeight: "800",
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sheetAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
  },
  sheetAvatarText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "800",
  },
  sheetPlayerBlock: {
    flex: 1,
    gap: 2,
  },
  sheetPlayer: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  sheetStat: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  sheetScorePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sheetScoreText: {
    fontSize: 12,
    fontWeight: "800",
  },
  scoreHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  scoreBubble: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  scoreBubbleValue: {
    color: "#16A34A",
    fontSize: 30,
    fontWeight: "800",
  },
  scoreCopy: {
    flex: 1,
    gap: 3,
  },
  scorePlayer: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },
  scoreMarket: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
  },
  aiInsightCard: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#0F172A",
    gap: 6,
    marginTop: 8,
  },
  aiInsightLabel: {
    color: "#7DD3FC",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  aiInsightText: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  scoreStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  miniStat: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    gap: 3,
  },
  miniStatValue: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  miniStatLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  pricingRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  planCard: {
    flex: 1,
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  planCardFeatured: {
    borderColor: "rgba(217,249,157,0.32)",
  },
  planName: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "800",
  },
  planPrice: {
    color: "#D9F99D",
    fontSize: 22,
    fontWeight: "800",
  },
  planBullet: {
    color: "rgba(229,231,235,0.72)",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  closeActions: {
    gap: 12,
    marginTop: 18,
  },
});
