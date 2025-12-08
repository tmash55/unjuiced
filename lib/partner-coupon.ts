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
}

/**
 * Utility function to read partner discount data from cookie (for server-side use)
 * Returns both couponId and promotionCodeId - prefer promotionCodeId if available
 */
export function getPartnerDiscountFromCookie(cookieHeader: string | null): PartnerDiscountResult {
  if (!cookieHeader) return { couponId: null, promotionCodeId: null };
  
  try {
    const cookie = cookieHeader
      .split("; ")
      .find((row) => row.startsWith("dub_partner_data="));
    
    if (!cookie) return { couponId: null, promotionCodeId: null };
    
    const value = cookie.split("=")[1];
    const decoded = decodeURIComponent(value);
    const partnerData = JSON.parse(decoded) as PartnerData;
    
    const discount = partnerData.discount;
    if (!discount) return { couponId: null, promotionCodeId: null };
    
    // Use test IDs in development, production IDs in production
    if (process.env.NODE_ENV === "development") {
      return {
        couponId: discount.couponTestId || discount.couponId || null,
        promotionCodeId: discount.promotionCodeTestId || discount.promotionCodeId || null,
      };
    }
    return {
      couponId: discount.couponId || null,
      promotionCodeId: discount.promotionCodeId || null,
    };
  } catch {
    return { couponId: null, promotionCodeId: null };
  }
}

/**
 * @deprecated Use getPartnerDiscountFromCookie instead
 */
export function getPartnerCouponFromCookie(cookieHeader: string | null): string | null {
  const { couponId } = getPartnerDiscountFromCookie(cookieHeader);
  return couponId;
}

