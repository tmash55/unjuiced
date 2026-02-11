import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-6 w-auto text-black dark:text-white", className)}
    >
      <text
        x="50"
        y="18"
        fontSize="20"
        fontWeight="600"
        letterSpacing="-0.5"
        fill="currentColor"
        fontFamily="system-ui, -apple-system, sans-serif"
        textAnchor="middle"
      >
        Unjuiced
      </text>
    </svg>
  );
}
