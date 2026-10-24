import type { Shipment, Trip } from "../../../lib/types"

/** Name of the warehouse this account receives for, read from its own shipments. */
export function hubName(shipments: Shipment[] | undefined, address: string | undefined) {
  const mine = shipments?.find(
    (s) => s.consignee.toLowerCase() === address?.toLowerCase() && s.trip?.destination?.name,
  )
  return mine?.trip?.destination?.name ?? undefined
}

/** "120 boxes of ground coffee", or just the cargo when the quantity is unknown. */
export function cargoText(trip: Pick<Trip, "cargo" | "quantity"> | undefined) {
  const cargo = trip?.cargo?.trim()
  if (!cargo) return trip?.quantity !== undefined ? `${trip.quantity} boxes` : undefined
  if (trip?.quantity === undefined) return cargo
  // Lowercase a sentence-case first word ("Rice" -> "rice"), keep acronyms and names as written
  const lowered = /^[A-Z][a-z]/.test(cargo) ? cargo[0].toLowerCase() + cargo.slice(1) : cargo
  return `${trip.quantity} boxes of ${lowered}`
}

export function greeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

/** "Today, 15:36" or "Oct 21, 11:02". */
export function dayTime(ms: number, now = Date.now()) {
  const date = new Date(ms)
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  const today = new Date(now).toDateString() === date.toDateString()
  if (today) return `Today, ${time}`
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`
}
