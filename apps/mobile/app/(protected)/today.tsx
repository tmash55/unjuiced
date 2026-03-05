import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { brandColors } from "@/src/theme/brand";

export default function TodayScreen() {
  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <View style={s.iconWrap}>
          <Ionicons name="basketball-outline" size={48} color={brandColors.primary} />
        </View>
        <Text style={s.title}>No games scheduled!</Text>
        <Text style={s.subtitle}>
          Check back later for today's games, live scores, and matchups.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: brandColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    color: brandColors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: brandColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
