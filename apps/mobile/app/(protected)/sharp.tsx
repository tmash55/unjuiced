import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { brandColors } from "@/src/theme/brand";
import { triggerSelectionHaptic } from "@/src/lib/haptics";
import { useUserPreferences } from "@/src/hooks/use-user-preferences";
import PageHeader from "@/src/components/PageHeader";
import SportsbookPicker from "@/src/components/SportsbookPicker";
import PositiveEvScreen from "@/src/components/positive-ev/PositiveEvScreen";
import ArbitrageContent from "@/src/components/sharp/ArbitrageContent";
import EdgeFinderContent from "@/src/components/sharp/EdgeFinderContent";
import PlanGate from "@/src/components/plan-gate/PlanGate";
import { PLAN_GATE_FEATURES } from "@/src/components/plan-gate/plan-gate-config";

type SharpTab = "ev" | "arb" | "edge";

const TABS: Array<{ key: SharpTab; label: string }> = [
  { key: "ev", label: "+EV" },
  { key: "arb", label: "Arbitrage" },
  { key: "edge", label: "Edge Finder" }
];

const TAB_ACCENT_COLORS: Record<SharpTab, string> = {
  ev: brandColors.success,
  arb: brandColors.primary,
  edge: brandColors.warning,
};

export default function SharpScreen() {
  const [activeTab, setActiveTab] = useState<SharpTab>("ev");
  const [pickerVisible, setPickerVisible] = useState(false);
  const { preferences, savePreferences } = useUserPreferences();

  const accentColor = TAB_ACCENT_COLORS[activeTab];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PageHeader
        title="Sharp"
        accentColor={accentColor}
        onSportsbooksPress={() => setPickerVisible(true)}
        selectedSportsbooks={preferences.preferredSportsbooks}
      />

      <View style={styles.topDeck}>
        <View style={styles.stickyHeader}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabScroll}
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              const color = TAB_ACCENT_COLORS[tab.key];
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    if (activeTab !== tab.key) triggerSelectionHaptic();
                    setActiveTab(tab.key);
                  }}
                  style={styles.tab}
                >
                  <Text
                    style={[
                      styles.tabText,
                      active && styles.tabTextActive,
                      active && { color },
                    ]}
                  >
                    {tab.label}
                  </Text>
                  <View
                    style={[
                      styles.tabUnderline,
                      active && [styles.tabUnderlineActive, { backgroundColor: color }],
                    ]}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === "ev" && (
          <PositiveEvScreen embedded />
        )}
        {activeTab === "arb" && (
          <PlanGate feature={PLAN_GATE_FEATURES.arbitrage}>
            <ArbitrageContent />
          </PlanGate>
        )}
        {activeTab === "edge" && (
          <PlanGate feature={PLAN_GATE_FEATURES.edgeFinder}>
            <EdgeFinderContent />
          </PlanGate>
        )}
      </View>

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
  topDeck: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 8,
  },
  stickyHeader: {
    marginTop: 0,
    borderBottomWidth: 1,
    borderBottomColor: brandColors.border,
  },
  tabScroll: {
    gap: 28,
    paddingRight: 20,
  },
  tab: {
    position: "relative",
    paddingTop: 2,
    paddingBottom: 14,
  },
  tabText: {
    color: brandColors.textSecondary,
    fontSize: 16,
    fontWeight: "500",
  },
  tabTextActive: {
    color: brandColors.textPrimary,
    fontWeight: "700",
  },
  tabUnderline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -1,
    height: 3,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  tabUnderlineActive: {
    shadowColor: "#38BDF8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  content: {
    flex: 1
  }
});
