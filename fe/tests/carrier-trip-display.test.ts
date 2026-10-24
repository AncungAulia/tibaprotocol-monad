import { test } from "node:test"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { scenarios } from "../src/dev/preview/scenarios"
import { ReadyToGetPaid, TripFacts, TripPaid } from "../src/modules/carrier/components/TripPresentation"

test("carrier payout keeps the 97.5% amount, blocks pending actions and shows only available receipt data", () => {
  const shipment = scenarios.carrier.shipments!.find((s) => s.id === "1043")!
  const ready = renderToStaticMarkup(createElement(ReadyToGetPaid, {
    shipment: { ...shipment, amount: 300_000_000n }, pending: true, onPay: () => {},
  }))
  assert.match(ready, /292\.50/)
  assert.match(ready, /disabled=""/)
  assert.match(ready, /Waiting for wallet/)
  const paid = renderToStaticMarkup(createElement(TripPaid, { amount: 300_000_000n, direct: true }))
  assert.match(paid, /300\.00/)
  assert.match(paid, /paid you directly/)
  assert.doesNotMatch(paid, /View receipt|under a second/)
  const facts = renderToStaticMarkup(createElement(TripFacts, { shipment: { ...shipment, trip: undefined } }))
  assert.match(facts, /Shipping fee/)
  assert.doesNotMatch(facts, /Shipping company|Dewi|Invalid Date/)
})
