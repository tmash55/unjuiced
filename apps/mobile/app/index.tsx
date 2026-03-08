import { useEffect, useRef, useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { Animated, Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { WelcomeExperience } from "@/src/components/auth/WelcomeExperience";
import { useAuth } from "@/src/providers/auth-provider";

function BrandSplash() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const glow = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 18,
        stiffness: 220,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.65,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [glow, opacity, scale]);

  return (
    <LinearGradient
      colors={["#071019", "#0B1014", "#09131E"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.splash}
    >
      <Animated.View style={[styles.splashGlow, { opacity: glow }]} />
      <Animated.View
        style={[
          styles.splashLogoWrap,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <Image
          source={require("../assets/logo.png")}
          style={styles.splashLogo}
          resizeMode="contain"
        />
      </Animated.View>
    </LinearGradient>
  );
}

export default function IndexScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [splashComplete, setSplashComplete] = useState(false);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (loading) return;

    const minimumDuration = user ? 1000 : 2000;
    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, minimumDuration - elapsed);
    const timeout = setTimeout(() => setSplashComplete(true), remaining);

    return () => clearTimeout(timeout);
  }, [loading, user]);

  if (loading || !splashComplete) {
    return <BrandSplash />;
  }

  if (user) {
    return <Redirect href="/today" />;
  }

  return (
    <WelcomeExperience
      onGetStarted={() => router.push("/onboarding-sports")}
      onLogin={() => router.push("/login")}
    />
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  splashGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(56,189,248,0.14)",
  },
  splashLogoWrap: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  splashLogo: {
    width: 196,
    height: 60,
  },
});
