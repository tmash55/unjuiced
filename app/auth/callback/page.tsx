"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/libs/supabase/client";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = createClient();
        
        // Get parameters from URL
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const tokenHash = params.get("token_hash");
        const type = params.get("type");
        const next = params.get("next") || params.get("redirectTo") || "/today";
        const errorParam = params.get("error");
        const errorDescription = params.get("error_description");

        // Handle OAuth errors from provider
        if (errorParam) {
          console.error("OAuth error:", errorParam, errorDescription);
          setStatus("error");
          setErrorMessage(errorDescription || errorParam);
          return;
        }

        // Handle OTP verification (email confirmation, password recovery)
        if (tokenHash && type) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'recovery' | 'email' | 'signup' | 'invite' | 'magiclink',
          });

          if (error) {
            console.error("OTP verification error:", error);
            setStatus("error");
            setErrorMessage(error.message);
            return;
          }

          if (data.user) {
            console.log("✅ OTP verified for user:", data.user.id);
            setStatus("success");

            // For password recovery, redirect to forgot-password page
            if (type === 'recovery') {
              window.location.href = '/forgot-password';
              return;
            }

            // Call server endpoint for tracking
            try {
              await fetch("/api/auth/post-signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: data.user.id,
                  email: data.user.email,
                  fullName: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
                  avatarUrl: data.user.user_metadata?.avatar_url,
                  createdAt: data.user.created_at,
                }),
              });
            } catch (e) {
              console.warn("Post-signup tracking failed:", e);
            }

            window.location.href = next.startsWith("http") ? next : next;
            return;
          }
        }

        // Handle OAuth code exchange (PKCE flow)
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error("Code exchange error:", error);
            setStatus("error");
            setErrorMessage(error.message);
            return;
          }

          if (data.session) {
            console.log("✅ Session established for user:", data.user?.id);
            setStatus("success");
            
            // Call server endpoint to handle Stripe/Brevo/Dub tracking for new users
            if (data.user) {
              try {
                await fetch("/api/auth/post-signup", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userId: data.user.id,
                    email: data.user.email,
                    fullName: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
                    avatarUrl: data.user.user_metadata?.avatar_url,
                    createdAt: data.user.created_at,
                  }),
                });
              } catch (e) {
                // Non-blocking - don't fail the auth flow if tracking fails
                console.warn("Post-signup tracking failed:", e);
              }
            }

            // Redirect to destination
            window.location.href = next.startsWith("http") ? next : next;
            return;
          }
        }

        // Check if user is already authenticated (e.g., page refresh)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setStatus("success");
          window.location.href = next.startsWith("http") ? next : next;
          return;
        }

        // No code and no session
        setStatus("error");
        setErrorMessage("No authentication code provided");
      } catch (e) {
        console.error("Auth callback error:", e);
        setStatus("error");
        setErrorMessage(e instanceof Error ? e.message : "An unexpected error occurred");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-700 dark:border-t-white" />
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Completing sign in...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Success! Redirecting...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg
                className="h-6 w-6 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-medium text-neutral-900 dark:text-white">
                Sign in failed
              </p>
              {errorMessage && (
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {errorMessage}
                </p>
              )}
            </div>
            <a
              href="/login"
              className="mt-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Try again
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
