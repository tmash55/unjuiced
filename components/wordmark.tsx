import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block select-none text-xl font-semibold tracking-tight text-black dark:text-white", className)}>
      Unjuiced
    </span>
  );
}