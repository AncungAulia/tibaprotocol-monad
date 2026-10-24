"use client"

import Link from "next/link"
import { Search, type LucideIcon } from "lucide-react"
import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

export type DataColumn<T> = {
  key: string
  header: string
  /** Desktop column width, e.g. "140px". */
  width: string
  cell: (row: T) => ReactNode
}

/**
 * Responsive list table (Pencil: Deliveries and Shipments tables).
 * Wide containers (>= 720px): a white table with a header row and fixed-width columns.
 * Narrow containers: the same rows as a list, with the main cell on the left and `aside` on the right.
 * Rows open a link (`href`) or call `onSelect`; the whole row is the hit target.
 */
export function DataTable<T>({
  label,
  rows,
  getKey,
  header,
  icon: Icon,
  primary,
  columns,
  aside,
  href,
  onSelect,
  loading,
  empty,
  className,
}: {
  /** Accessible name of the list. */
  label: string
  rows: T[]
  getKey: (row: T) => string
  /** Header of the main column. */
  header: string
  icon: LucideIcon
  primary: (row: T) => { title: string; subtitle?: string }
  columns: DataColumn<T>[]
  /** What phones show on the right of each row (usually the amount over the status). */
  aside: (row: T) => ReactNode
  href?: (row: T) => string
  onSelect?: (row: T) => void
  /** Show skeleton rows instead of data. */
  loading?: boolean
  /** Shown instead of the rows when there are none. */
  empty?: ReactNode
  className?: string
}) {
  const style = {
    "--cols": `minmax(0,1fr) ${columns.map((column) => column.width).join(" ")}`,
  } as CSSProperties
  const rowGrid =
    "flex items-center gap-3 @min-[720px]:grid @min-[720px]:gap-4 @min-[720px]:[grid-template-columns:var(--cols)]"

  return (
    <div
      style={style}
      className={cn("@container min-w-0 rounded-[28px] bg-surface px-4 py-2 sm:px-5", className)}
    >
      <div
        aria-hidden
        className={cn(rowGrid, "hidden py-3 text-caption text-muted-ink @min-[720px]:grid")}
      >
        <span>{header}</span>
        {columns.map((column) => (
          <span key={column.key}>{column.header}</span>
        ))}
      </div>
      {loading ? (
        <div role="status" aria-label="Loading">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className={cn(
                rowGrid,
                "border-t border-line py-3.5 first:border-t-0 @min-[720px]:first:border-t",
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="size-10 shrink-0 rounded-full bg-subtle" />
                <div className="min-w-0 flex-1 space-y-2">
                  <span className="block h-4 w-2/3 max-w-56 rounded-full bg-subtle" />
                  <span className="block h-3 w-1/2 max-w-40 rounded-full bg-subtle" />
                </div>
              </div>
              {columns.map((column) => (
                <span
                  key={column.key}
                  className="hidden h-4 w-3/4 rounded-full bg-subtle @min-[720px]:block"
                />
              ))}
              <span className="h-4 w-20 shrink-0 rounded-full bg-subtle @min-[720px]:hidden" />
            </div>
          ))}
          <span className="sr-only">Loading</span>
        </div>
      ) : !rows.length ? (
        empty
      ) : (
        <ul aria-label={label}>
          {rows.map((row) => {
            const main = primary(row)
            const content = (
              <>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas">
                    <Icon size={17} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p title={main.title} className="truncate font-medium">
                      {main.title}
                    </p>
                    {main.subtitle && (
                      <p
                        title={main.subtitle}
                        className="mt-0.5 line-clamp-2 text-caption text-muted-ink @min-[720px]:truncate"
                      >
                        {main.subtitle}
                      </p>
                    )}
                  </div>
                </div>
                {columns.map((column) => (
                  <div key={column.key} className="hidden min-w-0 @min-[720px]:block">
                    {column.cell(row)}
                  </div>
                ))}
                <div className="flex shrink-0 flex-col items-end gap-1.5 text-right @min-[720px]:hidden">
                  {aside(row)}
                </div>
              </>
            )
            const rowClass = cn(
              rowGrid,
              "w-full py-3.5 text-left transition-colors hover:bg-canvas/60 focus-visible:bg-canvas/60",
            )
            return (
              <li
                key={getKey(row)}
                className="border-t border-line first:border-t-0 @min-[720px]:first:border-t"
              >
                {href ? (
                  <Link href={href(row)} className={rowClass}>
                    {content}
                  </Link>
                ) : onSelect ? (
                  <button type="button" className={rowClass} onClick={() => onSelect(row)}>
                    {content}
                  </button>
                ) : (
                  <div className={rowClass}>{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Pill tabs with counts above a table. Scrolls inside itself on narrow screens. */
export function TableTabs<V extends string>({
  label,
  tabs,
  value,
  onChange,
  className,
}: {
  label: string
  tabs: { value: V; label: string; count?: number }[]
  value: V
  onChange: (value: V) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex max-w-full gap-1.5 overflow-x-auto rounded-full bg-surface p-1 [scrollbar-width:none]",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-label font-medium whitespace-nowrap transition-colors",
              active ? "bg-ink text-white" : "text-ink-2 hover:bg-canvas",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "text-caption font-normal",
                  active ? "text-white/70" : "text-muted-ink",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Pill search field that sits next to the tabs. */
export function TableSearch({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label
      className={cn(
        "flex h-11 min-w-0 items-center gap-2.5 rounded-full bg-surface px-4 focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      <Search size={16} className="shrink-0 text-muted-ink" aria-hidden />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        {...props}
        className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-ink focus-visible:shadow-none"
      />
    </label>
  )
}
