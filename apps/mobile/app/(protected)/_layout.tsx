import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/providers/auth-provider";
import { triggerSelectionHaptic } from "@/src/lib/haptics";
import { brandColors } from "@/src/theme/brand";

function TabIcon({
  name,
  focused
}: {
  name: string;
  focused: boolean;
}) {
  return (
    <Ionicons
      name={name as any}
      size={24}
      color={focused ? brandColors.primary : brandColors.navInactive}
    />
  );
}

function CustomTabButton(props: any) {
  const { children, onPress, onLongPress, accessibilityState, style } = props;
  const focused = accessibilityState?.selected;

  function handlePress() {
    if (!focused) triggerSelectionHaptic();
    onPress?.();
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      style={[
        style,
        styles.tabButton,
        focused && styles.tabButtonActive,
      ]}
    >
      {children}
    </Pressable>
  );
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
          borderTopColor: "rgba(56, 189, 248, 0.06)",
          borderTopWidth: 0.5,
          height: 82,
          paddingBottom: 14,
          paddingTop: 6,
          elevation: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: brandColors.primary,
        tabBarInactiveTintColor: brandColors.navInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarButton: CustomTabButton,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          headerShown: false,
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name={focused ? "calendar" : "calendar-outline"} focused={focused} />
          )
        }}
      />
      <Tabs.Screen
        name="props"
        options={{
          title: "Research",
          headerShown: false,
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name={focused ? "stats-chart" : "stats-chart-outline"} focused={focused} />
          )
        }}
      />
      <Tabs.Screen
        name="sharp"
        options={{
          title: "Sharp",
          headerShown: false,
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name={focused ? "flash" : "flash-outline"} focused={focused} />
          )
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: "Games",
          headerShown: false,
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name={focused ? "pricetags" : "pricetags-outline"} focused={focused} />
          )
        }}
      />
      <Tabs.Screen
        name="my-slips"
        options={{
          title: "My Picks",
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name={focused ? "bookmark" : "bookmark-outline"} focused={focused} />
          )
        }}
      />
      <Tabs.Screen name="account" options={{ href: null, title: "Account" }} />
      {/* Hidden routes for backward compatibility */}
      <Tabs.Screen name="hit-rates" options={{ href: null, title: "Hit Rates" }} />
      <Tabs.Screen name="positive-ev" options={{ href: null, title: "+EV" }} />
      <Tabs.Screen name="arbitrage" options={{ href: null, title: "Arbitrage" }} />
      <Tabs.Screen name="edge-finder" options={{ href: null, title: "Edge Finder" }} />
      <Tabs.Screen name="help" options={{ href: null, title: "Help" }} />
      <Tabs.Screen name="how-to" options={{ href: null, title: "How To" }} />
      <Tabs.Screen name="player/[id]" options={{ href: null, title: "Player", headerShown: false }} />
      <Tabs.Screen name="cheat-sheets" options={{ href: null, title: "Cheat Sheets" }} />
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
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  tabButtonActive: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
});
