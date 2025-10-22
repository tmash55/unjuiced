"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { usePreferences } from "@/context/preferences-context";
import { createClient } from "@/libs/supabase/client";
import { Settings, Shield, Bell, User } from "lucide-react";
import { DivideX } from "@/components/divide";

import SecuritySettings from "./sections/security";
import NotificationsSettings from "./sections/notifications";
import GeneralSettings from "./sections/general";


type SettingsSection = "general" | "security" | "notifications";

export default function SettingsClient() {
  const { user } = useAuth();
  const { preferences } = usePreferences();
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setProfile(data);
      }
      setLoading(false);
    }

    loadProfile();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const sections = [
    {
      id: "general" as SettingsSection,
      label: "General",
      icon: User,
      description: "Manage your account details",
    },
    {
      id: "security" as SettingsSection,
      label: "Security",
      icon: Shield,
      description: "Password and authentication",
    },
    {
      id: "notifications" as SettingsSection,
      label: "Notifications",
      icon: Bell,
      description: "Email and push notifications",
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="relative border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
        {/* Dotted background pattern with gradient mask */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.2] dark:opacity-[0.15]">
          <div 
            className="absolute inset-0 bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] dark:bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:10px_10px]"
            style={{
              maskImage: 'radial-gradient(ellipse 80% 50% at 50% 50%, black 0%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 50%, black 0%, transparent 100%)'
            }}
          />
        </div>
        
        {/* Content */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <Settings className="h-5 w-5 text-brand" />
            </div>
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
              Settings
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-3">
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${
                      isActive
                        ? "bg-brand/10 text-brand dark:bg-brand/20"
                        : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{section.label}</div>
                        <div className="hidden text-xs text-neutral-500 dark:text-neutral-400 sm:block">
                          {section.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-9">
            {activeSection === "general" && (
              <GeneralSettings user={user} profile={profile} setProfile={setProfile} />
            )}
            {activeSection === "security" && <SecuritySettings user={user} />}
            {activeSection === "notifications" && (
              <NotificationsSettings user={user} preferences={preferences} />
            )}
          </div>
        </div>
      </div>

      {/* Divider before footer */}
      <DivideX />
    </div>
  );
}

