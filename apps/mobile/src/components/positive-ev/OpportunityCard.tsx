import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Image,
  LayoutAnimation,
  Linking,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PositiveEVOpportunity } from "@unjuiced/types";
import { triggerLightImpactHaptic, triggerSelectionHaptic } from "@/src/lib/haptics";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { getKellyStakeDisplay } from "@/src/lib/kelly";
import { brandColors } from "@/src/theme/brand";
import SharpOpportunityCardShell from "@/src/components/sharp/SharpOpportunityCardShell";
import { EV_TIER_COLORS, SPORT_COLORS } from "./constants";
import {
  formatGameInfo,
  formatOdds,
  getFairValueOdds,
  getEvTier,
  getMarketShort,
  getOpportunityTitle,
  sportLabel,
} from "./helpers";
import OverUnderComparison from "./OverUnderComparison";
import SingleSideGrid from "./SingleSideGrid";

const SWIPE_THRESHOLD = -80;
const SWIPE_SNAP = -90;
const SWIPE_DISMISS = -200;

type Props = {
  opp: PositiveEVOpportunity;
  rank: number;
  isFeatured: boolean;
  isExpanded: boolean;
  isHidden: boolean;
  onToggleExpand: () => void;
  onToggleHide: () => void;
  bankroll: number;
  kellyPercent: number;
};

export default function OpportunityCard({
  opp,
  rank,
  isFeatured,
  isExpanded,
  isHidden,
  onToggleExpand,
  onToggleHide,
  bankroll,
  kellyPercent,
}: Props) {
  const ev = opp.evCalculations?.evWorst ?? 0;
  const kelly = (opp.evCalculations?.kellyWorst ?? 0) * 100;
  const sport = (opp.sport ?? "").toLowerCase();
  const tier = getEvTier(ev);
  const accentColor = brandColors.success;
  const badgeColor = SPORT_COLORS[sport] ?? brandColors.textMuted;
  const bookLogo = getSportsbookLogoUrl(opp.book.bookId);
  const fairValue = getFairValueOdds(opp);
  const gameInfo = formatGameInfo(opp);
  const marketShort = getMarketShort(opp);
  const booksOnSide = opp.allBooks?.length ?? 1;
  const marketDepth = booksOnSide + (opp.oppositeBooks?.length ?? 0);

  const hasTwoSides =
    (opp.side === "over" || opp.side === "under") &&
    opp.oppositeBooks &&
    opp.oppositeBooks.length > 0;

  const sideLabel =
    opp.side === "over" ? "O" : opp.side === "under" ? "U" : opp.side === "yes" ? "Yes" : "No";
  const lineDisplay = opp.line != null && Number.isFinite(opp.line) ? ` ${opp.line}` : "";

  /* ─── Kelly stake ─── */
  const kellyInfo = useMemo(() => {
    if (!fairValue) return null;
    return getKellyStakeDisplay({
      bankroll,
      bestOdds: opp.book.price,
      fairOdds: fairValue,
      kellyPercent,
    });
  }, [bankroll, kellyPercent, opp.book.price, fairValue]);

  /* ─── Vig from devigResults ─── */
  const vig = useMemo(() => {
    const dr = opp.devigResults;
    const margin = dr?.power?.margin ?? dr?.multiplicative?.margin;
    if (typeof margin === "number" && Number.isFinite(margin)) {
      return (margin * 100).toFixed(1);
    }
    return null;
  }, [opp.devigResults]);

  const handleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    triggerSelectionHaptic();
    onToggleExpand();
  }, [onToggleExpand]);

  const handleBet = useCallback(() => {
    const url = opp.book.mobileLink || opp.book.link;
    if (url) {
      triggerLightImpactHaptic();
      void Linking.openURL(url);
    }
  }, [opp.book.mobileLink, opp.book.link]);

  const isGlowing = tier === "elite" || tier === "great";
  const isElite = tier === "elite";

  /* ─── Swipe-to-hide ─── */
  const translateX = useRef(new Animated.Value(0)).current;
  const swiped = useRef(false);
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.7,
    }).start();
  }, [entrance]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy * 1.5),
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_, gs) => {
        const clamped = Math.min(0, gs.dx);
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < SWIPE_DISMISS || gs.vx < -1.2) {
          swiped.current = false;
          Animated.timing(translateX, {
            toValue: -400,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateX.setValue(0);
            onToggleHide();
          });
        } else if (gs.dx < SWIPE_THRESHOLD || gs.vx < -0.5) {
          swiped.current = true;
          Animated.spring(translateX, {
            toValue: SWIPE_SNAP,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        } else {
          swiped.current = false;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    })
  ).current;

  const handleSwipeAction = useCallback(() => {
    triggerSelectionHaptic();
    Animated.timing(translateX, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      swiped.current = false;
      onToggleHide();
    });
  }, [translateX, onToggleHide]);

  /* ─── Stat row values ─── */
  const stakeDisplay = kellyInfo?.display ?? null;
  const kellyDisplay = kellyInfo ? kellyInfo.kellyPct.toFixed(1) : kelly.toFixed(1);
  const statItems = [
    { key: "ev", label: "EV", value: `${ev.toFixed(1)}%`, accent: true },
    { key: "kelly", label: "Kelly", value: `${kellyDisplay}%`, accent: false },
    { key: "stake", label: "Stake", value: stakeDisplay ?? "—", accent: false },
    { key: vig != null ? "vig" : "depth", label: vig != null ? "Vig" : "Depth", value: vig != null ? `${vig}%` : String(marketDepth), accent: false },
  ];

  return (
    <View style={s.swipeContainer}>
      {/* Action revealed behind card */}
      <Pressable onPress={handleSwipeAction} style={s.swipeAction}>
        <Ionicons
          name={isHidden ? "eye-outline" : "eye-off-outline"}
          size={20}
          color="#FFF"
        />
        <Text style={s.swipeActionText}>{isHidden ? "Show" : "Hide"}</Text>
      </Pressable>

      {/* Card */}
      <Animated.View
        style={[
          {
            opacity: entrance,
            transform: [
              { translateX },
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
              {
                scale: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.985, 1],
                }),
              },
            ],
          }
        ]}
        {...panResponder.panHandlers}
      >
        <SharpOpportunityCardShell
          accentColor={accentColor}
          metaContent={
            <Text style={s.metaText} numberOfLines={1}>
              <Text style={{ color: badgeColor, fontWeight: "800" }}>{sportLabel(sport)}</Text>
              {gameInfo ? `  ${gameInfo}` : ""}
            </Text>
          }
          badgeText={`+${ev.toFixed(1)}%`}
          title={getOpportunityTitle(opp)}
          selectionRow={
            <View style={s.selectionRow}>
              <View style={s.selectionCopy}>
                <View style={s.selectionMetaRow}>
                  <Text style={s.propText}>
                    {marketShort} {sideLabel}{lineDisplay}
                  </Text>
                  <Text style={s.oddsText}>{formatOdds(opp.book.price)}</Text>
                  {fairValue != null ? <Text style={s.fvText}>FV {formatOdds(fairValue)}</Text> : null}
                  {opp.book.limits?.max ? (
                    <View style={s.limitPill}>
                      <Text style={s.limitPillText}>max ${opp.book.limits.max.toLocaleString()}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <Pressable
                onPress={handleBet}
                style={[
                  s.betPill,
                  isElite
                    ? { backgroundColor: `${accentColor}16`, borderColor: `${accentColor}36` }
                    : { backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.10)" }
                ]}
              >
                {bookLogo ? <Image source={{ uri: bookLogo }} style={s.bookLogo} /> : null}
                <Text style={[s.betPillText, { color: isElite ? accentColor : brandColors.textPrimary }]}>
                  Bet
                </Text>
                <Ionicons name="arrow-forward" size={11} color={isElite ? accentColor : brandColors.textPrimary} />
              </Pressable>
            </View>
          }
          statItems={statItems}
          isExpanded={isExpanded}
          onToggleExpand={handleExpand}
          expandedContent={
            <>
              {opp.sharpReference ? (
                <View style={s.sharpSection}>
                <Text style={s.sharpLabel}>SHARP</Text>
                  <Text style={s.sharpText}>
                    {opp.sharpReference.preset ?? "Pinnacle"}  {formatOdds(opp.sharpReference.overOdds)} / {formatOdds(opp.sharpReference.underOdds)}
                  </Text>
                  <View style={s.sharpSpacer} />
                  {opp.evCalculations?.power ? (
                    <Text style={[s.methodTag, { color: accentColor }]}>P +{opp.evCalculations.power.evPercent.toFixed(1)}%</Text>
                  ) : null}
                  {opp.evCalculations?.multiplicative ? (
                    <Text style={[s.methodTag, { color: accentColor }]}>M +{opp.evCalculations.multiplicative.evPercent.toFixed(1)}%</Text>
                  ) : null}
                </View>
              ) : null}

              <Text style={s.booksSectionLabel}>BOOKS</Text>
              {hasTwoSides ? (
                <OverUnderComparison opp={opp} fairValue={fairValue} />
              ) : (
                <SingleSideGrid opp={opp} fairValue={fairValue} />
              )}

              <Pressable onPress={handleBet} style={[s.betButton, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}36` }]}>
                {bookLogo ? <Image source={{ uri: bookLogo }} style={s.betBookLogo} /> : null}
                <Text style={[s.betButtonText, { color: accentColor }]}>
                  Bet {formatOdds(opp.book.price)}
                </Text>
                <Ionicons name="arrow-forward" size={12} color={accentColor} />
              </Pressable>

              <Pressable style={s.oddsMovementRow} disabled>
                <Ionicons name="trending-up-outline" size={13} color={brandColors.textMuted} />
                <Text style={s.oddsMovementText}>Odds Movement</Text>
                <View style={s.soonBadge}>
                  <Text style={s.soonBadgeText}>SOON</Text>
                </View>
              </Pressable>
            </>
          }
          isHidden={isHidden}
          isGlowing={isGlowing}
          isElite={isElite}
          isFeatured={isFeatured}
        />
      </Animated.View>
    </View>
  );
}

/* ─── Style helpers ─── */

const s = StyleSheet.create({
  /* ── Swipe container ── */
  swipeContainer: {
    marginBottom: 6,
    overflow: "hidden",
    borderRadius: 16,
  },
  swipeAction: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 90,
    backgroundColor: brandColors.warning + "1F",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  swipeActionText: {
    color: brandColors.warning,
    fontSize: 11,
    fontWeight: "700",
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
  propText: {
    color: brandColors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
  },
  selectionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
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
  limitPill: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  limitPillText: {
    color: brandColors.textMuted,
    fontSize: 8,
    fontWeight: "700",
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
  },
  betPillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  /* ── Expanded ── */
  sharpSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(251,191,36,0.06)",
  },
  sharpLabel: {
    color: "#FBBF24",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  sharpText: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "600",
  },
  sharpSpacer: { flex: 1 },
  methodTag: {
    color: "rgba(34,197,94,0.6)",
    fontSize: 9,
    fontWeight: "700",
    marginLeft: 6,
  },
  booksSectionLabel: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 2,
  },
  betButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  betBookLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  betButtonText: {
    fontSize: 14,
    fontWeight: "800",
  },
  oddsMovementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    opacity: 0.4,
  },
  oddsMovementText: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  soonBadge: {
    backgroundColor: "rgba(251,191,36,0.12)",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  soonBadgeText: {
    color: "#FBBF24",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
