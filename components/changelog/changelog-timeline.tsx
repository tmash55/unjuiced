import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChangelogEntry {
  id: string;
  title: string;
  slug?: string | null;
  summary?: string | null;
  body: string;
  category?: string | null;
  tags?: string[] | null;
  author?: string | null;
  image_url?: string | null;
  is_major?: boolean | null;
  created_at: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const markdownComponents = {
  p: (props: any) => (
    <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300 [&:not(:first-child)]:mt-3">
      {props.children}
    </p>
  ),
  ul: (props: any) => (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-600 dark:text-neutral-300">
      {props.children}
    </ul>
  ),
  ol: (props: any) => (
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-600 dark:text-neutral-300">
      {props.children}
    </ol>
  ),
  li: (props: any) => <li>{props.children}</li>,
  a: (props: any) => (
    <a
      {...props}
      className="font-semibold text-sky-600 underline decoration-sky-400/60 decoration-2 underline-offset-2 hover:text-sky-500 dark:text-sky-300"
      target="_blank"
      rel="noreferrer"
    />
  ),
  strong: (props: any) => (
    <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
      {props.children}
    </strong>
  ),
};

const tagColors = [
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200",
];

const getTagColor = (index: number) => tagColors[index % tagColors.length];

export function ChangelogTimeline({ entries }: { entries: ChangelogEntry[] }) {
  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-6 py-12 text-center dark:border-neutral-700 dark:bg-neutral-900/40">
        <p className="text-base font-medium text-neutral-900 dark:text-white">
          No changelog entries yet
        </p>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Ship something new and it will show up here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {entries.map((entry, index) => {
        const date = dateFormatter.format(new Date(entry.created_at));
        const tags = entry.tags ?? [];
        const isMajor = Boolean(entry.is_major);

        return (
          <article
            key={entry.id}
            className="grid gap-6 sm:grid-cols-[110px_1fr]"
          >
            <div className="relative hidden flex-col items-center sm:flex">
              {index !== 0 && (
                <span className="absolute -top-6 h-6 w-px bg-neutral-200 dark:bg-neutral-800" />
              )}
              <span className="inline-flex min-w-[80px] items-center justify-center rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-600 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                {date}
              </span>
              {index !== entries.length - 1 && (
                <span className="mt-2 h-full w-px bg-neutral-200 dark:bg-neutral-800" />
              )}
            </div>

            <div
              className={cn(
                "relative flex-1 rounded-2xl border px-5 py-6 shadow-sm transition hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900/60",
                isMajor
                  ? "border-sky-200/80 bg-gradient-to-br from-white via-sky-50/60 to-white dark:from-neutral-900 dark:via-sky-900/10 dark:to-neutral-900"
                  : "border-neutral-200 bg-white dark:bg-neutral-900/40"
              )}
            >
              <div className="mb-3 flex items-center gap-3 sm:hidden">
                <span className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-600 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                  {date}
                </span>
                <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                    {entry.category || "General"}
                    {isMajor && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-200">
                        <Star className="h-3 w-3" />
                        Major
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-neutral-900 dark:text-white">
                    {entry.title}
                  </h3>
                  {entry.summary && (
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      {entry.summary}
                    </p>
                  )}
                </div>
              </div>

              {entry.image_url && entry.image_url !== '""' && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={entry.image_url}
                    alt={entry.title}
                    className="h-52 w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}

              <div className="mt-4 prose prose-sm max-w-none text-neutral-700 dark:prose-invert dark:text-neutral-200">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {entry.body}
                </ReactMarkdown>
              </div>

              {(tags.length > 0 || entry.author) && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag, idx) => (
                        <span
                          key={`${entry.id}-${tag}`}
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            getTagColor(idx)
                          )}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {entry.author && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      Posted by <span className="font-medium">{entry.author}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

