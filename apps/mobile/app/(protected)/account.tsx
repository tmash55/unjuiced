import { useMemo } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { normalizePlanName } from "@unjuiced/types";
import { useAuth } from "@/src/providers/auth-provider";
import { useEntitlements } from "@/src/hooks/use-entitlements";
import { useUserPreferences } from "@/src/hooks/use-user-preferences";
import { triggerSelectionHaptic, triggerWarningHaptic } from "@/src/lib/haptics";
import { brandColors } from "@/src/theme/brand";

function getInitials(email: string | undefined | null) {
  if (!email) return "U";
  const [name] = email.split("@");
  if (!name) return "U";
  return name.slice(0, 2).toUpperCase();
}

function getPlanColor(plan: string) {
  switch (plan) {
    case "elite":
      return brandColors.warning;
    case "sharp":
      return brandColors.success;
    case "scout":
      return brandColors.primary;
    default:
      return brandColors.textMuted;
  }
}

function Row({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={brandColors.textSecondary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons
        name={onPress ? "chevron-forward" : "remove-outline"}
        size={16}
        color={brandColors.textMuted}
      />
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { data: entitlements } = useEntitlements();
  const { preferences } = useUserPreferences();

  const plan = normalizePlanName(String(entitlements?.plan || "free"));
  const planColor = getPlanColor(plan);
  const initials = getInitials(user?.email);

  const summary = useMemo(
    () => [
      { label: "Plan", value: plan.toUpperCase() },
      { label: "Books", value: String(preferences.preferredSportsbooks.length || 0) },
      {
        label: "Sports",
        value: String((preferences.bestOddsSelectedSports ?? preferences.positiveEvSelectedSports).length),
      },
    ],
    [plan, preferences.bestOddsSelectedSports, preferences.positiveEvSelectedSports, preferences.preferredSportsbooks.length]
  );

  async function handleSignOut() {
    triggerWarningHaptic();
    await signOut();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.profileCopy}>
              <View style={[styles.planPill, { borderColor: `${planColor}30`, backgroundColor: `${planColor}14` }]}>
                <Text style={[styles.planPillText, { color: planColor }]}>{plan.toUpperCase()}</Text>
              </View>
              <Text style={styles.email} numberOfLines={1}>
                {user?.email ?? "Signed in"}
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            {summary.map((item) => (
              <View key={item.label} style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={styles.summaryValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Support</Text>
          <View style={styles.group}>
            <Row
              icon="help-circle-outline"
              title="Help"
              subtitle="Support articles and FAQs"
              onPress={() => {
                triggerSelectionHaptic();
                router.push("/help");
              }}
            />
            <Row
              icon="school-outline"
              title="How To"
              subtitle="Guides for using the app"
              onPress={() => {
                triggerSelectionHaptic();
                router.push("/how-to");
              }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Settings</Text>
          <View style={styles.group}>
            <Row
              icon="sparkles-outline"
              title="Plan and Billing"
              subtitle="More account controls coming soon"
            />
            <Row
              icon="notifications-outline"
              title="Notifications"
              subtitle="Alert preferences coming soon"
            />
            <Row
              icon="shield-checkmark-outline"
              title="Security"
              subtitle="Password and auth controls coming soon"
            />
          </View>
        </View>

        <Pressable onPress={() => void handleSignOut()} style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
          <Ionicons name="log-out-outline" size={18} color={brandColors.error} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.appBackground,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 16,
  },
  header: {
    paddingTop: 4,
  },
  title: {
    color: brandColors.textPrimary,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    padding: 16,
    gap: 16,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelBackgroundAlt,
    borderWidth: 1,
    borderColor: brandColors.border,
  },
  avatarText: {
    color: brandColors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  profileCopy: {
    flex: 1,
    gap: 6,
  },
  planPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  planPillText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  email: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: brandColors.panelBackgroundAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryLabel: {
    color: brandColors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  summaryValue: {
    marginTop: 5,
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    paddingHorizontal: 2,
  },
  group: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brandColors.border,
    backgroundColor: brandColors.panelBackground,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelBackgroundAlt,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: brandColors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  rowSubtitle: {
    color: brandColors.textSecondary,
    fontSize: 12,
  },
  signOutButton: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.22)",
    backgroundColor: "rgba(127, 29, 29, 0.10)",
    paddingVertical: 14,
  },
  signOutText: {
    color: brandColors.error,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.88,
  },
});
