// Stripe price id constants (client-safe). Prefer NEXT_PUBLIC_* envs so we can
// reference them in client components without leaking secrets.

export type BillingPlan = "monthly" | "yearly";
export type ProductType = "pro" | "nba_hit_rates";

// Pro subscription prices
export const STRIPE_PRICE_IDS: Record<BillingPlan, string> = {
  monthly:
    process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ||
    "", // fill in via env or config
  yearly:
    process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY ||
    "", // fill in via env or config
};

// NBA Hit Rates product price
export const STRIPE_NBA_HIT_RATES_PRICE_ID = 
  process.env.NEXT_PUBLIC_STRIPE_NBA_HIT_RATES || "";

// All product prices by type and plan
export const STRIPE_PRODUCT_PRICES: Record<ProductType, Partial<Record<BillingPlan, string>>> = {
  pro: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || "",
    yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY || "",
  },
  nba_hit_rates: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_NBA_HIT_RATES || "",
    // Add yearly if needed: yearly: process.env.NEXT_PUBLIC_STRIPE_NBA_HIT_RATES_YEARLY || "",
  },
};

export function getPriceId(plan: BillingPlan, fallback?: string): string {
  const id = STRIPE_PRICE_IDS[plan];
  return id || fallback || "";
}

export function getProductPriceId(
  product: ProductType,
  plan: BillingPlan = "monthly",
  fallback?: string
): string {
  const id = STRIPE_PRODUCT_PRICES[product]?.[plan];
  return id || fallback || "";
}


