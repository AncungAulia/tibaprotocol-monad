import { test } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { RouteMap } from "../src/components/elements/RouteMap"

test("single-trip and fleet maps disclose simulated locations", () => {
  const location = {
    lat: -7,
    lng: 110,
    recorded_at: new Date().toISOString(),
    source: "simulated" as const,
  }
  assert.match(
    renderToStaticMarkup(createElement(RouteMap, { location })),
    /Demo · simulated location/,
  )
  assert.match(
    renderToStaticMarkup(
      createElement(RouteMap, {
        trips: [
          { shipment_id: "1", pickup_place: "p", destination_place: "d", cargo: "Rice", location },
        ],
      }),
    ),
    /Demo · simulated location/,
  )
  assert.doesNotMatch(
    renderToStaticMarkup(createElement(RouteMap, { location: { ...location, source: "gps" } })),
    /Demo · simulated location/,
  )
})
