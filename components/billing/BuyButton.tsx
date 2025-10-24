"use client";

import React from "react";
import { Button } from "@/components/button";

interface BuyButtonProps {
  priceId: string; // Stripe price id
  mode?: "subscription" | "payment";
  couponId?: string | null;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function BuyButton({ priceId, mode = "subscription", couponId = null, label = "Upgrade", className, disabled }: BuyButtonProps) {
  const [loading, setLoading] = React.useState(false);

  const onClick = async () => {
    if (!priceId || loading) return;
    setLoading(true);
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('[BuyButton] creating checkout', { priceId, mode, couponId });
      }
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, mode, couponId }),
      });
      if (res.status === 401) {
        const params = new URLSearchParams({ priceId, mode, ...(couponId ? { couponId } : {}) }).toString();
        const redirectTarget = `/billing/start?${params}`;
        // Send to register (or login) with a redirect back to a protected starter route
        if (process.env.NODE_ENV === 'development') {
          console.log('[BuyButton] not authenticated → redirecting to register with redirectTo', redirectTarget);
        }
        window.location.assign(`/register?redirectTo=${encodeURIComponent(redirectTarget)}`);
        return;
      }
      const json = await res.json();
      if (process.env.NODE_ENV === 'development') {
        console.log('[BuyButton] checkout response', { status: res.status, url: json?.url });
      }
      if (json?.url) {
        window.location.assign(json.url);
      }
    } catch (e) {
      console.error("[BuyButton] checkout error", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={onClick} disabled={disabled || loading} className={className}>
      {loading ? "Redirecting…" : label}
    </button>
  );
}


