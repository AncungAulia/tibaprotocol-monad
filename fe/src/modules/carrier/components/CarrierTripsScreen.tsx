"use client"

import { useAuth } from "@/providers/AuthProvider"
import { useShipments } from "@/lib/ledger"
import { useProfile } from "@/lib/queries"
import { QueryState } from "@/components/elements/DataState"
import { CarrierTripsContent } from "./CarrierTripsContent"

export function CarrierTripsScreen() {
  const { address } = useAuth()
  const query = useShipments()
  const profile = useProfile()
  const rows = (query.data ?? []).filter((s) => s.carrier.toLowerCase() === address?.toLowerCase())
  return (
    <QueryState loading={query.isLoading} error={query.error} retry={() => void query.refetch()}>
      <CarrierTripsContent name={profile.data?.name} rows={rows} />
    </QueryState>
  )
}
