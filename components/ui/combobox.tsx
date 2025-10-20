"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/tooltip"

export interface ComboboxOption<TMeta = any> {
  value: string
  label: React.ReactNode
  icon?: React.ReactNode
  right?: React.ReactNode
  disabled?: boolean
  disabledTooltip?: React.ReactNode
  meta?: TMeta
  first?: boolean
}

export interface ComboboxProps<TMeta = any> {
  selected: ComboboxOption<TMeta> | null
  setSelected: (opt: ComboboxOption<TMeta> | null) => void

  options?: ComboboxOption<TMeta>[]
  searchPlaceholder?: string
  onSearchChange?: (v: string) => void
  shouldFilter?: boolean // if false, we'll still filter client-side unless onSearchChange provided
  matchTriggerWidth?: boolean

  icon?: React.ReactNode
  caret?: React.ReactNode
  inputRight?: React.ReactNode

  buttonProps?: {
    className?: string
    textWrapperClassName?: string
  }
  optionClassName?: string
  emptyState?: React.ReactNode

  open?: boolean
  onOpenChange?: (o: boolean) => void
}

export function Combobox<TMeta = any>({
  selected,
  setSelected,
  options = [],
  searchPlaceholder = "Search...",
  onSearchChange,
  shouldFilter = true,
  matchTriggerWidth = false,
  icon,
  caret,
  inputRight,
  buttonProps,
  optionClassName,
  emptyState,
  open,
  onOpenChange,
}: ComboboxProps<TMeta>) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const [query, setQuery] = useState("")
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!isOpen) return
      const t = e.target as Node
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(t) &&
        menuRef.current &&
        !menuRef.current.contains(t)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [isOpen, setOpen])

  // Derived filtered options (client-side)
  const filtered = useMemo(() => {
    if (!options) return []
    if (onSearchChange) return options // server/parent filtering
    const q = query.trim().toLowerCase()
    if (!q || !shouldFilter) return options
    return options.filter((o) => String(o.label).toLowerCase().includes(q))
  }, [options, query, onSearchChange, shouldFilter])

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!isOpen)}
        className={cn(
          "group flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-left shadow-sm transition-colors hover:bg-neutral-100 active:bg-neutral-200 data-[state=open]:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:active:bg-neutral-700 dark:data-[state=open]:bg-neutral-800",
          buttonProps?.className,
        )}
        data-state={isOpen ? "open" : "closed"}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon}
          <span
            className={cn(
              "min-w-0 truncate text-left text-sm font-medium leading-6 text-neutral-900 dark:text-neutral-100",
              buttonProps?.textWrapperClassName,
            )}
          >
            {selected ? selected.label : "Select"}
          </span>
        </div>
        {caret && <div className="flex-shrink-0">{caret}</div>}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            "absolute left-0 top-full z-[60] mt-2 max-h-80 overflow-auto rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-800",
            matchTriggerWidth && "min-w-[var(--trigger-w)]",
          )}
          style={{
            // Read trigger width for matchTriggerWidth; fallback gracefully
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            "--trigger-w": `${triggerRef.current?.offsetWidth || 240}px`,
          }}
        >
          {/* Search */}
          <div className="mb-2 flex items-center gap-2">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                onSearchChange?.(e.target.value)
              }}
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none ring-0 focus:border-brand focus:ring-2 focus:ring-brand/30 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white dark:placeholder:text-neutral-500"
            />
            {inputRight}
          </div>

          {/* Options */}
          <div className="flex max-h-64 flex-col gap-1 overflow-auto">
            {filtered && filtered.length > 0 ? (
              filtered.map((opt) => {
                const content = (
                  <button
                    key={opt.value}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2.5 text-sm transition-colors hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600",
                      optionClassName,
                      opt.disabled && "cursor-not-allowed opacity-60",
                    )}
                    onClick={() => {
                      if (opt.disabled) return
                      setSelected(opt)
                      setOpen(false)
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {opt.icon}
                      <span className="min-w-0 truncate text-neutral-900 dark:text-white font-medium">
                        {opt.label}
                      </span>
                    </span>
                    {opt.right}
                  </button>
                )
                return opt.disabledTooltip ? (
                  <Tooltip key={opt.value} content={opt.disabledTooltip}>
                    <div>{content}</div>
                  </Tooltip>
                ) : (
                  <div key={opt.value}>{content}</div>
                )
              })
            ) : (
              emptyState ?? (
                <div className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                  No results
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}


