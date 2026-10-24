import type { Trip } from "./types"

type Position = [number, number]

/** Great-circle distance in km between two [lng, lat] points. */
function distanceKm(a: number[], b: number[]) {
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLng = (b[0] - a[0]) * rad
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Share of the demo trip done at `now`, from the verified pickup time. 0 to 1. */
export function simulationProgress(
  simulation: NonNullable<Trip["simulation"]>,
  now = Date.now(),
): number {
  const start = Date.parse(simulation.startedAt)
  if (!Number.isFinite(start) || simulation.durationSec <= 0) return 0
  return Math.max(0, Math.min(1, (now - start) / (simulation.durationSec * 1000)))
}

/**
 * The point `progress` of the way along the road, measured by distance (not by segment count),
 * and the road behind it for the travelled line. Same idea as @turf/along in be.
 */
export function pointAlong(route: number[][], progress: number) {
  if (route.length < 2) return undefined
  const legs = route.slice(1).map((point, index) => distanceKm(route[index], point))
  const total = legs.reduce((sum, leg) => sum + leg, 0)
  let remaining = total * Math.max(0, Math.min(1, progress))
  for (let index = 0; index < legs.length; index++) {
    if (remaining <= legs[index] || index === legs.length - 1) {
      const t = legs[index] ? Math.min(1, remaining / legs[index]) : 0
      const [start, end] = [route[index], route[index + 1]]
      const position: Position = [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
      ]
      return { position, travelled: [...route.slice(0, index + 1), position] }
    }
    remaining -= legs[index]
  }
}

/** Ease-out move from one GPS fix to the next, so the truck glides instead of jumping. */
export function glide(from: Position, to: Position, elapsedMs: number, durationMs = 1000): Position {
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs))
  const eased = 1 - (1 - t) ** 3
  return [from[0] + (to[0] - from[0]) * eased, from[1] + (to[1] - from[1]) * eased]
}
