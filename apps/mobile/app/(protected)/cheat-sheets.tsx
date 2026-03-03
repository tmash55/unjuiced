import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { brandColors } from "@/src/theme/brand";
import HitRatesSheet from "@/src/components/cheat-sheets/HitRatesSheet";
import InjuryImpactSheet from "@/src/components/cheat-sheets/InjuryImpactSheet";
import DvpSheet from "@/src/components/cheat-sheets/DvpSheet";
import MatrixSheet from "@/src/components/cheat-sheets/MatrixSheet";
import TripleDoubleSheet from "@/src/components/cheat-sheets/TripleDoubleSheet";

type SheetTab = "hit-rates" | "injury" | "dvp" | "matrix" | "triple";

const TABS: Array<{ key: SheetTab; label: string }> = [
  { key: "hit-rates", label: "Hit Rates" },
  { key: "injury", label: "Injury" },
  { key: "dvp", label: "DVP" },
  { key: "matrix", label: "Matrix" },
  { key: "triple", label: "Triple Dbl" }
];

export default function CheatSheetsScreen() {
  const [activeSheet, setActiveSheet] = useState<SheetTab>("hit-rates");

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
            const active = activeSheet === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveSheet(tab.key)}
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
        {activeSheet === "hit-rates" && <HitRatesSheet />}
        {activeSheet === "injury" && <InjuryImpactSheet />}
        {activeSheet === "dvp" && <DvpSheet />}
        {activeSheet === "matrix" && <MatrixSheet />}
        {activeSheet === "triple" && <TripleDoubleSheet />}
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
