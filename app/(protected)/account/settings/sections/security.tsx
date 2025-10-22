"use client";

import { User } from "@supabase/supabase-js";

interface SecuritySettingsProps {
  user: User;
}

export default function SecuritySettings({ user }: SecuritySettingsProps) {
  return (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Change Password
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            To update your password, please contact{" "}
            <a 
              href="mailto:support@unjuiced.bet" 
              className="text-brand hover:underline"
            >
              support@unjuiced.bet
            </a>
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            For security reasons, password changes must be handled through our support team.
          </p>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Two-Factor Authentication
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Add an extra layer of security to your account.
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Two-factor authentication is coming soon. We'll notify you when it's available.
          </p>
        </div>
      </div>
    </div>
  );
}

