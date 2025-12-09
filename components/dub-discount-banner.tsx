"use client";

import { useAnalytics } from "@dub/analytics/react";
import { X, Gift } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/libs/supabase/client";

// Test data for local development - append ?test_discount=true to URL
const TEST_PARTNER = {
  id: "pn_test",
  name: "Tyler Maschoff",
  image: "https://avatar.vercel.sh/tyler",
};

const TEST_DISCOUNT = {
  id: "disc_test",
  amount: 30,
  type: "percentage" as const,
  maxDuration: 1,
  // Don't include a fake couponId - the banner is just for display
  // Real coupon comes from the actual Dub cookie
};

// Helper to safely decode URL-encoded strings
function safeDecodeURIComponent(str: string | null | undefined): string | null | undefined {
  if (!str) return str;
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export function DubDiscountBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isTestMode = searchParams.get("test_discount") === "true";
  
  const analytics = useAnalytics();
  
  // Use test data in test mode, otherwise use real analytics data
  const rawPartner = isTestMode ? TEST_PARTNER : analytics?.partner;
  const discount = isTestMode ? TEST_DISCOUNT : analytics?.discount;
  
  // Decode URL-encoded partner data from Dub
  const partner = rawPartner ? {
    ...rawPartner,
    name: safeDecodeURIComponent(rawPartner.name) || rawPartner.name,
    image: safeDecodeURIComponent(rawPartner.image) || rawPartner.image,
  } : null;
  
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  const [showPopup, setShowPopup] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check if user is signed in
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsSignedIn(!!user);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    // Don't show if user is signed in, not mounted, or no partner/discount data
    if (!partner || !discount || !mounted || isSignedIn === null || isSignedIn) return;

    // Check if user has seen the popup before
    const hasSeenPopup = localStorage.getItem("dub_discount_popup_seen");
    
    if (!hasSeenPopup) {
      // Show popup on first visit
      setShowPopup(true);
    } else {
      // Show banner if popup was already seen
      const bannerDismissed = localStorage.getItem("dub_discount_banner_dismissed");
      if (!bannerDismissed) {
        setShowBanner(true);
      }
    }
  }, [partner, discount, mounted, isSignedIn]);

  // Don't render anything on server, if no data, if dismissed, or if user is signed in
  if (!mounted || !partner || !discount || dismissed || isSignedIn) {
    return null;
  }

  const discountText = discount.type === "percentage" 
    ? `${discount.amount}% off` 
    : `$${discount.amount} off`;

  const durationText = discount.maxDuration 
    ? `for ${discount.maxDuration} month${discount.maxDuration > 1 ? 's' : ''}` 
    : '';

  const handleClosePopup = (navigateToPricing = false) => {
    localStorage.setItem("dub_discount_popup_seen", "true");
    setShowPopup(false);
    setShowBanner(true);
    if (navigateToPricing) {
      router.push("/pricing");
    }
  };

  const handleCloseBanner = () => {
    localStorage.setItem("dub_discount_banner_dismissed", "true");
    setShowBanner(false);
    setDismissed(true);
  };

  // Clear test data (for testing)
  const handleClearTestData = () => {
    localStorage.removeItem("dub_discount_popup_seen");
    localStorage.removeItem("dub_discount_banner_dismissed");
    window.location.reload();
  };

  // Popup Modal
  if (showPopup) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          {/* Close button */}
          <button
            onClick={() => handleClosePopup(false)}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>

          {/* Content */}
          <div className="p-6 pt-8 flex flex-col items-center text-center">
            {/* Partner Avatar */}
            {partner.image ? (
              <img
                src={partner.image}
                alt={partner.name}
                className="w-16 h-16 rounded-full border-4 border-emerald-100 dark:border-emerald-900/50 shadow-lg mb-4"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg mb-4">
                <Gift className="w-8 h-8 text-white" />
              </div>
            )}

            {/* Heading */}
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              {partner.name} has gifted you
              <br />
              <span className="text-emerald-600 dark:text-emerald-400">
                {discountText} {durationText}!
              </span>
            </h2>

            {/* Subtext */}
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
              Your discount will be automatically applied when you purchase a paid plan.
            </p>

            {/* CTA Button */}
            <button
              onClick={() => handleClosePopup(true)}
              className="w-full py-3 px-6 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
            >
              View plans
            </button>

            {/* Test mode indicator */}
            {isTestMode && (
              <button
                onClick={handleClearTestData}
                className="mt-3 text-xs text-neutral-400 hover:text-neutral-600 underline"
              >
                Reset test data
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Top Banner (shows after popup is closed) - NOT fixed, pushes content down
  if (showBanner) {
    return (
      <div className="relative z-50 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 py-2 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 sm:gap-3 relative">
          {partner.image && (
            <img
              src={partner.image}
              alt={partner.name}
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white/30 shrink-0"
            />
          )}
          <p className="text-xs sm:text-sm font-medium text-center pr-6">
            <span className="font-semibold">{partner.name}</span>
            <span className="hidden xs:inline"> gifted you</span>
            <span className="xs:hidden"> →</span>{" "}
            <span className="font-bold">{discountText}</span>
            <span className="hidden sm:inline"> {durationText}</span>
            <span className="hidden md:inline opacity-90"> • Applied at checkout</span>
          </p>
          <button
            onClick={handleCloseBanner}
            className="absolute right-1 sm:right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Test mode indicator */}
        {isTestMode && (
          <button
            onClick={handleClearTestData}
            className="absolute bottom-full right-2 mb-1 text-[10px] bg-black/50 text-white px-2 py-0.5 rounded"
          >
            Reset test
          </button>
        )}
      </div>
    );
  }

  return null;
}
