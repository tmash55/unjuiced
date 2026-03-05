import { useEffect, useRef } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, Animated, Image, SafeAreaView, StyleSheet, View } from "react-native";
import { useAuth } from "@/src/providers/auth-provider";

export default function IndexScreen() {
  const { user, loading } = useAuth();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoOpacity, logoScale]);

  if (!loading) {
    return <Redirect href={user ? "/today" : "/login"} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <ActivityIndicator size="small" color="#38BDF8" style={styles.spinner} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1014",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 180,
    height: 56,
  },
  spinner: {
    marginTop: 32,
  },
});
