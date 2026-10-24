"use client"

import Link from "next/link"
import { CircleAlert, PackageCheck } from "lucide-react"
import { useAuth } from "@/providers/AuthProvider"
import { useShipments } from "@/lib/ledger"
import { Status } from "@/lib/contracts"
import { cn } from "@/lib/utils"
import { PageHeading } from "@/components/elements/PageHeading"
import { Card, QueryState } from "@/components/elements/DataState"
import { useNow } from "../../carrier/hooks/useNow"
import { dayTime, hubName } from "../data/display"

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

function Stat({ label, value, context }: { label: string; value: string; context: string }) {
  return (
    <Card className="grid gap-1 p-5 md:p-7">
      <h2 className="text-label font-normal text-muted-ink">{label}</h2>
      <p className="text-amount font-medium tracking-[-0.02em]">{value}</p>
      <p className="text-caption text-muted-ink">{context}</p>
    </Card>
  )
}

export function WarehouseHistoryScreen() {
  const { address } = useAuth()
  const query = useShipments()
  const now = useNow(60000)
  const hub = hubName(query.data, address)
  const history =
    query.data?.filter(
      (s) =>
        s.consignee.toLowerCase() === address?.toLowerCase() &&
        [Status.DELIVERED, Status.DISPUTED, Status.FINANCED, Status.REPAID].includes(s.status),
    ) ?? []
  const monthStart = new Date(now)
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const month = history.filter((s) => Number(s.deliveredAt) * 1000 >= monthStart.getTime())
  const problems = (list: typeof history) =>
    list.filter((s) => s.status === Status.DISPUTED).length
  const summary = (list: typeof history) =>
    `${list.length - problems(list)} confirmed, ${plural(problems(list), "problem")}`

  return (
    <div className="space-y-6">
      <PageHeading
        title="History"
        description={hub ? `Everything received at ${hub}` : "Everything you received"}
      />
      <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
        {!history.length ? (
          <Card>
            <div className="grid justify-items-center gap-2 py-8 text-center md:py-12">
              <PackageCheck className="mb-2 size-7" aria-hidden />
              <h2 className="text-[17px] leading-6 font-medium">Nothing received yet</h2>
              <p className="max-w-sm text-label text-muted-ink">
                Deliveries you confirm or report show up here.
              </p>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 md:gap-6">
              <Stat
                label="This month"
                value={plural(month.length, "delivery", "deliveries")}
                context={summary(month)}
              />
              <Stat
                label="All time"
                value={plural(history.length, "delivery", "deliveries")}
                context={summary(history)}
              />
            </div>
            <Card className="px-3 py-2 md:px-4 md:py-3">
              <ul>
                {history.map((s) => {
                  const problem = s.status === Status.DISPUTED
                  const trip = s.trip
                  const route =
                    trip?.pickup?.name && trip.destination?.name
                      ? `${trip.pickup.name} to ${trip.destination.name}`
                      : (trip?.cargo ?? `Shipment #${s.id}`)
                  const counted =
                    trip?.quantity !== undefined
                      ? `${s.receivedQty} of ${trip.quantity} boxes`
                      : s.receivedQty
                        ? plural(s.receivedQty, "item")
                        : undefined
                  const at = Number(s.deliveredAt) * 1000
                  const status = (
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-caption font-medium whitespace-nowrap ring-1 ring-line ring-inset">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          problem ? "bg-danger" : "bg-success",
                        )}
                        aria-hidden
                      />
                      {problem ? "Problem reported" : "Confirmed"}
                    </span>
                  )
                  const time = at > 0 && (
                    <span className="text-caption text-muted-ink">{dayTime(at, now)}</span>
                  )
                  return (
                    <li key={s.id} className="border-line not-first:border-t">
                      <Link
                        href={`/confirm/${s.id}`}
                        className="flex min-w-0 items-center gap-3 rounded-2xl px-2 py-4 transition-colors hover:bg-canvas md:px-3"
                      >
                        <span
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-full",
                            problem ? "bg-danger/10 text-danger" : "bg-canvas",
                          )}
                        >
                          {problem ? (
                            <CircleAlert className="size-[18px]" aria-hidden />
                          ) : (
                            <PackageCheck className="size-[18px]" aria-hidden />
                          )}
                        </span>
                        <span className="grid min-w-0 flex-1 gap-0.5">
                          <span className="text-body font-medium [overflow-wrap:anywhere]">
                            {route}
                          </span>
                          <span className="text-caption leading-[1.45] text-muted-ink [overflow-wrap:anywhere]">
                            {[`#${s.id}`, trip?.carrier_name, counted].filter(Boolean).join(" · ")}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 @min-[20rem]:hidden">
                            {status}
                            {time}
                          </span>
                        </span>
                        <span className="hidden shrink-0 justify-items-end gap-1 text-right @min-[20rem]:grid">
                          {status}
                          {time}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  )
}
