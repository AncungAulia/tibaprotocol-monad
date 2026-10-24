"use client"

import { useState, type ReactNode } from "react"
import { ArrowDownToLine, BadgeCheck, CircleAlert, Phone } from "lucide-react"
import { Amount } from "@/components/elements/Amount"
import { Button, ButtonLink } from "@/components/elements/Button"
import { Card } from "@/components/elements/DataState"
import { KeyValue } from "@/components/elements/KeyValue"
import { Modal } from "@/components/elements/Modal"
import { RouteMap } from "@/components/elements/RouteMap"
import { StatusChip } from "@/components/elements/StatusChip"
import { Timeline } from "@/components/elements/Timeline"
import { Status } from "@/lib/contracts"
import { formatUsdcWithUnit } from "@/lib/format"
import type { Shipment } from "@/lib/types"
import { issueLabels } from "@/modules/warehouse/data/report"
import { isBill, isOverdue } from "../data/shipment"
import { billDueLabel } from "./payer-home-display"

export function ShipmentDetailContent({ shipment: s, onPay, feedback }: {
  shipment: Shipment
  onPay: () => void
  feedback?: ReactNode
}) {
  const [reportOpen, setReportOpen] = useState(false)
  const trip = s.trip
  const carrier = trip?.carrier_name ?? "The carrier"
  const disputed = s.status === Status.DISPUTED
  const repaid = s.status === Status.REPAID
  const paused = s.status === Status.IN_TRANSIT && trip?.share_location === false
  const dueDate = new Date(Number(s.dueDate) * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })
  const mapLabel = paused ? "Location paused" : s.status === Status.APPROVED
    ? "Waiting for pickup" : disputed || repaid ? "Trip finished"
    : s.status === Status.FINANCED || s.status === Status.DELIVERED ? "Trip arrived" : undefined
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-headline font-medium [overflow-wrap:anywhere]">
            {trip?.pickup?.name ?? "Pickup"} to {trip?.destination?.name ?? "Destination"}
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-ink">Shipment #{s.id}</p>
        </div>
        <StatusChip status={s.status} />
      </div>
      {s.metadataError && <p role="alert" className="text-danger">Trip details could not load: {s.metadataError}</p>}
      {disputed && (
        <section className="space-y-3 rounded-[20px] bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] px-5 py-[18px]" aria-label="Delivery problem">
          <h2 className="flex items-center gap-2.5 font-medium">
            <CircleAlert size={20} className="shrink-0 text-danger" aria-hidden />
            {trip?.destination?.name ?? "The warehouse"} reported a problem
          </h2>
          <p className="text-[14px] text-ink-2">
            {trip?.report?.note && <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">&quot;{trip.report.note}&quot; </span>}
            {carrier} can&apos;t be paid early until this is settled.
          </p>
          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <Button onClick={() => setReportOpen(true)} className="h-[52px] w-full sm:w-fit">Read the report</Button>
            {trip?.carrier_phone && <ButtonLink href={`sms:${trip.carrier_phone}`} variant="secondary" className="h-[52px] w-full sm:w-fit">Message {carrier}</ButtonLink>}
          </div>
        </section>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <div className="[&>div]:rounded-[24px]">
            <RouteMap pickup={trip?.pickup} destination={trip?.destination}
              route={trip?.route_geojson} location={trip?.location}
              simulation={trip?.simulation} channel={trip?.channel}
              label={mapLabel} className="h-[340px] lg:h-[560px]" />
          </div>
          {paused && (
            <p role="status" className="rounded-md bg-subtle px-4 py-3.5 text-[13.5px]">
              {carrier}&apos;s phone stopped sharing location. The trip is still on.
              <span className="hidden lg:inline"> You&apos;ll see the next update when the app opens again.</span>
            </p>
          )}
        </div>
        <div className="min-w-0 space-y-4">
          {(isBill(s) || repaid || disputed) && (
            <Card className={`space-y-3 p-6 md:p-6 ${disputed || isOverdue(s) ? "bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))]" : repaid ? "" : "bg-ink text-white"}`}>
              <h2 className={`text-label font-medium ${disputed || isOverdue(s) ? "text-danger" : repaid ? "text-success" : "text-stamp"}`}>
                {disputed ? "Bill on hold" : repaid ? "Bill repaid" : "Your bill"}
              </h2>
              <p><Amount value={s.amount} size="hero" className="text-[clamp(2rem,10cqi,2.125rem)]" /></p>
              <p className={`text-[13.5px] leading-5 ${disputed || isOverdue(s) || repaid ? "text-ink-2" : "text-white/75"}`}>
                {disputed ? "Nothing is due while the problem is open." : repaid ? "Your payment is complete." : `Due ${dueDate} · ${billDueLabel(s).replace(/^Due /, "").toLowerCase()}`}
              </p>
              {isBill(s) && <Button variant={isOverdue(s) ? "primary" : "moment"} icon={ArrowDownToLine} onClick={onPay} className="h-[52px] w-full">{isOverdue(s) ? "Pay now" : "Pay early"}</Button>}
              {repaid && (
                <div className="flex items-center gap-3 rounded-[18px] bg-canvas px-4 py-3">
                  <BadgeCheck className="size-8 shrink-0 rounded-full bg-success/10 p-1.5 text-success" aria-hidden />
                  <span className="text-label font-medium">Bill paid</span>
                </div>
              )}
              {feedback}
            </Card>
          )}
          <Card className="p-6 md:p-6">
            <h2 className="mb-1 text-[18px] font-medium">Progress</h2>
            <Timeline shipment={s} payer />
            {!disputed && trip?.report && <Button variant="quiet" icon={null} onClick={() => setReportOpen(true)} className="mt-2 w-full">Read the report</Button>}
          </Card>
          <Card className="p-6 md:p-6">
            <h2 className="mb-1.5 text-[18px] font-medium">Trip</h2>
            <dl className="divide-y divide-line">
              {[
                ["Carrier", trip?.carrier_name ?? "Connected carrier"],
                ["Cargo", trip?.cargo ?? "Not available"],
                ["From", trip?.pickup?.name ?? trip?.pickup?.address ?? "Not available"],
                ["To", trip?.destination?.name ?? trip?.destination?.address ?? "Not available"],
                ["Shipping fee", formatUsdcWithUnit(s.amount)],
              ].map(([label, value]) => <KeyValue key={label} label={label}>{value}</KeyValue>)}
            </dl>
            {trip?.carrier_phone && <ButtonLink variant="secondary" icon={Phone} className="mt-2.5 h-[52px] w-full" href={`tel:${trip.carrier_phone}`}>Call driver</ButtonLink>}
          </Card>
        </div>
      </div>
      <Modal open={reportOpen} onOpenChange={setReportOpen} title="Arrival report">
        {trip?.report ? (
          <div className="space-y-3">
            <p>{issueLabels(trip.report.issues)}</p>
            <p>{trip.report.received_qty} received</p>
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{trip.report.note}</p>
          </div>
        ) : <p>The report is not available yet. Contact the carrier for details.</p>}
      </Modal>
    </>
  )
}
