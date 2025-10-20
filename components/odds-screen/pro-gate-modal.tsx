"use client"

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sparkles, ExternalLink } from 'lucide-react'
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
      <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-brand">
              <Lock className="h-8 w-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl font-bold text-neutral-900 dark:text-white">
            {feature} is a Pro Feature
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-6 space-y-6">
          <p className="text-center text-neutral-600 dark:text-neutral-400">
            Upgrade to Pro to unlock direct betting links, giving you instant access to place bets on your favorite sportsbooks.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                <Sparkles className="h-4 w-4 text-brand" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-neutral-900 dark:text-white">
                  One-Click Betting
                </h4>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                  Click any odds to instantly open the bet slip on your sportsbook
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                <ExternalLink className="h-4 w-4 text-brand" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-neutral-900 dark:text-white">
                  Fast & Seamless
                </h4>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                  Save time with direct links to pre-filled bet slips
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-3">
            <ButtonLink 
              href="/pricing" 
              onClick={onClose}
              variant="primary"
              className="w-full justify-center"
            >
              Upgrade to Pro
            </ButtonLink>
            <button
              onClick={onClose}
              className="w-full text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors py-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}









