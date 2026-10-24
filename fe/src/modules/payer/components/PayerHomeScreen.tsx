"use client"

import { useAuth } from "@/providers/AuthProvider"
import { usePoolAccount, useShipments } from "@/lib/ledger"
import Link from "next/link"
import { Check, ChevronRight } from "lucide-react"
import { useApiQuery, usePlaces, useNetwork } from "@/lib/queries"
import type { Company } from "@/lib/types"
import { Card, QueryState } from "@/components/elements/DataState"
import { PayerHomeContent } from "./PayerHomeContent"

export function PayerHomeScreen() {
  const { address } = useAuth()
  const company = useApiQuery<{ company: Company | null }>("/api/payer/company")
  const account = usePoolAccount(),
    shipments = useShipments()
  const places = usePlaces(),
    relations = useNetwork()
  const rows = (shipments.data ?? []).filter(
    (s) => s.payer.toLowerCase() === address?.toLowerCase(),
  )
  const a = account.data
  const carrier = relations.data?.find((r) => ["joined", "connected", "active"].includes(r.status))
  const destination = places.data?.some((p) => p.kind === "destination" && p.receiver_address)
  const steps = [
    {
      title: "Invite a carrier",
      detail: relations.error
        ? "Carrier list unavailable"
        : carrier
          ? `${carrier.name ?? "Carrier"} joined`
          : "Who moves your goods",
      done: !!carrier,
      href: "/payer/network",
    },
    {
      title: "Add a destination",
      detail: places.error ? "Destination list unavailable" : "Where your goods go",
      done: !!destination,
      href: "/payer/network",
    },
    {
      title: "Create your first shipment",
      detail: "Approve a trip before the truck leaves",
      done: false,
      href: "/payer/shipments/new",
    },
  ]
  return (
    <QueryState
      loading={account.isLoading || shipments.isLoading}
      error={account.error || shipments.error}
      retry={() => {
        void account.refetch()
        void shipments.refetch()
      }}
    >
      <PayerHomeContent
        name={company.data?.company?.company_name}
        rows={rows}
        creditLimit={a?.creditLimit ?? 0n}
        outstanding={a?.outstanding ?? 0n}
        paidOnTime={
          a && a.repaidCount > 0n
            ? `${Number(((a.repaidCount - a.lateCount) * 100n) / a.repaidCount)}%`
            : "No payments yet"
        }
        paidOnTimeDetail={
          a && a.repaidCount > 0n
            ? `${a.repaidCount - a.lateCount} of ${a.repaidCount} bills`
            : "No payments yet"
        }
        setup={
          !rows.length ? (
            <Card className="p-6 md:p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[18px] leading-[22px] font-medium">Get set up</h2>
                <span className="text-label text-stamp-deep">
                  {steps.filter((step) => step.done).length} of 3 done
                </span>
              </div>
              <ul className="space-y-3">
                {steps.map((step) => (
                  <li key={step.title}>
                    <Link
                      href={step.href}
                      className="flex items-center gap-3 rounded-md bg-canvas px-3.5 py-3"
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-full ${step.done ? "bg-ink text-white" : "border border-line-strong bg-surface"}`}
                      >
                        {step.done && <Check className="size-3.5" aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block font-medium ${step.done ? "text-muted-ink" : ""}`}>
                          {step.title}
                        </span>
                        <span className="mt-0.5 block text-caption text-muted-ink">{step.detail}</span>
                      </span>
                      <ChevronRight className="size-[18px] shrink-0 text-muted-ink" aria-hidden />
                      {step.done && <span className="sr-only">Completed</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : undefined
        }
      />
    </QueryState>
  )
}
