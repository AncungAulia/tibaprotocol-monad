import type { Trip } from "./types"
import { travelledCoordinates } from "./map-route"

type Journey = Pick<Trip, "pickup" | "destination" | "route_geojson" | "location">
export function mapJourneys(journeys: Journey[], now = Date.now()) {
  const routes = journeys.map((trip) => {
    const route = trip.route_geojson
    const coordinates = (
      route
        ? route.type === "Feature"
          ? route.geometry.coordinates
          : route.coordinates
        : trip.pickup && trip.destination
          ? [
              [trip.pickup.lng, trip.pickup.lat],
              [trip.destination.lng, trip.destination.lat],
            ]
          : []
    ).filter(
      (p) =>
        p.length >= 2 &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]) &&
        Math.abs(p[0]) <= 180 &&
        Math.abs(p[1]) <= 90,
    )
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: coordinates.length >= 2 ? coordinates : [],
      },
    }
  })
  const travelled = routes.map((feature, index) => ({
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: journeys[index].location
        ? travelledCoordinates(feature.geometry.coordinates, [
            journeys[index].location!.lng,
            journeys[index].location!.lat,
          ])
        : [],
    },
  }))
  const markers = journeys.flatMap((trip, index) =>
    (
      [
        ["Pickup", trip.pickup],
        ["Destination", trip.destination],
        ["Truck", trip.location],
      ] as const
    ).flatMap(([kind, point]) =>
      point &&
      Number.isFinite(point.lng) &&
      Number.isFinite(point.lat) &&
      Math.abs(point.lng) <= 180 &&
      Math.abs(point.lat) <= 90
        ? [
            {
              id: `${index}-${kind}`,
              kind,
              position: [point.lng, point.lat] as [number, number],
              paused:
                !trip.location?.recorded_at ||
                !Number.isFinite(Date.parse(trip.location.recorded_at)) ||
                now - Date.parse(trip.location.recorded_at) > 600000,
            },
          ]
        : [],
    ),
  )
  return {
    routes: { type: "FeatureCollection" as const, features: routes },
    travelled: { type: "FeatureCollection" as const, features: travelled },
    markers,
  }
}
