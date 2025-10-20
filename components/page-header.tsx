import { cn } from "@/lib/utils";
import { Container } from "./container";
import { Rss } from "lucide-react";
import X from "./icons/x";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  description: string;
  showFollowButtons?: boolean;
  xUrl?: string;
  rssUrl?: string;
}

export function PageHeader({
  title,
  description,
  showFollowButtons = false,
  xUrl,
  rssUrl,
}: PageHeaderProps) {
  return (
    <div className="relative">
      {/* Content with side borders */}
      <Container>
        <div className="relative border-x border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-col gap-6 px-8 py-16 md:px-12 md:py-20">
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-white md:text-5xl">
                {title}
              </h1>
              <p className="text-lg text-neutral-600 dark:text-neutral-400">
                {description}
              </p>
            </div>

            {showFollowButtons && (
              <div className="flex items-center gap-3">
                {xUrl && (
                  <Link
                    href={xUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    )}
                  >
                    <X className="h-3.5 w-3.5" />
                    Follow
                  </Link>
                )}
                {rssUrl && (
                  <Link
                    href={rssUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    )}
                    aria-label="RSS Feed"
                  >
                    <Rss className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}

