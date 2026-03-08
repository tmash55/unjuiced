import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Dimensions, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { ALL_SPORTSBOOKS } from "@/src/lib/sportsbooks";
import { triggerLightImpactHaptic, triggerSelectionHaptic } from "@/src/lib/haptics";
import { brandColors } from "@/src/theme/brand";

const SCREEN_W = Dimensions.get("window").width;
const GRADIENT_H = 120;
const MAX_LOGOS = 3;

type Props = {
  title?: string;
  /** Custom content rendered in place of the title */
  titleContent?: ReactNode;
  /** Optional right-side actions rendered after built-in buttons */
  children?: ReactNode;
  /** Show auto-refresh toggle */
  autoRefresh?: { enabled: boolean; onToggle: () => void };
  /** Show manual refresh button */
  onRefresh?: () => void;
  isRefetching?: boolean;
  /** Gradient accent color — defaults to brandColors.primary */
  accentColor?: string;
  /** Sportsbooks filter button */
  onSportsbooksPress?: () => void;
  /** Selected sportsbook IDs (empty = all) */
  selectedSportsbooks?: string[];
  /** Show account button — defaults to true when onSportsbooksPress is set */
  showAccount?: boolean;
};

export default function PageHeader({
  title,
  titleContent,
  children,
  autoRefresh,
  onRefresh,
  isRefetching,
  accentColor = brandColors.primary,
  onSportsbooksPress,
  selectedSportsbooks,
  showAccount,
}: Props) {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Determine which logos to show in the pill
  const logoIds =
    selectedSportsbooks && selectedSportsbooks.length > 0
      ? selectedSportsbooks.slice(0, MAX_LOGOS)
      : ALL_SPORTSBOOKS.slice(0, MAX_LOGOS).map((b) => b.id);

  const shouldShowAccount = showAccount ?? Boolean(onSportsbooksPress);

  function handleSportsbooksPress() {
    triggerLightImpactHaptic();
    onSportsbooksPress?.();
  }

  function handleRefreshPress() {
    triggerSelectionHaptic();
    onRefresh?.();
  }

  function handleAccountPress() {
    triggerSelectionHaptic();
    router.push("/account");
  }

  return (
    <View style={s.wrapper}>
      {/* ── Radial gradient background ── */}
      <Animated.View style={[s.gradientWrap, { opacity: pulseAnim }]} pointerEvents="none">
        <Svg width={SCREEN_W} height={GRADIENT_H + 60} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient
              id="headerGlow"
              cx="50%"
              cy="0%"
              rx="70%"
              ry="100%"
            >
              <Stop offset="0%" stopColor={accentColor} stopOpacity="0.12" />
              <Stop offset="60%" stopColor={accentColor} stopOpacity="0.04" />
              <Stop offset="100%" stopColor={accentColor} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={SCREEN_W} height={GRADIENT_H + 60} fill="url(#headerGlow)" />
        </Svg>
      </Animated.View>

      {/* ── Title row ── */}
      <View style={s.row}>
        {titleContent ? (
          <View style={s.titleContentWrap}>{titleContent}</View>
        ) : title ? (
          <Text style={s.title}>{title}</Text>
        ) : null}
        <View style={s.actions}>
          {children}
          {onSportsbooksPress ? (
            <Pressable onPress={handleSportsbooksPress} style={s.booksPill}>
              <View style={s.logoStack}>
                {logoIds.map((id, i) => {
                  const uri = getSportsbookLogoUrl(id);
                  if (!uri) return null;
                  return (
                    <Image
                      key={id}
                      source={{ uri }}
                      style={[
                        s.logoThumb,
                        i > 0 && { marginLeft: -6 },
                      ]}
                    />
                  );
                })}
              </View>
              <Ionicons name="chevron-down" size={14} color={brandColors.textMuted} />
            </Pressable>
          ) : null}
          {autoRefresh ? (
            <Pressable
              onPress={() => {
                triggerSelectionHaptic();
                autoRefresh.onToggle();
              }}
              style={[s.actionBtn, autoRefresh.enabled && s.actionBtnActive]}
            >
              <Ionicons
                name="refresh"
                size={14}
                color={autoRefresh.enabled ? brandColors.primary : brandColors.textMuted}
              />
              <Text style={[s.actionBtnText, autoRefresh.enabled && s.actionBtnTextActive]}>
                Auto
              </Text>
            </Pressable>
          ) : null}
          {onRefresh ? (
            <Pressable onPress={handleRefreshPress} disabled={isRefetching} style={s.refreshBtn}>
              <Ionicons
                name="refresh-outline"
                size={18}
                color={isRefetching ? brandColors.textMuted : brandColors.textSecondary}
              />
            </Pressable>
          ) : null}
          {shouldShowAccount ? (
            <Pressable onPress={handleAccountPress} style={s.accountBtn}>
              <Ionicons name="person" size={16} color={brandColors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  gradientWrap: {
    position: "absolute",
    top: -60,
    left: 0,
    right: 0,
    height: GRADIENT_H + 60,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  title: {
    color: brandColors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  titleContentWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  /* ── Action buttons (auto-refresh, refresh) ── */
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brandColors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionBtnActive: {
    borderColor: brandColors.primary,
    backgroundColor: brandColors.primarySoft,
  },
  actionBtnText: {
    color: brandColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  actionBtnTextActive: {
    color: brandColors.primary,
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: brandColors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Sportsbook logo pill ── */
  booksPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
  },
  logoStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: brandColors.panelBackground,
    backgroundColor: brandColors.panelBackgroundAlt,
  },

  /* ── Account avatar button ── */
  accountBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
});
