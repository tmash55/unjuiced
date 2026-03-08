import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AuthButton,
  AuthPanel,
  AuthScreenShell,
  authUiStyles,
} from "@/src/components/auth/AuthScreenShell";
import { useAuthOnboarding } from "@/src/components/auth/AuthOnboardingContext";
import { brandColors } from "@/src/theme/brand";

const SPORT_OPTIONS: Array<{
  id: string;
  label: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: "mlb", label: "MLB", caption: "Sheets and hitter spots", icon: "baseball-outline" },
  { id: "nba", label: "NBA", caption: "Props, hit rates, and pace", icon: "basketball-outline" },
  { id: "nhl", label: "NHL", caption: "Shots, points, alt ladders", icon: "snow-outline" },
  { id: "nfl", label: "NFL", caption: "Markets and player trends", icon: "american-football-outline" },
];

export default function OnboardingSportsScreen() {
  const router = useRouter();
  const { selectedSports, toggleSport } = useAuthOnboarding();

  return (
    <AuthScreenShell
      title="Which sports do you follow?"
      subtitle="Pick the boards you want Unjuiced to feel tuned for from the first session."
      eyebrow="Step 1 of 3"
      footer={<Text style={authUiStyles.helperText}>Multi-select. You can change this later.</Text>}
    >
      <AuthPanel>
        <View style={styles.optionsGrid}>
          {SPORT_OPTIONS.map((sport) => {
            const active = selectedSports.includes(sport.id);
            return (
              <Pressable
                key={sport.id}
                onPress={() => toggleSport(sport.id)}
                style={[styles.optionCard, active ? styles.optionCardActive : null]}
              >
                <View style={[styles.optionIconWrap, active ? styles.optionIconWrapActive : null]}>
                  <Ionicons
                    name={sport.icon}
                    size={20}
                    color={active ? "#04111B" : brandColors.textPrimary}
                  />
                </View>
                <Text style={styles.optionLabel}>{sport.label}</Text>
                <Text style={styles.optionCaption}>{sport.caption}</Text>
                {active ? (
                  <View style={styles.checkPill}>
                    <Ionicons name="checkmark" size={12} color="#04111B" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <AuthButton
          label="Continue"
          icon="arrow-forward"
          onPress={() => router.push("/onboarding-books")}
        />
      </AuthPanel>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  optionsGrid: {
    gap: 10,
  },
  optionCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  optionCardActive: {
    borderColor: "rgba(217,249,157,0.38)",
    backgroundColor: "rgba(217,249,157,0.08)",
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  optionIconWrapActive: {
    backgroundColor: "#D9F99D",
  },
  optionLabel: {
    color: brandColors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  optionCaption: {
    color: brandColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 220,
  },
  checkPill: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#D9F99D",
    alignItems: "center",
    justifyContent: "center",
  },
});
