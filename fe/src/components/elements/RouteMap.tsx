"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { Map as MapType, GeoJSONSource } from "maplibre-gl"
import type { Place, TruckLocation, Trip } from "@/lib/types"
import { mapJourneys } from "@/lib/map-journeys"
import { travelledCoordinates } from "@/lib/map-route"
import { glide, pointAlong, simulationProgress } from "@/lib/truck-position"
import { cn } from "@/lib/utils"

type Position = [number, number]
/** A truck that moves on its own: a demo trip timed from pickup, or GPS pushed over Realtime. */
type LiveJourney = {
  route: number[][]
  simulation: Trip["simulation"]
  channel: string | null
  location?: TruckLocation
}
const isLive = (trip: Pick<Trip, "simulation" | "channel">) => !!trip.simulation || !!trip.channel

function truckElement() {
  const element = document.createElement("div")
  element.setAttribute("aria-label", "Truck")
  element.className = "tiba-map-truck"
  const image = document.createElement("img")
  image.src = "/illustrations/role-carrier.svg"
  image.alt = ""
  element.append(image)
  return element
}

type Point = Pick<Place, "lat" | "lng" | "name">
export function RouteMap({
  pickup,
  destination,
  route,
  location,
  simulation,
  channel,
  trips,
  onPinChange,
  className,
  fleetLabel = false,
  label,
}: {
  pickup?: Point
  destination?: Point
  route?: Trip["route_geojson"]
  location?: TruckLocation
  /** Demo trip clock from be: the truck moves along the route by itself. */
  simulation?: Trip["simulation"]
  /** Realtime Broadcast topic for live GPS. */
  channel?: string | null
  trips?: Trip[]
  onPinChange?: (lat: number, lng: number) => void
  className?: string
  fleetLabel?: boolean
  label?: ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapType | null>(null)
  const pinHandler = useRef(onPinChange)
  pinHandler.current = onPinChange
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let disposed = false
    import("maplibre-gl")
      .then((library) => {
        if (disposed || !container.current) return
        const instance = new library.Map({
          container: container.current,
          center: [110.37, -7.5],
          zoom: 8,
          attributionControl: { compact: true },
          style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        })
        map.current = instance
        instance.addControl(new library.NavigationControl({ showCompass: false }), "top-right")
        instance.on("load", () => {
          if (!disposed) setReady(true)
        })
        instance.on("error", () => {
          if (!disposed) setFailed(true)
        })
        instance.on("click", (event) => pinHandler.current?.(event.lngLat.lat, event.lngLat.lng))
      })
      .catch(() => {
        if (!disposed) setFailed(true)
      })
    return () => {
      disposed = true
      map.current?.remove()
      map.current = null
    }
  }, [])
  const fitted = useRef(false)
  const pinMode = !!onPinChange
  const pickupLat = pickup?.lat,
    pickupLng = pickup?.lng,
    destinationLat = destination?.lat,
    destinationLng = destination?.lng
  const truckLat = location?.lat,
    truckLng = location?.lng,
    recordedAt = location?.recorded_at
  const simStart = simulation?.startedAt,
    simDuration = simulation?.durationSec
  const singleLive = !!simStart || !!channel
  const [arrived, setArrived] = useState(false)
  const liveFresh = useMemo<LiveJourney[]>(() => {
    const journeys = trips
      ? trips.filter(isLive)
      : singleLive
        ? [
            {
              pickup:
                pickupLat !== undefined && pickupLng !== undefined
                  ? ({ lat: pickupLat, lng: pickupLng } as Place)
                  : undefined,
              destination:
                destinationLat !== undefined && destinationLng !== undefined
                  ? ({ lat: destinationLat, lng: destinationLng } as Place)
                  : undefined,
              route_geojson: route,
              simulation:
                simStart && simDuration ? { startedAt: simStart, durationSec: simDuration } : null,
              channel: channel ?? null,
              location:
                truckLat !== undefined && truckLng !== undefined
                  ? { lat: truckLat, lng: truckLng, recorded_at: recordedAt ?? "" }
                  : undefined,
            },
          ]
        : []
    return journeys.flatMap((trip) => {
      const coordinates = mapJourneys([{ ...trip, location: undefined }]).routes.features[0]
        .geometry.coordinates
      return coordinates.length >= 2
        ? [
            {
              route: coordinates,
              simulation: trip.simulation ?? null,
              channel: trip.channel ?? null,
              location: trip.location,
            },
          ]
        : []
    })
  }, [
    trips,
    singleLive,
    route,
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
    simStart,
    simDuration,
    channel,
    truckLat,
    truckLng,
    recordedAt,
  ])
  // Parents rebuild `trips` on every refetch; only restart the animation when a truck really changes
  const liveKey = JSON.stringify(
    liveFresh.map((j) => [
      j.simulation,
      j.channel,
      j.route.length,
      j.route[0],
      j.route[j.route.length - 1],
      j.location?.recorded_at,
    ]),
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const live = useMemo(() => liveFresh, [liveKey])
  const multi = !!trips
  useEffect(() => {
    const instance = map.current
    if (!ready || !instance) return
    let disposed = false
    const cleanup: (() => void)[] = []
    import("maplibre-gl")
      .then((library) => {
        if (disposed) return
        const data = mapJourneys(
          trips?.map((trip) => (isLive(trip) ? { ...trip, location: undefined } : trip)) ?? [
            {
              pickup:
                pickupLat !== undefined && pickupLng !== undefined
                  ? ({ lat: pickupLat, lng: pickupLng, name: "Pickup" } as Place)
                  : undefined,
              destination:
                destinationLat !== undefined && destinationLng !== undefined
                  ? ({ lat: destinationLat, lng: destinationLng, name: "Destination" } as Place)
                  : undefined,
              route_geojson: route,
              location:
                !singleLive && truckLat !== undefined && truckLng !== undefined
                  ? { lat: truckLat, lng: truckLng, recorded_at: recordedAt ?? "" }
                  : undefined,
            },
          ],
        )
        for (const [id, features, color] of [
          ["route", data.routes, "#BDBDBB"],
          ["travelled", data.travelled, "#FFC21A"],
        ] as const) {
          const source = instance.getSource(id) as GeoJSONSource | undefined
          if (source) source.setData(features)
          else {
            instance.addSource(id, { type: "geojson", data: features })
            instance.addLayer(
              {
                id,
                type: "line",
                source: id,
                layout: { "line-cap": "round", "line-join": "round" },
                paint: { "line-color": color, "line-width": 6 },
              },
              // keep the live travelled line on top
              instance.getLayer("travelled-live") ? "travelled-live" : undefined,
            )
          }
        }
        const bounds = new library.LngLatBounds()
        for (const point of data.markers) {
          const element = document.createElement("div")
          element.setAttribute("aria-label", point.kind)
          element.className =
            point.kind === "Truck"
              ? `tiba-map-truck ${point.paused ? "is-paused" : ""}`
              : point.kind === "Destination"
                ? "tiba-map-destination"
                : "tiba-map-pickup"
          if (point.kind === "Truck") {
            const image = document.createElement("img")
            image.src = "/illustrations/role-carrier.svg"
            image.alt = ""
            element.append(image)
          } else if (point.kind === "Destination") element.textContent = "■"
          const marker = new library.Marker({
            element,
            draggable: point.kind === "Destination" && pinMode,
          })
            .setLngLat(point.position)
            .setPopup(new library.Popup().setText(point.kind))
            .addTo(instance)
          marker.on("dragend", () => {
            const p = marker.getLngLat()
            pinHandler.current?.(p.lat, p.lng)
          })
          cleanup.push(() => marker.remove())
          bounds.extend(point.position)
        }
        if (!fitted.current && data.markers.length) {
          instance.fitBounds(bounds, { padding: 55, maxZoom: 13, duration: 0 })
          fitted.current = true
        } else if (
          pinMode &&
          destinationLng !== undefined &&
          destinationLat !== undefined &&
          !instance.getBounds().contains([destinationLng, destinationLat])
        )
          instance.setCenter([destinationLng, destinationLat])
      })
      .catch(() => {
        if (!disposed) setFailed(true)
      })
    return () => {
      disposed = true
      cleanup.forEach((remove) => remove())
    }
  }, [
    ready,
    trips,
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
    truckLat,
    truckLng,
    recordedAt,
    route,
    pinMode,
    singleLive,
  ])
  useEffect(() => {
    const instance = map.current
    if (!ready || !instance || !live.length) return
    let disposed = false,
      frame = 0,
      timer: ReturnType<typeof setTimeout> | undefined,
      lastLine = 0
    const cleanup: (() => void)[] = []
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    import("maplibre-gl")
      .then((library) => {
        if (disposed) return
        const trucks = live.map((journey) => {
          const start: Position = journey.simulation
            ? (pointAlong(journey.route, simulationProgress(journey.simulation))?.position ??
              (journey.route[0] as Position))
            : journey.location
              ? [journey.location.lng, journey.location.lat]
              : (journey.route[0] as Position)
          const marker = new library.Marker({ element: truckElement() })
            .setLngLat(start)
            .addTo(instance)
          cleanup.push(() => marker.remove())
          return { journey, marker, from: start, to: start, since: 0, position: start }
        })
        const empty = { type: "FeatureCollection" as const, features: [] }
        if (!instance.getSource("travelled-live")) {
          instance.addSource("travelled-live", { type: "geojson", data: empty })
          instance.addLayer({
            id: "travelled-live",
            type: "line",
            source: "travelled-live",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#FFC21A", "line-width": 6 },
          })
        }
        const source = instance.getSource("travelled-live") as GeoJSONSource
        cleanup.push(() => source.setData(empty))

        // Live GPS: each fix arrives over Realtime Broadcast and the truck glides to it
        const gps = trucks.filter((truck) => !truck.journey.simulation && truck.journey.channel)
        if (gps.length)
          import("@/lib/supabase")
            .then(({ supabase }) => {
              if (disposed) return
              for (const truck of gps) {
                const topic = supabase
                  .channel(truck.journey.channel!)
                  .on("broadcast", { event: "location" }, ({ payload }) => {
                    const lat = Number(payload?.lat),
                      lng = Number(payload?.lng)
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
                    truck.from = truck.position
                    truck.to = [lng, lat]
                    truck.since = Date.now()
                    tick()
                  })
                  .subscribe()
                cleanup.push(() => void supabase.removeChannel(topic))
              }
            })
            .catch(() => undefined)

        function tick() {
          if (disposed) return
          cancelAnimationFrame(frame)
          clearTimeout(timer)
          const now = Date.now()
          let moving = false,
            arrivedAll = true
          const lines = trucks.map((truck) => {
            const { journey } = truck
            let travelled: number[][] = []
            if (journey.simulation) {
              const progress = simulationProgress(journey.simulation, now)
              const point = pointAlong(journey.route, progress)
              if (point) {
                truck.position = point.position
                travelled = point.travelled
              }
              if (progress < 1) {
                moving = true
                arrivedAll = false
              }
            } else {
              arrivedAll = false
              truck.position = calm ? truck.to : glide(truck.from, truck.to, now - truck.since)
              if (now - truck.since < 1000) moving = true
              travelled = travelledCoordinates(journey.route, truck.position)
            }
            truck.marker.setLngLat(truck.position)
            return {
              type: "Feature" as const,
              properties: {},
              geometry: { type: "LineString" as const, coordinates: travelled },
            }
          })
          // Redrawing a long road line every frame is wasteful; four times a second looks the same
          if (now - lastLine > 250 || !moving) {
            source.setData({ type: "FeatureCollection", features: lines })
            lastLine = now
          }
          if (!multi) setArrived(arrivedAll && !!trucks[0]?.journey.simulation)
          if (moving) {
            if (calm) timer = setTimeout(tick, 1000)
            else frame = requestAnimationFrame(tick)
          }
        }
        tick()
      })
      .catch(() => {
        if (!disposed) setFailed(true)
      })
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      cleanup.forEach((remove) => remove())
    }
  }, [ready, live, multi])
  const paused =
    !recordedAt ||
    !Number.isFinite(Date.parse(recordedAt)) ||
    Date.now() - Date.parse(recordedAt) > 600000
  const simulated =
    !!simStart ||
    location?.source === "simulated" ||
    trips?.some((trip) => !!trip.simulation || trip.location?.source === "simulated")
  return (
    <div className="relative overflow-hidden rounded-md bg-[#ececea]">
      <div
        ref={container}
        role="region"
        aria-label={trips ? "Active shipment map" : "Shipment route map"}
        className={cn("h-[320px] w-full", className)}
      />
      {(!fleetLabel || !trips || trips.length > 0) && (
        <span className="absolute top-3 left-3 max-w-[calc(100%-72px)] rounded-full bg-surface px-3 py-2 text-caption shadow-float">
          {failed ? (
            "Map unavailable. Trip details are still available."
          ) : pinMode ? (
            "Drag the pin or tap to choose a location"
          ) : label ? (
            label
          ) : trips ? (
            fleetLabel ? (
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-success" aria-hidden />
                {trips.length} {trips.length === 1 ? "truck" : "trucks"} moving
              </span>
            ) : (
              `${trips.length} active ${trips.length === 1 ? "shipment" : "shipments"}`
            )
          ) : simStart ? (
            arrived ? (
              `Arrived at ${destination?.name ?? "the destination"}. Waiting for the warehouse to confirm.`
            ) : (
              "On the road"
            )
          ) : channel ? (
            "Live location"
          ) : location ? (
            paused ? (
              "Location paused"
            ) : (
              "Recent location"
            )
          ) : route ? (
            "Route preview"
          ) : (
            "Direct route preview"
          )}
        </span>
      )}
      {simulated && !pinMode && (
        <span className="absolute bottom-9 left-3 rounded-full bg-surface px-3 py-2 text-caption shadow-float sm:bottom-3">
          Demo · simulated location
        </span>
      )}
    </div>
  )
}
