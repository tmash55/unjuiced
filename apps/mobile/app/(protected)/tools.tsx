import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { hasPlanAccess, normalizePlanName, type UserPlan } from "@unjuiced/types";
import { useEntitlements } from "@/src/hooks/use-entitlements";
import { useAuth } from "@/src/providers/auth-provider";

type ToolCard = {
  id: string;
  title: string;
  route: "/today" | "/positive-ev" | "/arbitrage";
  minimumPlan: UserPlan;
  description: string;
};

const TOOL_CARDS: ToolCard[] = [
  {
    id: "today",
    title: "Today",
    route: "/today",
    minimumPlan: "free",
    description: "Quick daily view of your active opportunities."
  },
  {
    id: "positive-ev",
    title: "Positive EV",
    route: "/positive-ev",
    minimumPlan: "sharp",
    description: "High-value opportunities gated for Sharp and Elite plans."
  },
  {
    id: "arbitrage",
    title: "Arbitrage",
    route: "/arbitrage",
    minimumPlan: "sharp",
    description: "Arbitrage workflow with plan-aware controls."
  }
];

export default function ToolsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { data: entitlements, isLoading, isError, error, refetch } = useEntitlements();

  const plan = normalizePlanName(String(entitlements?.plan || "free"));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Tools</Text>
            <Text style={styles.headerSubtitle}>Plan: {plan.toUpperCase()}</Text>
          </View>
          <Pressable onPress={() => void signOut()} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>

        <Text style={styles.helperText}>
          Entitlement source: {entitlements?.entitlement_source || "none"}
        </Text>
        {isError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Entitlements failed to load</Text>
            <Text style={styles.errorBody}>
              {error instanceof Error ? error.message : "Unknown error"}
            </Text>
            <Pressable onPress={() => void refetch()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {TOOL_CARDS.map((tool) => {
          const unlocked = hasPlanAccess(plan, tool.minimumPlan);

          return (
            <Pressable
              key={tool.id}
              disabled={!unlocked || isLoading}
              onPress={() => router.push(tool.route)}
              style={({ pressed }: { pressed: boolean }) => [
                styles.card,
                !unlocked && styles.cardLocked,
                pressed && unlocked && styles.cardPressed
              ]}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{tool.title}</Text>
                <Text style={[styles.badge, unlocked ? styles.badgeOpen : styles.badgeLocked]}>
                  {unlocked ? "OPEN" : `Requires ${tool.minimumPlan.toUpperCase()}`}
                </Text>
              </View>
              <Text style={styles.cardDescription}>{tool.description}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  headerTitle: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700"
  },
  headerSubtitle: {
    color: "#93C5FD",
    fontSize: 12,
    marginTop: 2
  },
  helperText: {
    color: "#9CA3AF",
    fontSize: 12
  },
  signOutButton: {
    borderColor: "#334155",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  signOutText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "600"
  },
  card: {
    borderColor: "#1F2937",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#111827",
    gap: 6
  },
  cardLocked: {
    opacity: 0.55
  },
  cardPressed: {
    opacity: 0.8
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  cardTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700"
  },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden"
  },
  badgeOpen: {
    color: "#86EFAC",
    backgroundColor: "rgba(22, 163, 74, 0.25)"
  },
  badgeLocked: {
    color: "#FCD34D",
    backgroundColor: "rgba(217, 119, 6, 0.25)"
  },
  cardDescription: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18
  },
  errorCard: {
    borderColor: "rgba(248, 113, 113, 0.35)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "rgba(127, 29, 29, 0.2)",
    gap: 6
  },
  errorTitle: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "700"
  },
  errorBody: {
    color: "#FECACA",
    fontSize: 11
  },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DC2626",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  retryText: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "700"
  }
});
