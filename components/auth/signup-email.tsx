"use client";

import { Button } from "@/components/button";
import { FormEvent, useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Input } from "../ui/input";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/libs/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRegisterContext } from "./register/context";
import { useMediaQuery } from "@/hooks/use-media-query";
import posthog from "posthog-js";

// Zod schema for sign up
const signUpSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().max(50, "Last name must be less than 50 characters").optional(),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters"),
});

type SignUpProps = z.infer<typeof signUpSchema>;

export const SignUpEmail = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || searchParams.get("redirect");
  const supabase = createClient();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { setEmail, setPassword, setStep, email: contextEmail, lockEmail } = useRegisterContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<SignUpProps>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: contextEmail || "",
      password: "",
    },
  });

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      // Submit the form directly
      await handleSubmit(async (data) => {
        setIsSubmitting(true);
        try {
          // Update context
          setEmail(data.email);
          setPassword(data.password);

          // Determine where to redirect after signup
          // Default to app subdomain /today
          const nextUrl = redirectTo || "/today";
          
          // Build the callback URL - pass redirectTo for cross-subdomain redirect
          const callbackUrl = redirectTo
            ? `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`
            : `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`;
          
          // Clean and trim name fields
          const firstName = data.firstName?.trim() || undefined;
          const lastName = data.lastName?.trim() || undefined;
          const fullName = [firstName, lastName].filter(Boolean).join(' ') || undefined;

          const { data: signUpData, error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
              emailRedirectTo: callbackUrl,
              data: {
                // Store name in user metadata (same format as Google OAuth)
                full_name: fullName,
                first_name: firstName,
                last_name: lastName,
              },
            },
          });

          if (error) throw error;

          // Track referral with FirstPromoter (production only)
          if (typeof window !== "undefined" && typeof (window as any).fpr === "function") {
            try {
              (window as any).fpr("referral", { email: data.email });
              console.log("[FirstPromoter] Tracked referral for:", data.email);
            } catch (e) {
              console.warn("[FirstPromoter] Failed to track referral:", e);
            }
          }

          // Check if email confirmation is disabled (user is immediately confirmed)
          if (signUpData.user && signUpData.session) {
            // Identify user in PostHog and capture signup event
            posthog.identify(signUpData.user.id, {
              email: data.email,
              name: fullName,
              first_name: firstName,
              last_name: lastName,
            });
            posthog.capture("user_signed_up", {
              method: "email",
              email: data.email,
            });

            // Track lead with Dub (for referral attribution)
            try {
              const leadResponse = await fetch('/api/track/lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: signUpData.user.id,
                  email: data.email,
                  name: signUpData.user.user_metadata?.full_name || signUpData.user.user_metadata?.name,
                  avatar: signUpData.user.user_metadata?.avatar_url,
                }),
              });
              const leadResult = await leadResponse.json();
              console.log('[Dub] Lead tracking result:', leadResult);
            } catch (leadError) {
              console.warn('[Dub] Failed to track lead:', leadError);
            }
            
            // Sync to BeeHiiv as a lead
            try {
              const beehiivResponse = await fetch('/api/track/beehiiv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: data.email,
                  firstName,
                  lastName,
                }),
              });
              const beehiivResult = await beehiivResponse.json();
              console.log('[BeeHiiv] Lead sync result:', beehiivResult);
            } catch (beehiivError) {
              console.warn('[BeeHiiv] Failed to sync lead:', beehiivError);
            }
            
            // User is automatically signed in - redirect to destination
            toast.success("Account created! 🎉", {
              description: "Redirecting you to continue.",
              duration: 2500,
            });

            setTimeout(() => {
              const destination = nextUrl;
              window.location.href = destination.startsWith("http")
                ? destination
                : `${window.location.origin}${destination}`;
            }, 500);
          } else {
            // Email confirmation is required
            toast.success("Check your email!", {
              description:
                "We sent you a confirmation link to complete your registration.",
              duration: 5000,
            });

            // Transition to verify step
            setStep("verify");
          }
        } catch (error) {
          // Capture error in PostHog
          posthog.captureException(error);

          // Handle specific Supabase error messages
          let errorMessage = "Failed to create account. Please try again.";

          if (error instanceof Error) {
            const message = error.message.toLowerCase();
            
            // Check for common Supabase errors
            if (message.includes("already registered") || message.includes("already exists")) {
              errorMessage = "This email is already registered. Try logging in instead.";
            } else if (message.includes("invalid email")) {
              errorMessage = "Please enter a valid email address.";
            } else if (message.includes("password")) {
              errorMessage = "Password must be at least 6 characters long.";
            } else {
              errorMessage = error.message;
            }
          }
          
          toast.error("Signup failed", {
            description: errorMessage,
            duration: 5000,
          });
        } finally {
          setIsSubmitting(false);
        }
      })(e);
    },
    [handleSubmit, supabase, router, setEmail, setPassword, setStep],
  );

  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-col gap-y-4">
        {/* Name fields - optional */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="firstName"
              className="mb-2 block text-sm font-medium text-neutral-900 dark:text-neutral-100"
            >
              First Name
            </label>
            <Input
              id="firstName"
              type="text"
              placeholder="John"
              autoComplete="given-name"
              required
              disabled={isSubmitting}
              autoFocus={!isMobile && !lockEmail}
              {...register("firstName")}
              error={errors.firstName?.message}
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="mb-2 block text-sm font-medium text-neutral-900 dark:text-neutral-100"
            >
              Last Name <span className="text-neutral-400 font-normal">(optional)</span>
            </label>
            <Input
              id="lastName"
              type="text"
              placeholder="Doe"
              autoComplete="family-name"
              disabled={isSubmitting}
              {...register("lastName")}
              error={errors.lastName?.message}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-neutral-900 dark:text-neutral-100"
          >
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="panic@thedis.co"
            autoComplete="email"
            required
            readOnly={!errors.email && lockEmail}
            disabled={isSubmitting}
            {...register("email")}
            error={errors.email?.message}
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-neutral-900 dark:text-neutral-100"
          >
            Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="At least 6 characters"
            autoComplete="new-password"
            required
            disabled={isSubmitting}
            {...register("password")}
            error={errors.password?.message}
            minLength={6}
          />
        </div>
        <Button
          type="submit"
          text={isSubmitting ? "Signing up..." : "Sign Up"}
          disabled={isSubmitting}
          loading={isSubmitting}
          variant="primary"
          className="h-10 w-full justify-center rounded-lg bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        />
      </div>
    </form>
  );
};
