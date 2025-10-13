import { cn } from "@/lib/utils";

export function Logo2({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-10 w-10 items-center justify-center rounded-md bg-black text-white dark:bg-white dark:text-black", className)}>
      <span className="text-sm font-bold">U</span>
    </div>
  );
}