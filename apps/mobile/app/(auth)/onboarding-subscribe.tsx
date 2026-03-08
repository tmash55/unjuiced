import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AuthButton,
  AuthInlineLink,
  AuthPanel,
  AuthScreenShell,
  authUiStyles,
} from "@/src/components/auth/AuthScreenShell";
import {
  useAuthOnboarding,
  type OnboardingPlan,
} from "@/src/components/auth/AuthOnboardingContext";
import { brandColors } from "@/src/theme/brand";

const PLAN_CARDS: Array<{
  id: OnboardingPlan;
  name: string;
  price: string;
  bullets: string[];
}> = [
  {
    id: "standard",
    name: "Standard",
    price: "$15/mo",
    bullets: ["Live +EV feed", "Core sheets", "Sportsbook filtering", "Today dashboard"],
  },
  {
    id: "sharp",
    name: "Sharp",
    price: "$30/mo",
    bullets: ["AI score previews", "Premium sheets", "Arbitrage tools", "Advanced sharp workflows"],
  },
];

export default function OnboardingSubscribeScreen() {
  const router = useRouter();
  const { selectedSports, selectedBooks, selectedPlan, setPlan } = useAuthOnboarding();

  return (
    <AuthScreenShell
      title="Choose how sharp you want to start."
      subtitle="Keep it simple with Standard, or unlock the full premium workflow with Sharp."
      eyebrow="Step 3 of 3"
      footer={
        <AuthInlineLink
          prefix="Already have an account?"
          action="Log In"
          onPress={() => router.push("/login")}
        />
      }
    >
      <AuthPanel>
        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryValue}>{selectedSports.length}</Text>
            <Text style={styles.summaryLabel}>sports</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryValue}>{selectedBooks.length}</Text>
            <Text style={styles.summaryLabel}>books</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryValue}>Live</Text>
            <Text style={styles.summaryLabel}>ready</Text>
          </View>
        </View>

        <View style={styles.planGrid}>
          {PLAN_CARDS.map((plan) => {
            const active = selectedPlan === plan.id;
            return (
              <Pressable
                key={plan.id}
                onPress={() => setPlan(plan.id)}
                style={[styles.planCard, active ? styles.planCardActive : null]}
              >
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
                {plan.bullets.map((bullet) => (
                  <Text key={bullet} style={styles.planBullet}>
                    {`\u2022 ${bullet}`}
                  </Text>
                ))}
              </Pressable>
            );
          })}
        </View>

        <Text style={authUiStyles.helperText}>
          You can change plans later. For now, this sets the version of Unjuiced we aim you toward.
        </Text>

        <AuthButton
          label="Get Started"
          icon="arrow-forward"
          onPress={() => router.push("/register")}
        />
      </AuthPanel>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryChip: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    gap: 3,
  },
  summaryValue: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  summaryLabel: {
    color: brandColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  planGrid: {
    flexDirection: "row",
    gap: 10,
  },
  planCard: {
    flex: 1,
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  planCardActive: {
    borderColor: "rgba(217,249,157,0.38)",
    backgroundColor: "rgba(217,249,157,0.08)",
  },
  planName: {
    color: brandColors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  planPrice: {
    color: "#D9F99D",
    fontSize: 22,
    fontWeight: "800",
  },
  planBullet: {
    color: brandColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
});
