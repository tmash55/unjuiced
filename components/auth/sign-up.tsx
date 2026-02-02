"use client";

import { SignUpEmail } from "@/components/auth/signup-email";
import { GoogleButton } from "@/components/auth/google-button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export const SignUpForm = () => {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");
  
  // Preserve redirectTo when switching to login
  const loginHref = redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login";

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 text-center">
          Create your Unjuiced account
        </h1>

        {/* Google OAuth */}
        <GoogleButton />

        {/* Divider */}
        <div className="relative flex items-center">
          <div className="flex-grow border-t border-neutral-200 dark:border-neutral-700" />
          <span className="mx-4 flex-shrink text-sm text-neutral-500 dark:text-neutral-400">or</span>
          <div className="flex-grow border-t border-neutral-200 dark:border-neutral-700" />
        </div>

        {/* Email/Password Form */}
        <SignUpEmail />

        {/* Sign in link */}
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          Already have an account?{" "}
          <Link
            href={loginHref}
            className="font-semibold text-neutral-800 underline underline-offset-2 hover:text-neutral-600 dark:text-neutral-200 dark:hover:text-neutral-400"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};
