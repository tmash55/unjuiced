import { useState } from "react";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useAuth } from "@/src/providers/auth-provider";

export default function ForgotPasswordScreen() {
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={styles.keyboardContainer}
      >
        <View style={styles.formCard}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>We will send a reset link to your account email.</Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            disabled={submitting || !email}
            onPress={onSubmit}
            style={({ pressed }: { pressed: boolean }) => [
              styles.primaryButton,
              (submitting || !email) && styles.disabledButton,
              pressed && !submitting && styles.pressedButton
            ]}
          >
            {submitting ? <ActivityIndicator size="small" color="#020617" /> : <Text style={styles.primaryButtonText}>Send reset link</Text>}
          </Pressable>

          <Link href="/login" style={styles.secondaryLink}>
            Back to login
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1014"
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20
  },
  formCard: {
    backgroundColor: "#111827",
    borderColor: "#1F2937",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12
  },
  title: {
    color: "#F8FAFC",
    fontSize: 24,
    fontWeight: "700"
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 13
  },
  input: {
    borderColor: "#374151",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F8FAFC",
    fontSize: 14
  },
  error: {
    color: "#F87171",
    fontSize: 12
  },
  message: {
    color: "#4ADE80",
    fontSize: 12
  },
  primaryButton: {
    backgroundColor: "#38BDF8",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#020617",
    fontSize: 14,
    fontWeight: "700"
  },
  disabledButton: {
    opacity: 0.4
  },
  pressedButton: {
    opacity: 0.85
  },
  secondaryLink: {
    color: "#7DD3FC",
    fontSize: 13,
    textAlign: "center"
  }
});
