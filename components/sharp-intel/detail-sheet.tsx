"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface DetailSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

/**
 * Bottom sheet for mobile detail panels.
 * Slides up from the bottom, ~85vh height, scrollable content.
 */
export function DetailSheet({ open, onClose, title, children }: DetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="bottom"
        className="bg-white dark:bg-neutral-900 border-neutral-200/60 dark:border-neutral-800/60 rounded-t-2xl max-h-[85vh] flex flex-col p-0"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-8 rounded-full bg-neutral-700" />
        </div>

        {title && (
          <SheetHeader className="px-4 pb-2">
            <SheetTitle className="text-neutral-200 text-sm">{title}</SheetTitle>
          </SheetHeader>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
