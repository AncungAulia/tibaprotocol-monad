"use client"
import { useState } from "react"
import { Plus, SearchX, Truck } from "lucide-react"
import { useAuth } from "@/providers/AuthProvider"
import { useShipments } from "@/lib/ledger"
import { Status } from "@/lib/contracts"
import { formatUsdcWithUnit } from "@/lib/format"
import type { Shipment } from "@/lib/types"
import { cn } from "@/lib/utils"
import { EmptyState, QueryState, TextLink } from "@/components/elements/DataState"
import { ButtonLink } from "@/components/elements/Button"
import { StatusChip } from "@/components/elements/StatusChip"
import { DataTable, TableSearch, TableTabs } from "@/components/elements/DataTable"
import { isBill } from "../data/shipment"

const FILTERS = ["All", "On the road", "Bills due", "Done"] as const
type Filter = (typeof FILTERS)[number]

function matches(s: Shipment, filter: Filter) {
  return (
    filter === "All" ||
    (filter === "On the road"
      ? s.status === Status.IN_TRANSIT
      : filter === "Bills due"
        ? isBill(s)
        : s.status === Status.REPAID)
  )
}

const DAY = 86_400_000

/** Bill column text: due date, a warning close to the date, or what happened to the bill. */
function billNote(s: Shipment): { text: string; tone?: "warning" | "danger" } {
  if (s.status === Status.APPROVED) return { text: "Not picked up yet" }
  if (s.status === Status.REPAID) return { text: "Paid back" }
  if (s.status === Status.DISPUTED) return { text: "Payment on hold" }
  const due = Number(s.dueDate) * 1000
  const days = Math.ceil((due - Date.now()) / DAY)
  if (isBill(s) && days < 0)
    return { text: `Late by ${-days} ${-days === 1 ? "day" : "days"}`, tone: "danger" }
  if (isBill(s) && days <= 3)
    return {
      text: days === 0 ? "Due today" : `Due in ${days} ${days === 1 ? "day" : "days"}`,
      tone: "warning",
    }
  return {
    text: `Due ${new Date(due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
  }
}

function BillNote({ shipment }: { shipment: Shipment }) {
  const note = billNote(shipment)
  return (
    <span
      className={cn(
        "text-label",
        note.tone === "warning"
          ? "font-medium text-warning"
          : note.tone === "danger"
            ? "font-medium text-danger"
            : "text-ink-2",
      )}
    >
      {note.text}
    </span>
  )
}

export function ShipmentListScreen() {
  const { address } = useAuth()
  const query = useShipments()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("All")
  const mine = (query.data ?? [])
    .filter((s) => s.payer.toLowerCase() === address?.toLowerCase())
    .sort((a, b) => Number(b.id) - Number(a.id))
  const rows = mine
    .filter((s) => matches(s, filter))
    .filter((s) =>
      [s.id, s.trip?.cargo, s.trip?.carrier_name, s.trip?.pickup?.name, s.trip?.destination?.name]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().replace(/^#/, "").toLowerCase()),
    )
  const loading = query.isLoading
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-headline font-medium">Shipments</h1>
          <p className="mt-1.5 text-muted-ink">Everything you approved, newest first</p>
        </div>
        <ButtonLink href="/payer/shipments/new" icon={Plus} className="shrink-0">
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New shipment</span>
        </ButtonLink>
      </div>
      <QueryState loading={false} error={query.error} retry={() => query.refetch()}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TableTabs
            label="Filter shipments"
            value={filter}
            onChange={setFilter}
            className="self-start"
            tabs={FILTERS.map((item) => ({
              value: item,
              label: item,
              count: loading ? undefined : mine.filter((s) => matches(s, item)).length,
            }))}
          />
          <TableSearch
            label="Search shipments"
            placeholder="Search shipments"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-[280px]"
          />
        </div>
        <DataTable
          label="Shipments"
          rows={rows}
          loading={loading}
          getKey={(s) => s.id}
          href={(s) => `/payer/shipments/${s.id}`}
          header="Shipment"
          icon={Truck}
          primary={(s) => ({
            title: `${s.trip?.pickup?.name ?? "Pickup"} to ${s.trip?.destination?.name ?? "Destination"}`,
            subtitle: [`#${s.id}`, s.trip?.carrier_name, s.trip?.cargo ?? "Trip details pending"]
              .filter(Boolean)
              .join(" · "),
          })}
          columns={[
            {
              key: "status",
              header: "Status",
              width: "150px",
              cell: (s) => <StatusChip status={s.status} />,
            },
            {
              key: "fee",
              header: "Fee",
              width: "140px",
              cell: (s) => <span className="font-medium">{formatUsdcWithUnit(s.amount)}</span>,
            },
            { key: "bill", header: "Bill", width: "160px", cell: (s) => <BillNote shipment={s} /> },
          ]}
          aside={(s) => (
            <>
              <span className="font-medium whitespace-nowrap">{formatUsdcWithUnit(s.amount)}</span>
              <StatusChip status={s.status} />
            </>
          )}
          empty={
            search ? (
              <div className="grid justify-items-center gap-2 px-2 py-12 text-center">
                <SearchX size={28} className="text-muted-ink" aria-hidden />
                <h2 className="mt-1 font-medium [overflow-wrap:anywhere]">
                  No shipments match &ldquo;{search}&rdquo;
                </h2>
                <p className="max-w-sm text-label text-muted-ink">
                  Try a city, a carrier&apos;s name, or a shipment number like #1041.
                </p>
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="min-h-11 text-label font-medium text-stamp-deep underline-offset-4 hover:underline"
                >
                  Clear search
                </button>
              </div>
            ) : filter !== "All" ? (
              <EmptyState
                title="Nothing here right now"
                description="No shipments match this filter. Try another tab."
              />
            ) : (
              <EmptyState
                title="Your first shipment starts here"
                description="Connect a carrier and destination, then approve your first trip."
                action={<TextLink href="/payer/network">Manage network</TextLink>}
              />
            )
          }
        />
      </QueryState>
    </div>
  )
}
