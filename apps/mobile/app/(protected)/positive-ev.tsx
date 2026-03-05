import { SafeAreaView, StyleSheet } from "react-native";
import { brandColors } from "@/src/theme/brand";
import PositiveEvContent from "@/src/components/sharp/PositiveEvContent";

export default function PositiveEvScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <PositiveEvContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground
  }
});
