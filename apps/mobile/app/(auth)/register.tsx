import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Text,
  TextInput,
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

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const onSubmit = async () => {
    if (!email || !password) return;
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
      title="Create your account."
      subtitle="Get set up with sharp signals, cheat sheets, and real-time edges."
      eyebrow="Get started"
      footer={
        <AuthInlineLink
          prefix="Already have an account?"
          action="Sign in"
          onPress={() => router.replace("/login")}
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
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />

          <AuthField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Choose a password"
            secureTextEntry
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
          />

          {error ? <Text style={authUiStyles.errorText}>{error}</Text> : null}
          {message ? <Text style={authUiStyles.infoText}>{message}</Text> : null}

          <AuthButton
            label="Create account"
            onPress={() => void onSubmit()}
            disabled={!email || !password}
            loading={submitting}
          />
        </View>
      </AuthPanel>
    </AuthScreenShell>
  );
}
