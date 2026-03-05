import type { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { useEntitlements } from "@/src/hooks/use-entitlements";
import { hasPlanAccess } from "@unjuiced/types";
import type { PlanGateFeature } from "./plan-gate-config";
import UpgradeBanner from "./UpgradeBanner";

const BANNER_HEIGHT = 64;

interface PlanGateProps {
  feature: PlanGateFeature;
  children: ReactNode;
  bannerBottomOffset?: number;
}

export default function PlanGate({
  feature,
  children,
  bannerBottomOffset = 0,
}: PlanGateProps) {
  const { data: entitlements, isLoading } = useEntitlements();

  // Don't show banner while entitlements are loading or stale.
  // Protected routes guarantee auth — if entitlements say unauthenticated, the
  // cached result predates the session and we should wait for the real fetch.
  if (isLoading || !entitlements || !entitlements.authenticated) {
    return <>{children}</>;
  }

  const hasAccess = hasPlanAccess(entitlements.plan, feature.requiredPlan);

  if (hasAccess) return <>{children}</>;

  const authenticated = true;
  const canUseTrial = entitlements.trial?.trial_used === false;

  return (
    <View style={styles.wrapper}>
      {children}
      <View style={{ height: BANNER_HEIGHT + bannerBottomOffset }} />
      <UpgradeBanner
        feature={feature}
        authenticated={authenticated}
        canUseTrial={canUseTrial}
        bottomOffset={bannerBottomOffset}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
});
