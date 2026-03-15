import { forwardRef, useCallback, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { brandColors } from "@/src/theme/brand";

type AuthScreenShellProps = {
  title: string;
  subtitle: string;
  eyebrow?: string;
  align?: "left" | "center";
  keyboard?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  heroFooter?: ReactNode;
};

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  icon?: keyof typeof Ionicons.glyphMap;
};

type AuthFieldProps = TextInputProps & {
  label: string;
  rightLabel?: ReactNode;
};

export function AuthScreenShell({
  title,
  subtitle,
  eyebrow,
  keyboard = false,
  children,
  footer,
}: AuthScreenShellProps) {
  const router = useRouter();

  const content = (
    <Pressable style={styles.flex} onPress={Keyboard.dismiss}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <Pressable
          style={styles.backButton}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons name="chevron-back" size={20} color={brandColors.textSecondary} />
        </Pressable>

        {/* Main content — centered vertically */}
        <View style={styles.centerBlock}>
          {/* Logo */}
          <Image
            source={require("../../../assets/logo.png")}
            style={styles.logo}
            contentFit="contain"
          />

          {/* Header copy */}
          <View style={styles.headerWrap}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {/* Form content */}
          {children}
        </View>

        {/* Footer link — pushed to bottom */}
        {footer ? <View style={styles.footerWrap}>{footer}</View> : null}
      </ScrollView>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.background}>
        {keyboard ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.select({ ios: "padding", default: undefined })}
            keyboardVerticalOffset={Platform.select({ ios: 0, default: 0 })}
          >
            {content}
          </KeyboardAvoidingView>
        ) : (
          content
        )}
      </View>
    </SafeAreaView>
  );
}

export function AuthPanel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

export const AuthField = forwardRef<TextInput, AuthFieldProps>(
  function AuthField({ label, rightLabel, style, ...props }, ref) {
    const [focused, setFocused] = useState(false);

    return (
      <View style={styles.fieldWrap}>
        <View style={styles.fieldHeader}>
          <Text style={[styles.fieldLabel, focused && styles.fieldLabelFocused]}>{label}</Text>
          {rightLabel}
        </View>
        <TextInput
          ref={ref}
          placeholderTextColor="rgba(255,255,255,0.22)"
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            styles.fieldInput,
            focused && styles.fieldInputFocused,
            style,
          ]}
          {...props}
        />
      </View>
    );
  }
);

export function AuthButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  icon,
}: AuthButtonProps) {
  const isPrimary = variant === "primary";

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  }, [onPress]);

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.buttonBase,
        isPrimary ? styles.buttonPrimary : styles.buttonSecondary,
        (disabled || loading) ? styles.buttonDisabled : null,
        pressed && !(disabled || loading) ? styles.buttonPressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? "#04111B" : brandColors.textPrimary}
        />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? (
            <Ionicons
              name={icon}
              size={16}
              color={isPrimary ? "#04111B" : brandColors.textPrimary}
            />
          ) : null}
          <Text style={[styles.buttonText, isPrimary ? styles.buttonTextPrimary : styles.buttonTextSecondary]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function FeatureChip({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.featureChip}>
      <Ionicons name={icon} size={14} color={brandColors.textSecondary} />
      <Text style={styles.featureChipText}>{label}</Text>
    </View>
  );
}

export function AuthInlineLink({
  prefix,
  action,
  onPress,
}: {
  prefix: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.inlineLinkRow}>
      <Text style={styles.inlineLinkPrefix}>{prefix} </Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={styles.inlineLinkAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

export const authUiStyles = StyleSheet.create({
  helperText: {
    color: brandColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  infoText: {
    color: "#86EFAC",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  errorText: {
    color: brandColors.error,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  topGap: {
    marginTop: 4,
  },
  actionRow: {
    gap: 16,
  },
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#0B1014",
  },
  background: {
    flex: 1,
    backgroundColor: "#0B1014",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  centerBlock: {
    flex: 1,
    justifyContent: "center",
    gap: 24,
    paddingVertical: 24,
  },
  logo: {
    width: 136,
    height: 42,
  },
  headerWrap: {
    gap: 8,
  },
  eyebrow: {
    color: "#7DD3FC",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
    letterSpacing: -0.6,
  },
  subtitle: {
    color: "rgba(229,231,235,0.56)",
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 320,
  },
  panel: {
    gap: 18,
  },
  fieldWrap: {
    gap: 8,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    color: brandColors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  fieldLabelFocused: {
    color: brandColors.textSecondary,
  },
  fieldInput: {
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    color: "#F8FAFC",
    fontSize: 15,
  },
  fieldInputFocused: {
    borderColor: "rgba(56, 189, 248, 0.5)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  buttonBase: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 4,
  },
  buttonPrimary: {
    backgroundColor: "#38BDF8",
  },
  buttonSecondary: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  buttonTextPrimary: {
    color: "#04111B",
  },
  buttonTextSecondary: {
    color: brandColors.textPrimary,
  },
  featureChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  featureChipText: {
    color: brandColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  inlineLinkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  inlineLinkPrefix: {
    color: "rgba(229,231,235,0.44)",
    fontSize: 14,
  },
  inlineLinkAction: {
    color: "#7DD3FC",
    fontSize: 14,
    fontWeight: "700",
  },
  footerWrap: {
    paddingTop: 16,
    paddingBottom: 4,
  },
});
