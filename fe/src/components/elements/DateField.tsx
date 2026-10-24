"use client"

import { useId, useRef, useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { inputClass, useFieldFeedback } from "./Form"
import { cn } from "@/lib/utils"

export const calendarDateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

export function calendarDays(month: Date) {
  const y = month.getFullYear(), m = month.getMonth()
  const offset = (new Date(y, m, 1).getDay() + 6) % 7
  const count = Math.ceil((offset + new Date(y, m + 1, 0).getDate()) / 7) * 7
  return Array.from({ length: count }, (_, i) => new Date(y, m, 1 - offset + i))
}

export function calendarKeyboardDate(date: Date, key: string) {
  const steps: Record<string, number> = {
    ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
    Home: -((date.getDay() + 6) % 7), End: 6 - ((date.getDay() + 6) % 7),
  }
  if (Object.hasOwn(steps, key)) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + steps[key])
  if (key === "PageUp" || key === "PageDown") {
    const month = date.getMonth() + (key === "PageUp" ? -1 : 1)
    return new Date(date.getFullYear(), month, Math.min(date.getDate(), new Date(date.getFullYear(), month + 1, 0).getDate()))
  }
}

export function DateField({ label, value, onChange, min, max, hint, error }: {
  label: string; value: string; onChange: (value: string) => void
  min: string; max: string; hint?: string; error?: string
}) {
  const id = useId()
  const feedback = useFieldFeedback(error, value)
  const showError = feedback.message && error
  const initial = new Date(`${value || min}T00:00:00`)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(initial)
  const [focused, setFocused] = useState(value || min)
  const content = useRef<HTMLDivElement>(null)
  const days = calendarDays(month)
  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const changeMonth = (direction: number) => {
    const date = new Date(month.getFullYear(), month.getMonth() + direction, 1)
    const key = calendarDateValue(date)
    setMonth(date)
    setFocused(key < min ? min : key > max ? max : key)
  }
  const select = (key: string) => {
    feedback.onChange()
    onChange(key)
    setOpen(false)
  }
  const today = calendarDateValue(new Date())
  const until = value ? Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : 0
  return (
    <div className="min-w-0 space-y-2">
      <span id={id} className="block text-label font-medium">{label}</span>
      <Popover.Root open={open} onOpenChange={(next) => {
        if (next) {
          const key = value >= min && value <= max ? value : min
          setMonth(new Date(`${key}T00:00:00`)); setFocused(key)
        }
        setOpen(next)
      }}>
        <Popover.Trigger type="button" aria-labelledby={id} aria-haspopup="dialog"
          aria-invalid={!!showError} aria-describedby={hint || showError ? `${id}-hint` : undefined}
          onBlur={feedback.onBlur}
          onKeyDown={(e) => { if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); select("") } }}
          className={cn(inputClass, "flex items-center justify-between gap-3 text-left", !value && "text-muted-ink")}>
          <span className="min-w-0 break-words">{value ? `${initial.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}${until > 0 ? ` · in ${until} ${until === 1 ? "day" : "days"}` : ""}` : "Pick a date"}</span>
          <CalendarDays size={16} className="shrink-0 text-muted-ink" aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content ref={content} align="end" sideOffset={6} collisionPadding={12}
            aria-label="Choose a due date"
            onOpenAutoFocus={(e) => { e.preventDefault(); requestAnimationFrame(() => content.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus()) }}
            className="tiba-popover z-50 w-[min(436px,calc(100vw-24px))] rounded-[18px] border border-line bg-surface p-4 shadow-float">
            <div className="mb-3.5 grid grid-cols-3 gap-2">
              {[30, 45, 60].map((n) => {
                const key = calendarDateValue(new Date(Date.now() + n * 86400000))
                return <button key={n} type="button" disabled={key < min || key > max} onClick={() => select(key)}
                  className={`min-h-11 rounded-full px-2 text-label disabled:opacity-40 ${value === key ? "bg-ink text-white" : "bg-canvas"}`}>{n} days</button>
              })}
            </div>
            <div className="mb-2 flex items-center justify-between">
              <button type="button" aria-label="Previous month" disabled={calendarDateValue(new Date(month.getFullYear(), month.getMonth(), 0)) < min} onClick={() => changeMonth(-1)} className="grid size-11 place-items-center rounded-full hover:bg-canvas disabled:opacity-30"><ChevronLeft size={18} aria-hidden /></button>
              <p id={`${id}-month`} aria-live="polite" className="text-[14px] font-medium">{monthLabel}</p>
              <button type="button" aria-label="Next month" disabled={calendarDateValue(new Date(month.getFullYear(), month.getMonth() + 1, 1)) > max} onClick={() => changeMonth(1)} className="grid size-11 place-items-center rounded-full hover:bg-canvas disabled:opacity-30"><ChevronRight size={18} aria-hidden /></button>
            </div>
            <table role="grid" aria-labelledby={`${id}-month`} className="w-full table-fixed border-separate border-spacing-y-0.5 text-center">
              <thead><tr>{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => <th key={day} scope="col" className="h-7 text-caption font-normal text-muted-ink">{day}</th>)}</tr></thead>
              <tbody>{Array.from({ length: days.length / 7 }, (_, row) => (
                <tr key={row}>{days.slice(row * 7, row * 7 + 7).map((date) => {
                  const key = calendarDateValue(date)
                  const selected = key === value
                  return <td key={key} aria-selected={selected} className="p-0">
                    {date.getMonth() === month.getMonth() && <button type="button" data-date={key}
                      aria-label={date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      aria-current={key === today ? "date" : undefined}
                      disabled={key < min || key > max} tabIndex={key === focused ? 0 : -1}
                      onFocus={() => setFocused(key)} onClick={() => select(key)}
                      onKeyDown={(e) => {
                        const next = calendarKeyboardDate(date, e.key)
                        if (!next) return
                        e.preventDefault()
                        const nextKey = calendarDateValue(next)
                        if (nextKey < min || nextKey > max) return
                        setMonth(next); setFocused(nextKey)
                        requestAnimationFrame(() => content.current?.querySelector<HTMLButtonElement>(`[data-date="${nextKey}"]`)?.focus())
                      }}
                      className={`min-h-9 w-full rounded-[10px] text-label disabled:text-muted-ink disabled:opacity-35 ${selected ? "bg-stamp font-semibold" : "hover:bg-canvas"}`}>{date.getDate()}</button>}
                  </td>
                })}</tr>
              ))}</tbody>
            </table>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-caption text-muted-ink">
              <p>Paying later than 60 days needs a talk with us.</p>
              {value && <button type="button" onClick={() => select("")} className="min-h-11 text-stamp-deep">Clear date</button>}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {(showError || hint) && <p id={`${id}-hint`} aria-live="polite" className={`text-caption ${showError ? "text-danger" : "text-muted-ink"}`}>{showError || hint}</p>}
    </div>
  )
}
