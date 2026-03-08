import { useRouter } from "expo-router";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuthOnboarding } from "@/src/components/auth/AuthOnboardingContext";
import { useAuth } from "@/src/providers/auth-provider";
import {
  AuthButton,
  AuthField,
  AuthInlineLink,
  AuthPanel,
  AuthScreenShell,
  authUiStyles,
} from "@/src/components/auth/AuthScreenShell";

export default function RegisterScreen() {
  const router = useRouter();
  const { selectedBooks, selectedPlan, selectedSports } = useAuthOnboarding();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      setMessage(null);
      await signUp(email.trim(), password);
      setMessage("Account created. Check your inbox to confirm.");
      router.replace("/login");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      keyboard
      title="Create your premium betting workspace."
      subtitle="Start with a cleaner setup for hit rates, sharp signals, and sportsbook-aware research."
      eyebrow="Create account"
      footer={
        <AuthInlineLink
          prefix="Already have an account?"
          action="Sign in"
          onPress={() => router.push("/login")}
        />
      }
    >
      <AuthPanel>
        <View style={s.copyWrap}>
          <Text style={s.panelTitle}>Start your account</Text>
          <Text style={authUiStyles.helperText}>
            We’ll get your mobile profile ready so your books and preferences follow you.
          </Text>
        </View>

        <View style={s.summaryRow}>
          <View style={s.summaryChip}>
            <Text style={s.summaryValue}>{selectedSports.length}</Text>
            <Text style={s.summaryLabel}>sports</Text>
          </View>
          <View style={s.summaryChip}>
            <Text style={s.summaryValue}>{selectedBooks.length}</Text>
            <Text style={s.summaryLabel}>books</Text>
          </View>
          <View style={s.summaryChip}>
            <Text style={s.summaryValue}>{selectedPlan === "sharp" ? "Sharp" : "Standard"}</Text>
            <Text style={s.summaryLabel}>plan</Text>
          </View>
        </View>

        <View style={authUiStyles.actionRow}>
          <AuthField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            keyboardType="email-address"
          />

          <AuthField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Choose a password"
            secureTextEntry
          />

          {error ? <Text style={authUiStyles.errorText}>{error}</Text> : null}
          {message ? <Text style={authUiStyles.infoText}>{message}</Text> : null}

          <AuthButton
            label="Create account"
            icon="sparkles-outline"
            onPress={() => void onSubmit()}
            disabled={!email || !password}
            loading={submitting}
          />
        </View>
      </AuthPanel>
    </AuthScreenShell>
  );
}

const s = StyleSheet.create({
  copyWrap: {
    gap: 6,
  },
  panelTitle: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryChip: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    gap: 3,
  },
  summaryValue: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  summaryLabel: {
    color: "#7B8CA7",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
});
