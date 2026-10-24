import { env } from "../config/env.js"
import { logger } from "./logger.js"

export interface LatLng {
  lat: number
  lng: number
}

export interface RouteResult {
  /** GeoJSON LineString, coordinates in [lng, lat] order. */
  geometry: { type: "LineString"; coordinates: [number, number][] }
  distanceKm: number
  durationMin: number | null
  source: "ors" | "straight_line"
}

const ORS_BASE = "https://api.openrouteservice.org/v2/directions"
const PROFILES = ["driving-hgv", "driving-car"] as const
const ORS_TIMEOUT_MS = 8_000

interface OrsFeatureCollection {
  features?: Array<{
    geometry?: { type?: string; coordinates?: [number, number][] }
    properties?: { summary?: { distance?: number; duration?: number } }
  }>
}

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function straightLine(from: LatLng, to: LatLng): RouteResult {
  return {
    geometry: {
      type: "LineString",
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    },
    distanceKm: round(haversineKm(from, to), 2),
    durationMin: null,
    source: "straight_line",
  }
}

async function fetchOrs(profile: string, from: LatLng, to: LatLng, apiKey: string) {
  const response = await fetch(`${ORS_BASE}/${profile}/geojson`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      Accept: "application/geo+json, application/json",
    },
    body: JSON.stringify({
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    }),
    signal: AbortSignal.timeout(ORS_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`ORS ${profile} responded ${response.status}: ${await response.text()}`)
  }

  const data = (await response.json()) as OrsFeatureCollection
  const feature = data.features?.[0]
  const coordinates = feature?.geometry?.coordinates
  const distance = feature?.properties?.summary?.distance
  if (feature?.geometry?.type !== "LineString" || !coordinates?.length || distance === undefined) {
    throw new Error(`ORS ${profile} returned no usable route`)
  }

  const duration = feature.properties?.summary?.duration
  return {
    geometry: { type: "LineString" as const, coordinates },
    distanceKm: round(distance / 1000, 2),
    durationMin: duration === undefined ? null : round(duration / 60, 1),
    source: "ors" as const,
  }
}

/**
 * Road route from OpenRouteService (truck profile first, then car).
 * Falls back to a straight line so trip creation never fails because of routing.
 */
export async function getRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  const apiKey = env.ORS_API_KEY
  if (!apiKey) {
    logger.warn("ORS_API_KEY is not set; storing a straight-line route")
    return straightLine(from, to)
  }

  for (const profile of PROFILES) {
    try {
      return await fetchOrs(profile, from, to, apiKey)
    } catch (err) {
      logger.warn({ err, profile }, "OpenRouteService request failed")
    }
  }
  return straightLine(from, to)
}

function round(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}
