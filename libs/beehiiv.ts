/**
 * BeeHiiv Subscriber Management
 *
 * This module provides helpers for syncing user data with BeeHiiv
 * for email marketing, newsletters, and lifecycle messaging.
 */

const BEEHIIV_API_URL = 'https://api.beehiiv.com/v2';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * User lifecycle stages for BeeHiiv segmentation
 * - lead: Account created, no active subscription/trial
 * - trialing: Stripe subscription status = trialing
 * - active: Stripe subscription active, not canceling
 * - canceling: Stripe subscription active + cancel_at_period_end = true
 * - cancelled: Subscription ended / canceled
 * - churned: Was active, now cancelled (for win-back campaigns)
 */
export type BeeHiivLifecycle =
  | 'lead'
  | 'trialing'
  | 'active'
  | 'canceling'
  | 'cancelled'
  | 'churned';

/**
 * Plan names for BeeHiiv custom fields
 */
export type BeeHiivPlan = 'free' | 'scout' | 'sharp' | 'edge' | null;

/**
 * BeeHiiv custom fields we track
 * Field names must match what's configured in BeeHiiv dashboard
 */
export interface BeeHiivCustomFields {
  /** User's plan tier */
  plan?: BeeHiivPlan | string;
  /** Raw Stripe price ID */
  stripe_price_id?: string;
  /** Current lifecycle stage */
  lifecycle?: BeeHiivLifecycle;
  /** User's first name */
  first_name?: string;
  /** User's last name */
  last_name?: string;
  /** Trial end date (ISO string) */
  trial_ends_at?: string;
  /** Last login timestamp (ISO string) */
  last_login_at?: string;
}

export interface UpsertSubscriberParams {
  email: string;
  customFields?: BeeHiivCustomFields;
  /** UTM source for tracking */
  utmSource?: string;
  /** Whether to send double opt-in email (default: false for app signups) */
  sendWelcomeEmail?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Price ID → Plan Mapping
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map Stripe price IDs to plan names
 */
export const PRICE_ID_TO_PLAN: Record<string, BeeHiivPlan> = {
  // Sandbox price IDs
  'price_1SwQGeDHoRr1ai9XaPwfXaSR': 'scout',
  'price_1SwQHHDHoRr1ai9XHWAZBHxE': 'scout',
  'price_1SwQHpDHoRr1ai9XG5KgYpjq': 'sharp',
  'price_1SwQIFDHoRr1ai9XMYYvBaLY': 'sharp',
  'price_1SwQIgDHoRr1ai9XaVvzPu5t': 'edge',
  'price_1SwQItDHoRr1ai9XFYDFVtuR': 'edge',
  // Legacy price IDs
  'price_1Sc9RcDHoRr1ai9XRMhGYWbE': 'scout', // Old hit rate test
  'price_1ScAHwDNAgNbsqnmrkM790vG': 'scout', // Old hit rate prod
  'price_1SKiDjDHoRr1ai9XQTH0H9iV': 'sharp', // Old pro monthly
  'price_1SKiFTDHoRr1ai9XCF5wywQO': 'sharp', // Old pro yearly
  // Add production price IDs here when created
};

/**
 * Get plan name from Stripe price ID
 */
export function getPlanFromPriceId(priceId: string | undefined | null): BeeHiivPlan {
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
 * Map Stripe subscription status to BeeHiiv lifecycle stage
 */
export function getLifecycleFromSubscription(sub: SubscriptionData): BeeHiivLifecycle {
  const { status, cancel_at_period_end, current_period_end } = sub;

  if (status === 'trialing') {
    return 'trialing';
  }

  if (status === 'active') {
    if (cancel_at_period_end) {
      if (current_period_end && Date.now() >= current_period_end * 1000) {
        return 'cancelled';
      }
      return 'canceling';
    }
    return 'active';
  }

  if (status === 'past_due' || status === 'unpaid') {
    return 'active'; // Still has access, just payment issues
  }

  if (status === 'canceled' || status === 'cancelled' || status === 'incomplete_expired') {
    return 'cancelled';
  }

  return 'lead';
}

// ═══════════════════════════════════════════════════════════════════════════════
// BeeHiiv API Client
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create or update a subscriber in BeeHiiv
 *
 * Uses the BeeHiiv API to upsert subscribers with custom fields.
 * https://developers.beehiiv.com/docs/v2/post-publications-publication-id-subscriptions
 */
export async function upsertBeeHiivSubscriber(params: UpsertSubscriberParams): Promise<boolean> {
  const apiKey = process.env.BEEHIIV_API_KEY;
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID;

  if (!apiKey) {
    console.warn('[beehiiv] BEEHIIV_API_KEY not configured - skipping subscriber upsert');
    return false;
  }

  if (!publicationId) {
    console.warn('[beehiiv] BEEHIIV_PUBLICATION_ID not configured - skipping subscriber upsert');
    return false;
  }

  const { email, customFields = {}, utmSource = 'app', sendWelcomeEmail = false } = params;

  // Build custom fields array for BeeHiiv API
  // BeeHiiv expects custom_fields as an array of { name, value } objects
  const customFieldsArray: { name: string; value: string }[] = [];

  if (customFields.plan) {
    customFieldsArray.push({ name: 'Plan', value: customFields.plan });
  }
  if (customFields.stripe_price_id) {
    customFieldsArray.push({ name: 'Stripe Price ID', value: customFields.stripe_price_id });
  }
  if (customFields.lifecycle) {
    customFieldsArray.push({ name: 'Life cycle', value: customFields.lifecycle });
  }
  if (customFields.first_name) {
    customFieldsArray.push({ name: 'First Name', value: customFields.first_name });
  }
  if (customFields.last_name) {
    customFieldsArray.push({ name: 'Last Name', value: customFields.last_name });
  }
  if (customFields.trial_ends_at) {
    customFieldsArray.push({ name: 'Trial Ends At', value: customFields.trial_ends_at });
  }
  if (customFields.last_login_at) {
    customFieldsArray.push({ name: 'Last Login At', value: customFields.last_login_at });
  }

  const payload = {
    email,
    reactivate_existing: true, // Re-subscribe if previously unsubscribed
    send_welcome_email: sendWelcomeEmail,
    utm_source: utmSource,
    double_opt_in: 'off', // Skip double opt-in for app signups - they're already verified
    custom_fields: customFieldsArray.length > 0 ? customFieldsArray : undefined,
  };

  console.log('[beehiiv] Upserting subscriber:', {
    email: email.replace(/(.{2}).*@/, '$1***@'),
    customFields: customFieldsArray,
  });

  try {
    const response = await fetch(`${BEEHIIV_API_URL}/publications/${publicationId}/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[beehiiv] Subscriber upserted successfully:', {
        email: email.replace(/(.{2}).*@/, '$1***@'),
        subscriberId: data?.data?.id,
        status: data?.data?.status,
      });
      return true;
    }

    const errorText = await response.text();
    console.error('[beehiiv] Failed to upsert subscriber:', {
      status: response.status,
      error: errorText,
      email: email.replace(/(.{2}).*@/, '$1***@'),
    });

    return false;
  } catch (error) {
    console.error('[beehiiv] Network error upserting subscriber:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// High-Level Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sync a new signup to BeeHiiv as a lead
 * Call this when a user creates an account (before any subscription)
 */
export async function syncNewSignupToBeeHiiv(params: {
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<boolean> {
  const { email, firstName, lastName } = params;

  return upsertBeeHiivSubscriber({
    email,
    utmSource: 'app_signup',
    customFields: {
      lifecycle: 'lead',
      plan: 'free',
      first_name: firstName,
      last_name: lastName,
    },
  });
}

/**
 * Sync a Stripe subscription update to BeeHiiv
 * Call this from Stripe webhook handlers
 */
export async function syncSubscriptionToBeeHiiv(params: {
  email: string;
  priceId: string | undefined;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: number;
  trialEnd?: number;
  firstName?: string;
  lastName?: string;
}): Promise<boolean> {
  const {
    email,
    priceId,
    status,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    trialEnd,
    firstName,
    lastName,
  } = params;

  const lifecycle = getLifecycleFromSubscription({
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    current_period_end: currentPeriodEnd,
  });

  const plan = getPlanFromPriceId(priceId);

  const customFields: BeeHiivCustomFields = {
    lifecycle,
    plan: plan || 'free',
    stripe_price_id: priceId,
  };

  if (firstName) {
    customFields.first_name = firstName;
  }
  if (lastName) {
    customFields.last_name = lastName;
  }
  if (trialEnd) {
    customFields.trial_ends_at = new Date(trialEnd * 1000).toISOString();
  }

  return upsertBeeHiivSubscriber({
    email,
    customFields,
  });
}

/**
 * Update last login timestamp in BeeHiiv
 * Call this on user login to track engagement
 */
export async function updateLastLoginInBeeHiiv(email: string): Promise<boolean> {
  return upsertBeeHiivSubscriber({
    email,
    customFields: {
      last_login_at: new Date().toISOString(),
    },
  });
}

/**
 * Mark a subscriber as cancelled in BeeHiiv
 * Call this when a subscription is fully cancelled
 */
export async function markSubscriberCancelled(email: string): Promise<boolean> {
  return upsertBeeHiivSubscriber({
    email,
    customFields: {
      lifecycle: 'cancelled',
      plan: 'free',
    },
  });
}
