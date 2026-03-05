import type { UserPlan } from "@unjuiced/types";

export interface PlanGateFeature {
  id: string;
  name: string;
  description: string;
  requiredPlan: UserPlan;
  trialDescription?: string;
}

export const PLAN_GATE_FEATURES = {
  props: {
    id: "props",
    name: "Hit Rate Tools",
    description: "Player hit rates, streaks, matchups & correlations",
    requiredPlan: "scout" as UserPlan,
    trialDescription: "Try Scout free for 3 days",
  },
  positiveEv: {
    id: "positiveEv",
    name: "+EV Betting",
    description: "Find positive expected value bets across all sportsbooks",
    requiredPlan: "sharp" as UserPlan,
    trialDescription: "Try Sharp free for 3 days",
  },
  arbitrage: {
    id: "arbitrage",
    name: "Arbitrage",
    description: "Guaranteed profit opportunities across sportsbooks",
    requiredPlan: "sharp" as UserPlan,
    trialDescription: "Try Sharp free for 3 days",
  },
  edgeFinder: {
    id: "edgeFinder",
    name: "Edge Finder",
    description: "Discover edges where books disagree on odds",
    requiredPlan: "sharp" as UserPlan,
    trialDescription: "Try Sharp free for 3 days",
  },
} as const satisfies Record<string, PlanGateFeature>;

export function getUpgradeUrl(authenticated: boolean): string {
  return authenticated ? "https://unjuiced.bet/#pricing" : "https://unjuiced.bet/register";
}

const PLAN_LABELS: Record<UserPlan, string> = {
  anonymous: "Free",
  free: "Free",
  scout: "Scout",
  sharp: "Sharp",
  elite: "Elite",
};

export function getUpgradeButtonText(
  requiredPlan: UserPlan,
  canUseTrial: boolean
): string {
  if (canUseTrial) return "Start Free Trial";
  return `Upgrade to ${PLAN_LABELS[requiredPlan] ?? requiredPlan}`;
}
