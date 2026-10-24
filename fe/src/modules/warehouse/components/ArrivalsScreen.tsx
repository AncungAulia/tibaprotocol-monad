"use client"

import Link from "next/link"
import { ScanLine, Truck } from "lucide-react"
import { useAuth } from "@/providers/AuthProvider"
import { useShipments } from "@/lib/ledger"
import { useProfile } from "@/lib/queries"
import { Status } from "@/lib/contracts"
import { cn } from "@/lib/utils"
import { PageHeading } from "@/components/elements/PageHeading"
import { Card, QueryState } from "@/components/elements/DataState"
import { ButtonLink } from "@/components/elements/Button"
import { RouteMap } from "@/components/elements/RouteMap"
import { formatDuration, isArriving, tripEstimate } from "../../carrier/data/estimate"
import { useNow } from "../../carrier/hooks/useNow"
import { cargoText, greeting, hubName } from "../data/display"
import { WarehouseIllustration, WarehouseResult } from "./WarehouseResult"

export function ArrivalsScreen() {
  const { address } = useAuth()
  const query = useShipments()
  const profile = useProfile()
  const now = useNow()
  const hub = hubName(query.data, address)
  const arrivals = (
    query.data?.filter(
      (s) =>
        s.consignee.toLowerCase() === address?.toLowerCase() &&
        [Status.APPROVED, Status.IN_TRANSIT].includes(s.status),
    ) ?? []
  ).map((s) => {
    const inTransit = s.status === Status.IN_TRANSIT
    const estimate = tripEstimate(s.trip, now)
    const minutes = estimate.minutesLeft
    return {
      shipment: s,
      inTransit,
      arriving: isArriving(estimate, inTransit),
      minutes,
      eta: !inTransit
        ? "Not left yet"
        : minutes === undefined
          ? "On the way"
          : minutes <= 0 || estimate.progress === 1
            ? "Arriving now"
            : `in ${formatDuration(minutes)}`,
    }
  })
  const arriving = arrivals.filter((a) => a.arriving)
  const onTheWay = arrivals.filter((a) => a.inTransit)
  const name = profile.data?.name?.split(" ")[0]
  const count = arrivals.length
  const subtitle = `${count} ${count === 1 ? "truck" : "trucks"} expected${hub ? ` at ${hub}` : ""} today`

  return (
    <div className="space-y-6">
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        {!count ? (
          <>
            <PageHeading title="Arrivals" description={hub} />
            <Card>
              <WarehouseResult
                heading="h2"
                art={<WarehouseIllustration />}
                title="No trucks expected today"
              >
                When a shipment to {hub ?? "your warehouse"} is approved, it shows up here with the
                driver&apos;s name and arrival time.
              </WarehouseResult>
            </Card>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <h1
                suppressHydrationWarning
                className="text-headline font-medium [overflow-wrap:anywhere]"
              >
                {name ? `${greeting(new Date(now).getHours())}, ${name}` : "Arrivals"}
              </h1>
              <p className="text-body text-muted-ink">{subtitle}</p>
            </div>
            <div
              className={cn("grid gap-4 md:gap-6", onTheWay.length && "lg:grid-cols-2 lg:items-start")}
            >
              <div className="grid min-w-0 gap-4 md:gap-6">
                {arriving.map(({ shipment: s, minutes }) => (
                  <section
                    key={s.id}
                    className="@container grid min-w-0 gap-3 rounded-[28px] bg-stamp p-5 md:p-7"
                  >
                    <p className="flex items-center gap-2 text-label font-medium">
                      <Truck className="size-[18px] shrink-0" aria-hidden />
                      {minutes !== undefined && minutes > 0
                        ? `Arriving in about ${formatDuration(minutes)}`
                        : "Arriving now"}
                    </p>
                    <h2 className="text-[clamp(1.5rem,1.2rem+1vw,2rem)] leading-tight font-medium tracking-[-0.02em] [overflow-wrap:anywhere]">
                      {s.trip?.carrier_name ?? "A truck"}
                    </h2>
                    <p className="text-label text-ink-2 [overflow-wrap:anywhere]">
                      {[
                        `#${s.id}${s.trip?.payer_name ? ` from ${s.trip.payer_name}` : ""}`,
                        cargoText(s.trip),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <ButtonLink
                      href="/warehouse/scan"
                      icon={ScanLine}
                      block
                      className="mt-1 h-14"
                    >
                      Scan the driver&apos;s QR
                    </ButtonLink>
                  </section>
                ))}
                <Card className="pt-5 pb-2.5 md:pt-6 md:pb-3">
                  <h2 className="mb-1 text-[18px] leading-7 font-medium">Expected today</h2>
                  <ul>
                    {arrivals.map(({ shipment: s, arriving: near, eta, inTransit }) => (
                      <li key={s.id} className="border-line not-first:border-t">
                        <Link
                          href={`/confirm/${s.id}`}
                          className="-mx-2 flex min-w-0 items-center gap-3 rounded-2xl px-2 py-3.5 transition-colors hover:bg-canvas"
                        >
                          <span
                            className={cn(
                              "grid size-10 shrink-0 place-items-center rounded-full",
                              near ? "bg-stamp" : "bg-canvas",
                            )}
                          >
                            <Truck className="size-[17px]" aria-hidden />
                          </span>
                          <span className="grid min-w-0 flex-1 gap-0.5">
                            <span className="text-body font-medium [overflow-wrap:anywhere]">
                              {s.trip?.carrier_name ?? "Driver not set"}
                              {s.trip?.pickup?.name ? ` · from ${s.trip.pickup.name}` : ""}
                            </span>
                            <span className="text-caption leading-[1.45] text-muted-ink [overflow-wrap:anywhere]">
                              {[`#${s.id}`, cargoText(s.trip), s.trip?.payer_name]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-right text-label font-medium",
                              !inTransit && "text-muted-ink",
                            )}
                          >
                            {eta}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
              {onTheWay.length > 0 && (
                <Card className="grid gap-4 p-5 md:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="min-w-0 text-[18px] leading-7 font-medium [overflow-wrap:anywhere]">
                      Heading to {hub ?? "your warehouse"}
                    </h2>
                    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-canvas px-3 py-1.5 text-caption font-medium">
                      <span className="size-2 rounded-full bg-success" aria-hidden />
                      {onTheWay.length} {onTheWay.length === 1 ? "truck" : "trucks"} on the way
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-[20px]">
                    <RouteMap
                      trips={onTheWay.flatMap(({ shipment: s }) => (s.trip ? [s.trip] : []))}
                      className="h-[280px] md:h-[360px] lg:h-[480px]"
                    />
                  </div>
                </Card>
              )}
            </div>
          </>
        )}
      </QueryState>
    </div>
  )
}
