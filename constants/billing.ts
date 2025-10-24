// Stripe price id constants (client-safe). Prefer NEXT_PUBLIC_* envs so we can
// reference them in client components without leaking secrets.

export type BillingPlan = "monthly" | "yearly";

export const STRIPE_PRICE_IDS: Record<BillingPlan, string> = {
  monthly:
    process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ||
    "", // fill in via env or config
  yearly:
    process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY ||
    "", // fill in via env or config
};

export function getPriceId(plan: BillingPlan, fallback?: string): string {
  const id = STRIPE_PRICE_IDS[plan];
  return id || fallback || "";
}


