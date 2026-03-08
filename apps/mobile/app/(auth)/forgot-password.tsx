import { useState } from "react";
import { useRouter } from "expo-router";
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      setMessage(null);
      setError(null);
      await resetPassword(email.trim());
      setMessage("If your email exists, a reset link has been sent.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Password reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      keyboard
      title="Reset your password."
      subtitle="We’ll send a reset link so you can get back to the board without losing momentum."
      eyebrow="Account recovery"
      footer={
        <AuthInlineLink
          prefix="Remembered it?"
          action="Back to sign in"
          onPress={() => router.push("/login")}
        />
      }
    >
      <AuthPanel>
        <View style={styles.copyWrap}>
          <Text style={styles.panelTitle}>Send reset link</Text>
          <Text style={authUiStyles.helperText}>
            Enter the email tied to your Unjuiced account and we’ll handle the rest.
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

          {error ? <Text style={authUiStyles.errorText}>{error}</Text> : null}
          {message ? <Text style={authUiStyles.infoText}>{message}</Text> : null}

          <AuthButton
            label="Send reset link"
            icon="mail-outline"
            onPress={() => void onSubmit()}
            disabled={!email}
            loading={submitting}
          />
        </View>
      </AuthPanel>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  copyWrap: {
    gap: 6,
  },
  panelTitle: {
    color: "#F8FAFC",
    fontSize: 20,
    fontWeight: "800",
  },
});
