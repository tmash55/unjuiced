"use client";

import { Button } from "@/components/button";
import { FormEvent, useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Input } from "../ui/input";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "./auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { useMediaQuery } from "@/hooks/use-media-query";

// Zod schema for sign in
const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required"),
});

type SignInProps = z.infer<typeof signInSchema>;

export const SignInEmail = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { signIn } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInProps>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      await handleSubmit(async (data) => {
        setIsSubmitting(true);
        try {
          await signIn(data.email, data.password);

          toast.success("Welcome back! 👋", {
            description: "You have been signed in successfully.",
            duration: 3000,
          });

          // Check for redirect URL
          const redirectTo = searchParams.get("redirectTo");
          const destination = redirectTo || "/edge-finder";

          setTimeout(() => {
            router.push(destination);
            router.refresh();
          }, 500);
        } catch (error) {
          // Handle specific authentication errors
          let errorMessage = "Invalid email or password.";

          if (error instanceof Error) {
            const message = error.message.toLowerCase();

            if (message.includes("invalid login credentials") || message.includes("invalid")) {
              errorMessage = "Invalid email or password. Please try again.";
            } else if (message.includes("email not confirmed")) {
              errorMessage = "Please verify your email address before signing in.";
            } else if (message.includes("too many requests")) {
              errorMessage = "Too many login attempts. Please try again later.";
            } else {
              errorMessage = error.message;
            }
          }

          toast.error("Sign in failed", {
            description: errorMessage,
            duration: 5000,
          });
        } finally {
          setIsSubmitting(false);
        }
      })(e);
    },
    [handleSubmit, signIn, router, searchParams],
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
            autoFocus={!isMobile}
            disabled={isSubmitting}
            {...register("email")}
            error={errors.email?.message}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-neutral-900 dark:text-neutral-100"
            >
              Password
            </label>
            <a
              href="/forgot-password"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Forgot password?
            </a>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            disabled={isSubmitting}
            {...register("password")}
            error={errors.password?.message}
          />
        </div>
        <Button
          type="submit"
          text={isSubmitting ? "Signing in..." : "Log in"}
          disabled={isSubmitting}
          loading={isSubmitting}
          variant="primary"
          className="h-10 w-full justify-center rounded-lg bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        />
      </div>
    </form>
  );
};

