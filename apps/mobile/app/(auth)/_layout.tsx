import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, SafeAreaView, StyleSheet } from "react-native";
import { AuthOnboardingProvider } from "@/src/components/auth/AuthOnboardingContext";
import { useAuth } from "@/src/providers/auth-provider";
import { brandColors } from "@/src/theme/brand";

export default function AuthLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={brandColors.primary} />
      </SafeAreaView>
    );
  }

  if (user) {
    return <Redirect href="/today" />;
  }

  return (
    <AuthOnboardingProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: brandColors.appBackground },
          headerTintColor: brandColors.textPrimary,
          contentStyle: { backgroundColor: brandColors.appBackground }
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding-sports" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding-books" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding-subscribe" options={{ headerShown: false }} />
      </Stack>
    </AuthOnboardingProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: brandColors.appBackground,
    alignItems: "center",
    justifyContent: "center"
  }
});
