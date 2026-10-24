"use client"

import { Warehouse } from "lucide-react"
import { useShipments } from "@/lib/ledger"
import { useAuth } from "@/providers/AuthProvider"
import { hubName } from "../data/display"

/** Header pill with the warehouse name. Hidden until a shipment tells us which warehouse it is. */
export function WarehouseHubPill() {
  const { address } = useAuth()
  const query = useShipments()
  const name = hubName(query.data, address)
  if (!name) return null
  return (
    <span className="inline-flex max-w-[45vw] min-w-0 items-center gap-1.5 rounded-full bg-surface px-3 py-2 text-caption font-medium text-ink md:max-w-60 md:bg-canvas">
      <Warehouse className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
    </span>
  )
}
