"use client";

import { SignInEmail } from "@/components/auth/signin-email";
import { GoogleButton } from "@/components/auth/google-button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export const SignInForm = () => {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || searchParams.get("redirect");
  
  // Preserve redirectTo when switching to register
  const registerHref = redirectTo ? `/register?redirectTo=${encodeURIComponent(redirectTo)}` : "/register";

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 text-center">
          Log in to your Unjuiced account
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
        <SignInEmail />

        {/* Sign up link */}
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
              Don&apos;t have an account?{" "}
              <Link
            href={registerHref}
            className="font-semibold text-neutral-800 underline underline-offset-2 hover:text-neutral-600 dark:text-neutral-200 dark:hover:text-neutral-400"
              >
            Sign up
              </Link>
        </p>
      </div>
    </div>
  );
};

export default SignInForm;
