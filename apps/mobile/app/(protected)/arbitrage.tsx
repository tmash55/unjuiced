import { SafeAreaView, StyleSheet } from "react-native";
import { brandColors } from "@/src/theme/brand";
import ArbitrageContent from "@/src/components/sharp/ArbitrageContent";

export default function ArbitrageScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ArbitrageContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground
  }
});
