import Stripe from "stripe";

interface CreateCheckoutParams {
  priceId: string;
  mode: "payment" | "subscription";
  successUrl: string;
  cancelUrl: string;
  /**
   * Coupon ID to directly apply a discount (e.g., "1Ry5Zesp")
   */
  couponId?: string | null;
  /**
   * Promotion Code ID to pre-fill the promo code (e.g., "promo_xxx")
   * This shows the code name in the checkout UI
   */
  promotionCodeId?: string | null;
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
   * Whether to allow promotion codes on the checkout page.
   * Defaults to true. Set to false for yearly plans.
   */
  allowPromotionCodes?: boolean;
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
  couponId,
  promotionCodeId,
  trialDays,
  paymentMethodCollection,
  allowPromotionCodes = true,
}: CreateCheckoutParams): Promise<string | null> => {
  try {
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
        // The option below costs 0.4% (up to $2) per invoice. Alternatively, you can use https://zenvoice.io/ to create unlimited invoices automatically.
        // extraParams.invoice_creation = { enabled: true };
        extraParams.payment_intent_data = { setup_future_usage: "on_session" };
      }
      if (user?.email) {
        extraParams.customer_email = user.email;
      }
      extraParams.tax_id_collection = { enabled: true };
    }

    // Stripe doesn't allow both allow_promotion_codes AND discounts at the same time
    // So we use one OR the other, never both
    const hasDiscount = !!(promotionCodeId || couponId);

    // Build base session params
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
      // Only include discounts OR allow_promotion_codes, never both
      ...(hasDiscount
        ? {
            discounts: promotionCodeId
              ? [{ promotion_code: promotionCodeId }]
              : [{ coupon: couponId! }],
          }
        : {
            allow_promotion_codes: allowPromotionCodes,
          }),
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

    try {
      const stripeSession = await stripe.checkout.sessions.create(sessionParams);
      return stripeSession.url || null;
    } catch (stripeError: any) {
      // If the coupon doesn't apply to this product, retry without the discount
      if (stripeError?.code === 'coupon_applies_to_nothing' && hasDiscount) {
        console.warn('[stripe] Coupon does not apply to this product, retrying without discount');
        
        // Remove discounts and allow manual promo code entry instead
        const sessionParamsWithoutDiscount: Stripe.Checkout.SessionCreateParams = {
          ...sessionParams,
          discounts: undefined,
          allow_promotion_codes: allowPromotionCodes,
        };
        
        const retrySession = await stripe.checkout.sessions.create(sessionParamsWithoutDiscount);
        return retrySession.url || null;
      }
      
      // Re-throw other errors
      throw stripeError;
    }
  } catch (e) {
    console.error(e);
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

// This is used to get the uesr checkout session and populate the data so we get the planId the user subscribed to
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
