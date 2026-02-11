import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, SafeAreaView, StyleSheet } from "react-native";
import { useAuth } from "@/src/providers/auth-provider";

export default function AuthLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#38BDF8" />
      </SafeAreaView>
    );
  }

  if (user) {
    return <Redirect href="/hit-rates" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0B1014" },
        headerTintColor: "#E5E7EB",
        contentStyle: { backgroundColor: "#0B1014" }
      }}
    >
      <Stack.Screen name="login" options={{ title: "Login" }} />
      <Stack.Screen name="register" options={{ title: "Create Account" }} />
      <Stack.Screen name="forgot-password" options={{ title: "Forgot Password" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0B1014",
    alignItems: "center",
    justifyContent: "center"
  }
});
