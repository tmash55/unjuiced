import { Redirect } from "expo-router";
import { ActivityIndicator, SafeAreaView, StyleSheet } from "react-native";
import { useAuth } from "@/src/providers/auth-provider";

export default function IndexScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#38BDF8" />
      </SafeAreaView>
    );
  }

  return <Redirect href={user ? "/hit-rates" : "/login"} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0B1014",
    alignItems: "center",
    justifyContent: "center"
  }
});
