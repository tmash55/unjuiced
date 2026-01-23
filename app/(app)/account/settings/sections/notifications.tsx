"use client";

import { User } from "@supabase/supabase-js";
import { UserPreferences } from "@/lib/preferences-rpc";

interface NotificationsSettingsProps {
  user: User;
  preferences: UserPreferences | null;
}

export default function NotificationsSettings({ user, preferences }: NotificationsSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Email Notifications
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Manage how you receive email notifications from Unjuiced.
          </p>
        </div>

        <div className="space-y-4">
          {/* Product Updates */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
                Product Updates
              </h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Get notified about new features, improvements, and announcements.
              </p>
            </div>
            <button
              disabled
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-neutral-300 opacity-50 dark:bg-neutral-600"
            >
              <span className="inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white" />
            </button>
          </div>

          {/* Arbitrage Alerts */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
                Arbitrage Alerts
                <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  Pro
                </span>
              </h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Receive real-time alerts when high-value arbitrage opportunities appear. Coming soon.
              </p>
            </div>
            <button
              disabled
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-neutral-300 opacity-50 dark:bg-neutral-600"
            >
              <span className="inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white" />
            </button>
          </div>

          {/* +EV Alerts */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
                +EV Alerts
                <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  Pro
                </span>
              </h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Get notified about positive expected value betting opportunities. Coming soon.
              </p>
            </div>
            <button
              disabled
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-neutral-300 opacity-50 dark:bg-neutral-600"
            >
              <span className="inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white" />
            </button>
          </div>

          {/* Weekly Summary */}
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-white">
                Weekly Summary
              </h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Receive a weekly summary of your betting activity and insights.
              </p>
            </div>
            <button
              disabled
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-neutral-300 opacity-50 dark:bg-neutral-600"
            >
              <span className="inline-block h-4 w-4 translate-x-1 transform rounded-full bg-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Push Notifications */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Push Notifications
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Receive push notifications on your devices.
          </p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Push notifications are coming soon. We'll notify you when they're available.
          </p>
        </div>
      </div>
    </div>
  );
}

