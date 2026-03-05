import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { brandColors } from "@/src/theme/brand";
import PositiveEvContent from "@/src/components/sharp/PositiveEvContent";
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

export default function SharpScreen() {
  const [activeTab, setActiveTab] = useState<SharpTab>("ev");

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === "ev" && (
          <PlanGate feature={PLAN_GATE_FEATURES.positiveEv}>
            <PositiveEvContent />
          </PlanGate>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground
  },
  tabBarContainer: {
    borderBottomWidth: 1,
    borderBottomColor: brandColors.border,
    backgroundColor: brandColors.appBackground
  },
  tabBarScroll: {
    paddingHorizontal: 12,
    gap: 4,
    paddingVertical: 8
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent"
  },
  tabActive: {
    backgroundColor: brandColors.primarySoft,
    borderColor: brandColors.primary
  },
  tabText: {
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "600"
  },
  tabTextActive: {
    color: brandColors.primary,
    fontWeight: "700"
  },
  content: {
    flex: 1
  }
});
