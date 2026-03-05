import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@/src/providers/auth-provider";

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
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={s.keyboard}
      >
        <View style={s.top}>
          <Image
            source={require("../../assets/logo.png")}
            style={s.logo}
            resizeMode="contain"
          />
          <Text style={s.tagline}>
            Find the edge in every prop
          </Text>
        </View>

        <View style={s.form}>
          <Text style={s.title}>Sign in</Text>

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

          <View style={s.inputWrap}>
            <View style={s.labelRow}>
              <Text style={s.inputLabel}>Password</Text>
              <Link href="/forgot-password" style={s.forgotLink}>
                Forgot?
              </Link>
            </View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor="#4B5B73"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={s.input}
            />
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable
            disabled={submitting || !email || !password}
            onPress={onSubmit}
            style={({ pressed }: { pressed: boolean }) => [
              s.btn,
              (submitting || !email || !password) && s.btnDisabled,
              pressed && !submitting && s.btnPressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#020617" />
            ) : (
              <Text style={s.btnText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        <View style={s.bottom}>
          <Text style={s.bottomText}>Don't have an account? </Text>
          <Link href="/register" style={s.bottomLink}>
            Create one
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

  // Top branding
  top: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 180,
    height: 56,
  },
  tagline: {
    color: "#7B8CA7",
    fontSize: 15,
    fontWeight: "500",
    marginTop: 10,
    letterSpacing: 0.2,
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
    marginBottom: 4,
  },
  inputWrap: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inputLabel: {
    color: "#9FB0C6",
    fontSize: 13,
    fontWeight: "600",
  },
  forgotLink: {
    color: "#38BDF8",
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
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  bottomText: {
    color: "#7B8CA7",
    fontSize: 14,
  },
  bottomLink: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "700",
  },
});
