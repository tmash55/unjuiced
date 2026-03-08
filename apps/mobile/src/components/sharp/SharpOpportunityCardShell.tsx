import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { brandColors } from "@/src/theme/brand";

export type SharpOpportunityStatItem = {
  key: string;
  label: string;
  value: string;
  accent?: boolean;
};

type Props = {
  accentColor: string;
  metaContent: ReactNode;
  badgeText: string;
  title: string;
  selectionRow: ReactNode;
  statItems: SharpOpportunityStatItem[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  expandedContent?: ReactNode;
  isHidden?: boolean;
  isGlowing?: boolean;
  isElite?: boolean;
  isFeatured?: boolean;
  pressedOpacity?: number;
};

export default function SharpOpportunityCardShell({
  accentColor,
  metaContent,
  badgeText,
  title,
  selectionRow,
  statItems,
  isExpanded,
  onToggleExpand,
  expandedContent,
  isHidden = false,
  isGlowing = false,
  isElite = false,
  isFeatured = false,
  pressedOpacity = 0.88,
}: Props) {
  return (
    <View
      style={[
        s.card,
        isHidden && s.cardHidden,
        isGlowing && glowStyle(accentColor),
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={
          isFeatured
            ? [`${accentColor}1F`, "rgba(9, 18, 31, 0.10)", "rgba(9, 18, 31, 0)"]
            : [`${accentColor}12`, "rgba(9, 18, 31, 0.08)", "rgba(9, 18, 31, 0)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.cardGradient}
      />
      <View style={[s.accentBar, { backgroundColor: accentColor }]} />
      {isElite ? <View style={s.eliteWash} /> : null}

      <Pressable onPress={onToggleExpand} style={({ pressed }) => [s.cardBody, pressed && { opacity: pressedOpacity }]}>
        <View style={s.metaRow}>
          <View style={s.metaWrap}>{metaContent}</View>
          <View style={[s.evBadge, { backgroundColor: `${accentColor}14`, borderColor: `${accentColor}24` }]}>
            <Text style={[s.evBadgeText, { color: accentColor }]}>{badgeText}</Text>
          </View>
        </View>

        <Text style={s.playerName} numberOfLines={1}>
          {title}
        </Text>

        {selectionRow}

        <View style={s.statsRow}>
          {statItems.map((item, index) => (
            <View key={item.key} style={s.statSlot}>
              {index > 0 ? <View style={s.statDivider} /> : null}
              <View style={s.statCell}>
                <Text style={[s.statValue, item.accent && { color: accentColor }]}>{item.value}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.oddsToggleRow}>
          <View style={[s.oddsToggle, isExpanded && s.oddsToggleActive]}>
            <Text style={[s.oddsToggleText, isExpanded && s.oddsToggleTextActive]}>
              {isExpanded ? "Hide board" : "Open board"}
            </Text>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={10}
              color={isExpanded ? brandColors.primary : brandColors.textMuted}
            />
          </View>
        </View>
      </Pressable>

      {isExpanded && expandedContent ? (
        <View style={s.expanded}>{expandedContent}</View>
      ) : null}
    </View>
  );
}

function glowStyle(color: string) {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
    },
    android: {
      elevation: 5,
    },
  }) as any;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: brandColors.panelBackground,
    borderColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 4,
  },
  cardHidden: { opacity: 0.35 },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  accentBar: { height: 2 },
  eliteWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(34,197,94,0.03)",
    zIndex: 0,
  },
  cardBody: {
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 7,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  metaWrap: {
    flex: 1,
  },
  evBadge: {
    alignItems: "flex-end",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    minWidth: 66,
  },
  evBadgeText: {
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: -0.5,
  },
  playerName: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 6,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  statSlot: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 6,
  },
  statValue: {
    color: brandColors.textPrimary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  statLabel: {
    color: brandColors.textMuted,
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginTop: 0,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  oddsToggleRow: {
    alignItems: "center",
    paddingTop: 4,
  },
  oddsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  oddsToggleActive: {
    backgroundColor: brandColors.primarySoft,
  },
  oddsToggleText: {
    color: brandColors.textMuted,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  oddsToggleTextActive: {
    color: brandColors.primary,
  },
  expanded: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
});
