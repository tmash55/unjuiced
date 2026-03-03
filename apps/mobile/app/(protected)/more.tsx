import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/src/providers/auth-provider";
import { brandColors } from "@/src/theme/brand";

type MenuItemProps = {
  label: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
};

function MenuItem({ label, description, icon, onPress }: MenuItemProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardIcon}>{icon}</View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.cardBody}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={brandColors.navInactive} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Tools, account, and extras.</Text>

        <MenuItem
          label="Cheat Sheets"
          description="Hit rates, injury impact, DVP, and more."
          icon={<Ionicons name="newspaper-outline" size={22} color={brandColors.primary} />}
          onPress={() => router.push("/cheat-sheets")}
        />
        <MenuItem
          label="Arbitrage"
          description="Find guaranteed profit opportunities."
          icon={<MaterialCommunityIcons name="scale-balance" size={22} color={brandColors.primary} />}
          onPress={() => router.push("/arbitrage")}
        />
        <MenuItem
          label="My Slips"
          description="Review saved plays and active slips."
          icon={<Ionicons name="heart" size={22} color={brandColors.primary} />}
          onPress={() => router.push("/my-slips")}
        />
        <MenuItem
          label="Account"
          description="Manage profile, auth, and plan details."
          icon={<Ionicons name="person" size={22} color={brandColors.primary} />}
          onPress={() => router.push("/account")}
        />
        <MenuItem
          label="Help"
          description="FAQs and support resources."
          icon={<Ionicons name="help-circle" size={22} color={brandColors.primary} />}
          onPress={() => router.push("/help")}
        />
        <MenuItem
          label="How To"
          description="Guides and tutorials to get started."
          icon={<Ionicons name="school" size={22} color={brandColors.primary} />}
          onPress={() => router.push("/how-to")}
        />

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
  subtitle: {
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
