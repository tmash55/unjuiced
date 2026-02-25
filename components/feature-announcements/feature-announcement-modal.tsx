"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Megaphone } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/button";
import { createClient } from "@/libs/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getActiveFeatureAnnouncements, type FeatureAnnouncement } from "@/lib/feature-announcements";

const STORAGE_PREFIX = "feature_announcements_seen:v1:";

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function readSeenIds(userId: string): Set<string> {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.map(String));
  } catch {
    return new Set<string>();
  }
}

function writeSeenIds(userId: string, seen: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify([...seen]));
  } catch {
    // Ignore storage errors so UI never crashes.
  }
}

export function FeatureAnnouncementModal() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<FeatureAnnouncement | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const activeAnnouncements = useMemo(() => getActiveFeatureAnnouncements(), []);

  const markSeen = () => {
    if (!user?.id || !announcement) return;

    const metadataSeen = Array.isArray(user.user_metadata?.seen_feature_announcements)
      ? user.user_metadata.seen_feature_announcements.map(String)
      : [];

    const seen = readSeenIds(user.id);
    seen.add(announcement.id);
    writeSeenIds(user.id, seen);

    if (!metadataSeen.includes(announcement.id)) {
      void supabase.auth.updateUser({
        data: {
          seen_feature_announcements: [...metadataSeen, announcement.id],
        },
      });
    }
  };

  useEffect(() => {
    if (loading || !user?.id) return;

    const metadataSeen = Array.isArray(user.user_metadata?.seen_feature_announcements)
      ? user.user_metadata.seen_feature_announcements.map(String)
      : [];

    const seen = readSeenIds(user.id);
    metadataSeen.forEach((id) => seen.add(id));
    const next = activeAnnouncements.find((item) => !seen.has(item.id)) || null;

    setAnnouncement(next);
    setOpen(!!next);
  }, [activeAnnouncements, loading, user?.id, user?.user_metadata]);

  if (!announcement) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          markSeen();
        }
        setOpen(nextOpen);
      }}
    >
      <DialogContent className="max-w-[560px] border-neutral-200 dark:border-neutral-800 p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-brand/10 to-sky-400/10 px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-brand">
            <Megaphone className="h-3.5 w-3.5" />
            {announcement.badge || "Update"}
          </div>
          <DialogHeader className="mt-2 text-left space-y-1">
            <DialogTitle className="text-xl">{announcement.title}</DialogTitle>
            <DialogDescription className="text-sm text-neutral-600 dark:text-neutral-300">
              {announcement.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {announcement.imageSrc ? (
          <div className="px-6 pt-4">
            <div className="relative overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
              <Image
                src={announcement.imageSrc}
                alt={announcement.imageAlt || announcement.title}
                width={1200}
                height={630}
                className="h-40 w-full object-cover"
                priority
              />
            </div>
          </div>
        ) : null}

        {announcement.bullets?.length ? (
          <div className="px-6 py-4">
            <ul className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              {announcement.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand/80 shrink-0" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 sm:justify-between">
          <Button
            variant="secondary"
            className="sm:w-auto"
            text="Dismiss"
            onClick={() => {
              markSeen();
              setOpen(false);
            }}
          />

          {announcement.ctaHref && announcement.ctaLabel ? (
            <Link
              href={announcement.ctaHref}
              onClick={() => {
                markSeen();
                setOpen(false);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-900 bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-100"
            >
              {announcement.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
