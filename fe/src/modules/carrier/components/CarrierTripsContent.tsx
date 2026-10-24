"use client"

import { useState } from "react"
import { ArrowDownToLine, Navigation, QrCode, PackageCheck } from "lucide-react"
import Image from "next/image"
import { Amount } from "@/components/elements/Amount"
import { ReadyToGetPaid, TripQR, tripTitle } from "./TripPresentation"
import { Status } from "@/lib/contracts"
import type { Shipment } from "@/lib/types"
import { formatUsdcWithUnit } from "@/lib/format"
import { Card, EmptyState, TextLink } from "@/components/elements/DataState"
import { Button, ButtonLink } from "@/components/elements/Button"
import { RouteMap } from "@/components/elements/RouteMap"
import { StatusChip } from "@/components/elements/StatusChip"
import { payouts } from "../data/payouts"

export function CarrierTripsContent({ name, rows }: { name?: string | null; rows: Shipment[] }) {
  const [qr, setQr] = useState<Shipment | null>(null)
  const active = rows.filter((s) =>
    [Status.APPROVED, Status.IN_TRANSIT, Status.DELIVERED, Status.DISPUTED].includes(s.status),
  )
  const paid = payouts(rows)
  const ready = active.filter((s) => s.status === Status.DELIVERED)
  const live = active.filter((s) => s.status === Status.IN_TRANSIT)
  const others = active.filter(
    (s) => s.status !== Status.IN_TRANSIT && s.status !== Status.DELIVERED,
  )
  const title = tripTitle
  const waitingCard = (s: Shipment) => (
    <Card
      key={s.id}
      className="p-5 md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-heading font-medium">{title(s)}</h2>
          <p className="mt-1 text-caption text-muted-ink">
            #{s.id} · {s.trip?.payer_name ?? "Shipping company"}
          </p>
        </div>
        <StatusChip status={s.status} />
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-caption text-muted-ink">
            You get on arrival
          </p>
          <Amount value={(s.amount * 98n) / 100n} />
        </div>
      </div>
      <div className="mt-4">
        <ButtonLink
          href={`/carrier/trips/${s.id}`}
          variant="secondary"
          icon={PackageCheck}
          className="w-full sm:w-fit"
        >
          {s.status === Status.APPROVED
            ? "Confirm pickup"
            : "View issue"}
        </ButtonLink>
      </div>
    </Card>
  )
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline font-medium">{ready.length ? "Ready to get paid" : name ? `Hi, ${name}` : "Your trips"}</h1>
        <p className="mt-1 text-label text-muted-ink">
          {ready.length ? `Your delivery to ${ready[0].trip?.destination?.name ?? "the warehouse"} was confirmed` : !active.length ? "Let's get your first trip" : `${active.length} active ${active.length === 1 ? "trip" : "trips"}`}
        </p>
      </header>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className={`min-w-0 space-y-4 ${!active.length ? "lg:col-span-2" : ""}`}>
          {ready.map((s) => <ReadyToGetPaid key={s.id} shipment={s} />)}
          {live.map((s) => (
            <Card key={s.id} className="p-3.5 md:p-[18px]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-medium">On the road · #{s.id}</h2>
                <TextLink href={`/carrier/trips/${s.id}`}>Details</TextLink>
              </div>
              <RouteMap
                pickup={s.trip?.pickup}
                destination={s.trip?.destination}
                route={s.trip?.route_geojson}
                location={s.trip?.location}
                simulation={s.trip?.simulation}
                channel={s.trip?.channel}
                label={<span className="flex items-center gap-2"><span aria-hidden className={`size-1.5 rounded-full ${s.trip?.share_location === false ? "bg-muted-ink" : "bg-success"}`} />{s.trip?.share_location === false ? "Location sharing paused" : "Sharing location"}</span>}
                className="h-[240px] lg:h-[300px]"
              />
              {s.metadataError && (
                <p role="alert" className="mt-3 text-caption text-danger">
                  Trip details are unavailable. Open the trip to retry.
                </p>
              )}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button className="w-full sm:w-fit" icon={QrCode} onClick={() => setQr(s)}>
                  Show QR at arrival
                </Button>
                {s.trip?.destination && (
                  <ButtonLink
                    variant="secondary"
                    icon={Navigation}
                    className="w-full sm:w-fit"
                    target="_blank"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${s.trip.destination.lat},${s.trip.destination.lng}`}
                  >
                    Open in Google Maps
                  </ButtonLink>
                )}
              </div>
            </Card>
          ))}
          {others.map(waitingCard)}
          {!active.length && (
            <Card>
              <Image src="/illustrations/role-carrier.svg" alt="" width={280} height={210} className="mx-auto h-auto max-w-full" />
              <EmptyState
                title="No trips yet"
                description="Trips appear here once a shipping company you work with approves one for you."
                action={<TextLink href="/carrier/companies">Your companies</TextLink>}
              />
            </Card>
          )}
        </div>
        {active.length > 0 && <aside className="space-y-4">
          <Card className="hidden p-6 md:p-6 lg:block">
            <h2 className="text-caption text-muted-ink">Total paid to you</h2>
            <div className="mt-3"><Amount value={paid.reduce((sum, p) => sum + p.amount, 0n)} /></div>
            <p className="mt-2 text-caption text-muted-ink">
              {paid.length} paid {paid.length === 1 ? "shipment" : "shipments"}
            </p>
          </Card>
          <Card className="p-5 md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-medium">Recent payouts</h2>
              <TextLink href="/carrier/payouts">See all</TextLink>
            </div>
            {paid.length ? (
              <ul className="space-y-4">
                {paid.slice(0, 3).map(({ shipment: s, amount }) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/10 text-success">
                      <ArrowDownToLine size={16} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <TextLink href={`/carrier/trips/${s.id}`}>{title(s)}</TextLink>
                      <p className="text-caption text-muted-ink">#{s.id}</p>
                    </div>
                    <p className="min-w-0 text-right text-label text-success [overflow-wrap:anywhere]">
                      +{formatUsdcWithUnit(amount)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-label text-muted-ink">
                Your payouts will appear here after you get paid.
              </p>
            )}
          </Card>
        </aside>}
      </div>
      {qr && <TripQR shipment={qr} open={!!qr} onOpenChange={(open) => { if (!open) setQr(null) }} />}
    </div>
  )
}
