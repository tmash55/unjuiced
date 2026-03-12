import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { brandColors } from "@/src/theme/brand";

const { width: SCREEN_W } = Dimensions.get("window");

/* ─── slide data ─── */

type Slide = {
  key: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  content: () => React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    key: "welcome",
    eyebrow: "",
    title: "",
    subtitle: "",
    content: () => null, // welcome slide is rendered specially
  },
  {
    key: "sharp",
    eyebrow: "Sharp Edge Finder",
    title: "Find +EV plays\nin seconds.",
    subtitle:
      "A live feed of edges across every sport. See the sharp side, the best price, and the books offering it.",
    content: () => <SharpPreview />,
  },
  {
    key: "sheets",
    eyebrow: "Cheat Sheets & Hit Rates",
    title: "Research that\nhits different.",
    subtitle:
      "Color-coded sheets, hit rate trends, and player insights designed for fast pregame scans.",
    content: () => <SheetsPreview />,
  },
  {
    key: "tools",
    eyebrow: "Built for Bettors",
    title: "Every tool.\nOne app.",
    subtitle:
      "Arbitrage scanner, odds comparison, line history, player correlations, and more.",
    content: () => <ToolsPreview />,
  },
];

/* ─── slide content components ─── */

function SharpPreview() {
  const cards = [
    { player: "Jayson Tatum", market: "Points O24.5", edge: "+6.2%", book: "DraftKings", odds: "+105" },
    { player: "Martin Necas", market: "Shots O2.5", edge: "+7.6%", book: "FanDuel", odds: "+118" },
    { player: "Ronald Acuna Jr.", market: "Bases O1.5", edge: "+4.8%", book: "BetMGM", odds: "+132" },
  ];

  return (
    <View style={slideStyles.previewContainer}>
      <View style={slideStyles.previewCard}>
        <View style={slideStyles.previewHeader}>
          <View style={slideStyles.previewDot} />
          <Text style={slideStyles.previewHeaderText}>Live Edge Feed</Text>
        </View>
        {cards.map((card) => (
          <View key={card.player} style={slideStyles.feedRow}>
            <View style={slideStyles.feedRowLeft}>
              <Text style={slideStyles.feedPlayer}>{card.player}</Text>
              <Text style={slideStyles.feedMarket}>{card.market}</Text>
            </View>
            <View style={slideStyles.feedRowRight}>
              <View style={slideStyles.edgePill}>
                <Text style={slideStyles.edgePillText}>{card.edge}</Text>
              </View>
              <Text style={slideStyles.feedOdds}>{card.odds}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function SheetsPreview() {
  const rows = [
    { player: "Aaron Judge", score: 94, stat: "Power Surge", color: "#22C55E" },
    { player: "Nikola Jokic", score: 91, stat: "Triple-Dbl", color: "#38BDF8" },
    { player: "Connor McDavid", score: 88, stat: "Points O1.5", color: "#FBBF24" },
    { player: "Patrick Mahomes", score: 85, stat: "Pass Yds", color: "#A78BFA" },
  ];

  return (
    <View style={slideStyles.previewContainer}>
      <View style={slideStyles.previewCard}>
        <View style={slideStyles.previewHeader}>
          <Ionicons name="grid-outline" size={14} color={brandColors.textMuted} />
          <Text style={slideStyles.previewHeaderText}>Cheat Sheet</Text>
        </View>
        {rows.map((row) => (
          <View key={row.player} style={slideStyles.sheetRow}>
            <View style={slideStyles.sheetAvatar}>
              <Text style={slideStyles.sheetAvatarText}>
                {row.player.split(" ").map((p) => p[0]).join("")}
              </Text>
            </View>
            <View style={slideStyles.sheetInfo}>
              <Text style={slideStyles.sheetPlayer}>{row.player}</Text>
              <Text style={slideStyles.sheetStat}>{row.stat}</Text>
            </View>
            <View style={[slideStyles.scorePill, { backgroundColor: `${row.color}20` }]}>
              <Text style={[slideStyles.scoreText, { color: row.color }]}>{row.score}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function ToolsPreview() {
  const tools = [
    { icon: "swap-horizontal" as const, label: "Arbitrage", desc: "Guaranteed profit" },
    { icon: "trending-up" as const, label: "Line History", desc: "Track movement" },
    { icon: "people" as const, label: "Correlations", desc: "Player combos" },
    { icon: "analytics" as const, label: "Odds Screen", desc: "Best prices" },
  ];

  return (
    <View style={slideStyles.previewContainer}>
      <View style={slideStyles.toolsGrid}>
        {tools.map((tool) => (
          <View key={tool.label} style={slideStyles.toolCard}>
            <View style={slideStyles.toolIconWrap}>
              <Ionicons name={tool.icon} size={22} color="#38BDF8" />
            </View>
            <Text style={slideStyles.toolLabel}>{tool.label}</Text>
            <Text style={slideStyles.toolDesc}>{tool.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─── dot indicator ─── */

function DotIndicator({ count, activeIndex }: { count: number; activeIndex: number }) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            i === activeIndex ? dotStyles.dotActive : dotStyles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

/* ─── main component ─── */

export function OnboardingCarousel({
  ready,
  onGetStarted,
  onLogin,
}: {
  ready: boolean;
  onGetStarted: () => void;
  onLogin: () => void;
}) {
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isLastSlide = activeIndex === SLIDES.length - 1;

  // Animations that play when ready transitions to true
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoTranslateY = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;
  const bottomTranslateY = useRef(new Animated.Value(30)).current;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ready || revealed) return;
    setRevealed(true);

    Animated.sequence([
      // Step 1: Logo slides up slightly and scales down
      Animated.parallel([
        Animated.timing(logoTranslateY, {
          toValue: -40,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 0.9,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      // Step 2: Text and bottom bar fade in together
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(bottomOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(bottomTranslateY, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [ready, revealed, logoScale, logoTranslateY, textOpacity, textTranslateY, bottomOpacity, bottomTranslateY]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const goNext = useCallback(() => {
    if (isLastSlide) {
      onGetStarted();
    } else {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  }, [activeIndex, isLastSlide, onGetStarted]);

  const renderSlide = useCallback(({ item }: { item: Slide }) => {
    if (item.key === "welcome") {
      return (
        <View style={carouselStyles.slide}>
          <View style={slideStyles.welcomeWrap}>
            {/* Logo — always visible, animates position when ready */}
            <Animated.View
              style={{
                transform: [
                  { translateY: logoTranslateY },
                  { scale: logoScale },
                ],
              }}
            >
              <Image
                source={require("../../../assets/logo.png")}
                style={slideStyles.welcomeLogo}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Text — fades in after logo moves */}
            <Animated.View
              style={{
                opacity: textOpacity,
                transform: [{ translateY: textTranslateY }],
              }}
            >
              <Text style={slideStyles.welcomeTitle}>
                Sharper bets{"\n"}start here.
              </Text>
              <Text style={slideStyles.welcomeSubtitle}>
                Real-time edges, AI-powered scores, and{"\n"}cheat sheets across every sport.
              </Text>
            </Animated.View>
          </View>
        </View>
      );
    }

    return (
      <View style={carouselStyles.slide}>
        <View style={carouselStyles.slideTop}>
          {item.content()}
        </View>
        <View style={carouselStyles.slideBottom}>
          <Text style={carouselStyles.eyebrow}>{item.eyebrow}</Text>
          <Text style={carouselStyles.title}>{item.title}</Text>
          <Text style={carouselStyles.subtitle}>{item.subtitle}</Text>
        </View>
      </View>
    );
  }, [logoScale, logoTranslateY, textOpacity, textTranslateY]);

  return (
    <View style={carouselStyles.root}>
      <SafeAreaView style={carouselStyles.safe} edges={["top", "bottom"]}>
        {/* Skip button */}
        {revealed && activeIndex > 0 && !isLastSlide && (
          <Pressable style={carouselStyles.skipButton} onPress={onGetStarted}>
            <Text style={carouselStyles.skipText}>Skip</Text>
            <Ionicons name="chevron-forward" size={14} color={brandColors.textMuted} />
          </Pressable>
        )}

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          scrollEnabled={revealed}
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({
            length: SCREEN_W,
            offset: SCREEN_W * index,
            index,
          })}
          style={carouselStyles.flatList}
        />

        {/* Bottom area — fades in with the reveal */}
        <Animated.View
          style={[
            carouselStyles.bottomBar,
            {
              opacity: bottomOpacity,
              transform: [{ translateY: bottomTranslateY }],
            },
          ]}
          pointerEvents={revealed ? "auto" : "none"}
        >
          <DotIndicator count={SLIDES.length} activeIndex={activeIndex} />

          <Pressable
            onPress={goNext}
            style={({ pressed }) => [
              carouselStyles.ctaButton,
              pressed && carouselStyles.ctaButtonPressed,
            ]}
          >
            <Text style={carouselStyles.ctaText}>
              {isLastSlide ? "Let's Go" : "Continue"}
            </Text>
            {isLastSlide && (
              <Ionicons name="arrow-forward" size={18} color="#04111B" />
            )}
          </Pressable>

          {activeIndex === 0 ? (
            <Pressable onPress={onLogin} style={carouselStyles.loginRow}>
              <Text style={carouselStyles.loginPrefix}>Already have an account? </Text>
              <Text style={carouselStyles.loginAction}>Log In</Text>
            </Pressable>
          ) : (
            <View style={carouselStyles.loginPlaceholder} />
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

/* ─── carousel styles ─── */

const carouselStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0B1014",
  },
  safe: {
    flex: 1,
  },
  skipButton: {
    position: "absolute",
    top: 58,
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  skipText: {
    color: brandColors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_W,
    flex: 1,
    justifyContent: "center",
  },
  slideTop: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 28,
  },
  slideBottom: {
    paddingHorizontal: 28,
    paddingBottom: 12,
    gap: 10,
  },
  eyebrow: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: "rgba(229,231,235,0.68)",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  bottomBar: {
    paddingHorizontal: 28,
    paddingBottom: 12,
    gap: 16,
    alignItems: "center",
  },
  ctaButton: {
    width: "100%",
    minHeight: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#38BDF8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    color: "#04111B",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  loginPrefix: {
    color: "rgba(229,231,235,0.52)",
    fontSize: 14,
    fontWeight: "600",
  },
  loginAction: {
    color: "#7DD3FC",
    fontSize: 14,
    fontWeight: "800",
  },
  loginPlaceholder: {
    height: 22,
  },
});

/* ─── slide content styles ─── */

const slideStyles = StyleSheet.create({
  welcomeWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 32,
  },
  welcomeLogo: {
    width: 200,
    height: 62,
  },
  welcomeTitle: {
    color: "#F8FAFC",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.9,
    textAlign: "center",
  },
  welcomeSubtitle: {
    color: "rgba(229,231,235,0.64)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 12,
  },
  previewContainer: {
    paddingHorizontal: 28,
  },
  previewCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  previewHeaderText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  feedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  feedRowLeft: {
    flex: 1,
    gap: 3,
  },
  feedRowRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  feedPlayer: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "800",
  },
  feedMarket: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  edgePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(34,197,94,0.14)",
  },
  edgePillText: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "800",
  },
  feedOdds: {
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: "700",
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  sheetAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56,189,248,0.12)",
  },
  sheetAvatarText: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "800",
  },
  sheetInfo: {
    flex: 1,
    gap: 2,
  },
  sheetPlayer: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "800",
  },
  sheetStat: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  scorePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: "800",
  },
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 28,
    gap: 12,
  },
  toolCard: {
    width: (SCREEN_W - 56 - 12) / 2,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  toolIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(56,189,248,0.10)",
  },
  toolLabel: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "800",
  },
  toolDesc: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
});

/* ─── dot styles ─── */

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: "#38BDF8",
  },
  dotInactive: {
    width: 8,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
});
