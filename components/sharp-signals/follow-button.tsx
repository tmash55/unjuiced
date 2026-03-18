"use client"

import { cn } from "@/lib/utils"

interface FollowButtonProps {
  isFollowing: boolean
  onToggle: () => void
  size?: "sm" | "md"
  className?: string
}

export function FollowButton({ isFollowing, onToggle, size = "sm", className }: FollowButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium transition-all duration-150 active:scale-95",
        size === "sm" && "px-2.5 py-1 text-xs",
        size === "md" && "px-3 py-1.5 text-sm",
        isFollowing
          ? "border-sky-300 bg-sky-50 text-sky-600 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400 dark:hover:bg-sky-500/15"
          : "border-neutral-300 bg-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-400 dark:border-neutral-700/50 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:border-neutral-600",
        className
      )}
    >
      {/* Heart icon */}
      <svg
        className={cn("shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")}
        viewBox="0 0 16 16"
        fill={isFollowing ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={isFollowing ? 0 : 1.5}
      >
        <path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 0 1 8 4a3.5 3.5 0 0 1 5.5 3c0 3.5-5.5 7-5.5 7Z" />
      </svg>
      {isFollowing ? "Following" : "Follow"}
    </button>
  )
}
