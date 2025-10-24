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

// Zod schema for sign up
const signUpSchema = z.object({
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
  const redirectTo = searchParams.get("redirectTo");
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
          const nextUrl = redirectTo || '/arbitrage';
          
          const { data: signUpData, error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
              emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(nextUrl)}`,
            },
          });

          if (error) throw error;

          // Check if email confirmation is disabled (user is immediately confirmed)
          if (signUpData.user && signUpData.session) {
            // User is automatically signed in
            
            // Initialize trial for new user
            try {
              const initTrialResponse = await fetch('/api/auth/init-trial', {
                method: 'POST',
              });
              const trialResult = await initTrialResponse.json();
              console.log('✅ Trial initialization result:', trialResult);
            } catch (trialError) {
              console.error('❌ Error initializing trial:', trialError);
              // Don't block the flow if trial init fails
            }
            
            toast.success("Account created! 🎉", {
              description: "Redirecting you to your dashboard...",
              duration: 3000,
            });

            // Redirect to the intended destination
            setTimeout(() => {
              router.push(nextUrl);
              router.refresh();
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
            autoFocus={!isMobile && !lockEmail}
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
