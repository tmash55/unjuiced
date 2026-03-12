import { useState } from "react";
import { useRouter } from "expo-router";
import {
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
    if (!email) return;
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
      subtitle="We'll send a reset link so you can get back to the board."
      eyebrow="Account recovery"
      footer={
        <AuthInlineLink
          prefix="Remembered it?"
          action="Back to sign in"
          onPress={() => router.back()}
        />
      }
    >
      <AuthPanel>
        <View style={authUiStyles.actionRow}>
          <AuthField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
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
