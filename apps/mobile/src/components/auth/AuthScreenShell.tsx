import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
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
  align = "left",
  keyboard = false,
  children,
  footer,
  heroFooter,
}: AuthScreenShellProps) {
  const content = (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        align === "center" ? styles.scrollContentCenter : null,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroWrap}>
        <View style={styles.heroTopRow}>
          <Image
            source={require("../../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>Sharp mobile</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <LinearGradient
            colors={["rgba(56,189,248,0.14)", "rgba(251,191,36,0.10)", "rgba(16,185,129,0.06)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGlow}
          />

          {eyebrow ? (
            <View style={styles.eyebrowPill}>
              <Text style={styles.eyebrowText}>{eyebrow}</Text>
            </View>
          ) : null}

          <Text style={[styles.title, align === "center" ? styles.textCenter : null]}>{title}</Text>
          <Text style={[styles.subtitle, align === "center" ? styles.textCenter : null]}>{subtitle}</Text>

          <View style={[styles.heroChipsRow, align === "center" ? styles.heroChipsRowCenter : null]}>
            <FeatureChip icon="basketball-outline" label="Sporty" />
            <FeatureChip icon="diamond-outline" label="Premium" />
            <FeatureChip icon="flash-outline" label="Live edge" />
          </View>

          {heroFooter}
        </View>
      </View>

      {children}

      {footer ? <View style={styles.footerWrap}>{footer}</View> : null}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <LinearGradient
        colors={["#091018", "#0B1014", "#0F172A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        <View style={styles.bgOrbOne} />
        <View style={styles.bgOrbTwo} />
        <View style={styles.bgNet} />

        {keyboard ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.select({ ios: "padding", default: undefined })}
          >
            {content}
          </KeyboardAvoidingView>
        ) : (
          content
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

export function AuthPanel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

export function AuthField({ label, rightLabel, style, ...props }: AuthFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {rightLabel}
      </View>
      <TextInput
        placeholderTextColor={brandColors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.fieldInput, style]}
        {...props}
      />
    </View>
  );
}

export function AuthButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  icon,
}: AuthButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
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
          color={isPrimary ? "#03131E" : brandColors.textPrimary}
        />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? (
            <Ionicons
              name={icon}
              size={16}
              color={isPrimary ? "#03131E" : brandColors.textPrimary}
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
      <Text style={styles.inlineLinkPrefix}>{prefix}</Text>
      <Pressable onPress={onPress}>
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
    gap: 12,
  },
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#091018",
  },
  background: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    justifyContent: "center",
    gap: 18,
  },
  scrollContentCenter: {
    justifyContent: "space-between",
    paddingTop: 20,
  },
  heroWrap: {
    gap: 14,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    width: 168,
    height: 52,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  livePillText: {
    color: brandColors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "rgba(9, 16, 24, 0.84)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.14)",
    overflow: "hidden",
    gap: 12,
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  eyebrowPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
  },
  eyebrowText: {
    color: "#D7F4FF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 31,
    fontWeight: "800",
    lineHeight: 35,
    letterSpacing: -0.8,
  },
  subtitle: {
    color: "rgba(229, 231, 235, 0.72)",
    fontSize: 14,
    lineHeight: 21,
  },
  textCenter: {
    textAlign: "center",
    alignSelf: "center",
  },
  heroChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroChipsRowCenter: {
    justifyContent: "center",
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
  panel: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(14, 21, 34, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 16,
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
    color: brandColors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  fieldInput: {
    height: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: brandColors.textPrimary,
    fontSize: 15,
  },
  buttonBase: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonPrimary: {
    backgroundColor: "#D9F99D",
  },
  buttonSecondary: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  buttonDisabled: {
    opacity: 0.42,
  },
  buttonPressed: {
    opacity: 0.86,
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
    color: "#03131E",
  },
  buttonTextSecondary: {
    color: brandColors.textPrimary,
  },
  inlineLinkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  inlineLinkPrefix: {
    color: brandColors.textMuted,
    fontSize: 14,
  },
  inlineLinkAction: {
    color: brandColors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  footerWrap: {
    marginTop: 2,
  },
  bgOrbOne: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -60,
    right: -80,
    backgroundColor: "rgba(56, 189, 248, 0.10)",
  },
  bgOrbTwo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: 40,
    left: -70,
    backgroundColor: "rgba(251, 191, 36, 0.07)",
  },
  bgNet: {
    position: "absolute",
    top: "18%",
    left: -20,
    right: -20,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    transform: [{ rotate: "-8deg" }],
  },
});
