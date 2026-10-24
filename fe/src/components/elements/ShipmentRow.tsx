import Link from "next/link"
import type { ReactNode } from "react"
import { Truck } from "lucide-react"
import { StatusChip } from "./StatusChip"
import { formatUsdcWithUnit } from "@/lib/format"
import type { Shipment } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Bordered shipment card for lists. Phones: route on top, amount and status on a second line.
 * From `sm`: one row with amount over status on the right. Long names truncate instead of scrolling.
 */
export function ShipmentRow({
  shipment: s,
  href,
  note,
  className,
  compact = false,
}: {
  shipment: Shipment
  href: string
  /** Extra line under the details, such as an arrival estimate. */
  note?: ReactNode
  className?: string
  compact?: boolean
}) {
  const route = `${s.trip?.pickup?.name ?? "Pickup"} to ${s.trip?.destination?.name ?? "Destination"}`
  const details = [
    `#${s.id}`,
    s.trip?.carrier_name,
    compact ? null : (s.trip?.cargo ?? "Trip details pending"),
  ]
    .filter(Boolean)
    .join(" · ")
  const due = `Due ${new Date(Number(s.dueDate) * 1000).toLocaleDateString(
    compact ? "en-US" : "en-GB",
    {
      day: "numeric",
      month: "short",
    },
  )}`

  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 gap-3 rounded-[20px] border border-line bg-surface p-3 transition-colors hover:bg-canvas sm:items-center sm:gap-4 sm:p-4",
        compact && "gap-3.5 px-4 py-3.5 sm:gap-3.5 sm:py-3.5",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full bg-subtle sm:size-11",
          compact && "self-center sm:size-10",
        )}
      >
        <Truck size={18} aria-hidden />
      </span>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4",
          compact &&
            "min-[390px]:flex-row min-[390px]:flex-wrap min-[390px]:items-center min-[390px]:gap-3.5",
        )}
      >
        <div
          className={cn(
            "min-w-0 sm:flex-1",
            compact && "min-[390px]:min-w-[100px] min-[390px]:flex-1",
          )}
        >
          <p
            title={route}
            className={cn(
              "truncate font-medium",
              compact && "whitespace-normal break-words leading-[18px]",
            )}
          >
            {route}
          </p>
          <p
            title={details}
            className={cn(
              "mt-0.5 truncate text-caption text-muted-ink",
              compact && "whitespace-normal break-words",
            )}
          >
            {details}
            <span className={compact ? "inline" : "hidden sm:inline"}> · {due}</span>
          </p>
          {note && <p className="mt-1 text-caption text-muted-ink">{note}</p>}
        </div>
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 sm:shrink-0 sm:flex-nowrap sm:flex-col sm:items-end sm:gap-1.5",
            compact &&
              "min-[390px]:ml-auto min-[390px]:shrink-0 min-[390px]:flex-col min-[390px]:items-end",
          )}
        >
          <p className="min-w-0 font-medium">
            {formatUsdcWithUnit(s.amount)}
            {!compact && (
              <span className="ml-2 text-caption font-normal text-muted-ink sm:hidden">{due}</span>
            )}
          </p>
          <StatusChip status={s.status} className="shrink-0" />
        </div>
      </div>
    </Link>
  )
}
