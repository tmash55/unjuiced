import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/src/providers/auth-provider";

export default function MoreScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Account controls and extra tools.</Text>

        <Pressable onPress={() => router.push("/account")} style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <Text style={styles.cardBody}>Manage profile, auth, and plan details.</Text>
        </Pressable>

        <Pressable onPress={() => router.push("/my-slips")} style={styles.card}>
          <Text style={styles.cardTitle}>My Slips</Text>
          <Text style={styles.cardBody}>Review saved plays and active slips.</Text>
        </Pressable>

        <Pressable onPress={() => void signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
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
    padding: 16,
    gap: 12
  },
  title: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700"
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 13
  },
  card: {
    borderColor: "#1F2937",
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: "#111827",
    padding: 12,
    gap: 4
  },
  cardTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700"
  },
  cardBody: {
    color: "#94A3B8",
    fontSize: 13
  },
  signOutButton: {
    marginTop: 8,
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  signOutText: {
    color: "#E5E7EB",
    fontWeight: "600"
  }
});
