/**
 * Server-side utility to read partner coupon from cookie
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
  };
}

/**
 * Utility function to read partner coupon from cookie (for server-side use)
 */
export function getPartnerCouponFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  
  try {
    const cookie = cookieHeader
      .split("; ")
      .find((row) => row.startsWith("dub_partner_data="));
    
    if (!cookie) return null;
    
    const value = cookie.split("=")[1];
    const decoded = decodeURIComponent(value);
    const partnerData = JSON.parse(decoded) as PartnerData;
    
    // Use test coupon in development, production coupon in production
    if (process.env.NODE_ENV === "development") {
      return partnerData.discount?.couponTestId || partnerData.discount?.couponId || null;
    }
    return partnerData.discount?.couponId || null;
  } catch {
    return null;
  }
}

