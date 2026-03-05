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

export default function RegisterScreen() {
  const router = useRouter();
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
        </View>

        <View style={s.form}>
          <Text style={s.title}>Create account</Text>
          <Text style={s.subtitle}>Get access to hit rates, props tools, and more.</Text>

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
            <Text style={s.inputLabel}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Choose a password"
              placeholderTextColor="#4B5B73"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={s.input}
            />
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}
          {message ? <Text style={s.message}>{message}</Text> : null}

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
              <Text style={s.btnText}>Get Started</Text>
            )}
          </Pressable>
        </View>

        <View style={s.bottom}>
          <Text style={s.bottomText}>Already have an account? </Text>
          <Link href="/login" style={s.bottomLink}>
            Sign in
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

  // Top
  top: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 180,
    height: 56,
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
