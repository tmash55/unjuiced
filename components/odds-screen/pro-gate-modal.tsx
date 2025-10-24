"use client"

import React from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Sparkles, ExternalLink, Droplet } from 'lucide-react'
import { ButtonLink } from '@/components/button-link'
import Lock from '@/icons/lock'

interface ProGateModalProps {
  isOpen: boolean
  onClose: () => void
  feature?: string
}

export function ProGateModal({ isOpen, onClose, feature = "Deep Linking" }: ProGateModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-[var(--tertiary)]/20 bg-white p-0 shadow-xl dark:border-[var(--tertiary)]/30 dark:bg-neutral-900">
        {/* Accessible title for screen readers */}
        <VisuallyHidden asChild>
          <DialogTitle>{feature} is a Pro Feature</DialogTitle>
        </VisuallyHidden>
        <div className="p-8 text-center">
          {/* Icon with gradient glow */}
          <div className="relative mx-auto mb-6 w-fit">
            <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-[var(--tertiary)]/20 via-[var(--tertiary)]/30 to-[var(--tertiary-strong)]/30 blur-2xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--tertiary)]/20 bg-white shadow-sm dark:border-[var(--tertiary)]/30 dark:bg-neutral-900">
              <Lock className="h-8 w-8 text-[var(--tertiary-strong)]" />
            </div>
          </div>

          {/* Headline */}
          <h3 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">{feature} is a Pro Feature</h3>
          <p className="mb-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Upgrade to Pro to unlock direct betting links, giving you instant access to pre-filled bet slips on your favorite sportsbooks.
          </p>

          {/* Feature cards */}
          <div className="mb-6 space-y-3 text-left">
            <div className="flex items-start gap-3 rounded-lg border border-[var(--tertiary)]/20 bg-[var(--tertiary)]/5 p-4 dark:border-[var(--tertiary)]/30 dark:bg-[var(--tertiary)]/10">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--tertiary)]/20">
                <Sparkles className="h-4 w-4 text-[var(--tertiary-strong)]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">One-Click Betting</h4>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">Click any odds to instantly open the bet slip</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-[var(--tertiary)]/20 bg-[var(--tertiary)]/5 p-4 dark:border-[var(--tertiary)]/30 dark:bg-[var(--tertiary)]/10">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--tertiary)]/20">
                <ExternalLink className="h-4 w-4 text-[var(--tertiary-strong)]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">Fast & Seamless</h4>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">Skip searching—go straight to placing the bet</p>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3">
            <ButtonLink href="/pricing" onClick={onClose} variant="pro" className="w-full justify-center">
              Start Free — 7‑Day Trial
            </ButtonLink>
            <button
              onClick={onClose}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}









