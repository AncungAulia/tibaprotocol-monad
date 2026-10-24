import type { Trip } from "../../../lib/types"
import { simulationProgress } from "../../../lib/truck-position"

export type TripEstimate = {
  /** Share of the demo trip done, only while the demo truck is moving. */
  progress?: number
  kmLeft?: number
  minutesLeft?: number
  arrivesAt?: number
  totalKm?: number
  totalMinutes?: number
}

/** Arrival estimate from the route and, for the demo, the simulated drive. */
export function tripEstimate(
  trip: Pick<Trip, "distance_km" | "duration_min" | "simulation" | "picked_up_at"> | undefined,
  now = Date.now(),
): TripEstimate {
  const totalKm = trip?.distance_km ?? undefined
  const totalMinutes = trip?.duration_min ?? undefined
  if (trip?.simulation) {
    const progress = simulationProgress(trip.simulation, now)
    const start = Date.parse(trip.simulation.startedAt)
    return {
      progress,
      totalKm,
      totalMinutes,
      kmLeft: totalKm !== undefined ? totalKm * (1 - progress) : undefined,
      minutesLeft: (trip.simulation.durationSec * (1 - progress)) / 60,
      arrivesAt: Number.isFinite(start) ? start + trip.simulation.durationSec * 1000 : undefined,
    }
  }
  const pickedUp = trip?.picked_up_at ? Date.parse(trip.picked_up_at) : NaN
  if (Number.isFinite(pickedUp) && totalMinutes !== undefined) {
    const arrivesAt = pickedUp + totalMinutes * 60000
    return { totalKm, totalMinutes, arrivesAt, minutesLeft: Math.max(0, (arrivesAt - now) / 60000) }
  }
  return { totalKm, totalMinutes }
}

/** The truck is close: the demo drive is 90% done, or a moving truck has under 10 minutes left. */
export function isArriving(estimate: TripEstimate, inTransit: boolean) {
  if (estimate.progress !== undefined) return estimate.progress >= 0.9
  return inTransit && estimate.minutesLeft !== undefined && estimate.minutesLeft < 10
}

export function formatDuration(minutes: number) {
  const rounded = Math.max(1, Math.round(minutes))
  if (rounded < 60) return `${rounded} min`
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export function formatKm(km: number) {
  return km < 10 ? `${Math.max(0, km).toFixed(1)} km` : `${Math.round(km)} km`
}

/** One plain line for the trip screens, or undefined when the route has no numbers yet. */
export function estimateText(estimate: TripEstimate, inTransit: boolean) {
  if (inTransit && estimate.minutesLeft !== undefined) {
    if (estimate.minutesLeft <= 0 || estimate.progress === 1) return "Arriving now"
    const parts = [`About ${formatDuration(estimate.minutesLeft)} to arrival`]
    if (estimate.kmLeft !== undefined) parts.push(`${formatKm(estimate.kmLeft)} left`)
    return parts.join(" · ")
  }
  const parts = []
  if (estimate.totalKm !== undefined) parts.push(`${formatKm(estimate.totalKm)} trip`)
  if (estimate.totalMinutes !== undefined)
    parts.push(`about ${formatDuration(estimate.totalMinutes)} on the road`)
  if (!parts.length) return undefined
  const text = parts.join(", ")
  return text[0].toUpperCase() + text.slice(1)
}
