import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { brandColors } from "@/src/theme/brand";
import type { PlanGateFeature } from "./plan-gate-config";
import { getUpgradeUrl, getUpgradeButtonText } from "./plan-gate-config";

interface UpgradeBannerProps {
  feature: PlanGateFeature;
  authenticated: boolean;
  canUseTrial: boolean;
  bottomOffset?: number;
}

export default function UpgradeBanner({
  feature,
  authenticated,
  canUseTrial,
  bottomOffset = 0,
}: UpgradeBannerProps) {
  const buttonText = getUpgradeButtonText(feature.requiredPlan, canUseTrial);
  const url = getUpgradeUrl(authenticated);

  return (
    <View style={[styles.container, { bottom: bottomOffset }]}>
      <View style={styles.row}>
        <Ionicons name="lock-closed" size={18} color={brandColors.primary} />
        <View style={styles.textGroup}>
          <Text style={styles.title}>{feature.name}</Text>
          <Text style={styles.description} numberOfLines={1}>
            {canUseTrial && feature.trialDescription
              ? feature.trialDescription
              : feature.description}
          </Text>
        </View>
        <Pressable
          style={styles.button}
          onPress={() => Linking.openURL(url)}
        >
          <Text style={styles.buttonText}>{buttonText}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: brandColors.primarySoft,
    backgroundColor: brandColors.navBackground,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textGroup: {
    flex: 1,
  },
  title: {
    color: brandColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  description: {
    color: brandColors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  button: {
    backgroundColor: brandColors.primaryStrong,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
