/**
 * Brevo (formerly Sendinblue) Contact Management
 * 
 * This module provides helpers for syncing user lifecycle data with Brevo
 * for automated email marketing and lifecycle messaging.
 */

const BREVO_API_URL = process.env.BREVO_BASE_URL || 'https://api.brevo.com/v3';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * User lifecycle stages for Brevo segmentation
 * - lead: Account created, no active subscription/trial
 * - trialing: Stripe subscription status = trialing
 * - active_paid: Stripe subscription active, not canceling
 * - canceling: Stripe subscription active + cancel_at_period_end = true
 * - inactive_paid: Stripe status = past_due/unpaid
 * - cancelled: Subscription ended / canceled and access ended
 */
export type BrevoLifecycle = 
  | 'lead' 
  | 'trialing' 
  | 'active_paid' 
  | 'canceling' 
  | 'inactive_paid' 
  | 'cancelled';

/**
 * Human-readable plan names for Brevo
 */
export type BrevoPlan = 'hit_rates' | 'pro_monthly' | 'pro_yearly' | null;

/**
 * Contact source for tracking where signups come from
 */
export type BrevoSource = 'app_signup' | 'referral' | 'import' | 'manual';

/**
 * Brevo contact attributes we track
 */
export interface BrevoContactAttributes {
  /** Current lifecycle stage */
  LIFECYCLE?: BrevoLifecycle;
  /** Human-readable plan name */
  PLAN?: BrevoPlan | string;
  /** Raw Stripe price ID for debugging */
  STRIPE_PRICE_ID?: string;
  /** Whether user opted in to marketing emails */
  NEWSLETTER_OPT_IN?: boolean;
  /** Where the contact came from */
  SOURCE?: BrevoSource;
  /** User's first name (if available) */
  FIRSTNAME?: string;
  /** User's last name (if available) */
  LASTNAME?: string;
  /** Stripe customer ID for reference */
  STRIPE_CUSTOMER_ID?: string;
  /** Trial end date (ISO string) */
  TRIAL_ENDS_AT?: string;
  /** Current period end date (ISO string) */
  SUBSCRIPTION_ENDS_AT?: string;
}

export interface UpsertContactParams {
  email: string;
  attributes: BrevoContactAttributes;
  /** List IDs to add the contact to (system list) */
  listIds?: number[];
}

export interface BrevoApiError {
  code: string;
  message: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Price ID → Plan Mapping
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Known production Stripe price IDs mapped to plan names
 * 
 * IMPORTANT: Only these price IDs will trigger Brevo updates.
 * Test/development price IDs are intentionally excluded.
 */
export const PRICE_ID_TO_PLAN: Record<string, BrevoPlan> = {
  'price_1ScAHwDNAgNbsqnmrkM790vG': 'hit_rates',
  'price_1SMSbxDNAgNbsqnmE0QYhApx': 'pro_monthly',
  'price_1SMScHDNAgNbsqnmsQw8AaCh': 'pro_yearly',
};

/**
 * Check if a price ID is a known production price
 */
export function isKnownPriceId(priceId: string | undefined | null): boolean {
  if (!priceId) return false;
  return priceId in PRICE_ID_TO_PLAN;
}

/**
 * Get the plan name for a Stripe price ID
 * Returns null if price ID is not recognized (test/unknown)
 */
export function getPlanFromPriceId(priceId: string | undefined | null): BrevoPlan {
  if (!priceId) return null;
  return PRICE_ID_TO_PLAN[priceId] || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Stripe Status → Lifecycle Mapping
// ═══════════════════════════════════════════════════════════════════════════════

export interface SubscriptionData {
  status: string;
  cancel_at_period_end: boolean;
  current_period_end?: number; // Unix timestamp
}

/**
 * Map Stripe subscription status to Brevo lifecycle stage
 */
export function getLifecycleFromSubscription(sub: SubscriptionData): BrevoLifecycle {
  const { status, cancel_at_period_end, current_period_end } = sub;
  
  // Handle trialing first
  if (status === 'trialing') {
    return 'trialing';
  }
  
  // Active subscription
  if (status === 'active') {
    // Check if user has scheduled cancellation
    if (cancel_at_period_end) {
      // Double-check if period has actually ended
      if (current_period_end && Date.now() >= current_period_end * 1000) {
        return 'cancelled';
      }
      return 'canceling';
    }
    return 'active_paid';
  }
  
  // Payment issues - still has access but payment failed
  if (status === 'past_due' || status === 'unpaid') {
    return 'inactive_paid';
  }
  
  // Subscription ended
  if (status === 'canceled' || status === 'cancelled' || status === 'incomplete_expired') {
    return 'cancelled';
  }
  
  // Incomplete subscription (checkout not completed) - treat as lead
  if (status === 'incomplete') {
    return 'lead';
  }
  
  // Default fallback - shouldn't normally reach here
  console.warn('[brevo] Unknown subscription status:', status);
  return 'lead';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Brevo API Client
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Upsert a contact in Brevo (create or update)
 * 
 * Uses POST /v3/contacts with updateEnabled: true for idempotent upsert.
 * This is the primary method for syncing user data with Brevo.
 * 
 * @param params - Contact email and attributes to set
 * @returns true if successful, false if failed (logs error)
 */
export async function upsertBrevoContact(params: UpsertContactParams): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const systemListId = process.env.BREVO_SYSTEM_LIST_ID;
  
  if (!apiKey) {
    console.warn('[brevo] BREVO_API_KEY not configured - skipping contact upsert');
    return false;
  }
  
  if (!systemListId) {
    console.warn('[brevo] BREVO_SYSTEM_LIST_ID not configured - skipping contact upsert');
    return false;
  }
  
  const { email, attributes, listIds = [parseInt(systemListId, 10)] } = params;
  
  // Clean up attributes - remove undefined values
  const cleanAttributes: Record<string, any> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) {
      cleanAttributes[key] = value;
    }
  }
  
  const payload = {
    email,
    attributes: cleanAttributes,
    listIds,
    updateEnabled: true, // Idempotent upsert
  };
  
  console.log('[brevo] Upserting contact:', {
    email: email.replace(/(.{2}).*@/, '$1***@'),
    attributes: cleanAttributes,
    listIds,
  });
  
  try {
    const response = await fetch(`${BREVO_API_URL}/contacts`, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    // Brevo returns 201 for create, 204 for update
    if (response.ok || response.status === 201 || response.status === 204) {
      console.log('[brevo] Contact upserted successfully:', email.replace(/(.{2}).*@/, '$1***@'));
      return true;
    }
    
    // Handle errors
    const errorText = await response.text();
    let errorData: BrevoApiError | null = null;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      // Not JSON error response
    }
    
    console.error('[brevo] Failed to upsert contact:', {
      status: response.status,
      error: errorData || errorText,
      email: email.replace(/(.{2}).*@/, '$1***@'),
    });
    
    return false;
  } catch (error) {
    console.error('[brevo] Network error upserting contact:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// High-Level Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sync a new signup to Brevo as a lead
 * Call this when a user creates an account (before any subscription)
 */
export async function syncNewSignupToBrevo(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  newsletterOptIn?: boolean;
  source?: BrevoSource;
}): Promise<boolean> {
  const { email, firstName, lastName, newsletterOptIn = true, source = 'app_signup' } = params;
  
  return upsertBrevoContact({
    email,
    attributes: {
      LIFECYCLE: 'lead',
      SOURCE: source,
      NEWSLETTER_OPT_IN: newsletterOptIn,
      ...(firstName && { FIRSTNAME: firstName }),
      ...(lastName && { LASTNAME: lastName }),
    },
  });
}

/**
 * Sync a Stripe subscription update to Brevo
 * Call this from Stripe webhook handlers
 */
export async function syncSubscriptionToBrevo(params: {
  email: string;
  priceId: string | undefined;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: number;
  trialEnd?: number;
  stripeCustomerId?: string;
}): Promise<boolean> {
  const { 
    email, 
    priceId, 
    status, 
    cancelAtPeriodEnd, 
    currentPeriodEnd,
    trialEnd,
    stripeCustomerId,
  } = params;
  
  // Skip test/unknown price IDs
  if (!isKnownPriceId(priceId)) {
    console.log('[brevo] Skipping sync for unknown/test price ID:', priceId);
    return true; // Return true to not block webhook
  }
  
  const lifecycle = getLifecycleFromSubscription({
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    current_period_end: currentPeriodEnd,
  });
  
  const plan = getPlanFromPriceId(priceId);
  
  const attributes: BrevoContactAttributes = {
    LIFECYCLE: lifecycle,
    PLAN: plan,
    STRIPE_PRICE_ID: priceId,
  };
  
  // Add optional fields
  if (stripeCustomerId) {
    attributes.STRIPE_CUSTOMER_ID = stripeCustomerId;
  }
  
  if (trialEnd) {
    attributes.TRIAL_ENDS_AT = new Date(trialEnd * 1000).toISOString();
  }
  
  if (currentPeriodEnd) {
    attributes.SUBSCRIPTION_ENDS_AT = new Date(currentPeriodEnd * 1000).toISOString();
  }
  
  return upsertBrevoContact({
    email,
    attributes,
  });
}

/**
 * Mark a contact as cancelled in Brevo
 * Call this when a subscription is fully cancelled/deleted
 */
export async function markContactCancelled(email: string): Promise<boolean> {
  return upsertBrevoContact({
    email,
    attributes: {
      LIFECYCLE: 'cancelled',
    },
  });
}
