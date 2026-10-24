"use client"

import { useId, useState, type ReactNode } from "react"
import * as Popover from "@radix-ui/react-popover"
import { Command } from "cmdk"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { inputClass } from "./Form"
import { cn } from "@/lib/utils"

export type SelectOption = { value: string; label: string; keywords?: string[]; disabled?: boolean; description?: string; leading?: ReactNode }
export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose an option",
  disabled = false,
  selectedLabel,
  hideLabel = false,
  className,
  hint,
  searchPlaceholder = "Search...",
  footer,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  selectedLabel?: ReactNode
  hideLabel?: boolean
  className?: string
  hint?: string
  searchPlaceholder?: string
  footer?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const selected = options.find((option) => option.value === value)
  return (
    <div className={hideLabel ? "min-w-0" : "space-y-2"}>
      <span id={id} className={hideLabel ? "sr-only" : "block text-label font-medium"}>
        {label}
      </span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          disabled={disabled}
          type="button"
          aria-labelledby={id}
          aria-describedby={hint ? `${id}-hint` : undefined}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? `${id}-options` : undefined}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()
              setOpen(true)
            }
          }}
          className={cn(inputClass, "flex items-center justify-between gap-3 text-left", className)}
        >
          <span className={cn("min-w-0 truncate", !selected && "text-muted-ink")}>
            {selectedLabel ?? selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown size={16} className="shrink-0 text-muted-ink" aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className="tiba-popover z-50 w-[var(--radix-popover-trigger-width)] min-w-[min(280px,calc(100vw-24px))] max-w-[calc(100vw-24px)] rounded-[18px] border border-line bg-surface p-2 shadow-float"
          >
            <Command label={label} defaultValue={value}>
              {/* The search box is focused as soon as the list opens, so it shows an inset edge
                  instead of the page-level double ring, which would be clipped by the popover */}
              <div className="mb-1 flex items-center gap-2 rounded-sm bg-canvas px-3 focus-within:shadow-[inset_0_0_0_1.5px_var(--ink)]">
                <Search size={16} className="shrink-0 text-muted-ink" aria-hidden />
                <Command.Input
                  autoFocus
                  aria-label={`Search ${label.toLowerCase()}`}
                  placeholder={searchPlaceholder}
                  className="h-11 min-w-0 w-full bg-transparent placeholder:text-muted-ink focus-visible:shadow-none"
                />
              </div>
              <Command.List
                id={`${id}-options`}
                className="max-h-[min(256px,calc(var(--radix-popover-content-available-height)_-_80px))] scroll-py-1 overflow-y-auto overscroll-contain p-1 [scrollbar-width:thin] [scrollbar-color:var(--line-strong)_transparent]"
              >
                <Command.Empty className="px-3 py-5 text-muted-ink">
                  No matches found.
                </Command.Empty>
                {options.map((option) => (
                  <Command.Item
                    key={option.value}
                    value={option.value}
                    keywords={[option.label, option.description ?? "", ...(option.keywords ?? [])]}
                    disabled={option.disabled}
                    onSelect={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3 data-[selected=true]:bg-canvas data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-40"
                  >
                    {option.leading}
                    <span className="min-w-0 flex-1 break-words">
                      <span className="block">{option.label}</span>
                      {option.description && <span className="mt-0.5 block text-caption text-muted-ink">{option.description}</span>}
                    </span>
                    {value === option.value && <Check size={16} className="shrink-0" aria-hidden />}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
            {footer && <div className="mt-1 border-t border-line px-3 pt-1">{footer}</div>}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {hint && <p id={`${id}-hint`} className="text-caption text-muted-ink">{hint}</p>}
    </div>
  )
}
