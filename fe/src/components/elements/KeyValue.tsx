import type { ReactNode } from "react"

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-[14px] leading-5">
      <dt className="shrink-0 text-muted-ink">{label}</dt>
      <dd className="min-w-0 text-right font-medium [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}
