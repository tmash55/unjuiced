"use client";

import { useMemo, useEffect, useState } from "react";

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

// Test partner data for local development
// Usage: Add ?test_partner=true to any URL
const TEST_PARTNER_DATA: PartnerData = {
  clickId: "test_click_123",
  partner: {
    id: "pn_test",
    name: "Test Partner",
    image: undefined,
  },
  discount: {
    id: "disc_test",
    amount: 25,
    type: "percentage",
    // Replace these with your actual Stripe coupon IDs for testing
    couponId: process.env.NEXT_PUBLIC_TEST_COUPON_ID || undefined,
    couponTestId: process.env.NEXT_PUBLIC_TEST_COUPON_ID || undefined,
  },
};

/**
 * Hook to read partner coupon data from the dub_partner_data cookie
 * Returns the appropriate coupon ID based on environment
 * 
 * For local testing, add ?test_partner=true to the URL
 */
export function usePartnerCoupon() {
  const [isTestMode, setIsTestMode] = useState(false);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const testMode = params.get("test_partner") === "true";
      if (testMode) {
        setIsTestMode(true);
        // Also set the cookie so it persists across pages
        document.cookie = `dub_partner_data=${encodeURIComponent(JSON.stringify(TEST_PARTNER_DATA))};path=/;max-age=3600`;
      }
    }
  }, []);

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
  }, [isTestMode]); // Re-read cookie when test mode changes

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
    isTestMode,
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

