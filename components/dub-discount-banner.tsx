"use client";

import { useAnalytics } from "@dub/analytics/react";
import { X } from "lucide-react";
import { useState } from "react";

export function DubDiscountBanner() {
  const { partner, discount } = useAnalytics();
  const [dismissed, setDismissed] = useState(false);

  if (!partner || !discount || dismissed) {
    return null;
  }

  const discountText = discount.type === "percentage" 
    ? `${discount.amount}% off` 
    : `$${discount.amount} off`;

  const durationText = discount.maxDuration 
    ? `for ${discount.maxDuration} month${discount.maxDuration > 1 ? 's' : ''}` 
    : '';

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2.5 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 relative">
        {partner.image && (
          <img
            src={partner.image}
            alt={partner.name}
            className="w-7 h-7 rounded-full border-2 border-white/30 shrink-0"
          />
        )}
        <p className="text-sm font-medium text-center">
          <span className="font-semibold">{partner.name}</span> has gifted you{" "}
          <span className="font-bold">{discountText}</span> {durationText}!
          <span className="opacity-80 ml-1">
            Applied automatically at checkout.
          </span>
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-0 p-1 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

