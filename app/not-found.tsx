"use client";

import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col">
      {/* Subtle top accent */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-brand to-transparent opacity-60" />

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* 404 number — large, muted */}
        <div className="text-[120px] sm:text-[160px] font-black leading-none text-neutral-200 dark:text-neutral-800 select-none">
          404
        </div>

        {/* Message */}
        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white -mt-4 sm:-mt-6">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-brand text-white hover:bg-brand/90 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <button
            onClick={() => typeof window !== "undefined" && window.history.back()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="py-6 text-center">
        <p className="text-xs text-neutral-400">
          <a href="/terms" className="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">Terms</a>
          {" · "}
          <a href="/privacy" className="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">Privacy</a>
        </p>
      </div>
    </div>
  );
}
