import type { Shipment } from "../../../lib/types"
import { Status } from "../../../lib/contracts"

/**
 * What the carrier received for a shipment: the early payout from the pool, or the full amount
 * when the company repaid the carrier directly. Undefined while nothing has been paid.
 */
export function payoutAmount(shipment: Pick<Shipment, "status" | "advanced" | "amount">) {
  if (shipment.advanced > 0n) return shipment.advanced
  if (shipment.status === Status.REPAID) return shipment.amount
  return undefined
}

/** Shipments that paid this carrier, newest first, with the amount received. */
export function payouts<T extends Pick<Shipment, "id" | "status" | "advanced" | "amount">>(
  rows: T[],
) {
  return rows
    .flatMap((shipment) => {
      const amount = payoutAmount(shipment)
      return amount !== undefined ? [{ shipment, amount }] : []
    })
    .sort((a, b) => Number(b.shipment.id) - Number(a.shipment.id))
}
