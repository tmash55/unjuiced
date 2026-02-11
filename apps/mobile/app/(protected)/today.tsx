import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function TodayScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.body}>MVP placeholder. Next step: wire the production Today feed and filters.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1014"
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 8
  },
  title: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700"
  },
  body: {
    color: "#94A3B8",
    textAlign: "center"
  }
});
