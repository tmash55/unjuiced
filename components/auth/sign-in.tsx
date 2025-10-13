"use client";

import { SignInEmail } from "@/components/auth/signin-email";
import Link from "next/link";

export const SignInForm = () => {
  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 text-center">
          Log in to your Unjuiced account
        </h1>

        <SignInEmail />

        {/* Sign up link */}
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
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
