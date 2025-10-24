'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { AlertTriangle, RefreshCw, Zap } from 'lucide-react'

interface ConnectionErrorDialogProps {
  isOpen: boolean
  onClose: () => void
  onRefresh?: () => void
}

export function ConnectionErrorDialog({ isOpen, onClose, onRefresh }: ConnectionErrorDialogProps) {
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh()
    } else {
      window.location.reload()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-neutral-200 bg-white p-0 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="p-8 text-center">
          {/* Icon with gradient glow */}
          <div className="relative mx-auto mb-6 w-fit">
            <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-amber-500/20 via-amber-500/30 to-amber-600/30 blur-2xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-white shadow-sm dark:border-amber-500/30 dark:bg-neutral-900">
              <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          {/* Content */}
          <h3 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">
            Connection Lost
          </h3>
          <p className="mb-6 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            We've lost connection to live odds updates. This can happen after extended periods of inactivity.
          </p>

          {/* Info Cards */}
          <div className="mb-6 space-y-3">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-left dark:border-neutral-700 dark:bg-neutral-800">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                What happened?
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                The connection to our real-time odds feed has timed out. This is normal after being away for a while.
              </p>
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-left dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                <Zap className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong className="font-semibold">Tip:</strong> Refreshing will reconnect you and load the latest odds data.
                </span>
              </p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleRefresh}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral-800 hover:shadow-md dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Page
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              Continue Without Live Updates
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

