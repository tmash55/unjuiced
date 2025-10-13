"use client";

import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import React, { useCallback, useState } from "react";
import { EyeSlash } from "@/icons/eye-slash";
import Eye from "@/icons/eye";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const toggleIsPasswordVisible = useCallback(
      () => setIsPasswordVisible(!isPasswordVisible),
      [isPasswordVisible, setIsPasswordVisible],
    );

    return (
      <div>
        <div className="relative flex">
          <input
            type={isPasswordVisible ? "text" : type}
            className={cn(
              "h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors",
              "hover:border-neutral-400",
              "focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-200",
              "read-only:cursor-not-allowed read-only:bg-neutral-50 read-only:text-neutral-500",
              "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500",
              "dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500",
              "dark:hover:border-neutral-600 dark:focus:border-neutral-500 dark:focus:ring-neutral-800",
              "dark:read-only:bg-neutral-800 dark:disabled:bg-neutral-800",
              props.error &&
                "border-red-500 focus:border-red-500 focus:ring-red-100 dark:border-red-500 dark:focus:ring-red-900",
              className,
            )}
            ref={ref}
            {...props}
          />

          <div className="group">
            {props.error && (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-none items-center px-2.5">
                <AlertCircle
                  className={cn(
                    "size-5 text-white",
                    type === "password" &&
                      "transition-opacity group-hover:opacity-0",
                  )}
                  fill="#ef4444"
                />
              </div>
            )}
            {type === "password" && (
              <button
                className={cn(
                  "absolute inset-y-0 right-0 flex items-center px-3",
                  props.error &&
                    "opacity-0 transition-opacity group-hover:opacity-100",
                )}
                type="button"
                onClick={() => toggleIsPasswordVisible()}
                aria-label={
                  isPasswordVisible ? "Hide password" : "Show Password"
                }
              >
                {isPasswordVisible ? (
                  <Eye
                    className="size-4 flex-none text-neutral-500 transition hover:text-neutral-700"
                    aria-hidden
                  />
                ) : (
                  <EyeSlash
                    className="size-4 flex-none text-neutral-500 transition hover:text-neutral-700"
                    aria-hidden
                  />
                )}
              </button>
            )}
          </div>
        </div>

        {props.error && (
          <span
            className="mt-2 block text-sm text-red-500"
            role="alert"
            aria-live="assertive"
          >
            {props.error}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };