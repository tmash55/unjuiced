/**
 * Customer.io Tracking API
 *
 * Provides helpers for identifying customers and tracking events
 * via the Customer.io Track API v1.
 *
 * All calls are non-blocking — errors are logged but never thrown,
 * so they won't fail the calling webhook.
 */

const CUSTOMERIO_API_URL = 'https://track.customer.io/api/v1';

function getAuthHeader(): string {
  const siteId = process.env.CUSTOMERIO_SITE_ID;
  const apiKey = process.env.CUSTOMERIO_API_KEY;
  if (!siteId || !apiKey) {
    console.warn('[customerio] Missing CUSTOMERIO_SITE_ID or CUSTOMERIO_API_KEY');
    return '';
  }
  return `Basic ${Buffer.from(`${siteId}:${apiKey}`).toString('base64')}`;
}

/**
 * Identify (create or update) a customer in Customer.io.
 * identifier = Supabase user_id
 */
export async function identifyCustomer(
  userId: string,
  attributes: Record<string, any>
): Promise<void> {
  try {
    const auth = getAuthHeader();
    if (!auth) return;

    const res = await fetch(`${CUSTOMERIO_API_URL}/customers/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attributes),
    });

    if (!res.ok) {
      console.error(`[customerio] identifyCustomer failed (${res.status}):`, await res.text().catch(() => ''));
    } else {
      console.log('[customerio] Identified customer', userId);
    }
  } catch (e) {
    console.error('[customerio] identifyCustomer error:', (e as any)?.message);
  }
}

/**
 * Track an event for a customer in Customer.io.
 */
export async function trackEvent(
  userId: string,
  eventName: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const auth = getAuthHeader();
    if (!auth) return;

    const res = await fetch(`${CUSTOMERIO_API_URL}/customers/${encodeURIComponent(userId)}/events`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: eventName, data: data || {} }),
    });

    if (!res.ok) {
      console.error(`[customerio] trackEvent "${eventName}" failed (${res.status}):`, await res.text().catch(() => ''));
    } else {
      console.log('[customerio] Tracked event', eventName, 'for', userId);
    }
  } catch (e) {
    console.error('[customerio] trackEvent error:', (e as any)?.message);
  }
}
