import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Warehouse illustration on a soft tile (empty arrivals, delivery confirmed). */
export function WarehouseIllustration({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid w-full max-w-[340px] place-items-center rounded-[28px] bg-canvas px-6 pt-6",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/illustrations/role-warehouse.svg"
        alt=""
        width={320}
        height={240}
        className="h-auto w-full max-w-[260px]"
      />
    </div>
  )
}

const tones = {
  stamp: "bg-stamp-soft text-ink",
  danger: "bg-danger/10 text-danger",
  success: "bg-success/10 text-success",
} as const

/** Centered result: art or icon circle, title, one line of copy, then actions. */
export function WarehouseResult({
  icon: Icon,
  tone = "stamp",
  art,
  title,
  children,
  actions,
  heading = "h1",
}: {
  icon?: LucideIcon
  tone?: keyof typeof tones
  art?: ReactNode
  title: string
  children?: ReactNode
  actions?: ReactNode
  heading?: "h1" | "h2"
}) {
  const Heading = heading
  return (
    <div className="@container mx-auto grid w-full max-w-[460px] justify-items-center gap-5 py-10 text-center md:py-16">
      {art}
      {Icon && (
        <span className={cn("grid size-[72px] place-items-center rounded-full", tones[tone])}>
          <Icon className="size-7" aria-hidden />
        </span>
      )}
      <div className="grid gap-2">
        <Heading className="text-[clamp(1.5rem,1.2rem+1vw,1.875rem)] leading-tight font-medium [overflow-wrap:anywhere]">
          {title}
        </Heading>
        {children && <div className="text-body text-muted-ink">{children}</div>}
      </div>
      {actions && <div className="grid w-full justify-items-center gap-2">{actions}</div>}
    </div>
  )
}
