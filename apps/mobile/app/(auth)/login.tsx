import { useRouter } from "expo-router";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@/src/providers/auth-provider";
import {
  AuthButton,
  AuthField,
  AuthInlineLink,
  AuthPanel,
  AuthScreenShell,
  authUiStyles,
} from "@/src/components/auth/AuthScreenShell";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await signIn(email.trim(), password);
      router.replace("/today");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      keyboard
      title="Welcome back."
      subtitle="Jump back into the board and pick up right where your research left off."
      eyebrow="Sign in"
      footer={
        <AuthInlineLink
          prefix="Need an account?"
          action="Create one"
          onPress={() => router.push("/register")}
        />
      }
    >
      <AuthPanel>
        <View style={s.copyWrap}>
          <Text style={s.panelTitle}>Sign in to Unjuiced</Text>
          <Text style={authUiStyles.helperText}>
            Your books, bankroll settings, and saved preferences come with you.
          </Text>
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
            placeholder="Your password"
            secureTextEntry
            rightLabel={
              <Text style={s.inlineAction} onPress={() => router.push("/forgot-password")}>
                Forgot?
              </Text>
            }
          />

          {error ? <Text style={authUiStyles.errorText}>{error}</Text> : null}

          <AuthButton
            label="Sign in"
            icon="arrow-forward"
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
  inlineAction: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "700",
  },
});
