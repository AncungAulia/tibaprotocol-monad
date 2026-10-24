"use client"

import Link from "next/link"
import { ArrowDownToLine } from "lucide-react"
import { ADVANCE_BPS, BPS } from "@tiba/sc"
import { useAuth } from "@/providers/AuthProvider"
import { useShipments } from "@/lib/ledger"
import { formatUsdcWithUnit } from "@/lib/format"
import { PageHeading } from "@/components/elements/PageHeading"
import { QueryState } from "@/components/elements/DataState"
import { payouts } from "../data/payouts"

const earlyShare = `${(ADVANCE_BPS / BPS) * 100}%`

function day(seconds: bigint) {
  return seconds > 0n
    ? new Date(Number(seconds) * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : undefined
}

export function PayoutsScreen() {
  const { address } = useAuth()
  const query = useShipments()
  const paid = payouts(
    (query.data ?? []).filter((s) => s.carrier.toLowerCase() === address?.toLowerCase()),
  )
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const thisMonth = paid.filter(
    ({ shipment }) => Number(shipment.deliveredAt) * 1000 >= monthStart.getTime(),
  )
  const sum = (rows: typeof paid) => rows.reduce((total, p) => total + p.amount, 0n)
  return (
    <div className="space-y-6">
      <PageHeading title="Payouts" description="Money paid to you when goods arrive" />
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <section className="@container min-w-0 rounded-[28px] bg-ink p-6 text-white">
              <h2 className="text-label font-normal text-white/70">This month</h2>
              <p className="mt-2 text-hero font-medium tabular-nums [overflow-wrap:anywhere]">
                {formatUsdcWithUnit(sum(thisMonth))}
              </p>
              <p className="mt-2 text-label text-stamp">
                {paid.length
                  ? `${thisMonth.length} ${thisMonth.length === 1 ? "trip" : "trips"} · paid when goods arrive`
                  : "Your first payout shows up here"}
              </p>
            </section>
            <section className="@container min-w-0 rounded-[28px] bg-surface p-6">
              <h2 className="text-label font-normal text-muted-ink">All time</h2>
              <p className="mt-2 text-hero font-medium tabular-nums [overflow-wrap:anywhere]">
                {formatUsdcWithUnit(sum(paid))}
              </p>
              <p className="mt-2 text-caption text-muted-ink">
                Early payouts are {earlyShare} of the trip amount. When your company paid you
                directly, you got the full amount.
              </p>
            </section>
          </div>
          {paid.length ? (
            <ul className="rounded-[28px] bg-surface px-5 py-2">
              {paid.map(({ shipment: s, amount }) => {
                const route =
                  s.trip?.pickup?.name && s.trip.destination?.name
                    ? `${s.trip.pickup.name} to ${s.trip.destination.name}`
                    : `Shipment #${s.id}`
                const meta = [
                  `#${s.id}`,
                  s.trip?.payer_name,
                  day(s.deliveredAt),
                  s.advanced > 0n ? "Paid early" : "Paid by your company",
                ].filter(Boolean)
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 border-b border-line py-3.5 last:border-b-0"
                  >
                    <span className="grid size-[38px] shrink-0 place-items-center rounded-full bg-success/10 text-success">
                      <ArrowDownToLine size={16} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{route}</p>
                      <p className="text-caption text-muted-ink">{meta.join(" · ")}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[14.5px] leading-5 font-medium text-success tabular-nums">
                        +{formatUsdcWithUnit(amount)}
                      </p>
                      <Link
                        href={`/carrier/trips/${s.id}`}
                        className="inline-flex min-h-6 items-center text-caption text-stamp-deep underline-offset-4 hover:underline"
                      >
                        View trip
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <section className="grid justify-items-center gap-2.5 rounded-[28px] bg-surface px-6 py-10 text-center">
              <ArrowDownToLine size={26} className="text-muted-ink" aria-hidden />
              <h2 className="text-[17px] leading-6 font-medium">No payouts yet</h2>
              <p className="max-w-[420px] text-[13.5px] leading-5 text-muted-ink">
                Finish a trip and you&apos;ll be paid the moment the warehouse confirms.
              </p>
            </section>
          )}
        </div>
      </QueryState>
    </div>
  )
}
