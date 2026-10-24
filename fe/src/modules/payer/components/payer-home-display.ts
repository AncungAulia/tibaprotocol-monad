import { isOverdue } from "../data/shipment"
import type { Shipment } from "@/lib/types"

export function payerGreeting(
  name: string | null | undefined,
  firstVisit: boolean,
  now = new Date(),
) {
  if (!name) return "Your shipments"
  const hour = now.getHours()
  const greeting = firstVisit
    ? "Welcome"
    : hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening"
  return `${greeting}, ${name}`
}

export function billDueLabel(bill: Shipment, now = Date.now()) {
  const due = Number(bill.dueDate) * 1000
  if (isOverdue(bill, now)) {
    const days = Math.floor((now - due) / 86400000)
    return days === 0 ? "Less than a day late" : `${days} ${days === 1 ? "day" : "days"} late`
  }
  const days = Math.max(0, Math.ceil((due - now) / 86400000))
  return days === 0 ? "Due today" : `Due in ${days} ${days === 1 ? "day" : "days"}`
}
