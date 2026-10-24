"use client"

import { useState, type ReactNode } from "react"
import { ArrowDownToLine, CircleAlert, Plus, UserPlus } from "lucide-react"
import { formatUsdcWithUnit } from "@/lib/format"
import { Status } from "@/lib/contracts"
import type { Shipment } from "@/lib/types"
import { Card, EmptyState, TextLink } from "@/components/elements/DataState"
import { Button, ButtonLink } from "@/components/elements/Button"
import { FanMeter } from "@/components/elements/FanMeter"
import { ShipmentRow } from "@/components/elements/ShipmentRow"
import { RouteMap } from "@/components/elements/RouteMap"
import { Modal } from "@/components/elements/Modal"
import { Amount } from "@/components/elements/Amount"
import { billDueLabel, payerGreeting } from "./payer-home-display"
import { homeShipmentRows, isBill, isOverdue } from "../data/shipment"

export function PayerHomeContent({
  name,
  rows,
  creditLimit,
  outstanding,
  paidOnTime,
  paidOnTimeDetail,
  setup,
}: {
  name?: string | null
  rows: Shipment[]
  creditLimit: bigint
  outstanding: bigint
  paidOnTime: string
  paidOnTimeDetail?: string
  setup?: ReactNode
}) {
  const [tab, setTab] = useState("Active")
  const [mapOpen, setMapOpen] = useState(false)
  const bills = rows
    .filter(isBill)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))
  const live = rows.filter((s) => s.status === Status.IN_TRANSIT)
  const overdue = rows.some((s) => isOverdue(s))
  const remaining = creditLimit > outstanding ? creditLimit - outstanding : 0n
  const utilization = creditLimit > 0n ? Number((outstanding * 100n) / creditLimit) : 0
  const lateBill = bills.find((s) => isOverdue(s))
  const nextBill = lateBill ?? bills[0]
  const visible = homeShipmentRows(rows, tab)
  const now = new Date()
  const firstVisit = rows.length === 0
  const weekBills = bills.filter((s) => s.dueDate * 1000n <= BigInt(Date.now() + 7 * 86400000))
  const dueThisWeek = weekBills.reduce((sum, s) => sum + s.amount, 0n)
  const paidEarly = rows.filter((s) => s.advanced > 0n).length
  const routeLabel = (s: Shipment) =>
    `${s.trip?.pickup?.name ?? "Pickup"} to ${s.trip?.destination?.name ?? "Destination"}`
  const billCard = nextBill && (
    <Card
      className={`space-y-3.5 p-6 md:p-6 ${isOverdue(nextBill) ? "bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))]" : "bg-ink text-white"}`}
    >
      <p className={`text-label ${isOverdue(nextBill) ? "text-danger" : "text-stamp"}`}>
        {billDueLabel(nextBill)}
      </p>
      <p
        className={`text-[14px] leading-5 ${isOverdue(nextBill) ? "text-ink-2" : "text-white/75"}`}
      >
        Bill for #{nextBill.id} · {routeLabel(nextBill)}
      </p>
      <p>
        <Amount value={nextBill.amount} size="hero" className="text-[clamp(2rem,10cqi,2.125rem)]" />
      </p>
      <ButtonLink
        variant={isOverdue(nextBill) ? "primary" : "moment"}
        icon={isOverdue(nextBill) ? undefined : ArrowDownToLine}
        href={`/payer/shipments/${nextBill.id}`}
        className="h-[52px] w-full"
      >
        {isOverdue(nextBill) ? "Pay now" : "Pay early"}
      </ButtonLink>
    </Card>
  )
  return (
    <div className="-mt-[11px] space-y-4 md:mt-1 lg:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline font-medium">{payerGreeting(name, firstVisit, now)}</h1>
          <p className="mt-1 text-label text-muted-ink">
            {now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
        </div>
        <div className="grid w-full gap-3 md:flex md:w-auto md:flex-wrap">
          <ButtonLink
            href="/payer/network"
            variant="secondary"
            icon={UserPlus}
            className="hidden h-[52px] w-full md:inline-flex md:w-fit"
          >
            Invite carrier
          </ButtonLink>
          {overdue ? (
            <Button disabled icon={Plus} className="h-[52px] w-full md:w-fit">
              New shipment
            </Button>
          ) : (
            <ButtonLink
              href="/payer/shipments/new"
              icon={Plus}
              className="h-[52px] w-full md:w-fit"
            >
              New shipment
            </ButtonLink>
          )}
        </div>
      </div>
      {lateBill && (
        <div
          role="alert"
          className="hidden items-center gap-3.5 rounded-md bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] px-[18px] py-3.5 md:flex"
        >
          <CircleAlert className="size-5 shrink-0 text-danger" aria-hidden />
          <p className="flex-1 text-[14px] leading-5">
            Bill for #{lateBill.id} is {billDueLabel(lateBill).toLowerCase()}. New shipments are
            paused until it&apos;s paid.
          </p>
          <TextLink
            href={`/payer/shipments/${lateBill.id}`}
            className="min-h-0 shrink-0 text-danger"
          >
            Pay now
          </TextLink>
        </div>
      )}
      {billCard && <div className="lg:hidden">{billCard}</div>}
      <div className="hidden gap-4 md:grid md:grid-cols-3">
        {[
          [
            "Owed to the pool",
            formatUsdcWithUnit(outstanding),
            paidEarly ? `${paidEarly} trips paid early` : "Nothing yet",
          ],
          [
            "Due this week",
            formatUsdcWithUnit(dueThisWeek),
            `${weekBills.length} ${weekBills.length === 1 ? "bill" : "bills"}`,
          ],
          ["Paid on time", paidOnTime, paidOnTimeDetail],
        ].map(([label, value, context]) => (
          <Card key={label} className="p-5 md:p-5">
            <h2 className="text-caption text-muted-ink">{label}</h2>
            <p className="mt-1.5 break-words text-[clamp(1.25rem,2.25vw,2rem)] leading-none font-medium">
              {value}
            </p>
            {context && <p className="mt-1.5 text-caption text-muted-ink">{context}</p>}
          </Card>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          {setup}
          <Card className="p-3.5 md:p-[18px]">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <h2 className="text-[18px] leading-[22px] font-medium">On the road</h2>
              {live.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMapOpen(true)}
                  className="relative text-label text-stamp-deep after:absolute after:inset-x-0 after:-inset-y-3"
                >
                  Open map
                </button>
              )}
            </div>
            {live.length ? (
              <RouteMap
                fleetLabel
                trips={live.flatMap((s) => (s.trip ? [s.trip] : []))}
                className="h-[300px] lg:h-[629px]"
              />
            ) : (
              <div className="relative [&_.maplibregl-control-container]:hidden">
                <RouteMap fleetLabel trips={[]} className="h-[300px] opacity-30 lg:h-[400px]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4 text-center">
                  <p className="font-medium">No trucks on the road yet</p>
                  <p className="text-label text-muted-ink">
                    Trips show up here once a carrier picks up.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
        <div className="min-w-0 space-y-4">
          <Card
            className={`flex flex-col p-5 md:p-6 ${firstVisit ? "lg:min-h-[360px]" : "lg:min-h-[466px]"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] leading-[18px] font-medium">Credit limit</h2>
              <span
                className={`text-label ${utilization > 90 ? "text-warning" : "text-muted-ink"}`}
              >
                {utilization}% used
              </span>
            </div>
            <p
              className={`mt-3.5 text-amount font-medium tracking-[-0.035em] ${utilization > 90 ? "text-warning" : ""}`}
            >
              {formatUsdcWithUnit(remaining)}
            </p>
            <p className="mt-1 text-caption text-muted-ink">
              left to use, out of {formatUsdcWithUnit(creditLimit)}
            </p>
            <FanMeter
              value={utilization}
              label="Credit used"
              size="lg"
              className="mt-3.5 lg:mt-[18px]"
            />
            {utilization > 90 && (
              <p role="status" className="mt-3 text-caption text-warning">
                You have used over 90% of your limit.
              </p>
            )}
            <div className="mt-[18px] hidden border-t border-line pt-[18px] lg:block">
              {firstVisit ? (
                <div className="py-2">
                  <h3 className="font-medium">Nothing in use yet</h3>
                  <p className="mt-1.5 text-label text-muted-ink">
                    Each shipment you approve uses part of your limit until you pay its bill.
                  </p>
                </div>
              ) : (
                <>
                  <h3 className="mb-3 text-label font-medium">What&apos;s using it</h3>
                  <ul className="space-y-3">
                    {bills.slice(0, 3).map((s, index) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 text-caption"
                      >
                        <span
                          aria-hidden
                          className={`size-2 shrink-0 rounded-full ${isOverdue(s) ? "bg-danger" : index === 0 ? "bg-stamp" : "bg-ink"}`}
                        />
                        <TextLink href={`/payer/shipments/${s.id}`} className="min-h-0 min-w-0 flex-1 text-ink">
                          <span>
                            #{s.id} {routeLabel(s)}
                            <span
                              className={`mt-1 block text-caption font-normal ${isOverdue(s) ? "text-danger" : "text-muted-ink"}`}
                            >
                              {billDueLabel(s)}
                            </span>
                          </span>
                        </TextLink>
                        <span className="shrink-0">{formatUsdcWithUnit(s.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  <TextLink href="/payer/shipments" className="mt-3">
                    View all
                  </TextLink>
                </>
              )}
            </div>
          </Card>
          {billCard && <div className="hidden lg:block">{billCard}</div>}
        </div>
      </div>
      {!firstVisit && (
        <Card className="p-6 md:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-heading font-medium">Shipments</h2>
            <div
              role="group"
              aria-label="Shipment view"
              className="flex rounded-full bg-canvas p-1"
            >
              {["Active", "Created", "History"].map((label) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={tab === label}
                  onClick={() => setTab(label)}
                  className={`min-h-11 rounded-full px-4 text-caption ${tab === label ? "bg-ink text-white" : "text-muted-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {visible.length ? (
            <div className="grid gap-3">
              {visible.slice(0, 5).map((s) => (
                <ShipmentRow key={s.id} shipment={s} href={`/payer/shipments/${s.id}`} compact />
              ))}
            </div>
          ) : (
            <EmptyState
              title={`No ${tab.toLowerCase()} shipments`}
              description="Shipments will appear here when their status changes."
            />
          )}
          <TextLink href="/payer/shipments">View all shipments</TextLink>
        </Card>
      )}
      <Modal
        open={mapOpen}
        onOpenChange={setMapOpen}
        title="On the road"
        description={`${live.length} active shipments.`}
      >
        <RouteMap trips={live.flatMap((s) => (s.trip ? [s.trip] : []))} />
      </Modal>
    </div>
  )
}
