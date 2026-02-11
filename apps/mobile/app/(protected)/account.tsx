import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/src/providers/auth-provider";

export default function AccountScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.body}>Settings and session controls for your account.</Text>

        <Pressable style={styles.card}>
          <Text style={styles.cardTitle}>Profile</Text>
          <Text style={styles.cardBody}>Edit name and notification preferences.</Text>
        </Pressable>

        <Pressable style={styles.card}>
          <Text style={styles.cardTitle}>Billing</Text>
          <Text style={styles.cardBody}>Manage plan and subscription status.</Text>
        </Pressable>

        <Pressable style={styles.card}>
          <Text style={styles.cardTitle}>Security</Text>
          <Text style={styles.cardBody}>Password and sign-in providers.</Text>
        </Pressable>

        <Pressable onPress={() => void signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Log out</Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/hit-rates")} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to tools</Text>
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
    gap: 10
  },
  title: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700"
  },
  body: {
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
    fontSize: 15,
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
    fontWeight: "700"
  },
  backButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  backButtonText: {
    color: "#7DD3FC",
    fontWeight: "600"
  }
});
