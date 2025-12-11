import Stripe from "stripe";

interface CreateCheckoutParams {
  priceId: string;
  mode: "payment" | "subscription";
  successUrl: string;
  cancelUrl: string;
  clientReferenceId?: string;
  user?: {
    customerId?: string;
    email?: string;
  };
  /**
   * Optional number of trial days to apply when mode === 'subscription'
   */
  trialDays?: number;
  /**
   * Force card collection even if no payment is due up front.
   * Defaults to 'always' for subscriptions when trialDays is set.
   */
  paymentMethodCollection?: "always" | "if_required";
  /**
   * Whether to show the promotion code input on the checkout page.
   * Defaults to true. Set to false for yearly plans or when auto-applying a discount.
   */
  allowPromotionCodes?: boolean;
  /**
   * Auto-apply a Stripe coupon ID (e.g., from Dub partner referral)
   * This will be passed in the `discounts` array
   */
  couponId?: string;
  /**
   * Auto-apply a Stripe promotion code ID (e.g., from Dub partner referral)
   * This will be passed in the `discounts` array - preferred over couponId
   */
  promotionCodeId?: string;
}

interface CreateCustomerPortalParams {
  customerId: string;
  returnUrl: string;
}

// This is used to create a Stripe Checkout for one-time payments. It's usually triggered with the <ButtonCheckout /> component. Webhooks are used to update the user's state in the database.
export const createCheckout = async ({
  user,
  mode,
  clientReferenceId,
  successUrl,
  cancelUrl,
  priceId,
  trialDays,
  paymentMethodCollection,
  allowPromotionCodes = true,
  couponId,
  promotionCodeId,
}: CreateCheckoutParams): Promise<string | null> => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-08-16" as any,
    typescript: true,
  });

  const extraParams: {
    customer?: string;
    customer_creation?: "always";
    customer_email?: string;
    invoice_creation?: { enabled: boolean };
    payment_intent_data?: { setup_future_usage: "on_session" };
    tax_id_collection?: { enabled: boolean };
  } = {};

  if (user?.customerId) {
    extraParams.customer = user.customerId;
  } else {
    if (mode === "payment") {
      extraParams.customer_creation = "always";
      extraParams.payment_intent_data = { setup_future_usage: "on_session" };
    }
    if (user?.email) {
      extraParams.customer_email = user.email;
    }
    extraParams.tax_id_collection = { enabled: true };
  }

  try {
    // Build discounts array if we have a coupon or promotion code to auto-apply
    // Promotion code takes precedence over coupon ID
    // Note: When using discounts, allow_promotion_codes must be false
    let discounts: Stripe.Checkout.SessionCreateParams['discounts'] | undefined;
    let shouldAllowPromoCodes = allowPromotionCodes;
    
    if (promotionCodeId) {
      discounts = [{ promotion_code: promotionCodeId }];
      shouldAllowPromoCodes = false; // Can't have both
      console.log('[stripe] Auto-applying promotion code:', promotionCodeId);
    } else if (couponId) {
      discounts = [{ coupon: couponId }];
      shouldAllowPromoCodes = false; // Can't have both
      console.log('[stripe] Auto-applying coupon:', couponId);
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode,
      client_reference_id: clientReferenceId,
      metadata: {
        brand_key: 'unjuiced',
        ...(clientReferenceId ? { user_id: String(clientReferenceId) } : {}),
        // Dub tracking: associate checkout with the user for sale attribution
        ...(clientReferenceId ? { dubCustomerId: String(clientReferenceId) } : {}),
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Show promo code input for users to enter referral codes manually
      // (disabled when auto-applying a discount)
      allow_promotion_codes: shouldAllowPromoCodes,
      // Auto-apply discount if provided
      ...(discounts ? { discounts } : {}),
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(mode === 'subscription'
        ? {
            payment_method_collection:
              paymentMethodCollection || (typeof trialDays === 'number' ? 'always' : 'if_required'),
            subscription_data: {
              ...(typeof trialDays === 'number' ? { trial_period_days: trialDays } : {}),
              metadata: {
                ...(clientReferenceId ? { user_id: String(clientReferenceId) } : {}),
                // Dub tracking: associate subscription with the user for sale attribution
                ...(clientReferenceId ? { dubCustomerId: String(clientReferenceId) } : {}),
              },
            },
          }
        : {}),
      ...extraParams,
    };

    const stripeSession = await stripe.checkout.sessions.create(sessionParams);
    return stripeSession.url || null;
  } catch (e: any) {
    // Handle specific Stripe errors - if coupon doesn't apply, retry without it
    if (e?.code === 'coupon_applies_to_nothing' && (couponId || promotionCodeId)) {
      console.warn('[stripe] Coupon does not apply to this product, retrying without discount...');
      try {
        // Rebuild session params without the discount
        const retryParams: Stripe.Checkout.SessionCreateParams = {
          mode,
          client_reference_id: clientReferenceId,
          metadata: {
            brand_key: 'unjuiced',
            ...(clientReferenceId ? { user_id: String(clientReferenceId) } : {}),
            ...(clientReferenceId ? { dubCustomerId: String(clientReferenceId) } : {}),
          },
          line_items: [{ price: priceId, quantity: 1 }],
          allow_promotion_codes: allowPromotionCodes, // Re-enable manual promo code entry
          success_url: successUrl,
          cancel_url: cancelUrl,
          ...(mode === 'subscription'
            ? {
                payment_method_collection:
                  paymentMethodCollection || (typeof trialDays === 'number' ? 'always' : 'if_required'),
                subscription_data: {
                  ...(typeof trialDays === 'number' ? { trial_period_days: trialDays } : {}),
                  metadata: {
                    ...(clientReferenceId ? { user_id: String(clientReferenceId) } : {}),
                    ...(clientReferenceId ? { dubCustomerId: String(clientReferenceId) } : {}),
                  },
                },
              }
            : {}),
          ...extraParams,
        };
        const retrySession = await stripe.checkout.sessions.create(retryParams);
        return retrySession.url || null;
      } catch (retryError) {
        console.error('[stripe] Retry also failed:', retryError);
        return null;
      }
    }
    console.error('[stripe] Checkout error:', e);
    return null;
  }
};

// This is used to create Customer Portal sessions, so users can manage their subscriptions (payment methods, cancel, etc..)
export const createCustomerPortal = async ({
  customerId,
  returnUrl,
}: CreateCustomerPortalParams): Promise<string> => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-08-16" as any,
    typescript: true,
  });

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return portalSession.url;
};

// This is used to get the user checkout session and populate the data so we get the planId the user subscribed to
export const findCheckoutSession = async (sessionId: string) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-08-16" as any,
      typescript: true,
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });

    return session;
  } catch (e) {
    console.error(e);
    return null;
  }
};
