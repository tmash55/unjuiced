// Stripe price id constants (client-safe). Prefer NEXT_PUBLIC_* envs so we can
// reference them in client components without leaking secrets.

export type BillingPlan = "monthly" | "yearly";
export type ProductType = "scout" | "sharp" | "edge";

/**
 * Stripe price IDs for each product and billing plan
 * These are sandbox IDs - update for production
 */
export const STRIPE_PRODUCT_PRICES: Record<ProductType, Record<BillingPlan, string>> = {
  scout: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_SCOUT_MONTHLY || "price_1SwQGeDHoRr1ai9XaPwfXaSR",
    yearly: process.env.NEXT_PUBLIC_STRIPE_SCOUT_YEARLY || "price_1SwQHHDHoRr1ai9XHWAZBHxE",
  },
  sharp: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_SHARP_MONTHLY || "price_1SwQHpDHoRr1ai9XG5KgYpjq",
    yearly: process.env.NEXT_PUBLIC_STRIPE_SHARP_YEARLY || "price_1SwQIFDHoRr1ai9XMYYvBaLY",
  },
  edge: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_EDGE_MONTHLY || "price_1SwQIgDHoRr1ai9XaVvzPu5t",
    yearly: process.env.NEXT_PUBLIC_STRIPE_EDGE_YEARLY || "price_1SwQItDHoRr1ai9XFYDFVtuR",
  },
};

/**
 * All price IDs as a flat array (useful for validation)
 */
export const ALL_PRICE_IDS = Object.values(STRIPE_PRODUCT_PRICES).flatMap(
  (plans) => Object.values(plans)
);

/**
 * Map price ID to product type
 */
export function getProductFromPriceId(priceId: string): ProductType | null {
  for (const [product, plans] of Object.entries(STRIPE_PRODUCT_PRICES)) {
    if (Object.values(plans).includes(priceId)) {
      return product as ProductType;
    }
  }
  return null;
}

/**
 * Get price ID for a product and billing plan
 */
export function getProductPriceId(
  product: ProductType,
  plan: BillingPlan = "monthly"
): string {
  return STRIPE_PRODUCT_PRICES[product]?.[plan] || "";
}

type CheckoutOptions = {
  trialDays?: number;
  couponId?: string;
  mode?: "subscription" | "payment";
};

export function buildCheckoutStartPath(
  product: ProductType,
  plan: BillingPlan = "monthly",
  options: CheckoutOptions = {}
): string {
  const priceId = getProductPriceId(product, plan);
  const params = new URLSearchParams({
    priceId,
    mode: options.mode ?? "subscription",
  });
  if (typeof options.trialDays === "number") {
    params.set("trialDays", String(options.trialDays));
  }
  if (options.couponId) {
    params.set("couponId", options.couponId);
  }
  return `/billing/start?${params.toString()}`;
}

export function buildRegisterCheckoutPath(
  product: ProductType,
  plan: BillingPlan = "monthly",
  options: CheckoutOptions = {}
): string {
  const checkoutPath = buildCheckoutStartPath(product, plan, options);
  return `/register?redirectTo=${encodeURIComponent(checkoutPath)}`;
}

/**
 * Check if a price ID is for a yearly plan
 */
export function isYearlyPriceId(priceId: string): boolean {
  return (
    priceId === STRIPE_PRODUCT_PRICES.scout.yearly ||
    priceId === STRIPE_PRODUCT_PRICES.sharp.yearly ||
    priceId === STRIPE_PRODUCT_PRICES.edge.yearly
  );
}

// Legacy exports for backward compatibility
export const STRIPE_PRICE_IDS: Record<BillingPlan, string> = {
  monthly: STRIPE_PRODUCT_PRICES.sharp.monthly,
  yearly: STRIPE_PRODUCT_PRICES.sharp.yearly,
};

export function getPriceId(plan: BillingPlan, fallback?: string): string {
  return STRIPE_PRICE_IDS[plan] || fallback || "";
}
