import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { brandColors } from "@/src/theme/brand";
import type { TabId } from "./constants";
import { TAB_LABELS } from "./constants";

const TABS: TabId[] = ["chart", "shooting", "playtypes", "matchup", "correlation", "stats", "odds"];

interface ProfileTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function ProfileTabBar({ activeTab, onTabChange }: ProfileTabBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.bar}
    >
      {TABS.map((tab) => {
        const active = tab === activeTab;
        return (
          <Pressable
            key={tab}
            onPress={() => onTabChange(tab)}
            style={[s.tab, active && s.tabActive]}
          >
            <Text style={[s.tabText, active && s.tabTextActive]}>
              {TAB_LABELS[tab]}
            </Text>
            {active ? <View style={s.underline} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingBottom: 6,
    gap: 4,
    zIndex: 2
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    position: "relative"
  },
  tabActive: {},
  tabText: {
    color: brandColors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  underline: {
    position: "absolute",
    bottom: 0,
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#22C55E"
  }
});
