"use client";

import { useMemo } from "react";

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
 * Hook to read partner coupon data from the dub_partner_data cookie
 * Returns the appropriate coupon ID based on environment
 */
export function usePartnerCoupon() {
  const partnerData = useMemo(() => {
    if (typeof window === "undefined") return null;
    
    try {
      const cookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("dub_partner_data="));
      
      if (!cookie) return null;
      
      const value = cookie.split("=")[1];
      const decoded = decodeURIComponent(value);
      return JSON.parse(decoded) as PartnerData;
    } catch {
      return null;
    }
  }, []);

  const couponId = useMemo(() => {
    if (!partnerData?.discount) return null;
    
    // Use test coupon in development, production coupon in production
    if (process.env.NODE_ENV === "development") {
      return partnerData.discount.couponTestId || partnerData.discount.couponId || null;
    }
    return partnerData.discount.couponId || null;
  }, [partnerData]);

  return {
    partnerData,
    couponId,
    hasPartner: !!partnerData?.partner,
    discount: partnerData?.discount || null,
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

