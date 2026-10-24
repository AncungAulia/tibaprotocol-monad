"use client"

import { useEffect, useRef } from "react"
import { Status } from "@/lib/contracts"
import { cn } from "@/lib/utils"

// Labels and colors follow the shared pen.dev status chips. The chip is white with a hairline
// ring so it reads on both the canvas page and white cards; the dot carries the status color.
const statusUi: Partial<Record<number, { label: string; dot: string }>> = {
  [Status.APPROVED]: { label: "Approved", dot: "bg-muted-ink" },
  [Status.IN_TRANSIT]: { label: "In transit", dot: "bg-info" },
  [Status.DELIVERED]: { label: "Delivered", dot: "bg-stamp ring-1 ring-stamp-ring" },
  [Status.DISPUTED]: { label: "Problem reported", dot: "bg-danger" },
  [Status.FINANCED]: { label: "Paid early", dot: "bg-success" },
  [Status.REPAID]: { label: "Repaid", dot: "bg-ink" },
}

export function StatusChip({ status, className }: { status: number; className?: string }) {
  const element = useRef<HTMLSpanElement>(null)
  const previous = useRef(status)
  useEffect(() => {
    if (previous.current === status) return
    previous.current = status
    const animation = element.current?.animate([{ opacity: 0.4 }, { opacity: 1 }], {
      duration: 200,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    })
    return () => animation?.cancel()
  }, [status])
  const ui = statusUi[status]
  if (!ui) return null
  return (
    <span
      ref={element}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full bg-surface px-3 py-1 text-label font-medium whitespace-nowrap ring-1 ring-line ring-inset",
        className,
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", ui.dot)} aria-hidden />
      <span aria-live="polite">{ui.label}</span>
    </span>
  )
}
