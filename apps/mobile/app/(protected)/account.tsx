import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/providers/auth-provider";
import { brandColors } from "@/src/theme/brand";

export default function AccountScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.body}>Settings and session controls for your account.</Text>

        <Pressable style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="person-outline" size={20} color={brandColors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Profile</Text>
            <Text style={styles.cardBody}>Edit name and notification preferences.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={brandColors.navInactive} />
        </Pressable>

        <Pressable style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="card-outline" size={20} color={brandColors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Billing</Text>
            <Text style={styles.cardBody}>Manage plan and subscription status.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={brandColors.navInactive} />
        </Pressable>

        <Pressable style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="lock-closed-outline" size={20} color={brandColors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Security</Text>
            <Text style={styles.cardBody}>Password and sign-in providers.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={brandColors.navInactive} />
        </Pressable>

        <Pressable onPress={() => router.push("/help")} style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="help-circle-outline" size={20} color={brandColors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Help</Text>
            <Text style={styles.cardBody}>FAQs and support resources.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={brandColors.navInactive} />
        </Pressable>

        <Pressable onPress={() => router.push("/how-to")} style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="school-outline" size={20} color={brandColors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>How To</Text>
            <Text style={styles.cardBody}>Guides and tutorials to get started.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={brandColors.navInactive} />
        </Pressable>

        <Pressable onPress={() => void signOut()} style={styles.signOutButton}>
          <Ionicons name="log-out-outline" size={18} color={brandColors.error} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground
  },
  content: {
    padding: 16,
    gap: 10
  },
  title: {
    color: brandColors.textPrimary,
    fontSize: 24,
    fontWeight: "700"
  },
  body: {
    color: brandColors.textSecondary,
    fontSize: 13,
    marginBottom: 4
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: brandColors.border,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: brandColors.panelBackground,
    padding: 14,
    gap: 12
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: brandColors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  cardText: {
    flex: 1,
    gap: 2
  },
  cardTitle: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "600"
  },
  cardBody: {
    color: brandColors.textSecondary,
    fontSize: 12
  },
  signOutButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderColor: "rgba(248, 113, 113, 0.2)",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12
  },
  signOutText: {
    color: brandColors.error,
    fontWeight: "600",
    fontSize: 14
  }
});
