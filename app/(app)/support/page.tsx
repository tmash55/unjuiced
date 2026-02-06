"use client";

import React, { useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";

export default function AppContactPage() {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      message: formData.get("message"),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        form.reset();
        toast.success("Message sent!", {
          description: "We'll get back to you within 24 hours.",
          duration: 5000,
        });
      } else {
        const errorData = await response.json();
        toast.error("Failed to send message", {
          description: errorData.error || "Please try again later.",
          duration: 5000,
        });
      }
    } catch {
      toast.error("Failed to send message", {
        description: "Something went wrong. Please try again later.",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
        {/* Header */}
        <div className="mb-8 sm:mb-10">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-white sm:text-2xl">
            Help & Support
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            Have a question, found a bug, or want to request a feature? We're here to help.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Contact Form */}
          <div className="lg:col-span-3 rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  required
                  defaultValue={user?.user_metadata?.full_name || ""}
                  placeholder="Your name"
                  autoComplete="name"
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-600 dark:focus:bg-neutral-800 dark:focus:ring-neutral-600"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  defaultValue={user?.email || ""}
                  placeholder="your.email@example.com"
                  autoComplete="email"
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-600 dark:focus:bg-neutral-800 dark:focus:ring-neutral-600"
                />
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  placeholder="Tell us how we can help..."
                  rows={5}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-600 dark:focus:bg-neutral-800 dark:focus:ring-neutral-600"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                  "bg-[#0EA5E9] text-white hover:bg-[#0284C7]",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>

          {/* Contact Info Sidebar */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {/* Email Card */}
            <a
              href="mailto:support@unjuiced.bet"
              className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-sky-500/10 dark:bg-sky-400/10">
                <Mail className="size-5 text-sky-500 dark:text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-white">Email</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  support@unjuiced.bet
                </p>
              </div>
            </a>

            {/* X / Twitter Card */}
            <a
              href="https://x.com/unjuicedApp"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="text-neutral-700 dark:text-neutral-300"
                >
                  <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-white">X</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  @unjuicedApp
                </p>
              </div>
            </a>

            {/* Response time note */}
            <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Response time
              </p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                We typically respond within 24 hours. For urgent matters, DM us on X.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
