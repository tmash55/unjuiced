import { Redirect, Tabs } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/src/providers/auth-provider";
import { brandColors } from "@/src/theme/brand";

function TabIcon({
  name,
  library,
  focused
}: {
  name: string;
  library: "ionicons" | "mci";
  focused: boolean;
}) {
  const color = focused ? brandColors.primary : brandColors.navInactive;
  const icon =
    library === "mci" ? (
      <MaterialCommunityIcons name={name as any} size={24} color={color} />
    ) : (
      <Ionicons name={name as any} size={24} color={color} />
    );

  if (focused) {
    return <View style={styles.activePill}>{icon}</View>;
  }
  return icon;
}

export default function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={brandColors.primary} />
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
        headerStyle: { backgroundColor: brandColors.appBackground },
        headerTintColor: brandColors.textPrimary,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: brandColors.appBackground },
        tabBarStyle: {
          backgroundColor: brandColors.navBackground,
          borderTopColor: brandColors.navBorder,
          borderTopWidth: 0.5,
          height: 80,
          paddingBottom: 12,
          paddingTop: 8
        },
        tabBarActiveTintColor: brandColors.primary,
        tabBarInactiveTintColor: brandColors.navInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600"
        }
      }}
    >
      <Tabs.Screen
        name="hit-rates"
        options={{
          title: "Hit Rates",
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon
              name={focused ? "stats-chart" : "stats-chart-outline"}
              library="ionicons"
              focused={focused}
            />
          ),
          tabBarLabel: ({ focused, color }: { focused: boolean; color: string }) =>
            focused ? <Text style={[styles.tabLabel, { color }]}>Hit Rates</Text> : null
        }}
      />
      <Tabs.Screen
        name="positive-ev"
        options={{
          title: "+EV",
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon
              name={focused ? "add-circle" : "add-circle-outline"}
              library="ionicons"
              focused={focused}
            />
          ),
          tabBarLabel: ({ focused, color }: { focused: boolean; color: string }) =>
            focused ? <Text style={[styles.tabLabel, { color }]}>+EV</Text> : null
        }}
      />
      <Tabs.Screen
        name="edge-finder"
        options={{
          title: "Edge Finder",
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon
              name={focused ? "rocket" : "rocket-outline"}
              library="mci"
              focused={focused}
            />
          ),
          tabBarLabel: ({ focused, color }: { focused: boolean; color: string }) =>
            focused ? <Text style={[styles.tabLabel, { color }]}>Edge Finder</Text> : null
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon
              name={focused ? "ellipsis-horizontal-circle" : "ellipsis-horizontal-circle-outline"}
              library="ionicons"
              focused={focused}
            />
          ),
          tabBarLabel: ({ focused, color }: { focused: boolean; color: string }) =>
            focused ? <Text style={[styles.tabLabel, { color }]}>More</Text> : null
        }}
      />
      <Tabs.Screen name="arbitrage" options={{ href: null, title: "Arbitrage" }} />
      <Tabs.Screen name="my-slips" options={{ href: null, title: "My Slips" }} />
      <Tabs.Screen name="account" options={{ href: null, title: "Account" }} />
      <Tabs.Screen name="help" options={{ href: null, title: "Help" }} />
      <Tabs.Screen name="how-to" options={{ href: null, title: "How To" }} />
      <Tabs.Screen name="player/[id]" options={{ href: null, title: "Player", headerShown: false }} />
      <Tabs.Screen name="cheat-sheets" options={{ href: null, title: "Cheat Sheets" }} />
      <Tabs.Screen name="today" options={{ href: null }} />
      <Tabs.Screen name="tools" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: brandColors.appBackground,
    alignItems: "center",
    justifyContent: "center"
  },
  activePill: {
    backgroundColor: brandColors.navActivePill,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600"
  }
});
