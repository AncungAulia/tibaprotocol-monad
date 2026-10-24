import { test } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { homeShipmentRows } from "../src/modules/payer/data/shipment"
import { Status } from "../src/lib/contracts"
import type { Shipment, Place } from "../src/lib/types"
import { mapJourneys } from "../src/lib/map-journeys"
import { ButtonLink } from "../src/components/elements/Button"
import { StatusChip } from "../src/components/elements/StatusChip"

test("home tabs separate created shipments, current work and history", () => {
  const rows = [
    Status.APPROVED,
    Status.IN_TRANSIT,
    Status.DELIVERED,
    Status.FINANCED,
    Status.DISPUTED,
    Status.REPAID,
  ].map((status) => ({ status }) as Shipment)
  assert.deepEqual(
    homeShipmentRows(rows, "Created").map((s) => s.status),
    [Status.APPROVED],
  )
  assert.deepEqual(
    homeShipmentRows(rows, "History").map((s) => s.status),
    [Status.REPAID],
  )
  assert.deepEqual(
    homeShipmentRows(rows, "Active").map((s) => s.status),
    [Status.IN_TRANSIT, Status.DELIVERED, Status.FINANCED, Status.DISPUTED],
  )
})

test("fleet map keeps each route and truck separate and removes missing locations", () => {
  const pickup = { lat: 0, lng: 0 } as Place,
    destination = { lat: 2, lng: 2 } as Place
  const now = Date.parse("2026-10-23T12:00:00Z")
  const data = mapJourneys(
    [
      {
        pickup,
        destination,
        location: { lat: 1, lng: 1, recorded_at: new Date(now).toISOString() },
      },
      { pickup, destination, location: { lat: 1, lng: 1, recorded_at: "invalid" } },
    ],
    now,
  )
  assert.equal(data.routes.features.length, 2)
  assert.equal(new Set(data.markers.map((m) => m.id)).size, 6)
  assert.deepEqual(data.travelled.features[0].geometry.coordinates, [
    [0, 0],
    [1, 1],
  ])
  assert.deepEqual(
    data.markers.filter((m) => m.kind === "Truck").map((m) => m.paused),
    [false, true],
  )
  assert.equal(mapJourneys([{ pickup, destination }], now).markers.length, 2)
  assert.deepEqual(mapJourneys([], now).routes.features, [])
})

test("map rejects invalid coordinates instead of placing a fabricated marker", () => {
  const data = mapJourneys([
    {
      pickup: { lat: NaN, lng: 0 } as Place,
      destination: { lat: 2, lng: 999 } as Place,
      location: { lat: Infinity, lng: 1, recorded_at: "invalid" },
    },
  ])
  assert.deepEqual(data.markers, [])
  assert.deepEqual(data.routes.features[0].geometry.coordinates, [])
})

test("styled navigation remains a link to the existing confirmation flow", () => {
  const markup = renderToStaticMarkup(
    createElement(ButtonLink, { href: "/carrier/trips/1041" }, "Confirm pickup"),
  )
  assert.match(markup, /href="\/carrier\/trips\/1041"/)
  assert.doesNotMatch(markup, /<button/)
})

test("status labels match the design without changing their contract values", () => {
  for (const [status, label] of [
    [Status.IN_TRANSIT, "In transit"],
    [Status.DELIVERED, "Delivered"],
    [Status.FINANCED, "Paid early"],
    [Status.DISPUTED, "Problem reported"],
  ] as const)
    assert.match(renderToStaticMarkup(createElement(StatusChip, { status })), new RegExp(label))
})
