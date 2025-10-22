"use client";

import { useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/libs/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface GeneralSettingsProps {
  user: User;
  profile: any;
  setProfile: (profile: any) => void;
}

export default function GeneralSettings({ user, profile, setProfile }: GeneralSettingsProps) {
  const [displayName, setDisplayName] = useState(profile?.name || "");
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [fullNameSaving, setFullNameSaving] = useState(false);
  const [displayNameChanged, setDisplayNameChanged] = useState(false);
  const [fullNameChanged, setFullNameChanged] = useState(false);

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setDisplayNameChanged(value !== (profile?.name || ""));
  };

  const handleFirstNameChange = (value: string) => {
    setFirstName(value);
    setFullNameChanged(
      value !== (profile?.first_name || "") || 
      lastName !== (profile?.last_name || "")
    );
  };

  const handleLastNameChange = (value: string) => {
    setLastName(value);
    setFullNameChanged(
      firstName !== (profile?.first_name || "") || 
      value !== (profile?.last_name || "")
    );
  };

  const saveDisplayName = async () => {
    if (!displayNameChanged || displayName.length > 32) return;
    
    setDisplayNameSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ name: displayName })
        .eq("id", user.id);

      if (error) throw error;

      setProfile({ ...profile, name: displayName });
      toast.success("Changes saved successfully");
      setDisplayNameChanged(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update display name");
    } finally {
      setDisplayNameSaving(false);
    }
  };

  const saveFullName = async () => {
    if (!fullNameChanged) return;
    
    setFullNameSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ 
          first_name: firstName,
          last_name: lastName 
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfile({ ...profile, first_name: firstName, last_name: lastName });
      toast.success("Changes saved successfully");
      setFullNameChanged(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update full name");
    } finally {
      setFullNameSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Display Name / Username */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Display Name
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            This is your username or display name on Unjuiced.
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            maxLength={32}
            placeholder="Enter your display name"
            className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
          />
          
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Max 32 characters.
            </p>
            <button
              onClick={saveDisplayName}
              disabled={!displayNameChanged || displayNameSaving || displayName.length > 32}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {displayNameSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Full Name */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Full Name
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Your first and last name for your account.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => handleFirstNameChange(e.target.value)}
                placeholder="Enter first name"
                className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => handleLastNameChange(e.target.value)}
                placeholder="Enter last name"
                className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-500"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-end">
            <button
              onClick={saveFullName}
              disabled={!fullNameChanged || fullNameSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fullNameSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Your Email */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Your Email
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            This is the email you use to log in to Unjuiced and receive notifications. To update your email, please contact{" "}
            <a 
              href="mailto:support@unjuiced.bet" 
              className="text-brand hover:underline"
            >
              support@unjuiced.bet
            </a>
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="email"
            value={user.email || ""}
            disabled
            className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2 text-sm text-neutral-500 cursor-not-allowed dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-400"
          />
        </div>
      </div>

      {/* Your Avatar */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Your Avatar
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            This is your avatar image on your Unjuiced account.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-2xl font-semibold text-white">
            {displayName ? displayName.charAt(0).toUpperCase() : 
             firstName ? firstName.charAt(0).toUpperCase() : 
             user.email?.charAt(0).toUpperCase()}
          </div>
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            Avatar customization coming soon
          </div>
        </div>
      </div>
    </div>
  );
}

