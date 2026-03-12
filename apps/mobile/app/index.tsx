import { useEffect, useRef, useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { OnboardingCarousel } from "@/src/components/auth/OnboardingCarousel";
import { useAuth } from "@/src/providers/auth-provider";

export default function IndexScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [ready, setReady] = useState(false);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (loading) return;

    const minimumDuration = user ? 1200 : 1800;
    const elapsed = Date.now() - mountedAt.current;
    const remaining = Math.max(0, minimumDuration - elapsed);
    const timeout = setTimeout(() => setReady(true), remaining);

    return () => clearTimeout(timeout);
  }, [loading, user]);

  // Authenticated users redirect once ready
  if (ready && user) {
    return <Redirect href="/today" />;
  }

  // Always render the carousel — it handles the splash state internally
  return (
    <OnboardingCarousel
      ready={ready}
      onGetStarted={() => router.push("/register")}
      onLogin={() => router.push("/login")}
    />
  );
}
