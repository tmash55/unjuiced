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

    // Build discounts array - prefer promotion code over coupon
    // Promotion code shows the code name in checkout UI (e.g., "TYLER30")
    // Coupon directly applies the discount without showing a code
    let discounts: Stripe.Checkout.SessionCreateParams['discounts'] = [];
    if (promotionCodeId) {
      discounts = [{ promotion_code: promotionCodeId }];
    } else if (couponId) {
      discounts = [{ coupon: couponId }];
    }
    
    // Stripe doesn't allow both allow_promotion_codes AND discounts at the same time
    const hasDiscount = discounts.length > 0;

    // Build base session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode,
      // Disable allow_promotion_codes if we're pre-applying a discount
      allow_promotion_codes: hasDiscount ? false : allowPromotionCodes,
      client_reference_id: clientReferenceId,
      metadata: {
        brand_key: 'unjuiced',
        ...(clientReferenceId ? { user_id: String(clientReferenceId) } : {}),
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      discounts,
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
              },
            },
          }
        : {}),
      ...extraParams,
    };

    const stripeSession = await stripe.checkout.sessions.create(sessionParams);

    return stripeSession.url || null;
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
