"use client"

import { useState } from "react"
import { ArrowLeft, PackageCheck } from "lucide-react"
import { Card, EmptyState, QueryState } from "@/components/elements/DataState"
import { StatusChip } from "@/components/elements/StatusChip"
import { Timeline } from "@/components/elements/Timeline"
import { RouteMap } from "@/components/elements/RouteMap"
import { DataTable, TableSearch, TableTabs } from "@/components/elements/DataTable"
import { usePoolAccount, useShipments } from "@/lib/ledger"
import { formatUsdcWithUnit } from "@/lib/format"
import { Status } from "@/lib/contracts"
import type { Shipment } from "@/lib/types"
import { financingBreakdown } from "../data/math"

const TABS = ["All", "Waiting to be repaid", "Repaid"] as const
type Tab = (typeof TABS)[number]

const DAY = 86_400_000
const shortDate = (seconds: bigint) =>
  new Date(Number(seconds) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })

function inTab(row: Shipment, tab: Tab) {
  return (
    tab === "All" ||
    (tab === "Repaid" ? row.status === Status.REPAID : row.status === Status.FINANCED)
  )
}

function billText(row: Shipment) {
  if (row.status === Status.REPAID) return "Paid back"
  const days = Math.ceil((Number(row.dueDate) * 1000 - Date.now()) / DAY)
  if (days < 0) return `Bill late by ${-days} ${-days === 1 ? "day" : "days"}`
  if (days <= 3)
    return days === 0 ? "Bill due today" : `Bill due in ${days} ${days === 1 ? "day" : "days"}`
  return `Bill due ${shortDate(row.dueDate)}`
}

const route = (row: Shipment) =>
  `${row.trip?.pickup?.name ?? "Pickup"} to ${row.trip?.destination?.name ?? "Destination"}`
const people = (row: Shipment) =>
  [`#${row.id}`, row.trip?.payer_name ?? "Shipping company", row.trip?.carrier_name]
    .filter(Boolean)
    .join(" · ")

export function DeliveriesScreen() {
  const shipments = useShipments()
  const pool = usePoolAccount()
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<Tab>("All")
  const [selected, setSelected] = useState<string>()
  const all =
    shipments.data?.filter((row) => [Status.FINANCED, Status.REPAID].includes(row.status)) ?? []
  const rows = all.filter(
    (row) =>
      inTab(row, tab) &&
      `${row.id} ${row.trip?.cargo ?? ""} ${row.trip?.payer_name ?? ""} ${row.trip?.destination?.name ?? ""}`
        .toLowerCase()
        .includes(search.trim().replace(/^#/, "").toLowerCase()),
  )
  const detail = shipments.data?.find((row) => row.id === selected)

  if (detail)
    return <DeliveryDetail detail={detail} pool={pool.data} onBack={() => setSelected(undefined)} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline font-medium">Deliveries</h1>
        <p className="mt-1.5 text-muted-ink">Every trip the pool paid for, with proof it arrived</p>
      </div>
      <QueryState loading={false} error={shipments.error} retry={() => void shipments.refetch()}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TableTabs
            label="Filter deliveries"
            value={tab}
            onChange={setTab}
            className="self-start"
            tabs={TABS.map((item) => ({
              value: item,
              label: item,
              count: shipments.isLoading ? undefined : all.filter((row) => inTab(row, item)).length,
            }))}
          />
          <TableSearch
            label="Search deliveries"
            placeholder="Search deliveries"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full md:w-[280px]"
          />
        </div>
        <DataTable
          label="Deliveries"
          rows={rows}
          loading={shipments.isLoading}
          getKey={(row) => row.id}
          onSelect={(row) => {
            setSelected(row.id)
            window.scrollTo({ top: 0 })
          }}
          header="Delivery"
          icon={PackageCheck}
          primary={(row) => ({ title: route(row), subtitle: people(row) })}
          columns={[
            {
              key: "paid",
              header: "Paid early",
              width: "140px",
              cell: (row) => (
                <span className="font-medium">
                  {row.advanced > 0n ? formatUsdcWithUnit(row.advanced) : "Not paid early"}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              width: "140px",
              cell: (row) => <StatusChip status={row.status} />,
            },
            {
              key: "bill",
              header: "Bill",
              width: "170px",
              cell: (row) => <span className="text-label text-ink-2">{billText(row)}</span>,
            },
          ]}
          aside={(row) => (
            <>
              <span className="font-medium whitespace-nowrap">
                {formatUsdcWithUnit(row.advanced > 0n ? row.advanced : row.amount)}
              </span>
              <StatusChip status={row.status} />
            </>
          )}
          empty={
            <EmptyState
              title="No matching deliveries"
              description={
                search
                  ? "Try a different company or shipment number."
                  : "Deliveries will appear when a carrier gets paid or a bill is repaid."
              }
            />
          }
        />
      </QueryState>
    </div>
  )
}

function DeliveryDetail({
  detail,
  pool,
  onBack,
}: {
  detail: Shipment
  pool?: { shares: bigint; totalShares: bigint }
  onBack: () => void
}) {
  const financed = detail.advanced > 0n
  const breakdown = financed ? financingBreakdown(detail.amount, detail.advanced) : undefined
  const sharePct =
    pool && pool.totalShares > 0n
      ? Number((pool.shares * 10000n) / pool.totalShares) / 100
      : undefined
  const currentShare =
    pool && pool.totalShares > 0n && breakdown
      ? (breakdown.pool * pool.shares) / pool.totalShares
      : undefined
  const carrier = detail.trip?.carrier_name ?? "the carrier"
  const company = detail.trip?.payer_name ?? "The company"
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-2 text-label font-medium text-stamp-deep underline-offset-4 hover:underline"
      >
        <ArrowLeft size={16} aria-hidden />
        All deliveries
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-headline font-medium [overflow-wrap:anywhere]">{route(detail)}</h1>
          <p className="mt-1.5 text-muted-ink">{people(detail)}</p>
        </div>
        <StatusChip status={detail.status} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-3xl">
            <RouteMap
              pickup={detail.trip?.pickup}
              destination={detail.trip?.destination}
              route={detail.trip?.route_geojson}
            />
          </div>
          <Card className="p-6 md:p-6">
            <h2 className="mb-4 text-heading font-medium">Proof it happened</h2>
            <Timeline shipment={detail} />
          </Card>
        </div>
        <Card className="h-fit p-6 md:p-6">
          <h2 className="text-heading font-medium">Money</h2>
          {!breakdown ? (
            <p className="mt-3 text-muted-ink">
              The company paid the carrier {formatUsdcWithUnit(detail.amount)} itself. The pool did
              not pay early, so this shipment earns nothing for the pool.
            </p>
          ) : (
            <>
              <dl className="mt-2">
                <Row
                  label={`Paid early to ${carrier}`}
                  value={formatUsdcWithUnit(breakdown.paidToCarrier)}
                />
                <Row
                  label={`${company} pays back`}
                  value={`${formatUsdcWithUnit(detail.amount)}${detail.status === Status.FINANCED ? ` by ${shortDate(detail.dueDate)}` : ""}`}
                />
                <Row label="Pool earns" value={formatUsdcWithUnit(breakdown.pool)} />
                <Row
                  label={
                    sharePct !== undefined
                      ? `Your part (${Number(sharePct.toFixed(2))}%)`
                      : "Your part"
                  }
                  value={
                    currentShare !== undefined ? formatUsdcWithUnit(currentShare) : "Unavailable"
                  }
                  last
                />
              </dl>
              <p className="mt-3 text-caption text-muted-ink">
                Your final earnings depend on your share when the bill is repaid.
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-3 ${last ? "" : "border-b border-line"}`}>
      <dt className="min-w-0 text-muted-ink">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
