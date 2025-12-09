/**
 * Server-side utility to read partner coupon/promo from cookie
 * This file is NOT marked as "use client" so it can be used in API routes
 */

interface PartnerData {
  clickId?: string;
  partner?: {
    id: string;
    name: string;
    image?: string;
  };
  discount?: {
    id: string;
    amount: number;
    type: "percentage" | "fixed";
    maxDuration?: number;
    couponId?: string;
    couponTestId?: string;
    // Promotion code IDs (starts with promo_)
    promotionCodeId?: string;
    promotionCodeTestId?: string;
  };
}

interface PartnerDiscountResult {
  couponId: string | null;
  promotionCodeId: string | null;
  partnerName: string | null;
}

/**
 * Validate that a coupon ID looks like a real Stripe coupon
 * Stripe coupon IDs are alphanumeric and typically short (e.g., "1Ry5Zesp")
 * This prevents test placeholder strings from being sent to Stripe
 */
function isValidCouponId(id: string | undefined | null): boolean {
  if (!id) return false;
  // Must be alphanumeric, between 4-50 chars, no spaces or special placeholder patterns
  if (id.length < 4 || id.length > 50) return false;
  if (id.includes(" ") || id.includes("_")) return false;
  if (id.toLowerCase().includes("your") || id.toLowerCase().includes("test_coupon")) return false;
  return /^[a-zA-Z0-9]+$/.test(id);
}

/**
 * Validate that a promotion code ID looks like a real Stripe promo code
 * Stripe promotion code IDs start with "promo_"
 */
function isValidPromotionCodeId(id: string | undefined | null): boolean {
  if (!id) return false;
  return id.startsWith("promo_") && id.length > 10;
}

/**
 * Utility function to read partner discount data from cookie (for server-side use)
 * Returns both couponId and promotionCodeId - prefer promotionCodeId if available
 */
export function getPartnerDiscountFromCookie(cookieHeader: string | null): PartnerDiscountResult {
  if (!cookieHeader) return { couponId: null, promotionCodeId: null, partnerName: null };
  
  try {
    const cookie = cookieHeader
      .split("; ")
      .find((row) => row.startsWith("dub_partner_data="));
    
    if (!cookie) return { couponId: null, promotionCodeId: null, partnerName: null };
    
    const value = cookie.split("=")[1];
    const decoded = decodeURIComponent(value);
    const partnerData = JSON.parse(decoded) as PartnerData;
    
    const discount = partnerData.discount;
    if (!discount) return { couponId: null, promotionCodeId: null, partnerName: null };
    
    // Get partner name (decode URL encoding like "Tyler%20Maschoff" → "Tyler Maschoff")
    let partnerName: string | null = null;
    if (partnerData.partner?.name) {
      try {
        partnerName = decodeURIComponent(partnerData.partner.name);
      } catch {
        partnerName = partnerData.partner.name;
      }
    }
    
    // Use test IDs in development, production IDs in production
    let couponId: string | null = null;
    let promotionCodeId: string | null = null;
    
    if (process.env.NODE_ENV === "development") {
      couponId = discount.couponTestId || discount.couponId || null;
      promotionCodeId = discount.promotionCodeTestId || discount.promotionCodeId || null;
    } else {
      couponId = discount.couponId || null;
      promotionCodeId = discount.promotionCodeId || null;
    }
    
    // Validate IDs before returning - don't send invalid/placeholder IDs to Stripe
    return {
      couponId: isValidCouponId(couponId) ? couponId : null,
      promotionCodeId: isValidPromotionCodeId(promotionCodeId) ? promotionCodeId : null,
      partnerName,
    };
  } catch {
    return { couponId: null, promotionCodeId: null, partnerName: null };
  }
}

/**
 * @deprecated Use getPartnerDiscountFromCookie instead
 */
export function getPartnerCouponFromCookie(cookieHeader: string | null): string | null {
  const { couponId } = getPartnerDiscountFromCookie(cookieHeader);
  return couponId;
}

