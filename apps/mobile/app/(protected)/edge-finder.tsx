import { SafeAreaView, StyleSheet } from "react-native";
import { brandColors } from "@/src/theme/brand";
import EdgeFinderContent from "@/src/components/sharp/EdgeFinderContent";

export default function EdgeFinderScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <EdgeFinderContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground
  }
});
