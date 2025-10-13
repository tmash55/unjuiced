"use client";

import { Button } from "@/components/button";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/libs/supabase/client";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";

// Schema for requesting reset
const requestResetSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// Schema for setting new password
const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RequestResetProps = z.infer<typeof requestResetSchema>;
type ResetPasswordProps = z.infer<typeof resetPasswordSchema>;

export const ForgotPasswordForm = () => {
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const supabase = createClient();

  // Check if we're in recovery mode (user clicked email link)
  useEffect(() => {
    const checkRecoveryMode = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsRecoveryMode(true);
      }
    };
    checkRecoveryMode();
  }, [supabase.auth]);

  // Form for requesting reset email
  const requestForm = useForm<RequestResetProps>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: {
      email: "",
    },
  });

  // Form for setting new password
  const resetForm = useForm<ResetPasswordProps>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const handleRequestReset = async (data: RequestResetProps) => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/forgot-password`,
      });

      if (error) {
        // Provide more helpful error messages
        if (error.message.includes("unexpected")) {
          toast.error(
            "Email service is not configured yet. Please contact support or try again later.",
            { duration: 6000 }
          );
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success(
          "Check your email for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder.",
          { duration: 6000 }
        );
        // Don't redirect immediately, let user see the message
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (error) {
      console.error("Password reset error:", error);
      toast.error(
        "Unable to send reset email. Please ensure email is configured in Supabase dashboard.",
        { duration: 6000 }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (data: ResetPasswordProps) => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Your password has been reset successfully!");
        router.push("/login");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // If user clicked email link, show password reset form
  if (isRecoveryMode) {
    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 text-center">
            Set a new password
          </h1>
          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
            Enter a new password for your account.
          </p>
        </div>

        <form onSubmit={resetForm.handleSubmit(handleResetPassword)}>
          <div className="flex flex-col gap-6">
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium leading-none text-neutral-800 dark:text-neutral-100"
              >
                New Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  {...resetForm.register("password")}
                  error={resetForm.formState.errors.password?.message}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {resetForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-500">
                  {resetForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-medium leading-none text-neutral-800 dark:text-neutral-100"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  {...resetForm.register("confirmPassword")}
                  error={resetForm.formState.errors.confirmPassword?.message}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {resetForm.formState.errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">
                  {resetForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Password must contain:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                <li>• At least 8 characters</li>
                <li>• One uppercase letter</li>
                <li>• One lowercase letter</li>
                <li>• One number</li>
              </ul>
            </div>

            <Button
              type="submit"
              text={isLoading ? "Resetting..." : "Reset password"}
              loading={isLoading}
              disabled={isLoading}
            />
          </div>
        </form>
      </div>
    );
  }

  // Otherwise, show email request form
  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 text-center">
          Reset your password
        </h1>
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={requestForm.handleSubmit(handleRequestReset)}>
        <div className="flex flex-col gap-6">
          <label>
            <span className="mb-2 block text-sm font-medium leading-none text-neutral-800 dark:text-neutral-100">
              Email
            </span>
            <Input
              type="email"
              autoFocus={!isMobile}
              placeholder="you@example.com"
              required
              disabled={isLoading}
              {...requestForm.register("email")}
              error={requestForm.formState.errors.email?.message}
            />
          </label>
          <Button
            type="submit"
            text={isLoading ? "Sending..." : "Send reset link"}
            loading={isLoading}
            disabled={isLoading}
          />
        </div>
      </form>

      <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-semibold text-neutral-800 underline underline-offset-2 hover:text-neutral-600 dark:text-neutral-200 dark:hover:text-neutral-400"
        >
          Log in
        </Link>
      </p>
    </div>
  );
};
