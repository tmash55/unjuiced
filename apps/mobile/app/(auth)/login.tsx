import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  StyleSheet,
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

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const onSubmit = async () => {
    if (!email || !password) return;
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
      subtitle="Pick up right where your research left off."
      eyebrow="Sign in"
      footer={
        <AuthInlineLink
          prefix="Need an account?"
          action="Create one"
          onPress={() => router.replace("/register")}
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
            placeholder="Your password"
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
            rightLabel={
              <Text style={s.forgotLink} onPress={() => router.push("/forgot-password")}>
                Forgot?
              </Text>
            }
          />

          {error ? <Text style={authUiStyles.errorText}>{error}</Text> : null}

          <AuthButton
            label="Sign in"
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
  forgotLink: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "700",
  },
});
