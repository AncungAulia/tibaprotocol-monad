import along from "@turf/along"
import length from "@turf/length"
import { z } from "zod"
import { Status, addresses, shipmentManagerAbi } from "@tiba/sc"
import { decodeEventLog, type TransactionReceipt } from "viem"

const coordinate = z
  .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
  .rest(z.number())
const geometry = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(coordinate).min(2),
})
const routeSchema = z.union([geometry, z.object({ type: z.literal("Feature"), geometry })])

/** Accept stored LineString geometry or a GeoJSON Feature; never fabricate a missing route. */
export function simulationRoute(value: unknown) {
  const result = routeSchema.safeParse(value)
  if (!result.success)
    throw new Error(
      "The saved route must be a valid GeoJSON LineString with at least two coordinates.",
    )
  const parsed = result.data
  const route = parsed.type === "Feature" ? parsed.geometry : parsed
  const line = {
    type: "LineString" as const,
    coordinates: route.coordinates.map(([lng, lat]) => [lng, lat]),
  }
  const distanceKm = length(
    { type: "Feature", properties: {}, geometry: line },
    { units: "kilometers" },
  )
  if (!Number.isFinite(distanceKm) || distanceKm <= 0)
    throw new Error("The saved route has no usable distance.")
  return { line, distanceKm }
}

export function hasPickupReceipt(
  receipt: Pick<TransactionReceipt, "status" | "logs">,
  shipmentId: number,
) {
  if (receipt.status !== "success") return false
  return receipt.logs.some((log) => {
    if (log.removed) return false
    if (log.address.toLowerCase() !== addresses.shipmentManager.toLowerCase()) return false
    try {
      const event = decodeEventLog({
        abi: shipmentManagerAbi,
        eventName: "PickedUp",
        data: log.data,
        topics: log.topics,
      })
      return event.args.id === BigInt(shipmentId)
    } catch {
      return false
    }
  })
}

export function simulatedPosition(
  route: ReturnType<typeof simulationRoute>,
  elapsedSeconds: number,
  durationSeconds: number,
) {
  if (
    !Number.isFinite(elapsedSeconds) ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    throw new Error("Simulation timing must be finite and duration must be positive.")
  }
  const progress = Math.max(0, Math.min(1, elapsedSeconds / durationSeconds))
  const point = along(route.line, route.distanceKm * progress, { units: "kilometers" })
  const [lng, lat] = point.geometry.coordinates
  if (lng === undefined || lat === undefined)
    throw new Error("Could not calculate a route position.")
  return { lat, lng, progress }
}

export interface SimulationTrip {
  shipment: { status: number }
  trip: { route_geojson: unknown; share_location: boolean } | null
}
export interface SimulationSample {
  shipmentId: number
  lat: number
  lng: number
  recordedAt: string
  source: "simulated"
}
export interface SimulationOptions {
  shipmentId: number
  pickedUpAt: number
  durationSeconds: number
  intervalSeconds?: number
  dryRun?: boolean
  signal?: AbortSignal
}
export interface SimulationDependencies {
  loadTrip: () => Promise<SimulationTrip>
  saveLocation: (sample: SimulationSample) => Promise<void>
  now: () => number
  wait: (milliseconds: number, signal?: AbortSignal) => Promise<void>
  onSample?: (sample: SimulationSample & { progress: number }, dryRun: boolean) => void
}

/** Run sequentially. Recheck live status/consent each tick and never confirm delivery automatically. */
export async function runLocationSimulation(
  options: SimulationOptions,
  dependencies: SimulationDependencies,
) {
  const interval = options.intervalSeconds ?? 30
  if (
    !Number.isInteger(options.shipmentId) ||
    options.shipmentId < 1 ||
    options.shipmentId > 33_554_431 ||
    !Number.isFinite(options.pickedUpAt) ||
    options.pickedUpAt < 0 ||
    !Number.isFinite(options.durationSeconds) ||
    options.durationSeconds <= 0 ||
    !Number.isFinite(interval) ||
    interval < 1 ||
    interval > 60
  )
    throw new Error("Invalid simulation options.")
  while (!options.signal?.aborted) {
    const detail = await dependencies.loadTrip()
    if (detail.shipment.status !== Status.IN_TRANSIT) return "not_in_transit" as const
    if (!detail.trip) throw new Error("Trip metadata has not been saved for this shipment.")
    if (!detail.trip.share_location) return "sharing_disabled" as const
    const now = dependencies.now()
    const position = simulatedPosition(
      simulationRoute(detail.trip.route_geojson),
      (now - options.pickedUpAt) / 1000,
      options.durationSeconds,
    )
    const sample: SimulationSample = {
      shipmentId: options.shipmentId,
      lat: position.lat,
      lng: position.lng,
      recordedAt: new Date(now).toISOString(),
      source: "simulated",
    }
    if (options.signal?.aborted) return "cancelled" as const
    if (!options.dryRun) await dependencies.saveLocation(sample)
    dependencies.onSample?.({ ...sample, progress: position.progress }, !!options.dryRun)
    if (options.dryRun) return "dry_run" as const
    if (position.progress === 1) return "route_complete" as const
    await dependencies.wait(interval * 1000, options.signal)
  }
  return "cancelled" as const
}
