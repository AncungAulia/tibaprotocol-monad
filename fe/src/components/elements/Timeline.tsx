import { Check, CircleAlert } from "lucide-react"
import { Status } from "@/lib/contracts"
import { formatUsdcWithUnit } from "@/lib/format"
import type { Shipment } from "@/lib/types"

const timestamp = (date: Date) =>
  Number.isFinite(date.getTime())
    ? date.toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
      })
    : undefined

export function Timeline({ shipment: s, payer = false }: { shipment: Shipment; payer?: boolean }) {
  const carrier = s.trip?.carrier_name ?? "Carrier"
  const disputed = s.status === Status.DISPUTED
  const reached = disputed ? 3 : s.status === Status.REPAID ? 5 : s.status === Status.FINANCED ? 4 : s.status
  const stages = [
    { label: payer ? "Approved by you" : "Approved by company" },
    {
      label: payer ? `Picked up by ${carrier}` : "Picked up by carrier",
      detail: s.trip?.picked_up_at
        ? timestamp(new Date(s.trip.picked_up_at))
        : s.status === Status.APPROVED ? "Waiting for pickup" : undefined,
    },
    {
      label: payer && s.trip?.destination?.name ? `Arrived at ${s.trip.destination.name}` : "Arrival confirmed",
      detail: s.deliveredAt > 0n ? timestamp(new Date(Number(s.deliveredAt) * 1000)) : undefined,
    },
    {
      label: s.status === Status.REPAID && s.advanced === 0n ? "Carrier payment settled" : payer ? `${carrier} paid early` : "Carrier paid early",
      detail: disputed ? "On hold" : s.advanced > 0n ? formatUsdcWithUnit(s.advanced) : undefined,
    },
    {
      label: payer ? "You repaid" : "Bill repaid",
      detail: s.status === Status.REPAID ? formatUsdcWithUnit(s.amount) : s.status === Status.FINANCED
        ? `Due ${new Date(Number(s.dueDate) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : undefined,
    },
  ]
  return (
    <ol className="space-y-1">
      {stages.map(({ label, detail }, index) => {
        const done = index < reached
        const current = index === reached
        const held = disputed && current
        return (
          <li key={index} aria-current={current ? "step" : undefined} className="flex items-start gap-3.5 py-2.5">
            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${done ? "bg-ink text-white" : held ? "bg-danger/10 text-danger" : current ? "bg-stamp text-ink" : "border border-line-strong bg-surface"}`}>
              {done ? <Check size={14} aria-hidden /> : held ? <CircleAlert size={14} aria-hidden /> : current ? <span className="size-1.5 rounded-full bg-ink" /> : null}
            </span>
            <span className="min-w-0">
              <span className={`block text-[14.5px] leading-5 ${done || current ? "font-medium" : "text-muted-ink"}`}>{label}</span>
              {detail && <span className={`mt-0.5 block text-caption ${held ? "text-danger" : "text-muted-ink"}`}>{detail}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
