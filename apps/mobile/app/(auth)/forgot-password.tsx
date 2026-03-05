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
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={s.keyboard}
      >
        <View style={s.iconWrap}>
          <View style={s.iconCircle}>
            <Ionicons name="lock-closed-outline" size={28} color="#38BDF8" />
          </View>
        </View>

        <View style={s.form}>
          <Text style={s.title}>Reset password</Text>
          <Text style={s.subtitle}>
            Enter your email and we'll send you a link to reset your password.
          </Text>

          <View style={s.inputWrap}>
            <Text style={s.inputLabel}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor="#4B5B73"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={s.input}
            />
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}
          {message ? <Text style={s.message}>{message}</Text> : null}

          <Pressable
            disabled={submitting || !email}
            onPress={onSubmit}
            style={({ pressed }: { pressed: boolean }) => [
              s.btn,
              (submitting || !email) && s.btnDisabled,
              pressed && !submitting && s.btnPressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#020617" />
            ) : (
              <Text style={s.btnText}>Send Reset Link</Text>
            )}
          </Pressable>
        </View>

        <View style={s.bottom}>
          <Link href="/login" style={s.bottomLink}>
            Back to sign in
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1014",
  },
  keyboard: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },

  // Icon
  iconWrap: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Form
  form: {
    gap: 18,
  },
  title: {
    color: "#E5E7EB",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#7B8CA7",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginTop: -8,
    marginBottom: 2,
  },
  inputWrap: {
    gap: 6,
  },
  inputLabel: {
    color: "#9FB0C6",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#101A2B",
    borderColor: "#22324A",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    color: "#E5E7EB",
    fontSize: 15,
  },
  error: {
    color: "#F87171",
    fontSize: 13,
    fontWeight: "500",
  },
  message: {
    color: "#22C55E",
    fontSize: 13,
    fontWeight: "500",
  },

  // Button
  btn: {
    backgroundColor: "#38BDF8",
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  btnText: {
    color: "#020617",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnPressed: {
    opacity: 0.85,
  },

  // Bottom
  bottom: {
    alignItems: "center",
    marginTop: 32,
  },
  bottomLink: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "700",
  },
});
