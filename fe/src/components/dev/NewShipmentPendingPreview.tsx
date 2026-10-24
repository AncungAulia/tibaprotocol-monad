"use client"

import { scenarios } from "@/dev/preview/scenarios"
import { networkRelations, type NetworkResponse } from "@/lib/responses"
import type { Place } from "@/lib/types"
import { formatUsdc } from "@/lib/format"
import { calendarDateValue } from "@/components/elements/DateField"
import { NewShipmentContent } from "@/modules/payer/components/NewShipmentContent"

/** Uses the real form presentation with a static pending state; never submits a shipment. */
export function NewShipmentPendingPreview() {
  const data = scenarios.payer
  const carriers = networkRelations(data.api!["/api/network"] as NetworkResponse, data.address)
  const places = (data.api!["/api/places"] as { places: Place[] }).places
  const pickup = places.find((p) => p.kind === "pickup")!
  const destination = places.find((p) => p.kind === "destination" && p.receiver_address)!
  const sample = data.shipments![0]
  const account = data.pool!
  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 md:px-6 lg:px-10">
      <p className="text-label text-muted-ink">UI preview only. No shipment will be created.</p>
      <h1 className="text-headline text-center font-medium md:text-left">New shipment</h1>
      <p className="text-center text-[14px] text-muted-ink md:text-left">You approve the fee and due date now. The carrier can&apos;t be paid until the goods arrive.</p>
      <NewShipmentContent values={{ carrier: carriers[0].carrier_address, pickupId: pickup.id, destinationId: destination.id,
        cargo: sample.trip!.cargo, quantity: String(sample.trip!.quantity), fee: formatUsdc(sample.amount),
        due: calendarDateValue(new Date(Date.now() + 30 * 86400000)) }}
        onChange={() => {}} carriers={carriers} places={places} pickup={pickup} destination={destination}
        amount={sample.amount} remaining={account.creditLimit - account.outstanding} creditLimit={account.creditLimit}
        outstanding={account.outstanding} valid recoveryReady pending step="Approve this shipment in your wallet"
        errors={{}} overdue={false} minDate={calendarDateValue(new Date())}
        maxDate={calendarDateValue(new Date(Date.now() + 60 * 86400000))} onSubmit={() => {}} />
    </main>
  )
}
