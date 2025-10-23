'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

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
      <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <DialogTitle className="text-xl font-semibold text-neutral-900 dark:text-white">
              Connection Lost
            </DialogTitle>
          </div>
          <DialogDescription className="text-base text-neutral-600 dark:text-neutral-400">
            We've lost connection to live odds updates. This can happen after extended periods of inactivity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              <strong className="font-semibold text-neutral-900 dark:text-white">What happened?</strong>
              <br />
              <span className="mt-1 inline-block">
                The connection to our real-time odds feed has timed out. This is normal after being away for a while.
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-brand/20 bg-brand/5 p-4 dark:border-brand/30 dark:bg-brand/10">
            <p className="text-sm text-brand-700 dark:text-brand-300">
              <strong className="font-semibold">💡 Tip:</strong> Refreshing will reconnect you and load the latest odds data.
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            Continue Without Live Updates
          </Button>
          <Button
            onClick={handleRefresh}
            variant="primary"
            className="flex-1 gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

