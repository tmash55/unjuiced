import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { ALL_SPORTSBOOKS } from "@/src/lib/sportsbooks";
import { triggerLightImpactHaptic, triggerSelectionHaptic } from "@/src/lib/haptics";
import { brandColors } from "@/src/theme/brand";

const MAX_LOGOS = 3;

type Props = {
  title?: string;
  titleContent?: ReactNode;
  children?: ReactNode;
  autoRefresh?: { enabled: boolean; onToggle: () => void };
  onRefresh?: () => void;
  isRefetching?: boolean;
  accentColor?: string;
  onSportsbooksPress?: () => void;
  selectedSportsbooks?: string[];
  showAccount?: boolean;
};

export default function PageHeader({
  title,
  titleContent,
  children,
  autoRefresh,
  onRefresh,
  isRefetching,
  onSportsbooksPress,
  selectedSportsbooks,
  showAccount,
}: Props) {
  const router = useRouter();

  const logoIds =
    selectedSportsbooks && selectedSportsbooks.length > 0
      ? selectedSportsbooks.slice(0, MAX_LOGOS)
      : ALL_SPORTSBOOKS.slice(0, MAX_LOGOS).map((b) => b.id);

  const shouldShowAccount = showAccount ?? Boolean(onSportsbooksPress);

  return (
    <View style={s.row}>
      {titleContent ? (
        <View style={s.titleContentWrap}>{titleContent}</View>
      ) : title ? (
        <Text style={s.title}>{title}</Text>
      ) : null}

      <View style={s.actions}>
        {children}
        {onSportsbooksPress ? (
          <Pressable
            onPress={() => {
              triggerLightImpactHaptic();
              onSportsbooksPress();
            }}
            style={s.booksPill}
          >
            <View style={s.logoStack}>
              {logoIds.map((id, i) => {
                const uri = getSportsbookLogoUrl(id);
                if (!uri) return null;
                return (
                  <Image
                    key={id}
                    source={{ uri }}
                    style={[s.logoThumb, i > 0 && { marginLeft: -6 }]}
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
          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              onRefresh();
            }}
            disabled={isRefetching}
            style={s.refreshBtn}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={isRefetching ? brandColors.textMuted : brandColors.textSecondary}
            />
          </Pressable>
        ) : null}
        {shouldShowAccount ? (
          <Pressable
            onPress={() => {
              triggerSelectionHaptic();
              router.push("/account");
            }}
            style={s.accountBtn}
          >
            <Ionicons name="person" size={16} color={brandColors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
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
    borderColor: brandColors.appBackground,
    backgroundColor: brandColors.panelBackgroundAlt,
  },
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
