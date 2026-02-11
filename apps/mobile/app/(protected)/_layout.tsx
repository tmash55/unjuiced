import { Redirect, Tabs, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, View } from "react-native";
import { useAuth } from "@/src/providers/auth-provider";

export default function ProtectedLayout() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#38BDF8" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: "#0B1014" },
        headerTintColor: "#E5E7EB",
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: "#0B1014" },
        tabBarStyle: {
          backgroundColor: "#0B1014",
          borderTopColor: "#1F2937",
          height: 72,
          paddingBottom: 8,
          paddingTop: 6
        },
        tabBarActiveTintColor: "#38BDF8",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600"
        },
        headerLeft: () => (
          <View style={styles.headerLeft}>
            <Pressable onPress={() => router.push("/help")} style={styles.circleButton}>
              <Ionicons name="help-circle-outline" size={18} color="#E5E7EB" />
            </Pressable>
            <Pressable onPress={() => router.push("/how-to")} style={styles.circleButton}>
              <Ionicons name="school-outline" size={16} color="#E5E7EB" />
            </Pressable>
          </View>
        ),
        headerRight: () => (
          <Pressable onPress={() => router.push("/account")} style={styles.circleButton}>
            <Ionicons name="person-outline" size={18} color="#E5E7EB" />
          </Pressable>
        )
      }}
    >
      <Tabs.Screen
        name="hit-rates"
        options={{
          title: "Hit Rates",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="positive-ev"
        options={{
          title: "+EV",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="edge-finder"
        options={{
          title: "Edge Finder",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons name="rocket-outline" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="arbitrage"
        options={{
          title: "Arbitrage",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MaterialCommunityIcons name="scale-balance" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="my-slips"
        options={{
          title: "My Slips",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="heart-outline" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen name="account" options={{ href: null, title: "Account" }} />
      <Tabs.Screen name="help" options={{ href: null, title: "Help" }} />
      <Tabs.Screen name="how-to" options={{ href: null, title: "How To" }} />
      <Tabs.Screen name="player/[id]" options={{ href: null, title: "Player" }} />
      <Tabs.Screen name="more" options={{ href: null, title: "More" }} />
      <Tabs.Screen name="today" options={{ href: null }} />
      <Tabs.Screen name="tools" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0B1014",
    alignItems: "center",
    justifyContent: "center"
  },
  headerLeft: {
    flexDirection: "row",
    gap: 8,
    marginLeft: 8
  },
  circleButton: {
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 999,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
  }
});
