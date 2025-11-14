import { Metadata } from "next";
import Link from "next/link";
import { getSEOTags } from "@/lib/seo";
import { createClient } from "@/libs/supabase/server";
import { ChangelogTimeline, ChangelogEntry } from "@/components/changelog/changelog-timeline";
import XIcon from "@/components/icons/x";

export const metadata: Metadata = getSEOTags({
  title: "Changelog • Unjuiced",
  description:
    "Track everything we ship at Unjuiced – product improvements, new sportsbooks, and premium tooling updates.",
});

export const revalidate = 300;

async function getChangelogEntries(): Promise<ChangelogEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("changelog")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[marketing/changelog] Failed to load entries", error);
    return [];
  }

  return (data as ChangelogEntry[]) ?? [];
}

export default async function ChangelogPage() {
  const entries = await getChangelogEntries();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-br from-white via-sky-50 to-white px-6 py-10 shadow-sm dark:border-neutral-800 dark:from-neutral-900 dark:via-sky-950/30 dark:to-neutral-900">
        <div className="relative z-10 max-w-3xl space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-500">
            Changelog
          </p>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white sm:text-4xl">
            Every update, on the record.
          </h1>
          <p className="text-base text-neutral-600 dark:text-neutral-300">
            We iterate fast. Follow along as we ship new sportsbooks, tools, and features.
          </p>

          <div className="flex items-center gap-3">
            <Link
              href="https://x.com/UnjuicedApp"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 text-neutral-600 shadow-sm transition hover:border-sky-400 hover:text-sky-500 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-sky-500/70 dark:hover:text-sky-300"
            >
              <XIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="absolute -right-20 top-1/2 flex h-64 w-64 -translate-y-1/2 items-center justify-center rounded-full bg-sky-500/10 blur-3xl" />
      </header>

      <section className="mt-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Timeline</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {entries.length > 0
                ? `Showing ${entries.length} release${entries.length === 1 ? "" : "s"}`
                : "Nothing shipped yet — stay tuned!"}
            </p>
          </div>
        </div>

        <ChangelogTimeline entries={entries} />
      </section>
    </div>
  );
}

