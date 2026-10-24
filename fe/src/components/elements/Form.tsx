"use client"

import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export const inputClass =
  "min-h-[52px] w-full rounded-md border border-transparent bg-canvas px-4 py-3 text-body placeholder:text-muted-ink disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger"

export function useFieldFeedback(error: string | undefined, value: unknown) {
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<string>()
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => setMessage(error), 400)
    return () => clearTimeout(timer)
  }, [dirty, error, value])
  return {
    message,
    onChange: () => {
      setDirty(true)
      setMessage(undefined)
    },
    onBlur: () => {
      setDirty(true)
      setMessage(error)
    },
  }
}

export function Field({
  label,
  error,
  hint,
  suffix,
  className,
  id: providedId,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; suffix?: string }) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const feedback = useFieldFeedback(error, props.value)
  const showError = feedback.message && error
  return (
    <label htmlFor={id} className={cn("block space-y-2", className)}>
      <span className="block text-label font-medium">{label}</span>
      <span className="relative block">
        <input
        {...props}
        id={id}
        onBlur={(event) => {
          feedback.onBlur()
          props.onBlur?.(event)
        }}
        onChange={(event) => {
          feedback.onChange()
          props.onChange?.(event)
        }}
        aria-invalid={!!showError}
        aria-describedby={
          [props["aria-describedby"], suffix ? `${id}-suffix` : undefined, showError || hint ? `${id}-hint` : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn(inputClass, suffix && "pr-20")}
      />
        {suffix && <span id={`${id}-suffix`} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-label text-muted-ink">{suffix}</span>}
      </span>
      {showError || hint ? (
        <span
          id={`${id}-hint`}
          aria-live="polite"
          className={cn("block text-caption", showError ? "text-danger" : "text-muted-ink")}
        >
          {showError || hint}
        </span>
      ) : null}
    </label>
  )
}
export function CheckField({
  children,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl py-3 has-disabled:cursor-not-allowed has-disabled:opacity-60">
      <input {...props} type="checkbox" className="mt-0.5 size-5 shrink-0 accent-ink" />
      <span>{children}</span>
    </label>
  )
}
